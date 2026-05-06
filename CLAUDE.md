# BURS — Repository context

Mobile is the primary product. The web `src/` tree exists but is being deleted post-launch — type imports are fine, runtime imports drag web-only code in.

## Current wave

| Field | Value |
|---|---|
| **CURRENT WAVE** | M12 — Password reset + deep links |
| **CURRENT WAVE FILE** | `docs/launch/waves/m12-password-reset.md` |
| **STATUS** | TODO |

The current wave pointer is also tracked in `docs/launch/overview.md` and updated via the tracker step in every wave PR.

## How this repo works

- Mobile RN + Expo app at `mobile/`
- Edge functions at `supabase/functions/` (Deno runtime, ESM URL imports)
- Web React/Vite app at `src/` — **runtime imports forbidden from mobile**; type imports allowed
- All mobile PRs target `feat/mobile-rn-app` (never `main`)
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
