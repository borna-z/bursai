# Plan B — Meta Ads Autonomous Marketing Agent

**This document is the complete handoff for the co-founders' Claude sessions. It is self-contained on purpose — readers do not need access to the BURS codebase, `CLAUDE.md`, or the mobile launch wave docs to execute it.**

**Owner:** Co-founders (lead engineer + product) + their Claude sessions.
**Window:** Begins post-2026-05-31 BURS launch. MB1 → MB4 target ~4 weeks.
**Definition of done:** Autonomous agent reads Meta Ads insights daily, drafts creative variants, publishes campaigns within guardrails, and reallocates budget within bounds — all visible in an audit log, gated by a kill switch.

---

## 1. Product brief — what BURS is

BURS is an AI-powered wardrobe-management and personal-stylist mobile app (React Native + Expo, App Store + Play Store).

- **Target market:** Sweden first → Nordics (NO, DK, FI, IS) → UK → Netherlands.
- **Pricing:** 119 SEK/month or 899 SEK/year (single subscription tier, "premium").
- **Audience hypothesis:** style-conscious adults 22–45 who already own clothes they don't fully use. The product helps them photograph their wardrobe, generate outfits, plan travel capsules, and chat with an AI stylist.
- **Differentiator:** AI stylist sees your *actual* wardrobe, not a generic catalog.
- **Brand voice:** confident, warm, low-jargon, fashion-literate without being snobby. Swedish-readable copy first, English second.
- **What we do not say:** no body-shape critique, no "you need to buy", no scarcity tactics, no AI-generated photorealistic people in ads (use product UI + lifestyle stock).
- **Domain:** `burs.me`.

The agent uses this brief to draft on-brand creative without needing the codebase.

## 2. Scope of autonomy

**Allowed:**
- Read Meta Ads insights (impressions, clicks, spend, conversions).
- Draft ad creative (headline, primary text, description) and variants.
- Publish campaigns / ad sets / ads (gated — see §4).
- Reallocate budget across existing ad sets within configured bounds.
- Pause underperforming ads against pre-agreed metrics.

**Not allowed:**
- Open new ad accounts, change billing methods, or modify Meta Business Manager settings.
- Create campaigns above the per-campaign daily budget ceiling (config — co-founder-set).
- Move budget by more than the daily reallocation cap (config).
- Publish creative containing generated photorealistic people.
- Bypass the kill switch.

## 3. Meta API surface

**Marketing API (Graph API v20+):**
- `POST /act_{ad_account_id}/campaigns` — create campaign.
- `POST /act_{ad_account_id}/adsets` — create ad set.
- `POST /act_{ad_account_id}/ads` — create ad.
- `POST /act_{ad_account_id}/adcreatives` — create creative.
- `GET /act_{ad_account_id}/insights?fields=...&date_preset=...` — read performance.
- `POST /{ad_id}` / `POST /{adset_id}` / `POST /{campaign_id}` — update (status, budget).

**Required Meta Business Manager setup (co-founders, one-time):**
1. Meta Business Manager account at `business.facebook.com`.
2. Add ad account to Business Manager.
3. Create a System User in Business Manager → Business Settings → Users → System Users.
4. Grant System User permissions on the ad account: `ads_management`, `ads_read`, `business_management`.
5. Generate a long-lived access token for the System User (Never Expires).
6. Store token in agent's secret store (e.g. Supabase `vault.secrets`, Vercel env, or 1Password).

**Mobile-side Pixel + Conversions API (already shipped by BURS Plan A M2):**
The mobile app fires:
- `fb_mobile_first_app_launch` (install)
- `StartTrial` (free trial start)
- `Subscribe` (paid conversion, with `value` and `currency` SEK)

Server-side Conversions API in `supabase/functions/revenuecat_webhook` mirrors `Subscribe` for attribution accuracy. The agent reads these via Insights API once Meta has matched them to ad clicks.

## 4. Account-safety guardrails (non-negotiable)

A Meta ad account can be suspended within hours if an automated client misbehaves. These guardrails are not optional:

| Guardrail | Default | Where enforced |
|---|---|---|
| Daily mutation cap | 20 API writes / 24h across all entities | Agent middleware before every POST |
| Per-campaign daily budget ceiling | Co-founder-set (e.g. €50/day) | Agent rejects creates exceeding ceiling |
| Daily reallocation cap | ≤25% of any ad set's daily budget per day | Agent middleware |
| New-creative human approval | All new creative for first 30 days | Approval-queue table (see §5) |
| Kill switch | Boolean in Supabase config table | Agent first call on every run; exit if false |
| Append-only audit log | Every API request + response + decision | Postgres table `meta_agent_audit_log` |
| Sandbox mode (week 1 only) | Read-only insights; drafts to file | Config flag `agent_mode = 'sandbox'` |

If any guardrail trips, the agent logs and exits without attempting workaround.

## 5. Architecture

**High level:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Cron trigger (daily / hourly)                                   │
└──────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  Orchestrator job                                                │
│  1. Read kill switch from Postgres                               │
│  2. If alive: fetch yesterday's insights (Meta API)              │
│  3. Hand insights + product brief to Claude (cached prompt)      │
│  4. Claude proposes actions: { drafts, mutations, alerts }       │
│  5. Validate against guardrails                                  │
│  6. Route: drafts → approval_queue; mutations → Meta API         │
│  7. Log every step to meta_agent_audit_log                       │
└──────────────────────────────────────────────────────────────────┘
                 │
                 ├──→ Supabase: agent_config, approval_queue, meta_agent_audit_log
                 ├──→ Meta API: read insights, write mutations (gated)
                 └──→ Notification channel (Slack / Email / Discord)
```

**Claude Agent SDK usage:**
- Prompt structure: System (product brief + brand voice + guardrails) → Cached. User (yesterday's insights + today's decision request) → Fresh per run.
- Enable prompt caching on the System block (5-minute TTL — batch each run to complete inside that window).
- Use tool use for `propose_draft`, `propose_mutation`, `propose_pause`, `propose_alert` — never let Claude generate raw API JSON; tools validate first.
- Model recommendation: Claude Sonnet 4.6 for cost efficiency; escalate to Opus 4.7 only if creative quality is insufficient. Per memory: Opus 4.7 = `claude-opus-4-7`, Sonnet 4.6 = `claude-sonnet-4-6`.

**Postgres schema (run as migrations in the chosen Supabase project):**

```sql
-- agent runtime config
create table agent_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
-- seeded with: kill_switch=true, agent_mode='sandbox', daily_mutation_cap=20,
-- per_campaign_daily_ceiling_sek=500, daily_reallocation_cap_pct=25

-- queue of drafts awaiting human approval
create table approval_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('campaign','adset','ad','creative','mutation')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- append-only audit log
create table meta_agent_audit_log (
  id bigserial primary key,
  run_id uuid not null,
  ts timestamptz not null default now(),
  kind text not null,             -- 'kill_switch_check','insights_fetch','claude_decision','meta_write','guardrail_trip','notification'
  request jsonb,
  response jsonb,
  notes text
);
```

## 6. Hosting options

| Option | Pros | Cons |
|---|---|---|
| **(a) Supabase edge functions + pg_cron (recommended)** | Same Postgres as BURS, secrets in `vault.secrets`, no extra infra | Edge function timeout limits long agent runs — chunk by entity |
| (b) Vercel cron + Vercel KV | Generous timeout, simple TypeScript | Separate secrets store, separate data plane |
| (c) Dedicated VM + systemd | Full control, no platform limits | Most ops overhead; needs hardening |

If picking (a): cron is set up via `pg_cron`. Secrets in `vault.secrets`, never custom GUCs (any authenticated user can read GUC values).

## 7. Milestones

| MB | Target | Done when |
|---|---|---|
| **MB1 — Read-only insights** | 2026-06-07 | Agent reads Meta insights once daily. Writes a digest (top campaigns, spend, CPI, conversions) to the chosen notification channel. No writes to Meta. Audit log populated. Kill switch tested (set false → agent exits without action). |
| **MB2 — Draft + human-approval queue** | 2026-06-14 | Agent generates 3–5 creative variants per active campaign and writes them to `approval_queue`. Co-founders approve via a simple admin route or SQL update. Approved creatives still publish manually in MB2 — agent does not write to Meta yet. |
| **MB3 — Gated autonomous publish** | 2026-06-21 | After MB2 stability proven, agent publishes pre-approved templates within guardrails. Daily mutation cap enforced. Per-campaign daily budget ceiling enforced. First publish in production observed live by a co-founder. |
| **MB4 — Budget reallocation** | 2026-06-28 | Agent shifts budget across ad sets within daily reallocation cap. Full kill-switch + audit log reviewed end-to-end. Monthly review cadence agreed (co-founders review audit log weekly for first month, then monthly). |

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Ad account suspension | Guardrails in §4; sandbox week 1; mutation cap; human approval for first 30 days |
| 2 | Runaway spend | Per-campaign daily ceiling; daily reallocation cap; kill switch |
| 3 | Off-brand creative | Brand voice in cached system prompt; first-30-days human approval gate; weekly creative review |
| 4 | Meta API breaking changes | Pin Graph API version explicitly (`v20.0`); subscribe to Meta changelog; integration tests against sandbox account |
| 5 | Claude API outage | Agent treats Claude failure as no-op (log + exit); does not retry indefinitely |
| 6 | Audit log gap | Make `meta_agent_audit_log` writes synchronous with the Meta API call; never fire-and-forget |
| 7 | Token leak | System User token in secret store only, never in code or logs; rotate every 90 days |

## 9. Open decisions for co-founders

These are not decided in this document. The co-founders' first task is to agree on these and write them into `agent_config`:

- **Language:** TypeScript (matches BURS stack) or Python (matches most Claude examples).
- **Hosting:** (a) Supabase + pg_cron, (b) Vercel cron, (c) dedicated VM.
- **Daily budget ceiling per campaign (SEK).**
- **Daily mutation cap** (default 20; adjust by traffic).
- **Notification channel:** Slack workspace + channel, email distribution list, or Discord webhook.
- **First-30-days creative reviewer:** which co-founder, what SLA.
- **Run cadence:** daily once, daily twice, hourly (insights only, mutations daily).
- **Sandbox first?:** yes/no on starting in `agent_mode='sandbox'` for week 1.
- **Languages of ads:** Swedish only at launch, or Swedish + English?

## 10. What this plan does NOT do

- Does not block BURS launch. BURS Plan A ships first; B begins after.
- Does not require any BURS mobile code changes beyond the Pixel + Conversions API already covered in Plan A M2.
- Does not include creative production (photo/video assets) — agent drafts copy and uses pre-approved asset library. Asset production is a separate workstream.
- Does not include landing pages, deep links, or attribution beyond what Pixel + CAPI provide.
