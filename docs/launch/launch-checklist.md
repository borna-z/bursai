# Launch Checklist (post-M44 cutover)

> Source of truth for the BURS App Store + Play Store launch gate. Each
> checkbox is either green or it isn't — partial credit blocks launch.
>
> Status as of N10 (2026-05-09): pre-M38, web Stripe path marked
> deprecated, mobile RC path live since M31.

## Code gates (must be green on `main`)

- [ ] `mobile-ci.yml` all green: typecheck, lint, test, expo-doctor, bundle-size, smoke-local, deno-check, migration-smoke, migration-drift, build-and-test
  - Run locally with `node scripts/launch-readiness.mjs` (see below)
- [ ] No P0 findings open in `docs/launch/findings/`
- [ ] All migrations from `supabase/migrations/` deployed to prod
  - Verify via `npx supabase db push --linked --yes` from `main`; expected output: "Remote database is up to date." Last shipped migration: `20260509190001_ai_token_usage.sql`
- [ ] Edge functions deployed at SHA matching `main`
  - Functions involved at launch: `analyze_garment`, `burs_style_engine`, `style_chat`, `shopping_chat`, `mood_outfit`, `suggest_outfit_combinations`, `suggest_accessories`, `clone_outfit_dna`, `travel_capsule`, `wardrobe_gap_analysis`, `wardrobe_aging`, `style_twin`, `summarize_day`, `detect_duplicate_garment`, `assess_garment_condition`, `outfit_photo_feedback`, `visual_search`, `generate_garment_images`, `generate_flatlay`, `process_render_jobs`, `process_job_queue`, `prefetch_suggestions`, `cleanup_ai_cache`, `send_push_notification`, `revenuecat_webhook`, `delete_user_account`, `calendar`
  - Web-only Stripe functions (deprecated post-launch but still deployed for the existing web app): `stripe_webhook`, `create_checkout_session`, `create_portal_session`, `restore_subscription`, `start_trial`

## App Store gates (M43 + M44)

- [ ] Apple Developer Program enrollment active
- [ ] EAS dev build succeeds (`eas build --profile development --platform ios`)
- [ ] EAS production build succeeds (`eas build --profile production --platform ios`)
- [ ] RevenueCat sandbox flow verified end-to-end:
  - [ ] Trial start → premium entitlement granted
  - [ ] Trial-to-paid upgrade → `REVENUECAT_WEBHOOK` fires `INITIAL_PURCHASE` and `subscriptions.plan='premium'`
  - [ ] Restore Purchases → entitlement re-granted on fresh install
  - [ ] Cancel → `EXPIRATION` event downgrades plan to `free` after grace period
- [ ] Apple offer codes / introductory offers configured in App Store Connect
- [ ] App Store Connect submission package:
  - [ ] Screenshots in en + sv (6.7" + 6.1" + iPad if shipping)
  - [ ] Description in en + sv
  - [ ] Category: Lifestyle (primary), Shopping (secondary)
  - [ ] Age rating: 4+ (no objectionable content)
  - [ ] Privacy nutrition labels match `supabase/migrations/*` tracking footprint + Sentry telemetry + RC user identifiers

## Play Store gates (Android)

- [ ] Google Play Console enrollment active
- [ ] EAS production build (Android) submitted to internal testing
- [ ] Play Billing integration verified (mirrors RC iOS flow)
- [ ] Data safety form completed
- [ ] Privacy policy URL: `https://burs.me/privacy`

## Backend gates

- [ ] `vault.secrets` populated:
  - [ ] `process_render_jobs_bearer` (per migration `20260509120000_render_worker_bearer.sql`)
  - [ ] `process_render_jobs_endpoint`
  - [ ] `cleanup_ai_cache_endpoint`
  - [ ] `prefetch_suggestions_endpoint`
- [ ] cron jobs healthy in last 24h:
  - [ ] `process_render_jobs` — 0 errors
  - [ ] `process_job_queue` — 0 errors
  - [ ] `cleanup_ai_cache` — 0 errors
  - [ ] `prefetch_suggestions` — 0 errors
- [ ] RLS spot-check (run with anon key + signed-in JWT):
  - [ ] `subscriptions` — SELECT-only for authenticated, INSERT/UPDATE/DELETE blocked
  - [ ] `user_subscriptions` — same
  - [ ] `ai_rate_limits` — read-only at the API layer (writes go through service role)
  - [ ] `user_roles` — SELECT-only for authenticated
  - [ ] `ai_token_usage` (new in `20260509190001`) — SELECT scoped to `auth.uid() = user_id`
- [ ] AI cost ceilings configured (`ai_token_usage` table):
  - [ ] Free plan: $2 / month
  - [ ] Premium plan: $200 / month
  - [ ] Soft-limit alerts at 75% wired into Sentry / email
- [ ] RevenueCat ↔ Supabase consistency check:
  - [ ] `revenuecat_webhook` handles all 11 RC event types (INITIAL_PURCHASE, RENEWAL, CANCELLATION, UNCANCELLATION, NON_RENEWING_PURCHASE, EXPIRATION, BILLING_ISSUE, PRODUCT_CHANGE, TRANSFER, SUBSCRIPTION_PAUSED, SUBSCRIPTION_EXTENDED)
  - [ ] Stripe-vs-RC arbitration in `_shared/rc-event-ordering.ts` verified — Stripe-paying rows preserved against RC writes

## Customer-facing gates

- [ ] `burs.me/privacy` live (matches `src/pages/marketing/PrivacyPolicy.tsx` content)
- [ ] `burs.me/terms` live
- [ ] Resend SMTP sending from `burs.me` domain — DKIM, SPF, DMARC all pass (verify via mail-tester.com)
- [ ] Sweden launch: `sv` locale 100% coverage
  - Run `node scripts/i18n-diff.mjs` — expect "All 1234 keys present in sv.ts" (or similar)
- [ ] Support inbox monitored: `support@burs.me`

## Observability + rollback

- [ ] Sentry alerts configured:
  - [ ] Crash-free sessions < 99.5% → page on-call
  - [ ] Edge function 5xx rate > 1% / 5min → page
  - [ ] RC webhook signature failures > 0 → page
- [ ] Manual revert plan documented for each migration in `supabase/migrations/`
  - Each migration must have a corresponding rollback SQL (or "not safely revertible — restore from PITR" note) in the migration header
- [ ] Database PITR retention ≥ 7 days
- [ ] Render bucket lifecycle policy: 30-day retention on temp images

## Stripe deprecation (web-only) — N10

- All `src/` Stripe-touching files carry the standard deprecation banner; see PR description for the full file list.
- All web-only Stripe edge functions emit `console.warn("[deprecated] web-only Stripe edge function called", ...)` on every invocation so we can grep logs for residual mobile traffic before deletion.
- `package.json` and `stripe` npm dependency are intentionally retained — the existing web app still ships them.
- Post-launch deletion plan: a separate PR removes `src/` entirely, at which point all five Stripe edge functions and `_shared/stripe-config.ts` can be deleted in the same change.

---

## Running the readiness gate locally

```bash
node scripts/launch-readiness.mjs
```

Exits non-zero on any FAIL. Used by humans before merging launch-blocking
PRs and as part of the pre-submission checklist on launch day.
