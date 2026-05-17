# Plan A — Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship BURS to App Store + Play Store by 2026-05-31.

**Architecture:** 14-day sprint orchestrating five milestones (M1 audit + R-wave close, M2 submission-track waves + Pixel/CAPI, M3 store assets + QA pass, M4 submitted, M5 approved). Per-PR code work uses the existing per-wave workflow (`docs/launch/mobile-launch-overview.md` → per-wave file in `docs/launch/waves/` → standing PR gate stack). This plan adds sprint-level scheduling, ops checklists, and hand-offs between code work and store-ops work. Wave files are the source of truth for code skeletons — this plan does not duplicate them.

**Tech Stack:** React Native + Expo SDK 54 (mobile), Supabase (Postgres + edge functions), RevenueCat (iOS payments), Meta Pixel + Conversions API (advertising attribution), TypeScript.

**Standing references engineers must read once before starting:**
- `CLAUDE.md` (repo root) — LAUNCH MODE block at top, per-PR workflow, hard rules.
- `mobile/CLAUDE.md` — mobile-specific rules.
- `docs/launch/may-2026-sprint/00-overview.md` — sprint overview + cross-plan dependencies.
- `docs/launch/may-2026-sprint/A-launch-readiness.md` — spec this plan implements.
- `docs/launch/mobile-launch-overview.md` — wave tracker.

**Standing per-PR gate stack (applies to every code task below):**
1. Local CI gates (per `mobile/CLAUDE.md` and memory `reference-mobile-ci-gates`).
2. `Agent(subagent_type="code-reviewer", ...)` review.
3. Push PR. Codex loop until one positive signal (👍 reaction or "no bugs found"). Re-review pings are exactly `@codex` (memory `feedback-codex-ping-style`).
4. Self-review pass (memory `feedback-self-review-after-codex`): fresh-eyes diff scan, fix, re-scan, until clean.
5. If native (Kotlin/Swift via Expo config plugin): Borna real-device test. Borna merges manually (memory `feedback-device-test-before-merge`).
6. If non-native: Borna may auto-approve merge per CEO authority (memory `feedback-overnight-autonomous-mode`).
7. After merge of any migration-bearing PR: `npx supabase db push --linked --yes` from `main`.
8. Same PR updates: `docs/launch/may-2026-sprint/00-overview.md` status row + `docs/launch/mobile-launch-overview.md` wave row + `docs/launch/completion-log.md` row.

---

## M1 — Audit + Wave R close (target 2026-05-20)

### Task 1: Day 0 audit — produce unshipped-waves punch list

**Files:**
- Create: `docs/launch/may-2026-sprint/_audit-2026-05-17.md`
- Read: `docs/launch/mobile-launch-overview.md` + every file matching `docs/launch/waves/*.md`

- [ ] **Step 1: Glob the wave files**

Run via the Glob tool: pattern `docs/launch/waves/*.md`. Note the full list returned.

- [ ] **Step 2: Read the tracker**

Read `docs/launch/mobile-launch-overview.md` lines 24–48 (the Wave Index table). Capture the status column for each M-wave row.

- [ ] **Step 3: For each wave file, check git log for merge state**

Use the Bash tool. For each wave id like `m40`:

```bash
git log --oneline --all --grep="m40\|M40" -- docs/launch/waves/m40-privacy-terms-native.md | head -5
```

Treat a merge commit referencing the wave as "merged"; absence as "not merged."

- [ ] **Step 4: Wait for Copilot analysis upload**

If the user has not yet provided the Copilot analysis, stop and ask:
> "Paste or upload the Copilot analysis now so I can fold its P0 findings into the audit. Without it, the audit is incomplete."

Do not proceed past this step without the analysis. Re-read the user's message; they may have already provided it.

- [ ] **Step 5: Write the audit file**

Create `docs/launch/may-2026-sprint/_audit-2026-05-17.md` with this exact shape:

```markdown
# Day 0 Audit — 2026-05-17

## Unshipped waves
| Wave | File | Tracker status | Git merge state | Must-ship for launch? | Reason |
|---|---|---|---|---|---|

## Copilot analysis P0 findings
| # | Finding | File/location | Must-ship? | Mapped to wave or hotfix |
|---|---|---|---|---|

## Defer-to-post-launch list
| Wave / finding | Reason |
|---|---|

## M2 priority order (rewrites Plan A §M2 expected order if different)
1.
2.
3.
```

Fill all four tables from the data gathered in Steps 1–4.

- [ ] **Step 6: Commit the audit**

```bash
git add docs/launch/may-2026-sprint/_audit-2026-05-17.md
git commit -m "docs(launch): day 0 sprint audit + punch list"
```

User pushes. No PR — this is a docs commit straight to a working branch the user pushes.

- [ ] **Step 7: Update the sprint overview**

Edit `docs/launch/may-2026-sprint/00-overview.md` — flip M1 row status from `TODO` to `IN PROGRESS — audit done <date>` in the status table.

---

### Task 2: Day 1 (2026-05-18) — Bank meeting day, R-C background loops

**Files:**
- No code writes by Claude until Borna returns from bank meeting.

- [ ] **Step 1: Confirm R-C PR exists**

```bash
gh pr list --state open --search "R-C OR single-photo OR polish in:title" --limit 10
```

If no PR exists yet, R-C work is on a local branch only. Confirm with the user before starting any agent.

- [ ] **Step 2: Start the autonomous PR fix-loop agent on the R-C PR**

Use the template from memory `reference-pr-fix-loop-agent.md`. Dispatch in background via the Agent tool with `run_in_background: true`. The agent runs the Codex+self-review loop on the R-C PR until merge-ready.

- [ ] **Step 3: Do not merge native code today**

R-C touches native single-photo polish. Even if loops finish, the device-test gate applies. Hold merge until Borna is back from the bank meeting.

- [ ] **Step 4: Notify user when loops complete**

When the background agent posts that the PR is merge-ready, surface the message to the user with a one-line "R-C ready for your device test."

---

### Task 3: Day 2–3 — Close Wave R-C

**Files:**
- Wave file: `docs/launch/waves/r-android-parity-and-on-device-bg.md` (R-C subsection)
- Code per wave file's "Files touched" section
- Tracker: `docs/launch/mobile-launch-overview.md`, `docs/launch/may-2026-sprint/00-overview.md`, `docs/launch/completion-log.md`

- [ ] **Step 1: Read the R-C subsection of the wave file**

Open `docs/launch/waves/r-android-parity-and-on-device-bg.md`. Find the R-C section. Read its "Files touched", "Code skeletons", and "Acceptance gates" subsections in full.

- [ ] **Step 2: Verify all gate-stack steps complete on the R-C PR**

For the R-C PR in `gh`, confirm:

```bash
gh pr view <RC_PR_NUMBER> --json statusCheckRollup,reviews,reviewDecision
```

Expected: all checks green, Codex thread has one 👍 or "no bugs found", code-reviewer subagent run + clean.

- [ ] **Step 3: Borna runs device test**

Block here. Borna installs the PR build on a real iOS device, runs single-photo flow, confirms acceptance criteria in the wave file's R-C section.

- [ ] **Step 4: Borna merges**

```bash
gh pr merge <RC_PR_NUMBER> --squash --delete-branch
```

(Borna runs this — not Claude per `CLAUDE.md` hard rule.)

- [ ] **Step 5: Update trackers**

Edit `docs/launch/mobile-launch-overview.md` — flip R-C row status to DONE with PR number and date.
Edit `docs/launch/may-2026-sprint/00-overview.md` — update M1 row.
Edit `docs/launch/completion-log.md` — append a row.

These three edits go in the **same PR** as the R-C code, not a separate one.

---

### Task 4: Day 2–3 — Decide R-D (ship or defer)

**Files:**
- Wave file: `docs/launch/waves/r-android-parity-and-on-device-bg.md` (R-D subsection)
- Possibly: new code, new PR

- [ ] **Step 1: Estimate R-D work**

Read the R-D subsection of the wave file. Count "Files touched", read "Code skeletons" length. Estimate complexity (S/M/L).

- [ ] **Step 2: Decision**

- If estimate ≤2 days of work AND a free slot exists in the calendar: ship R-D. Proceed to Step 3.
- If estimate >2 days OR calendar is full: defer.

Ask the user to confirm the decision before acting:
> "R-D estimated <S/M/L>. Recommendation: <ship | defer>. Confirm?"

- [ ] **Step 3a: If shipping**

Run the standard per-wave workflow: read wave file → implement per skeletons → run gate stack → user merges → trackers updated in the same PR.

- [ ] **Step 3b: If deferring**

Edit `docs/launch/mobile-launch-overview.md` — flip R-D status to `DEFERRED (post-launch)` with one-line reason.
Edit `docs/launch/may-2026-sprint/_audit-2026-05-17.md` — add R-D to "Defer-to-post-launch list".
Commit:

```bash
git add docs/launch/mobile-launch-overview.md docs/launch/may-2026-sprint/_audit-2026-05-17.md
git commit -m "docs(launch): defer R-D batch parity to post-launch"
```

User pushes.

---

### Task 5: M1 milestone close

- [ ] **Step 1: Flip M1 status in sprint overview**

Edit `docs/launch/may-2026-sprint/00-overview.md` — M1 row from `IN PROGRESS` to `DONE — <date>`.

- [ ] **Step 2: Confirm M2 priority order**

Read the M2 priority section of `_audit-2026-05-17.md`. If it differs from Plan A §M2's expected order, update Plan A — but only if the audit's order is materially different. Minor reordering doesn't need a doc edit.

- [ ] **Step 3: Commit**

```bash
git add docs/launch/may-2026-sprint/00-overview.md docs/launch/may-2026-sprint/A-launch-readiness.md
git commit -m "docs(launch): M1 milestone closed, M2 order locked"
```

---

## M2 — Submission-track waves + Pixel/CAPI (target 2026-05-24)

Each wave below is one PR. Run them **in priority order from the audit**, not in the listed order. If audit says different order, follow audit.

### Task 6: Wave M40 — Privacy/Terms native

**Files:**
- Wave file: `docs/launch/waves/m40-privacy-terms-native.md`
- Code per wave file's "Files touched" section.

- [ ] **Step 1: Read the wave file in full**

Open `docs/launch/waves/m40-privacy-terms-native.md`. Read end-to-end. Note "Files touched", "Code skeletons", "Acceptance gates", "PR template".

- [ ] **Step 2: Read only the source files in "Files touched"**

Do not read sibling wave files. Do not explore the codebase. (Per `CLAUDE.md` per-PR workflow.)

- [ ] **Step 3: Implement per the wave file's Code skeletons**

Copy skeletons verbatim. Minimum change to satisfy acceptance criteria.

- [ ] **Step 4: Run local gates**

Per `mobile/CLAUDE.md` and memory `reference-mobile-ci-gates`:

```bash
cd mobile && npx tsc --noEmit
```

Plus the lint command from `reference-mobile-ci-gates` memory — must use the `"src/**/*.{ts,tsx}"` glob (not `--ext .ts,.tsx`).

Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Run code-reviewer subagent**

```
Agent(subagent_type="code-reviewer", prompt="Review this diff against main. Check: (1) does it satisfy m40-privacy-terms-native.md acceptance criteria? (2) are callers of changed symbols broken? (3) follow the useAddGarment.ts hook pattern? (4) any drift from wave file skeletons? Report under 200 words.")
```

If regression flagged: fix → re-run gates → re-review.

- [ ] **Step 6: Push PR with wave's PR template**

```bash
gh pr create --title "feat(mobile): m40 privacy/terms native" --body-file <(cat <<EOF
## Wave
M40 — Privacy/Terms native (\`docs/launch/waves/m40-privacy-terms-native.md\`)

## Problem
<from wave file>

## Fix
<from wave file>

## Files touched
<from wave file>

## Verification
- TypeScript: 0 errors
- Lint: 0 warnings
- Manual test: <from wave file>
- Code-reviewer subagent: approved

## Out of scope
<anything spotted; also appended to findings-log.md>
EOF
)
```

- [ ] **Step 7: Codex loop**

Wait for Codex 👀 (pickup). If quota-exhausted message: HARD STOP, surface to user.
On findings: fix each → resolve thread → ping `@codex` (exactly that, no narration).
Loop until one positive Codex signal (👍 OR "no bugs found").

- [ ] **Step 8: Self-review pass**

Scan the diff with fresh eyes. Fix any issues found. Re-scan. Loop until a full pass finds nothing.

- [ ] **Step 9: Borna merges**

For M40 (which may include native code per `m40-privacy-terms-native.md` "Files touched"): Borna device test required before merge.

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

- [ ] **Step 10: Tracker updates in the same PR**

Wave row in `mobile-launch-overview.md`, sprint overview M2 row, `completion-log.md`. Confirmed merged before moving to next wave.

---

### Task 7: Wave M43 — Apple EAS build profile

**Files:**
- Wave file: `docs/launch/waves/m43-apple-eas.md`

Repeat Task 6's Steps 1–10 substituting `m43-apple-eas.md` everywhere. Note: M43 likely modifies `eas.json` and may need an Apple Developer team ID — confirm Borna has provided this before starting Step 3.

- [ ] **Step 1: Read `docs/launch/waves/m43-apple-eas.md` in full.**
- [ ] **Step 2: Confirm Apple team ID + bundle ID `me.burs.app` registered in App Store Connect.** If missing, stop and ask.
- [ ] **Step 3–10: As Task 6 Steps 3–10.**

---

### Task 8: Wave M44 — RevenueCat sandbox submission

**Files:**
- Wave file: `docs/launch/waves/m44-revenuecat-sandbox-submission.md`

- [ ] **Step 1: Read `docs/launch/waves/m44-revenuecat-sandbox-submission.md` in full.**
- [ ] **Step 2: Confirm RevenueCat dashboard has products `burs_premium_monthly_119sek` and `burs_premium_annual_899sek` linked to entitlement `premium`.** If not, stop and ask Borna to configure.
- [ ] **Step 3–10: As Task 6 Steps 3–10.**

---

### Task 9: Wave mobile-w14 — Submission prep

**Files:**
- Wave file: `docs/launch/waves/mobile-w14-submission.md` (or `docs/launch/mobile-w14-submission.md` if not yet moved into waves/)

- [ ] **Step 1: Read the wave file in full.**
- [ ] **Step 2–10: As Task 6 Steps 3–10.**

---

### Task 10: Pixel + Conversions API integration

**Files:**
- Modify: `mobile/app.json` (add Meta SDK plugin if applicable)
- Modify: `mobile/package.json` (add `react-native-fbsdk-next` or chosen equivalent)
- Create: `mobile/src/lib/analytics.ts` — single export `track(event, params)`.
- Modify: `mobile/src/hooks/useAddGarment.ts` and entry-points that fire `StartTrial`, `Subscribe` (consult M31 RevenueCat code).
- Modify: `supabase/functions/revenuecat_webhook/index.ts` — add CAPI server-side mirror.
- Add Supabase `vault.secrets` entries: `meta_pixel_id`, `meta_capi_access_token`.

- [ ] **Step 1: Confirm SDK 54 compatibility**

Check `react-native-fbsdk-next` README for Expo SDK 54 support. If supported, install via:

```bash
cd mobile && npx expo install react-native-fbsdk-next
```

If not supported: skip the mobile SDK; do CAPI only (server-side from `revenuecat_webhook` + a new edge function `meta_install_capi` triggered on first-app-launch from the mobile app via existing supabase client). Add the new function to the wave doc and confirm with user before creating (per `CLAUDE.md` hard rule on new edge functions).

- [ ] **Step 2: Add `vault.secrets` entries**

Ask user to add via Supabase dashboard or MCP — do not commit any tokens. Confirm both keys exist before Step 3.

- [ ] **Step 3: Write failing test for `track()`**

```typescript
// mobile/src/lib/__tests__/analytics.test.ts
import { track } from '../analytics';

describe('track', () => {
  it('emits StartTrial event to Meta with currency SEK', () => {
    const spy = jest.fn();
    // mock the SDK or fetch depending on Step 1's choice
    track('StartTrial', { value: 0, currency: 'SEK' });
    expect(spy).toHaveBeenCalledWith(/* expected payload */);
  });
});
```

Fill in mock + expected payload based on Step 1's choice.

- [ ] **Step 4: Run test, expect FAIL**

```bash
cd mobile && npx jest analytics.test
```

Expected: FAIL — `track` not defined.

- [ ] **Step 5: Implement `mobile/src/lib/analytics.ts`**

Minimum implementation to make the test pass. Wrap the SDK call (or fetch to CAPI) behind a single `track(event, params)` export.

- [ ] **Step 6: Run test, expect PASS**

- [ ] **Step 7: Wire `track('StartTrial', ...)` and `track('Subscribe', ...)` into the actual app**

Find the RevenueCat hooks (likely under `mobile/src/hooks/`). Fire `track('StartTrial')` on trial-start callback, `track('Subscribe', { value, currency: 'SEK' })` on purchase success.

- [ ] **Step 8: Extend `supabase/functions/revenuecat_webhook/index.ts` for server-side CAPI mirror**

Add a POST to `https://graph.facebook.com/v20.0/{pixel_id}/events?access_token={capi_token}` on `INITIAL_PURCHASE` and `RENEWAL` events with the standard Subscribe event shape. Read secrets from `Deno.env.get('META_PIXEL_ID')` and `Deno.env.get('META_CAPI_ACCESS_TOKEN')` (sourced from `vault.secrets`).

- [ ] **Step 9: Deploy the edge function**

```bash
npx supabase functions deploy revenuecat_webhook --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

- [ ] **Step 10: Verify in Meta Events Manager**

Borna fires a sandbox subscribe via the app. Check Meta Events Manager → Test Events for `Subscribe` from both Pixel (client) and CAPI (server). Both must arrive within 60 seconds.

- [ ] **Step 11: Run remaining gate stack**

Code-reviewer subagent, push PR, Codex loop, self-review, Borna merges. Tracker updates in same PR.

---

### Task 11: RevenueCat sandbox E2E verification

**Files:** No code changes. Verification only.

- [ ] **Step 1: Borna installs the latest TestFlight build on iOS device** (after M43 + M44 merged).

- [ ] **Step 2: Run subscribe flow**

In-app: navigate to paywall → pick monthly → complete sandbox purchase. Confirm entitlement `premium` granted.

- [ ] **Step 3: Run restore flow**

Sign out → sign back in → tap "Restore Purchases" → confirm entitlement re-granted.

- [ ] **Step 4: Run cancel + expire flow**

Cancel from sandbox account settings. Force-expire in RevenueCat dashboard. Re-open app. Confirm entitlement removed.

- [ ] **Step 5: Verify webhook fired**

Check `supabase/functions/revenuecat_webhook` logs in Supabase dashboard. Confirm INITIAL_PURCHASE, CANCELLATION, and EXPIRATION events arrived and CAPI mirror fired.

- [ ] **Step 6: If any step fails**

File a hotfix wave. Do not advance to M3 until sandbox is clean.

---

### Task 12: M2 milestone close

- [ ] **Step 1: Confirm all M2 wave PRs merged**

```bash
gh pr list --state merged --search "m40 OR m43 OR m44 OR mobile-w14 OR pixel OR CAPI" --limit 20
```

- [ ] **Step 2: Flip M2 status**

Edit `docs/launch/may-2026-sprint/00-overview.md` — M2 row to `DONE — <date>`.

- [ ] **Step 3: Commit**

```bash
git add docs/launch/may-2026-sprint/00-overview.md
git commit -m "docs(launch): M2 milestone closed"
```

---

## M3 — Store assets + QA pass (target 2026-05-27)

### Task 13: App Store Connect — record + IAP + privacy details

**Files:** No code. Operates on `appstoreconnect.apple.com`.

- [ ] **Step 1: Borna logs into ASC**

- [ ] **Step 2: Confirm app record exists for bundle ID `me.burs.app`**

If missing: My Apps → + → New App → fill iOS / macOS=iOS / Name=BURS / Primary Language=Swedish / Bundle ID=me.burs.app / SKU=burs-001.

- [ ] **Step 3: Confirm IAP products active**

In-App Purchases & Subscriptions. Confirm both subscription products `burs_premium_monthly_119sek` and `burs_premium_annual_899sek` are in `Ready to Submit` or `Approved` state. If `Missing Metadata`: fill display name, description, pricing tier matching 119 SEK / 899 SEK.

- [ ] **Step 4: Fill App Privacy details**

App Privacy → Get Started. Declare:
- **Sentry:** Crash Data — Linked to user (App functionality)
- **Supabase:** User account info, wardrobe content (photos), purchase history — Linked to user (App functionality)
- **Gemini API:** Photos — Not linked to user, not used for tracking (App functionality)
- **RevenueCat:** Purchase history — Linked to user (App functionality)
- **Meta Pixel:** Device ID, Advertising ID — Linked to user, used for tracking (Third-party advertising)

- [ ] **Step 5: App Review Information**

Contact info: Borna's email + phone. Notes for reviewer: "Demo account `test@burs.me` / `<password>`. Wardrobe pre-seeded. To test subscription, use Apple sandbox tester `sandbox@burs.me`."

- [ ] **Step 6: Export Compliance**

Encryption: "Uses standard encryption (HTTPS only)". Mark `ITSAppUsesNonExemptEncryption=false` in `mobile/app.json` if not already.

---

### Task 14: App Store Connect — screenshots + copy + URLs

**Files:**
- Create: `docs/launch/may-2026-sprint/store-copy/apple-description.md` — full description draft (Claude writes).
- Create: `docs/launch/may-2026-sprint/store-copy/apple-keywords.md` — 100-char keywords list (Claude writes).
- Create: `docs/launch/may-2026-sprint/store-copy/apple-promo.md` — 170-char promo text (Claude writes).
- Create: `docs/launch/may-2026-sprint/store-copy/apple-screenshots-shotlist.md` — list of 3–5 screens to capture per device size.

- [ ] **Step 1: Claude drafts description in Swedish + English**

Draft to `store-copy/apple-description.md`. Use the brand voice from `docs/launch/may-2026-sprint/B-meta-ads-agent.md` §1 (confident, warm, low-jargon, fashion-literate-not-snobby). Two sections: Swedish first, English second. Aim for ~2000 chars each.

- [ ] **Step 2: Claude drafts 100-char keyword list**

Draft to `store-copy/apple-keywords.md`. Comma-separated, no spaces unless multi-word, focus on: wardrobe, stylist, outfit, AI, fashion, capsule, garderob, stil.

- [ ] **Step 3: Claude drafts 170-char promo text**

Draft to `store-copy/apple-promo.md`. One liner.

- [ ] **Step 4: Borna reviews drafts and edits**

Borna opens each `.md`, edits in place, commits. Claude does not re-write without explicit ask.

- [ ] **Step 5: Claude drafts screenshot shotlist**

5 screens per device size (6.7" and 6.5"): onboarding, wardrobe grid, outfit generation, travel capsule, paywall.

- [ ] **Step 6: Borna captures screenshots**

Use a real device or simulator at the target resolution. Save to `docs/launch/may-2026-sprint/store-copy/screenshots/apple/<device>/<order>-<name>.png`.

- [ ] **Step 7: Borna uploads to ASC**

App Store → 1.0 Prepare for Submission → Screenshots, Description, Keywords, Promotional Text, Support URL=`https://burs.me`, Marketing URL=`https://burs.me`, Privacy Policy URL=`https://burs.me/privacy`.

- [ ] **Step 8: Confirm privacy + terms URLs live**

```bash
curl -I https://burs.me/privacy
curl -I https://burs.me/terms
```

Both must return 200. If 404: coordinate with web `src/` side to ship the pages (web Wave 11 per `mobile-launch-overview.md` external setup checklist).

---

### Task 15: Play Console — record + IAP + Data Safety

**Files:** No code. Operates on `play.google.com/console`.

- [ ] **Step 1: Borna logs into Play Console**

- [ ] **Step 2: Confirm app record exists**

Create app → Name=BURS / Default language=Swedish / Free / I confirm meet developer program policies.

- [ ] **Step 3: Set up subscriptions**

Monetize → Products → Subscriptions. Create `burs_premium_monthly_119sek` and `burs_premium_annual_899sek` matching ASC products. Pricing per Sweden + 9 Nordic/EU regions.

- [ ] **Step 4: Data Safety form**

App content → Data safety → Manage. Declarations must match ASC App Privacy (Task 13 Step 4). Categories: Personal info, Photos and videos, Financial info (purchase history), App activity (analytics), Device or other IDs.

- [ ] **Step 5: Content rating**

Complete questionnaire. Likely PEGI 3 / ESRB Everyone.

- [ ] **Step 6: Target audience and content**

13+ recommended (matches BURS audience).

- [ ] **Step 7: Ads questionnaire**

Select "No, my app does not contain ads" (Plan B does not advertise inside BURS).

- [ ] **Step 8: App access**

Provide test reviewer credentials `test@burs.me` / `<password>`.

---

### Task 16: Play Console — store listing + copy

**Files:**
- Create: `docs/launch/may-2026-sprint/store-copy/play-short.md` — 80-char short description.
- Create: `docs/launch/may-2026-sprint/store-copy/play-full.md` — 4000-char full description.
- Create: `docs/launch/may-2026-sprint/store-copy/play-screenshots-shotlist.md` — phone + optional 7" tablet screens.

- [ ] **Step 1: Claude drafts short description (80 chars)**

Draft to `store-copy/play-short.md`.

- [ ] **Step 2: Claude drafts full description (4000 chars)**

Draft to `store-copy/play-full.md`. Same voice as ASC description. Bullets and section headers allowed in Play.

- [ ] **Step 3: Borna reviews, edits, signs off**

- [ ] **Step 4: Claude drafts screenshot shotlist**

8 phone screens, 4 tablet screens (tablet optional but recommended).

- [ ] **Step 5: Borna captures**

Save to `docs/launch/may-2026-sprint/store-copy/screenshots/play/<phone|tablet>/<order>-<name>.png`.

- [ ] **Step 6: Borna creates feature graphic (1024×500)**

Save to `docs/launch/may-2026-sprint/store-copy/feature-graphic.png`. Coordinate with brand voice — the AI-stylist UI is the hero.

- [ ] **Step 7: Borna uploads to Play Console**

Store listing → fill all fields. Privacy policy URL = `https://burs.me/privacy`.

---

### Task 17: TestFlight build distribution

**Files:**
- Build via EAS using `eas.json` from Task 7 (M43).

- [ ] **Step 1: Create production build**

```bash
cd mobile && npx eas build --platform ios --profile production --non-interactive
```

Wait for build. Approximate time: 20–40 minutes.

- [ ] **Step 2: Submit to TestFlight**

```bash
cd mobile && npx eas submit --platform ios --latest --non-interactive
```

- [ ] **Step 3: Wait for ASC processing**

5–30 minutes. Check ASC → TestFlight → iOS Builds. Status moves from `Processing` → `Ready to Submit` (after compliance).

- [ ] **Step 4: Add internal testers**

ASC → TestFlight → Internal Testing → + → invite at least 1 internal tester (Borna).

- [ ] **Step 5: Confirm install on device**

Borna installs via TestFlight app, opens, lands on first screen without crash.

---

### Task 18: Play internal-track build distribution

**Files:**
- Build via EAS targeting Android.

- [ ] **Step 1: Build Android AAB**

```bash
cd mobile && npx eas build --platform android --profile production --non-interactive
```

Note: per memory, do not attempt local Android builds from the OneDrive working dir. EAS cloud build is fine from OneDrive.

- [ ] **Step 2: Submit to Play internal track**

```bash
cd mobile && npx eas submit --platform android --latest --non-interactive --track internal
```

- [ ] **Step 3: Add internal testers in Play Console**

Testing → Internal testing → Testers → create email list with Borna's Google account.

- [ ] **Step 4: Borna installs via opt-in URL**

Confirm install on device, opens without crash.

---

### Task 19: iOS device E2E pass

**Files:** No code. Verification.

- [ ] **Step 1: Borna uses TestFlight build on iOS device.**

- [ ] **Step 2: Run the full flow:**
- Onboarding (all steps, including style DNA + permissions)
- Add single garment (selfie + photo upload)
- Add batch garments
- Outfit generation
- Travel capsule
- Push notification (trigger via Supabase admin)
- Subscribe (sandbox tester)
- Restore purchases
- Cancel + expire

- [ ] **Step 3: Check for missing strings**

Tap through every screen. Any `[missing_key]` indicator = failed gate. Append-only `mobile/src/i18n/locales/<locale>.ts` updates required.

- [ ] **Step 4: Pass criteria**

All steps completed without crash. All strings localized. Push delivered. RevenueCat sandbox webhook fired.

- [ ] **Step 5: If any failure**

Hotfix wave. Do not advance to M4 until E2E is clean.

---

### Task 20: Android device E2E pass

**Files:** No code. Verification.

- [ ] **Step 1: Borna uses Play internal-track build on Android device.**

- [ ] **Step 2: Same flow as Task 19** with Android-specific call-out: confirm **manual capture** for garments works (LiveScan auto-detect is deferred per R-A).

- [ ] **Step 3: Pass criteria as Task 19.**

- [ ] **Step 4: If any failure: hotfix wave.**

---

### Task 21: 24h Sentry monitoring window

**Files:** No code. Verification.

- [ ] **Step 1: Note Sentry crash-free sessions baseline**

Open Sentry → BURS-mobile project → Performance/Releases. Note crash-free sessions % at start of M3.

- [ ] **Step 2: Wait 24 hours after the latest TestFlight + Play build is in testers' hands.**

- [ ] **Step 3: Re-check Sentry**

Crash-free sessions must be ≥99.5%. If lower: identify top issue, hotfix wave, restart 24h window.

---

### Task 22: M3 milestone close

- [ ] **Step 1: Flip M3 status**

Edit `docs/launch/may-2026-sprint/00-overview.md` — M3 row to `DONE — <date>`.

- [ ] **Step 2: Commit**

```bash
git add docs/launch/may-2026-sprint/00-overview.md docs/launch/may-2026-sprint/store-copy/
git commit -m "docs(launch): M3 milestone closed — store assets + QA pass"
```

---

## M4 — Submitted (target 2026-05-29)

### Task 23: Pre-submission checklist render

**Files:** No code. Single rendered checklist.

- [ ] **Step 1: Claude renders the pre-submission checklist**

Reproduce the M3 "Done when" list from `A-launch-readiness.md` as an inline checkbox list in chat. Read each item; for each, confirm DONE or BLOCKED with one-line evidence.

- [ ] **Step 2: If any BLOCKED: stop**

Surface to user, fix, repeat Step 1. Do not advance to Task 24 until every item is DONE.

---

### Task 24: Submit to App Store

**Files:** No code. ASC operation.

- [ ] **Step 1: Borna confirms TestFlight build selected**

ASC → 1.0 Prepare for Submission → Build → select latest TestFlight build.

- [ ] **Step 2: Final review of submission fields**

All fields populated per Tasks 13–14. Privacy URL returns 200.

- [ ] **Step 3: Submit for Review**

Click "Add for Review" → "Submit to App Review".

- [ ] **Step 4: Confirm status**

ASC version page shows "Waiting for Review".

---

### Task 25: Submit to Play Store

**Files:** No code. Play Console operation.

- [ ] **Step 1: Promote internal-track build to production track**

Release → Production → Create new release → Add from library → select latest internal build.

- [ ] **Step 2: Add release notes**

Pull from `store-copy/play-full.md` if used; otherwise short release notes block.

- [ ] **Step 3: Review release**

All required sections green (store listing, content rating, target audience, data safety, app access). Countries match Plan A spec (Sweden + Nordics + UK + NL).

- [ ] **Step 4: Submit to Review**

Click "Send 1 change for review".

- [ ] **Step 5: Confirm status**

Play Console → Release → Production shows "In review".

---

### Task 26: M4 milestone close

- [ ] **Step 1: Flip M4 status**

Edit `docs/launch/may-2026-sprint/00-overview.md` — M4 row to `DONE — <date> — Apple #<asc_id>, Play #<package_version>`.

- [ ] **Step 2: Commit**

```bash
git add docs/launch/may-2026-sprint/00-overview.md
git commit -m "docs(launch): M4 milestone closed — both stores submitted"
```

---

## M5 — Approved (target 2026-05-31)

### Task 27: Monitor review status

**Files:** No code.

- [ ] **Step 1: Set up 4-hourly check rhythm**

Check ASC + Play Console status every 4 hours during waking hours. Note any status change.

- [ ] **Step 2: If In Review → Approved: celebrate.**

- [ ] **Step 3: If Rejected: triage immediately.**

Read the reviewer's reason. Triage to:
- Copy/metadata fix → edit field, resubmit (minutes).
- Privacy/data safety mismatch → edit declarations, resubmit (hours).
- IAP issue → fix in code, new TestFlight/Play build, resubmit (1–2 days).
- Crash on review device → fix code, new build, resubmit (1+ days).

Surface to user immediately. User decides resubmit path.

---

### Task 28: Hotfix capacity / resubmission cycle

**Files:** Depends on the rejection reason.

- [ ] **Step 1: If a code hotfix is needed**

Open a hotfix wave file at `docs/launch/waves/m-hotfix-<short-slug>.md` following the standard wave template (per `mobile-launch-overview.md` "Per-Wave Documentation Convention"). Run the standard per-wave workflow. Submit a new TestFlight/Play build. Resubmit.

- [ ] **Step 2: If a metadata/asset fix**

Edit the field directly in ASC/Play Console. No code change. Resubmit.

- [ ] **Step 3: Update sprint overview status**

Edit `docs/launch/may-2026-sprint/00-overview.md` — M5 row to `IN PROGRESS — resubmit <date> — <reason>`.

- [ ] **Step 4: Loop**

Back to Task 27 until M5 is met.

---

### Task 29: M5 milestone close

- [ ] **Step 1: Confirm both stores either Approved or in documented Active Resubmit by 2026-05-31 EOD.**

- [ ] **Step 2: Flip M5 status**

Edit `docs/launch/may-2026-sprint/00-overview.md` — M5 row to `DONE — <date>`. Add a note line below the table summarizing outcome (e.g. "Apple approved 2026-05-30; Play approved 2026-05-31").

- [ ] **Step 3: Remove LAUNCH MODE block from CLAUDE.md**

Edit `CLAUDE.md` — delete the entire `## LAUNCH MODE — until 2026-05-31` block and the trailing `---` separator. The block was self-marked for removal at this point.

- [ ] **Step 4: Commit + tag**

```bash
git add docs/launch/may-2026-sprint/00-overview.md CLAUDE.md
git commit -m "docs(launch): launch complete — LAUNCH MODE lifted"
git tag launch-2026-05-31
```

User pushes the tag.

- [ ] **Step 5: Trigger Plan C kickoff**

Plan C MC1 starts on this date. Spawn a fresh session pointed at `docs/launch/may-2026-sprint/C-marketing-dashboard.md` to begin writing the C implementation plan via `superpowers:writing-plans`.

- [ ] **Step 6: Notify co-founders that Plan B can start**

Plan B was always unblocked, but post-launch is the natural kickoff signal. Confirm they have the handoff doc at `docs/launch/may-2026-sprint/B-meta-ads-agent.md`.

---

## Self-Review

**Spec coverage:** all five milestones (M1–M5) implemented. Audit, R-wave close, M2 waves, Pixel/CAPI, RC sandbox, ASC + Play assets, both submissions, monitoring + hotfix, milestone close. Cross-plan hand-offs (Pixel/CAPI to C, kickoff to B) covered in Task 29.

**Placeholder scan:** no TBDs, no "implement later", no "similar to Task N" without repeating the necessary info. Where wave files own the code (Tasks 6–9), tasks explicitly direct the engineer to read the wave file and follow its skeletons — that's a deliberate pointer to authoritative source, not a placeholder.

**Type consistency:** the only repeated names across tasks are file paths, wave IDs, milestone IDs, and product SKUs — all consistent (`burs_premium_monthly_119sek`, `burs_premium_annual_899sek`, `me.burs.app`, `khvkwojtlkcvxjxztduj`).

**Known gaps the audit (Task 1) may fill:**
- The M2 wave list (Tasks 6–9) is based on the expected order from the sprint spec. If the audit finds additional must-ship waves, the executing agent must insert them as Task 6a/6b/etc., not skip them.
- The Pixel SDK choice in Task 10 has a real branch (`react-native-fbsdk-next` vs. CAPI-only) gated on SDK 54 compatibility. Step 1 of Task 10 handles this branching explicitly.
