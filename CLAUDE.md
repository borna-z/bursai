# BURS — Repository context

## LAUNCH MODE — until 2026-05-31

**Ship-only freeze.** Until 2026-05-31, the only acceptable work is whatever moves App Store + Play Store submission forward.

- No refactors, no new features, no non-launch waves.
- Bug fixes scoped to crash-or-blocker only.
- The active sprint plan is `docs/launch/may-2026-sprint/00-overview.md`. Read it before picking up work.
- Plan A (launch) is in-session. Plan B (Meta Ads agent) is owned by co-founders' Claude sessions — out of scope for this session. Plan C (marketing dashboard) execution does not start until 2026-05-31.
- If asked to do non-A work in this session, decline with a pointer to the sprint overview and ask if the user wants to override the freeze.

Remove this block after 2026-05-31 launch is shipped.

---

Mobile is the primary product. The web `src/` tree exists but is being deleted post-launch — type imports are fine, runtime imports drag web-only code in.

## Current sprint

The May 2026 launch sprint plan is at `docs/launch/may-2026-sprint/00-overview.md` (Plans A / B / C).

| Field | Value |
|---|---|
| **CURRENT** | Plan A — App Store + Play Store submission by 2026-05-31 |
| **REMAINING WORK** | M3 store-asset content drafts (Claude-owned: copy, privacy declarations, reviewer demo). M43 (Apple Developer + first EAS build, external setup). M44 (RevenueCat sandbox + submission, external setup). M45/M46 device verification (Borna). |
| **CODE-COMPLETE THROUGH** | PR #882 (2026-05-17) — all M0–M46 + Waves R / S / T / Q / G / N (through N21) / modularization Phases 0–6 merged |
| **AUDIT** | `docs/launch/may-2026-sprint/_audit-2026-05-17.md` |

For per-wave context see `docs/launch/waves/m45-*.md`, `m46-*.md`, `m43-apple-eas.md`, `m44-revenuecat-sandbox-submission.md`.

## How this repo works

- Mobile RN + Expo app at `mobile/`
- Edge functions at `supabase/functions/` (Deno runtime, ESM URL imports)
- Web React/Vite app at `src/` — **runtime imports forbidden from mobile**; type imports allowed
- All PRs target `main` (user direction 2026-05-06; the prior `feat/mobile-rn-app` launch-branch policy is retired)
- Supabase project ref: `khvkwojtlkcvxjxztduj` (region: `eu-central-1`)
- Working directory: `C:\Users\borna\OneDrive\Desktop\BZ\Burs\bursai-working`

## Per-PR workflow

1. Read `docs/launch/overview.md` → find CURRENT WAVE pointer
2. Read the single wave file in `docs/launch/waves/`
3. Read only files named in the wave's "Files touched" section
4. Implement → CI green (V0 gates) → code-reviewer subagent → push → tracker updates

The wave file is self-contained. Don't read sibling wave files.

## Migration discipline

- Never run a DB migration without the user explicitly asking
- Never `apply_migration` via MCP without committing the matching `supabase/migrations/<timestamp>_<name>.sql` file in the same PR — timestamp must equal the one MCP recorded on the remote
- After merging a PR with migrations: `npx supabase db push --linked --yes` from main
- Backdated migrations (drift repair) require `--include-all` and idempotency review — see `_archive/standing-rules.md` if needed
- Secrets in cron bodies live in `vault.secrets`, never custom GUCs (any authenticated user can read GUC values)
- Endpoint URLs in cron bodies also live in `vault.secrets` so preview branches don't post to production

## Edge function deploy

```bash
npx supabase functions deploy <name> --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

Deploy one function at a time. Never `deploy --all`. Shared module changes (`_shared/*.ts`) require redeploying every dependent function.

## Hard rules

- Never push directly to main
- Never merge PRs from within Claude Code — merging is the user's decision after testing
- Never add new edge functions unless the wave file authorizes them (M31 ships `revenuecat_webhook`; M30 modifies `send_push_notification`; anything else needs explicit user approval)
- Never delete DB schema fields
- Never edit `src/integrations/supabase/types.ts` (auto-generated)
- `src/i18n/locales/{en,sv}.ts` and `mobile/src/i18n/locales/*` are append-only
- Never use `getClaims()` in edge functions — use `getUser()`
- Never use `localStorage` / `sessionStorage` in React artifacts — use React state

## Pointers

- Wave plan: `docs/launch/overview.md`
- Mobile context: `mobile/CLAUDE.md`
- Findings log: `docs/launch/findings-log.md`
- Completion log: `docs/launch/completion-log.md`
- CI workflow: `.github/workflows/mobile-ci.yml` (created in V0)
- Old planning artifacts: `docs/launch/_archive/`

## Project facts (terse)

| Field | Value |
|---|---|
| App | BURS — AI-powered wardrobe management and personal stylist |
| Repo | borna-z/bursai |
| Distribution | React Native + Expo SDK 54 (App Store + Play Store) |
| Backend | Supabase (PostgreSQL + edge functions) |
| AI | Gemini API via OpenAI-compatible endpoint |
| Launch market | Sweden first, then Nordics/UK/Netherlands |
| Pricing | 119 SEK/month, 899 SEK/year |
| Domain | burs.me |
| SMTP | Resend (do NOT use IONOS) |
| iOS payments | StoreKit only via RevenueCat (M31) |
| Web payments | Stripe (existing; web only) |
