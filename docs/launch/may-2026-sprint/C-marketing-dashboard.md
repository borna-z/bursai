# Plan C — Marketing Dashboard Webapp

**Owner:** Borna + Claude.
**Window:** Begins 2026-05-31 (day of BURS launch submission) — does **not** start earlier per the LAUNCH MODE freeze in `CLAUDE.md`. Plan written now so scope is locked.
**Definition of done:** Single-screen ops dashboard at `dash.burs.me` (or chosen subdomain) showing acquisition, revenue, ad performance, and B-agent activity. Restricted to a 3-email allowlist.

## What the dashboard shows

Single screen, four panels. No navigation, no settings page, no admin UI beyond auth.

| # | Panel | Widgets |
|---|---|---|
| 1 | **Acquisition** | Installs 24h / 7d / 30d (Meta Pixel + store consoles). Signups 24h / 7d / 30d (Supabase). Funnel: install → trial start → subscribe. |
| 2 | **Revenue** | MRR. Active trials. Trial→paid conversion rate. Churn (cancellations / active subs). All from RevenueCat. |
| 3 | **Ad performance** | Spend 24h / 7d. CAC. ROAS. Top 5 campaigns by spend with CPI + conversion count. Reads from Plan B's `meta_agent_audit_log` + a derived `insights_daily` materialized view. |
| 4 | **Agent activity** | Last 24h of B's actions: campaigns drafted, mutations published, pending approvals count. Reads B's `approval_queue` + `meta_agent_audit_log`. |

## Stack

**Recommended:** Next.js 15 (App Router) + Supabase Auth + Tailwind, hosted on Vercel.

- Reuses Supabase project (`khvkwojtlkcvxjxztduj`) for auth + data reads.
- Vibe-codeable; ships in days, not weeks.
- Survives past prototype if dashboard grows.

**Auth:** Supabase magic-link. Email allowlist of 3 hardcoded in env (`ALLOWED_EMAILS=borna8688@gmail.com,cofounder1@…,cofounder2@…`). Auth callback rejects any email not in allowlist before session is created.

**Rejected alternatives:**
- Literal Lovable.dev export — fine for the first scaffold but ejecting later is friction; using Next.js directly lands in the same place faster.
- Reuse existing `src/` webapp — `src/` is being deleted post-launch per `CLAUDE.md`. New app, separate repo or `dashboard/` directory.

**Repo layout decision (deferred until MC1):** new repo `burs-dashboard` or `dashboard/` subdirectory in `bursai`. Decide at MC1 kickoff — likely new repo so deployment is independent of mobile.

## Data access

| Source | Method | Caching |
|---|---|---|
| Supabase (signups, subscribers) | `@supabase/ssr` direct query via service role on server side; RLS-respecting on client | None — Supabase is fast enough |
| RevenueCat (revenue, churn) | Server-side fetch of REST API (`api.revenuecat.com/v1`); secret key in env | 5 minutes via Next.js cache |
| Meta Ads insights | Read Plan B's `meta_agent_audit_log` + `insights_daily` materialized view in Supabase | Materialized view refreshed nightly by Plan B's orchestrator |
| Sentry | REST API `sentry.io/api/0/projects/.../stats_v2/` | 15 minutes |

Dashboard never calls Meta API directly — that surface is owned by Plan B.

## Milestones

| MC | Target | Done when |
|---|---|---|
| **MC1 — Scaffold + auth + signups widget** | 2026-06-03 | Next.js app live at chosen subdomain. Supabase magic-link auth restricts to 3-email allowlist (rejected emails see "not authorized" page). One widget rendered: signups 24h / 7d / 30d. Vercel deploy automated from main. |
| **MC2 — Revenue panel** | 2026-06-07 | RevenueCat MRR + active trials + churn widgets live. 5-minute cache. Server-side REST calls. |
| **MC3 — Funnel + ad performance** | 2026-06-14 | Acquisition funnel widget (install → trial → subscribe). Ad performance panel (spend, CAC, ROAS, top 5 campaigns). Requires Plan A M2's Pixel/CAPI events flowing in production for ≥7 days for meaningful data. |
| **MC4 — B agent activity feed** | 2026-06-21 | Reads `approval_queue` (pending count + 5 most recent items) and `meta_agent_audit_log` (last 20 actions). Gated on Plan B reaching MB2. |

## Dependencies on other plans

- **MC3** needs Plan A M2's Pixel + Conversions API events live in production.
- **MC4** needs Plan B's `audit_log` and `approval_queue` tables (created at MB2).
- If B slips, MC4 renders an empty "no agent data yet" placeholder. Dashboard still loads. No hard block.

## Risks + mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Vibe-coded Next.js apps accumulate auth/RLS holes fast | Allowlist + RLS keeps blast radius small. **Manual review pass before any non-allowlisted user can sign in**. Add a manual auth-callback test in MC1. |
| 2 | RevenueCat REST rate limits | Cache aggressively (5min). Backoff on 429. |
| 3 | Scope creep | The four panels are the entire spec. New panels = new mini-spec. No "while we're at it" features. |
| 4 | Materialized view stale | Refresh nightly via Plan B's orchestrator. Show "data as of <timestamp>" on the panel. |
| 5 | Service role key in env leaks | Use service role only in server actions; never expose to client. Rotate after launch. |

## What this plan does NOT do

- No customer-facing analytics or in-app dashboards.
- No alerting or paging. Sentry handles crash alerting; if more alerting is needed, separate spec.
- No mobile-responsive design beyond "works on a laptop screen". This is an ops tool.
- No multi-tenant or role-based access. 3-email allowlist; everyone sees everything.
- No data export. View only. If export needed later, separate spec.
