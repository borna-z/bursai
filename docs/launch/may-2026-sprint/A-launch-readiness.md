# Plan A — Launch Readiness (App Store + Play Store, 2026-05-31)

**Owner:** Borna (device tests, store ops, approvals) + Claude (code, gates, drafts).
**Window:** 2026-05-17 → 2026-05-31 (14 days).
**Definition of done:** BURS submitted to **both** App Store and Play Store; each either approved or in active resubmit with a documented fix ETA by 2026-05-31.

## Constraints carried from `CLAUDE.md` and memory

- Wave R open: R-C in progress, R-D pending, R-A deferred (Android LiveScan auto-detect — vc-worklets bridgeless conflict; Android ships via manual capture).
- Per-PR workflow: V0 CI gates → Codex loop until one positive signal (👍 reaction or "no bugs found") → self-review pass → device test for native PRs → Borna merges.
- Native PRs (Kotlin/Swift via Expo config plugin) cannot be merged by Claude — Borna device-test gate.
- Windows + OneDrive working dir cannot build Android natively. Use `C:\dev\bursai` clone for any `expo run:android` / `gradlew assembleDebug`.
- Expo managed workflow: never commit `mobile/{android,ios}`. Native code lives in `mobile/plugins/with-<feature>/`.
- After merging a PR with migrations: `npx supabase db push --linked --yes` from main.
- Locales `mobile/src/i18n/locales/*` are append-only.

## Milestones

### M1 — Audit + Wave R close (target 2026-05-20)

**Done when:**
- A Day-0 audit punch list exists at `docs/launch/may-2026-sprint/_audit-2026-05-17.md` (created in M1) with one row per unshipped wave: `{ wave_id, current_status, must_ship_for_launch (Y/N), reason }`.
- The user has uploaded the Copilot analysis; its P0 findings are folded into the punch list.
- R-C merged.
- R-D either merged or formally deferred-to-post-launch (note added in `docs/launch/mobile-launch-overview.md` plus the sprint overview status table).

**Day-by-day:**
- **Day 0 (2026-05-17):** Audit. Glob `docs/launch/waves/*.md`, cross-reference `docs/launch/mobile-launch-overview.md`, produce the punch list. Confirm any open R-C PR. Wait for Copilot analysis upload before locking the punch list.
- **Day 1 (2026-05-18):** Bank meeting — Borna time-blocked. Claude runs Codex/self-review loops on R-C in background. No native merges this day.
- **Day 2–3 (2026-05-19 → 2026-05-20):** Close R-C. Decide R-D (ship if ≤2 days work, otherwise defer with explicit note).

### M2 — Submission-track waves + Pixel/CAPI (target 2026-05-24)

**Done when:** All audit-identified must-ship waves merged. RevenueCat sandbox flow verified end-to-end on a real device (subscribe → entitlement granted → restore purchases → cancel). Meta Pixel + Conversions API events firing from the mobile app.

**Expected wave priority** (subject to Day-0 audit):
1. `m40-privacy-terms-native.md` — both stores require in-app privacy/terms surfaces.
2. `m43-apple-eas.md` — EAS build profile for App Store distribution.
3. `m44-revenuecat-sandbox-submission.md` — sandbox testing + submission readiness.
4. `mobile-w14-submission.md` — submission prep checklist execution.
5. Any other wave the audit marks must-ship-Y.

**Pixel + Conversions API sub-task (explicit because of Plan C and B dependency):**
- Install Meta SDK in mobile (`react-native-fbsdk-next` or equivalent if SDK 54-compatible; otherwise direct Conversions API calls from supabase edge function).
- Fire standard events: `fb_mobile_first_app_launch`, `StartTrial`, `Subscribe`.
- Server-side Conversions API mirror in `supabase/functions/revenuecat_webhook` (already exists per `CLAUDE.md` — extend, don't create new function).
- Pixel ID and CAPI access token via Supabase `vault.secrets`, never custom GUCs.

### M3 — Store assets + QA pass (target 2026-05-27)

**Done when all of:**

**Apple App Store Connect — assets uploaded:**
- App record exists (bundle ID `me.burs.app`).
- Screenshots: 6.7" iPhone (3–5), 6.5" iPhone (3–5). iPad optional, skip for v1.
- App icon (1024×1024, no alpha).
- Description, promotional text (170 chars), keywords (100 chars).
- Support URL `https://burs.me`, marketing URL `https://burs.me`, privacy URL `https://burs.me/privacy`.
- Age rating questionnaire completed.
- App Privacy Details declared: data collected by Sentry (crash diagnostics), Supabase (account, wardrobe content), Gemini (image processing, not retained), RevenueCat (subscription state), Meta Pixel (advertising).
- IAP products active in App Store Connect: `burs_premium_monthly_119sek`, `burs_premium_annual_899sek`.
- Demo reviewer account `test@burs.me` with reproducible flow.

**Google Play Console — assets uploaded:**
- Package name `me.burs.app`.
- Short description (80 chars), full description (4000 chars).
- Screenshots: phone (3–8), feature graphic (1024×500), app icon (512×512).
- Content rating questionnaire completed.
- Data Safety form: matches App Privacy Details above.
- Target audience and content (13+).
- Ads questionnaire: No for v1 (B agent does not advertise within the app).
- App access: test reviewer credentials.
- Pricing: free, with subscription IAP at 119 SEK/mo, 899 SEK/yr.
- Countries: Sweden + Nordics (NO, DK, FI, IS) + UK + Netherlands.

**Builds distributed:**
- TestFlight build uploaded and processed; at least one internal tester confirms install + paid-feature flow.
- Play internal-track build uploaded; at least one internal tester confirms install + paid-feature flow.

**Pre-submission E2E pass on real devices:**
- iOS physical device (latest iOS), Android physical device (latest stable Android).
- Flow: onboarding → wardrobe add (single + batch) → outfit generation → travel capsule → push notification (M30 verified) → subscribe sandbox → restore purchases → cancel → expire.
- All localized strings render (no `[missing_key]` indicators).
- Privacy URL and Terms URL live on `burs.me/privacy` and `burs.me/terms`.

**Sentry crash-free sessions ≥99.5% for the 24 hours preceding submission.**

**Owner split for M3:**
- Claude drafts: descriptions, keywords, promo text, release notes, App Privacy Details checklist, Data Safety form answers, demo reviewer flow.
- Borna: captures screenshots, uploads to ASC + Play Console, signs off on copy, runs device E2E.

### M4 — Submitted (target 2026-05-29)

**Done when:**
- App Store Connect status = "Waiting for Review".
- Play Console status = "In review".
- Both submissions filed by EOD 2026-05-29.

This date leaves 48 hours of headroom for first-rejection resubmission inside the May 31 window.

### M5 — Approved (target 2026-05-31)

**Done when:** Both apps live, OR one/both in active resubmission with a documented fix and ETA. An active documented resubmit counts as "deadline met" for this plan — Apple/Play review times are not fully controllable.

## Per-PR QA (every sprint PR)

Standing 10-gate workflow (memory `feedback-pr-gate-workflow`):
1. Pre-flight artifacts.
2. Per-step verification.
3. Migration drift check.
4. Full local pipeline (memory `reference-mobile-ci-gates`).
5. Code-reviewer subagent.
6. Tracker-in-PR update (sprint overview status table + `mobile-launch-overview.md` if a wave).
7. Codex loop until one positive signal — never treat silence as approval.
8. Self-review pass — fresh-eyes diff scan.
9. (Native only) Borna device test.
10. Merge.

## Pre-submission QA (one-shot before M4)

Already enumerated under M3 — restate as a single checklist Claude can render the day before M4 so nothing is missed.

## Risks + mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Apple rejection on first submit (IAP/copy/privacy are common reasons) | Submit 2026-05-29 = 48h buffer. Claude pre-screens copy and privacy details against common rejection reasons before M4. |
| 2 | Day-0 audit reveals more open waves than 14 days fits | Audit produces explicit defer-to-post-launch list; we ship a real subset, not pretend everything fits. |
| 3 | Android submission needs manual-capture path to work end-to-end without LiveScan auto-detect | M3 device E2E on Android explicitly tests manual capture. If broken, insert a hotfix wave before M4. |
| 4 | Windows + OneDrive blocks Android native builds | Borna uses `C:\dev\bursai` clone for any `expo run:android`. Pre-confirmed by memory. |
| 5 | Bank meeting 2026-05-18 consumes Borna's day | Claude runs Codex/self-review loops on R-C in background. No native merges scheduled for this day. |
| 6 | RevenueCat sandbox sometimes flaky | Verify sandbox during M2, not M3 — leaves dashboard troubleshooting time. |
| 7 | Copilot analysis upload reveals security/privacy issues post-Day-0 | Treat as P0; insert hotfix waves at start of M2 even if it pushes other M2 work. |
| 8 | Meta Pixel SDK 54 incompatibility forces server-only CAPI | Acceptable — CAPI via existing `revenuecat_webhook` covers subscribe events; install/trial fire from Supabase edge function on first-app-open ping. |

## Hand-offs out

- Plan C waits on M2's Pixel/CAPI going live in production. Coordinate timing: Claude pings C plan when M2 ships.
- Plan B is co-founders' lane. This plan ships everything they need server-side (Pixel + CAPI) via M2.
- After merge of any migration-bearing PR, run `npx supabase db push --linked --yes` from `main` (Claude's job per memory).
