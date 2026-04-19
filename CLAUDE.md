# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Follow everything here without being asked. These are standing orders, not suggestions.

## Session Start — Do This First, Every Time

```bash
cd C:\Users\borna\OneDrive\Desktop\BZ\Burs\bursai-working
git status
```

If not on main:
```bash
git checkout main && git pull origin main
```

Do not proceed until you are in bursai-working with a clean git status.

## Launch Plan — Single Source of Truth for All Fix Work

**CURRENT PROMPT:** P0a
**LAST UPDATED:** 2026-04-19
**TOTAL SCOPE:** 81 prompts across 12 waves

### How to Resume the Plan

When the user says "continue the launch plan" (or equivalent like "next prompt", "continue", "keep going"):
1. Read `CURRENT PROMPT` above.
2. Find it in the Prompt List below.
3. Load ONLY the files named in its scope (respect Token Conservation rules).
4. Follow the Fix Protocol (section below).
5. After the user merges the PR, run the End-of-Session Update.

### Status Legend
- `[TODO]` — not started
- `[WIP]` — branch open, PR not yet merged
- `[DONE]` — merged to main (PR link appended)
- `[BLOCKED]` — waiting on user decision, external dep, or failing CI
- `[SKIP]` — user decided not to do this prompt

### End-of-Session Update (MANDATORY after every merged PR)

At the end of every session, the agent MUST:
1. Flip the prompt's status from `[WIP]` to `[DONE] (PR #<num>, <date>)`
2. Move `CURRENT PROMPT` pointer to the next `[TODO]` prompt
3. Update `LAST UPDATED` to today's date (format: YYYY-MM-DD)
4. Add any findings discovered outside prompt scope to the Findings Log
5. Append a Completion Log row
6. Commit this CLAUDE.md update as part of the same PR (single atomic PR per prompt)

### Prompt List

#### Wave 0 — Safety Net (one afternoon, do first)

**P0a [TODO]** Husky pre-commit hook
- Install `husky` as devDependency. Add `.husky/pre-commit` running tsc + eslint + build.
- Files: `package.json`, `.husky/pre-commit` (new)
- Deploy: none

**P0b [TODO]** GitHub Actions CI workflow
- Block PR merge on tsc/eslint/build/vitest failure.
- Files: `.github/workflows/ci.yml` (new)
- Deploy: none

**P0c [TODO]** Append Fix Protocol section to CLAUDE.md *(already present after this Launch Plan block — this prompt just verifies it's in place and adjusts wording based on experience)*
- Files: `CLAUDE.md`
- Deploy: none

**P0d [TODO]** 10 integration smoke tests
- One test per major flow: signup, garment add, enrichment, render, outfit generate, outfit refine, plan week, visual search, shopping chat, travel capsule. Auth → run → assert response shape.
- Files: `src/test/smoke/*.test.ts` (new)
- Deploy: none

**P0e [TODO]** Migration drift check in CI
- Add `npx supabase migration list --linked` + `npx supabase db push --dry-run` as required CI steps for any PR touching `supabase/migrations/`.
- Files: `.github/workflows/ci.yml`
- Deploy: none

#### Wave 1 — Security (launch-blocking)

**P1 [TODO]** Auth gaps: summarize_day + process_job_queue + daily_reminders
- All three run with no caller identity verification. Add `getUser()` pattern from `detect_duplicate_garment`.
- Files: `supabase/functions/summarize_day/index.ts`, `supabase/functions/process_job_queue/index.ts`, `supabase/functions/daily_reminders/index.ts`
- Deploy: each function individually after merge

**P2 [TODO]** Remove anon-key bypass in calendar sync_all
- `handleSyncAll` accepts anon key OR service-role; anon path enables DoS against Google API. Service-role only.
- Files: `supabase/functions/calendar/index.ts`
- Deploy: `calendar`

**P3 [TODO]** OAuth hardening in google_calendar_auth
- Allowlist `redirect_uri`, replace `state: user.id` with CSRF token + user_id tuple.
- Files: `supabase/functions/google_calendar_auth/index.ts`, `src/pages/GoogleCalendarCallback.tsx`
- Deploy: `google_calendar_auth`

**P4 [TODO]** prefetch_suggestions identity check
- Single-user-trigger mode accepts arbitrary `user_id`. Verify caller's JWT matches `body.user_id`.
- Files: `supabase/functions/prefetch_suggestions/index.ts`
- Deploy: `prefetch_suggestions`

**P5 [TODO]** Email domain fix
- `hello@bursai.com` → `hello@burs.me` in both files.
- Files: `supabase/functions/send_push_notification/index.ts`, `supabase/functions/daily_reminders/index.ts`
- Deploy: both functions

**P6 [TODO]** Outfit ownership check in suggest_accessories
- `outfit_id` from request body queried via service client without user verification.
- Files: `supabase/functions/suggest_accessories/index.ts`
- Deploy: `suggest_accessories`

**P7 [TODO]** Cross-user validation in process_job_queue handlers
- Handlers don't verify `job.user_id` matches garment's user_id.
- Files: `supabase/functions/process_job_queue/index.ts`
- Deploy: `process_job_queue`

**P8 [TODO]** Complete delete_user_account cascade
- Add DELETEs for garment_pair_memory, feedback_signals, analytics_events, chat_messages, outfit_feedback, push_subscriptions, render_jobs, render_credits, render_credit_transactions, travel_capsules, ai_response_cache, ai_rate_limits.
- Files: `supabase/functions/delete_user_account/index.ts`
- Deploy: `delete_user_account`

#### Wave 2 — Rate Limiting & Idempotency

**P9 [TODO]** Add rate limit + overload to 14 functions
- `import_garments_from_links`, `insights_dashboard`, `seed_wardrobe`, `send_push_notification`, `restore_subscription`, `create_portal_session`, `delete_user_account`, `calendar`, `google_calendar_auth`, `daily_reminders`, `process_job_queue`, `process_garment_image`, `generate_outfit`, `cleanup_ai_cache`.
- Files: one per function
- Deploy: 14 functions (one PR, still one deploy each — do them in a batch of 3-4 per session)

**P10 [TODO]** UUID validation in PublicProfile + ShareOutfit
- Validate URL params are UUIDs before `.eq()` queries.
- Files: `src/pages/PublicProfile.tsx`, `src/pages/ShareOutfit.tsx`
- Deploy: none

**P11 [TODO]** Gate seed_wardrobe delete_all
- Require confirmation token in request body before executing destructive op.
- Files: `supabase/functions/seed_wardrobe/index.ts`
- Deploy: `seed_wardrobe`

**P12 [TODO]** DB-backed idempotency
- Replace in-memory cache in `_shared/idempotency.ts` with a `request_idempotency` table (atomic upsert pattern from stripe_events).
- Files: `supabase/functions/_shared/idempotency.ts`, new migration for `request_idempotency` table
- Deploy: all functions using idempotency (create_checkout_session, delete_user_account)

**P13 [TODO]** User-scope 7 cache namespaces
- `style_twin`, `clone_outfit_dna`, `wardrobe_aging`, `wardrobe_gap_analysis`, `smart_shopping_list`, `suggest_accessories`, `travel_capsule` — append `_${userId}` to cacheNamespace.
- Files: one per function (7 files)
- Deploy: 7 functions

**P14 [TODO]** Fix summarize_day events-key + suggest_outfit_combinations 8-char prefix collisions
- User-scope summarize_day cache. Expand suggest_combos prefix to full UUID.
- Files: `supabase/functions/summarize_day/index.ts`, `supabase/functions/suggest_outfit_combinations/index.ts`
- Deploy: both

#### Wave 3 — PhotoRoom Removal + Ghost Mannequin for All Categories

**P15 [TODO]** Unwire PhotoRoom entirely
- Delete `supabase/functions/process_garment_image/`, remove `startGarmentImageProcessingInBackground()` call, remove `image_processing_*` polling from GarmentDetail. Leave DB columns for now.
- Files: `supabase/functions/process_garment_image/` (delete), `src/lib/garmentIntelligence.ts`, `src/pages/GarmentDetail.tsx`, `supabase/functions/process_job_queue/index.ts` (remove handleImageProcessing)
- Deploy: `process_job_queue`

**P16 [TODO]** Category-aware render prompts
- Branch prompt by category: tops/bottoms/dresses/outerwear → true ghost mannequin; shoes → clean product shot; bags → product shot with strap; accessories → styled flat lay; jewelry/watches → clean close-up.
- Files: `supabase/functions/render_garment_image/index.ts`, `supabase/functions/_shared/gemini-image-client.ts`
- Deploy: `render_garment_image`

**P17 [TODO]** Multi-prompt retry chain in render_garment_image
- 3 attempts with different prompt variants before declaring failure. Use validateRenderedGarmentOutputWithGemini as gate on every retry.
- Files: `supabase/functions/render_garment_image/index.ts`
- Deploy: `render_garment_image`

**P18 [TODO]** Tighten validateRenderedGarmentOutputWithGemini
- Expand rejection signals per category. A shoe on a torso = reject.
- Files: `supabase/functions/_shared/render-eligibility.ts`
- Deploy: `render_garment_image` (consumer)

**P19 [TODO]** Add timeouts to gemini-image-client.ts + render-eligibility.ts
- Currently unbounded fetch — can hang indefinitely.
- Files: `supabase/functions/_shared/gemini-image-client.ts`, `supabase/functions/_shared/render-eligibility.ts`
- Deploy: `render_garment_image`

#### Wave 4 — AI Retrieval Quality (Right Garments to Gemini)

**P20 [TODO]** Semantic pre-filter for mood_outfit
- Mood-aware scoring (color, formality, vibe). Send top 40 not all.
- Files: `supabase/functions/mood_outfit/index.ts`
- Deploy: `mood_outfit`

**P21 [TODO]** Gap-aware pre-filter for wardrobe_gap_analysis
- Category coverage scoring. Send relevant sample, not full wardrobe.
- Files: `supabase/functions/wardrobe_gap_analysis/index.ts`
- Deploy: `wardrobe_gap_analysis`

**P22 [TODO]** Shopping-intent pre-filter for smart_shopping_list
- Same pattern, intent-aware.
- Files: `supabase/functions/smart_shopping_list/index.ts`
- Deploy: `smart_shopping_list`

**P23 [TODO]** Fix ID truncation
- `suggest_outfit_combinations`, `wardrobe_aging` use 8-char slices — collision risk. Use full UUIDs in prompts.
- Files: both functions
- Deploy: both

**P24 [TODO]** Enrichment guarantee
- Every AI function pre-checks `ai_raw` populated. If missing, trigger `garment_enrichment` job and either wait or degrade gracefully.
- Files: `supabase/functions/_shared/burs-ai.ts` (helper), consumers update per function
- Deploy: all AI functions (one per session)

**P25 [TODO]** Style DNA context injection
- Include Q1-Q12 onboarding answers in every AI function's system prompt. (Depends on Wave 7's schema.)
- Files: `supabase/functions/_shared/burs-ai.ts`, consumers
- Deploy: all AI functions (batch)

**P26 [TODO]** Remove slot:"unknown" hardcodes
- generate_outfit + unified_stylist_engine return real slot mapping.
- Files: `supabase/functions/generate_outfit/index.ts`, `supabase/functions/_shared/unified_stylist_engine.ts`
- Deploy: `generate_outfit`

**P27 [TODO]** Full audit + fix of clone_outfit_dna retrieval
- Verify it sends right context (currently unaudited).
- Files: `supabase/functions/clone_outfit_dna/index.ts`
- Deploy: `clone_outfit_dna`

#### Wave 5 — Refine Button + AI Chat Fixes

**P28 [TODO]** Refine anchors garment instead of full outfit (user's repro)
- Root cause: refine flow calls unified stylist with mode="swap" + single anchor_garment_id, losing full outfit context. Fix: pass active_look_garment_ids (all current garments) + locked_garment_ids (all except swap target) + requested_edit_slots, mode="refine".
- Files: `src/hooks/useSwapGarment.ts`, `supabase/functions/_shared/unified_stylist_engine.ts`, `supabase/functions/style_chat/index.ts` (refine path)
- Deploy: `style_chat`, `burs_style_engine`

**P29 [TODO]** AI chat activeLook persistence
- Verify `StyleChatActiveLookInput` serializes correctly across messages.
- Files: `supabase/functions/_shared/style-chat-contract.ts`, `supabase/functions/style_chat/index.ts`, `src/pages/AIChat.tsx`
- Deploy: `style_chat`

**P30 [TODO]** style_chat classifier fallback
- When hasActiveLook=true + user says "make it warmer", force intent=refine_outfit not conversation.
- Files: `supabase/functions/_shared/style-chat-classifier.ts`
- Deploy: `style_chat`

**P31 [TODO]** RefineChips/RefineBanner payload fix
- Send full outfit payload, not anchor-only.
- Files: `src/components/chat/RefineChips.tsx`, `src/components/chat/RefineBanner.tsx`
- Deploy: none

#### Wave 6 — Localization

**P32 [TODO]** Extend langName maps to 14 locales
- `mood_outfit`, `smart_shopping_list`, `wardrobe_aging`, `clone_outfit_dna`, `travel_capsule`
- Files: 5 functions
- Deploy: 5 functions

**P33 [TODO]** Localize NotFound + Auth + ResetPassword
- Entire NotFound.tsx + placeholders in Auth.tsx + ResetPassword.tsx. Add keys to en.ts + sv.ts.
- Files: 3 pages + 2 locale files
- Deploy: none

**P34 [TODO]** Localize ShareOutfit + PublicProfile meta tags
- og:title/description, fallbacks.
- Files: `src/pages/ShareOutfit.tsx`, `src/pages/PublicProfile.tsx`
- Deploy: none

**P35 [TODO]** Localize AddGarment + LiveScan + OutfitDetail + Onboarding fallbacks
- Hardcoded English/Swedish strings in four pages.
- Files: 4 pages + 2 locale files
- Deploy: none

**P36 [TODO]** Localize Insights.tsx
- Weekday abbreviations via date-fns locale, axis labels, eyebrow, title fallback.
- Files: `src/pages/Insights.tsx` + 2 locale files
- Deploy: none

**P37 [TODO]** Localize MoodOutfit MOODS + MOOD_MAP
- 12 moods with hint strings per locale.
- Files: `src/pages/MoodOutfit.tsx`, `supabase/functions/mood_outfit/index.ts` (MOOD_MAP keys)
- Deploy: `mood_outfit`

**P38 [TODO]** Extend token lists to all 14 locales
- outfit-rules.ts, burs-slots.ts, travel-capsule-planner.ts — currently English + Swedish only.
- Files: 3 shared modules
- Deploy: ALL AI functions importing these modules (huge redeploy — batch across sessions)

**P39 [TODO]** Localize day-intelligence.ts OCCASION_RULES
- Tags per locale.
- Files: `supabase/functions/_shared/day-intelligence.ts`
- Deploy: consumers (burs_style_engine, style_chat, etc.)

**P40 [TODO]** Multi-locale regexes
- OutfitGenerate FORMAL_KEYWORDS + shopping_chat CHAT_SHORT_RE.
- Files: `src/pages/OutfitGenerate.tsx`, `supabase/functions/shopping_chat/index.ts`
- Deploy: `shopping_chat`

**P41 [TODO]** Fix UnusedOutfits Swedish/English key mixing
- Files: `src/pages/UnusedOutfits.tsx`
- Deploy: none

#### Wave 7 — Onboarding Rebuild (Full 8-Step per Spec)

**P42 [TODO]** Migration: 4 new profiles columns
- `onboarding_step`, `onboarding_garment_count`, `onboarding_started_at`, `onboarding_completed_at`. With CHECK constraint on step values.
- Files: new migration `supabase/migrations/<ts>_onboarding_state.sql`
- Deploy: none (migration only, post-merge db push)

**P43 [TODO]** Onboarding rate-limit boost in scale-guard
- 2000/hour + 100/min for first 24h after `onboarding_started_at`.
- Files: `supabase/functions/_shared/scale-guard.ts`
- Deploy: all AI functions using scale-guard (batch)

**P44 [TODO]** Route gate enforcement
- `onboarding_step !== 'completed'` → redirect. Auth/paywall exempt. Deep-link blocker.
- Files: `src/components/auth/ProtectedRoute.tsx`, `src/App.tsx` (AnimatedRoutes)
- Deploy: none

**P45 [TODO]** Style DNA Quiz — 12-question rebuild
- Replace existing QuickStyleQuiz with Q1-Q12 spec (identity, lifestyle, climate, style, color, fit, formality, fabric, occasions, shopping, goals, cultural). Save to profiles.preferences.styleProfile (v4 shape).
- Files: `src/components/onboarding/QuickStyleQuiz.tsx`, `src/components/onboarding/StyleQuizV4.tsx` (new), `src/pages/Onboarding.tsx`
- Deploy: none

**P46 [TODO]** PhotoTutorial screen (NEW)
- Visual guide, "I'm ready" button to advance.
- Files: `src/components/onboarding/PhotoTutorialStep.tsx` (new), `src/pages/Onboarding.tsx`
- Deploy: none

**P47 [TODO]** BatchCapture screen (NEW)
- Min 20, recommended 30, max 50. Each save sets `onboarding_garment_count++`. Progress persists.
- Files: `src/components/onboarding/BatchCaptureStep.tsx` (new), `src/pages/Onboarding.tsx`
- Deploy: none

**P48 [TODO]** Achievement screen + grantTrialGift
- Call `grantTrialGift(userId, 3, idempotencyKey)` on screen entry (idempotent).
- Files: `src/components/onboarding/AchievementStep.tsx` (new), edge function integration
- Deploy: none

**P49 [TODO]** StudioSelection screen (NEW)
- User picks exactly 3 garments. Enqueue 3 render_jobs with source='trial_gift'. Cannot skip/close.
- Files: `src/components/onboarding/StudioSelectionStep.tsx` (new), `src/hooks/useEnqueueRenderJob.ts` (verify)
- Deploy: none

**P50 [TODO]** CoachTour — linear tour ending on rendered garment
- Home → Wardrobe → Outfits → AI Chat → Garment Detail (one of the 3 selected). Realtime subscription to render_status.
- Files: `src/components/onboarding/CoachTour.tsx` (new), realtime integration
- Deploy: none

**P51 [TODO]** Reveal — final tutorial page
- Show studio render with wow copy. If not yet ready, realtime reveal. If failed, auto-retry once + use original until ready.
- Files: `src/components/onboarding/RevealStep.tsx` (new)
- Deploy: none

#### Wave 8 — Subscription Model Enforcement (Subscription-Only)

**P52 [TODO]** Auto-start trial on signup
- Stripe customer create + subscription with 3-day trial on signup. Set onboarding_started_at.
- Files: `supabase/functions/<new: start_trial>/index.ts` OR extend create_checkout_session, `src/pages/Auth.tsx`
- Deploy: new/updated function

**P53 [TODO]** Remove free tier from useSubscription
- States: `trial` | `premium` | `locked`. No `free` path.
- Files: `src/hooks/useSubscription.ts`, PaywallModal, all gates
- Deploy: none

**P54 [TODO]** Day-4 lockout enforcement
- All AI endpoints check subscription.status + plan. Lockout → 402 response with paywall redirect.
- Files: `supabase/functions/_shared/scale-guard.ts` (new `enforceSubscription` helper), consumers
- Deploy: all AI functions (batch)

**P55 [TODO]** Paywall page with Restore Purchase button
- Required by App Store. Hook `restore_subscription` to button.
- Files: `src/components/PaywallModal.tsx`, `src/pages/marketing/Paywall.tsx` (if needed)
- Deploy: none

**P56 [TODO]** SEK pricing in Stripe
- Create monthly 119 SEK + yearly 899 SEK price IDs in Stripe dashboard. Update env vars.
- Files: `.env.example`, deploy config docs
- Deploy: `create_checkout_session`, `stripe_webhook` (pick up new env)

**P57 [TODO]** Credit priority verification
- Confirm `reserve_credit_atomic` applies trial_gift → monthly → topup. (Likely already correct, verify.)
- Files: `supabase/functions/_shared/render-credits.ts` (verify comments), migration if RPC needs change
- Deploy: none if verified

#### Wave 9 — Capacitor Migration (After Web Finished)

**P58 [TODO]** Capacitor scaffold + iOS/Android projects
- `npx cap init`, configure, iOS + Android folders.
- Files: `capacitor.config.ts`, `ios/`, `android/`
- Deploy: none

**P59 [TODO]** Camera: Median → @capacitor/camera
- Files: `src/hooks/useMedianCamera.ts` (delete), new `src/hooks/useCamera.ts`, all consumers (AddGarment, LiveScan)
- Deploy: none

**P60 [TODO]** Status bar: Median → @capacitor/status-bar
- Files: `src/hooks/useMedianStatusBar.ts` (delete), new hook, consumers
- Deploy: none

**P61 [TODO]** Haptics: Median bridge → @capacitor/haptics
- Files: `src/lib/haptics.ts`
- Deploy: none

**P62 [TODO]** Deep links via @capacitor/app
- Files: app init, routing
- Deploy: none

**P63 [TODO]** Push notifications via @capacitor/push-notifications
- Replace web push where native better.
- Files: push subscription flow
- Deploy: none

**P64 [TODO]** Splash screen + app icon + launch screen
- Files: iOS/Android assets
- Deploy: none

**P65 [TODO]** iOS Info.plist permissions
- Camera, photo library usage descriptions.
- Files: `ios/App/App/Info.plist`
- Deploy: none

**P66 [TODO]** Android manifest permissions
- Files: `android/app/src/main/AndroidManifest.xml`
- Deploy: none

**P67 [TODO]** Safe-area via Capacitor
- Replace Median approach.
- Files: CSS + layout components
- Deploy: none

**P68 [TODO]** Share API via @capacitor/share
- Files: `src/lib/nativeShare.ts`
- Deploy: none

**P69 [TODO]** Remove all Median files + lib/median.ts
- Files: delete 3 files + any import cleanups
- Deploy: none

#### Wave 10 — RevenueCat + StoreKit IAP (Parallel with Capacitor End-Stage)

**P70 [TODO]** RevenueCat account + SDK install
- `npm install @revenuecat/purchases-capacitor`.
- Files: `package.json`, init code
- Deploy: none

**P71 [TODO]** RevenueCat webhook → Supabase mirror function
- New edge function that mirrors RC subscription state to `subscriptions` table (parallel to Stripe webhook).
- Files: `supabase/functions/revenuecat_webhook/index.ts` (new)
- Deploy: new function

**P72 [TODO]** Configure products in App Store Connect + RevenueCat dashboard
- Monthly/yearly SKUs matching Stripe.
- Files: docs only
- Deploy: none

**P73 [TODO]** Client-side purchase flow
- RevenueCat Offerings → purchase → confirm.
- Files: `src/hooks/useRevenueCat.ts` (new), `src/components/PaywallModal.tsx`
- Deploy: none

**P74 [TODO]** Restore purchases flow (App Store requirement)
- Files: Paywall + Settings
- Deploy: none

**P75 [TODO]** Dual-path billing resolver
- iOS=RevenueCat, Android/Web=Stripe. Both write to `subscriptions` table.
- Files: `src/hooks/useSubscription.ts`
- Deploy: none

**P76 [TODO]** iOS introductory offer (3-day trial via StoreKit)
- Configure in App Store Connect. Verify it fires on first purchase.
- Files: RC config
- Deploy: none

**P77 [TODO]** Receipt validation defense endpoint
- RC handles most, but keep a verify endpoint for defense-in-depth.
- Files: `supabase/functions/verify_iap_receipt/index.ts` (new)
- Deploy: new function

#### Wave 11 — Launch Prep

**P78 [TODO]** App Store Connect listing
- Screenshots, app description, privacy policy URL, support URL.
- Files: assets only
- Deploy: none

**P79 [TODO]** App Privacy labels (ATT if needed)
- Files: App Store Connect config
- Deploy: none

**P80 [TODO]** TestFlight beta
- Internal testers first, then external.
- Files: build upload
- Deploy: none

**P81 [TODO]** Play Store listing + production monitoring + launch checklist
- Screenshots, description. Sentry alerts, Supabase log retention, render queue depth dashboard.
- Files: config + docs
- Deploy: none

### Findings Log

New findings discovered during implementation (not in the original audit). Agent MUST add here when spotted out of scope.

| Date | Prompt | Location | Description | Action |
|------|--------|----------|-------------|--------|
| — | — | — | — | — |

### Completion Log

| Date | PR | Prompt | Summary |
|------|-----|--------|---------|
| — | — | — | — |

## Prompt Workflow — Do This After Every Single Prompt

### Step 1 — Verify code quality

```bash
npx tsc --noEmit --skipLibCheck     # must return 0 errors
npx eslint src/ --ext .ts,.tsx --max-warnings 0   # must return 0 warnings
npm run build                        # must complete with no warnings (not just no errors)
```

The build check is mandatory — not optional. tsc passes things that Vite's bundler catches at runtime (circular dependencies, TDZ errors, chunk issues). If npm run build warns about anything, fix it before committing.

If tests exist for the touched area:
```bash
npx vitest run src/path/to/__tests__/File.test.tsx
```

### Step 2 — Git (every prompt, no exceptions)

```bash
git checkout -b prompt-[N]-[2-3-word-slug] main
git add -A
git commit -m "Prompt [N]: [what changed in plain English]"
git push origin prompt-[N]-[2-3-word-slug]
gh pr create --title "Prompt [N]: [title]" --body "[what and why]"
```

### Step 3 — If a deploy is listed in the prompt

```bash
npx supabase functions deploy [function-name] --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

Deploy ONE function at a time. Wait for CLI confirmation before the next.

### Step 4 — Report back in this exact format

```
✅ TypeScript: 0 errors
✅ Lint: 0 warnings
✅ Build: clean (no warnings)
✅ Tests: [passed / not applicable]
✅ Committed: [hash] on branch [name]
✅ Deployed: [function names, or "none"]
⚠️ Notes: [anything unexpected, or "none"]
PR: [URL]
```

## Fix Protocol — Mandatory for Every Launch Plan Prompt

### Before writing code
1. Read ONLY the files named in the prompt's scope.
2. If the fix touches shared code (`_shared/*.ts`, a hook, a context, a type), list every importer in the PR body's "Dependency radius" section.
3. Write a 3-bullet plan: what changes, why, what could break.

### While writing code
1. Minimum change that solves the stated problem.
2. No refactors, renames, or "while I'm here" cleanup unless the prompt explicitly scopes them.
3. If a second bug is found: note it in the PR body under "Out of scope" AND add it to the Launch Plan Findings Log. Do NOT fix it in this prompt.

### Before committing — run the full pipeline
- `npx tsc --noEmit --skipLibCheck` → 0 errors
- `npx eslint src/ --ext .ts,.tsx --max-warnings 0` → 0 warnings
- `npm run build` → clean, no warnings
- `npx vitest run` → existing tests pass
- If an edge function changed: `deno check supabase/functions/<name>/index.ts`

### Before pushing — invoke the code-reviewer subagent
Use `Agent(subagent_type="superpowers:code-reviewer", ...)` with this brief:

> Review this diff against main. Check: (1) does the fix solve the stated problem? (2) are any callers of changed symbols broken? (3) are types still correct across the dependency radius? (4) did any feature regress? Report in under 200 words.

Do NOT open the PR if the reviewer flags a regression. Fix it, re-run the pipeline, re-review.

### PR body template
```
## Problem
[1 sentence, the bug this fixes]

## Fix
- [bullet list of changes]

## Dependency radius
[files that import any changed symbol]

## Verification
- TypeScript: 0 errors
- Lint: 0 warnings
- Build: clean
- Tests: passed
- Code-reviewer: approved

## Out of scope
[anything spotted but not fixed — also added to Launch Plan Findings Log]
```

### After PR merge — End-of-Session Update
1. Flip the prompt's status in the Launch Plan from `[WIP]` to `[DONE] (PR #<num>, YYYY-MM-DD)`
2. Move `CURRENT PROMPT` pointer to the next `[TODO]` prompt
3. Update `LAST UPDATED` to today
4. Append a row to the Completion Log
5. Add any new findings to the Findings Log
6. Commit this CLAUDE.md update **as part of the same PR** (one atomic PR per prompt)

## Hard Rules — Never Break These

- Never push directly to main — all changes via PR
- Never merge to main from within Claude Code — merging is the user's decision after testing
- Never deploy all functions at once — always name the specific function
- Never use `deploy --all` — forbidden
- Never run a DB migration without the user explicitly asking for one
- Never apply a migration via MCP `apply_migration` without also committing a matching `supabase/migrations/<timestamp>_<name>.sql` file in the same PR — timestamp must equal the one MCP recorded on the remote (see Database Migration Rules)
- Never delete DB schema fields
- Never add new npm packages without asking first
- Never add new edge functions unless the prompt explicitly says to
- Never touch Median-specific code until Wave 9 — `src/hooks/useMedianCamera.ts`, `src/hooks/useMedianStatusBar.ts`, `src/lib/median.ts` — Capacitor migration is scoped in Wave 9 (P59-P69) of the Launch Plan
- `src/integrations/supabase/types.ts` — auto-generated, never edit manually
- `src/i18n/locales/en.ts` and `sv.ts` — append-only, never reorganise existing keys
- Never use `getClaims()` in edge functions — deprecated, broken. Use `getUser()` pattern instead
- Never use `localStorage` or `sessionStorage` in React artifacts — use React state

## Token Conservation Rules

- Never read a file unless it is explicitly listed in the prompt
- Never read more than 3 files per prompt unless instructed
- Never search the entire codebase — use targeted grep with specific patterns only
- If context from a previous prompt is needed, ask the user rather than re-reading files
- Prefer `grep -n "pattern" file.ts` over reading entire files

## Branch and Commit Naming

Branch: `prompt-[number]-[2-3-word-slug]`
Examples: `prompt-2-image-quality`, `prompt-7-rate-limits`, `prompt-8-ghost-mannequin`

Commit: `"Prompt [N]: [what changed in plain English]"`
Examples:
- `"Prompt 2: Raise live scan image quality to 1024px/0.85"`
- `"Prompt 7: Add noTierMultiplier to scale-guard, analyze_garment 30/min flat"`
- `"Prompt 8: Chain enrichment before render in triggerGarmentPostSaveIntelligence"`

## Backend Deploy Rules

Only deploy when the prompt's instructions explicitly say to deploy.

Exact command format — never deviate:
```bash
npx supabase functions deploy [function-name] --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

Deploy from the local branch, not from main.

### Shared Module Deploy Map

If you change any file in `supabase/functions/_shared/`, you must redeploy EVERY function that imports from it. Shared modules are bundled individually into each function — a shared file change is invisible until the dependent function is redeployed.

| Shared file | Functions that must be redeployed |
|-------------|-----------------------------------|
| `_shared/burs-ai.ts` | All 22 AI functions |
| `_shared/scale-guard.ts` | All AI functions |
| `_shared/style-chat-contract.ts` | `style_chat` only |
| `_shared/style-chat-normalizer.ts` | `style_chat` only |
| `_shared/outfit-scoring.ts` | `burs_style_engine` |
| `_shared/outfit-combination.ts` | `burs_style_engine` |
| `_shared/unified_stylist_engine.ts` | `style_chat` |
| `_shared/cors.ts` | All functions |

## Database Migration Rules

Migrations are the most fragile part of this repo. Drift between local files and the remote `supabase_migrations.schema_migrations` table breaks `npx supabase db push` and forces every future migration through MCP workarounds. Hard rules below prevent that.

### How drift happens (so you can avoid it)

Each time a migration is applied via MCP `apply_migration` or the Studio UI, Postgres stamps it with a fresh UTC timestamp and adds a row to `schema_migrations`. If the matching `.sql` file in `supabase/migrations/` has a different timestamp (or doesn't exist), the CLI sees "Local has X, Remote has Y" and refuses to push until the two sides are reconciled. Timestamps must match exactly — filename-based matching is all the CLI does.

### Never create drift

- When applying a migration via MCP, immediately create `supabase/migrations/<timestamp>_<name>.sql` with the timestamp the MCP call returned. Commit it in the same PR.
- If MCP rejects a first attempt (syntax error, missing extension, etc.) and you apply a fixed version under a different name, **delete or rename the rejected .sql file** — do not leave both in the repo.
- Do not use Studio UI to make schema changes. Studio records migrations with UUID names and no repo file — drift guaranteed.
- `npx supabase db push` is the only supported way to apply migrations from main post-merge.

### Pre-merge verification — REQUIRED for any PR touching `supabase/migrations/`

Run these from the PR branch BEFORE merging:

```bash
npx supabase migration list --linked
```
Every row must show matching Local and Remote columns. Any row with only one side populated is drift — fix it before merging. New migrations introduced by the PR will show as Local-only until post-merge push, which is expected.

```bash
npx supabase db push --linked --dry-run --yes
```
If the PR introduces new migrations: the dry-run should list exactly those migrations as pending.
If the PR is non-migration work: must report "Remote database is up to date."

### Post-merge deploy

**Default** — after merging a PR with migrations, from main:

```bash
npx supabase db push --linked --yes
```

**Exception — backdated migrations.** If a PR introduces a migration with a timestamp EARLIER than migrations already on remote (drift-repair or schema-catch-up work only), the CLI refuses the default command and requires explicit consent:

```bash
npx supabase db push --linked --yes --include-all
```

Only use `--include-all` after verifying:
1. The backdated migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `IF NOT EXISTS` guards on policies/indexes, etc.) so re-running against an already-applied schema is a no-op.
2. Running the full migration chain in timestamp order from an empty DB produces a schema matching production. Mental walkthrough of the chain is the minimum bar; a fresh Supabase project test is the real bar.
3. `npx supabase migration list --linked` shows the backdated migration as the only Local-only row.

Normal day-to-day migrations always append at the end of the chain and never need `--include-all`. It is a flag for drift cleanup specifically.

Deploy edge functions only after `db push` succeeds, so functions never hit a pre-migration schema.

### Migration drift repair strategy

When remote `applied_at` timestamps don't match local file timestamps (accumulated drift — the pattern that PR #419 repaired), there are two reconciliation strategies. The choice matters because `supabase migration list` compares only timestamps — a rename on the local side turns the file into a *new* migration version from the CLI's perspective.

**Strategy A — rename local files to match remote timestamps.** What PR #419 did for BURS. Safe ONLY when you are certain no environment other than production has applied the pre-rename versions. Renaming orphans any environment that applied the old timestamp — on its next `db push`, the CLI sees the renamed file as a new migration and tries to re-run it. Non-idempotent statements (plain `CREATE POLICY`, `CREATE TRIGGER`, `ALTER TABLE ADD COLUMN` without `IF NOT EXISTS`) will then fail with duplicate errors and block the push.

**Strategy B — `supabase migration repair`.** Preserve local filenames, update remote tracking via:

```bash
npx supabase migration repair --status applied <local_timestamp>
npx supabase migration repair --status reverted <remote_timestamp>
```

Tells every CLI client "treat the new timestamp as already applied, forget the old one." No file rename — so no orphaned environments.

**Rule:** For solo pre-launch work (current BURS state — no CI, no preview branches, no other developers), **rename is acceptable**. The moment a second developer, CI pipeline, or staging environment joins the workflow, `migration repair` becomes the default drift-repair strategy. Update this rule when that transition happens.

**Local repair if you ever hit this:** If your local Supabase has the pre-rename migrations applied and `supabase db push` fails with duplicate-policy or similar errors:

```bash
npx supabase migration repair --status applied <new_timestamp>
npx supabase migration repair --status reverted <old_timestamp>
```

### Secrets inside migrations — never in custom GUCs

If a migration body (including pg_cron schedule bodies) needs to authenticate to the app's own services, store the secret in `vault.secrets`, not in an `app.*` custom GUC.

Why: any `authenticated` Postgres role can read `current_setting('app.*', true)`. Verified on production 2026-04-17 by running `SET LOCAL ROLE authenticated; SELECT current_setting('app.test_leak', true)` — the value came back. So a custom GUC containing the service-role key would be readable by every logged-in user → account takeover.

`vault.decrypted_secrets` is restricted to the postgres superuser role. pg_cron runs as superuser, so it reads the decrypted value at cron-exec time. Authenticated users see nothing.

**Secret storage pattern:**

```sql
-- One-time insert, via Supabase SQL editor:
INSERT INTO vault.secrets (name, secret)
VALUES ('<key-name>', '<secret-value>')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
```

**Cron-body read pattern — two choices, pick by failure-mode preference:**

- **NULL-propagation (preferred for new code):** if the secret is missing, the SELECT returns NULL, which propagates through `||` and raises a not-null violation inside `net.http_post`. The failure lands in `cron.job_run_details` with `status='failed'` — loud operational signal.
  ```sql
  Authorization: 'Bearer ' || (
    SELECT decrypted_secret FROM vault.decrypted_secrets
    WHERE name = '<key-name>' LIMIT 1
  )
  ```
- **COALESCE-to-empty-string (legacy):** a missing secret yields a 401 with `status='succeeded'`, `return_message='401'`. Safer during migration apply (no SQL error) but hides the broken state in standard monitoring.
  ```sql
  Authorization: 'Bearer ' || COALESCE(
    (SELECT decrypted_secret FROM vault.decrypted_secrets
     WHERE name = '<key-name>' LIMIT 1),
    ''
  )
  ```

Prefer NULL-propagation for new cron bodies — the P5 `process-render-jobs` schedule uses this pattern specifically because Codex round 8 caught that the COALESCE version made a skipped-secret deploy invisible.

### Endpoint URLs inside migrations — also in vault, not hardcoded

Same rationale as the secret-storage rule, one step further: if a cron body (or any migration SQL) does an HTTP POST to the project's own functions endpoint, the base URL MUST come from `vault.secrets`, not a hardcoded `https://<project-ref>.supabase.co` string. A hardcoded URL cross-contaminates any non-production environment that applies the migration — every cron tick on a preview branch or a second project would POST to production, processing prod's queue and ignoring the local environment's own. Codex round 15 caught this on the P5 cron.

```sql
-- One-time insert per environment, alongside service_role_key:
INSERT INTO vault.secrets (name, secret)
VALUES ('functions_base_url', 'https://<this environment''s project ref>.supabase.co')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;

-- Cron body constructs the URL at exec time:
url := (
  SELECT decrypted_secret FROM vault.decrypted_secrets
  WHERE name = 'functions_base_url' LIMIT 1
) || '/functions/v1/<function-name>'
```

No trailing slash on the stored base URL — the cron body appends the `/functions/v1/<name>` path. Same NULL-propagation rule applies: a missing URL secret raises a not-null violation in `net.http_post`, producing `status='failed'` in `cron.job_run_details`.

### Post-deploy smoke tests

Any migration that introduces a new pg_cron schedule must include a post-deploy smoke test in the PR description. Template:

```sql
-- 1. Migration applied?
SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = '<job_name>') AS cron_registered;

-- 2. All secrets inserted (if the cron body needs them)?
-- For crons that POST to own-project edge functions, expect BOTH
-- service_role_key AND functions_base_url.
SELECT name FROM vault.secrets
WHERE name IN ('<secret_name_1>', '<secret_name_2>' /* ... */)
ORDER BY name;

-- 3. Wait one cron interval, then check execution result:
SELECT status, return_message, start_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = '<job_name>')
ORDER BY start_time DESC
LIMIT 3;
```

If `status != 'succeeded'` or `return_message != '200'`, the cron is silently broken — fix before considering the deploy done.

### P5 first-time-deploy vault inserts (post-merge for PR #421)

After `npx supabase db push --linked --yes` applies the P5 migration on a new environment (production, preview branch, or any non-prod project where the cron should run), run this ONCE in Supabase SQL editor:

```sql
INSERT INTO vault.secrets (name, secret)
VALUES
  ('service_role_key',   '<this environment''s service_role key>'),
  ('functions_base_url', 'https://<this environment''s project ref>.supabase.co')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
```

Verify with the smoke test template above. Skipping either insert leaves the 60s safety-net cron dead (client-initiated POSTs via `enqueue_render_job` still work, so user traffic isn't blocked — but stale / stuck jobs won't self-recover until the vault step is completed).

## Project Identity

| Field | Value |
|-------|-------|
| App | BURS — AI-powered wardrobe management and personal stylist |
| Founder | Solo, non-technical background, AI-assisted development throughout |
| Repo | borna-z/bursai on GitHub |
| Working directory | `C:\Users\borna\OneDrive\Desktop\BZ\Burs\bursai-working` |
| Distribution | React/Vite web app on Vercel, currently wrapped for iOS/Android via Median.co — Capacitor migration planned in ~2 months |
| Backend | Supabase (PostgreSQL + 39 edge functions, project ref: `khvkwojtlkcvxjxztduj`, region: eu-central-1) |
| AI | Gemini API via OpenAI-compatible endpoint. Model routing: trivial/standard → Flash Lite primary (Flash fallback), complex → Flash primary (Flash Lite fallback) |
| Target market | Sweden first, then Nordics/UK/Netherlands, US year two |
| Pricing | $7.99/month, $69.99/year. Binary free/premium model |
| Domain | burs.me via IONOS DNS to Vercel nameservers |

## Build & Dev Commands

```bash
npm run dev            # local dev server on port 8080
npm run build          # production build (Vite) — must be warning-free
npm run build:dev      # development build
npm run lint           # ESLint (ignores supabase/**)
npm run typecheck      # tsc --noEmit
npm test               # Vitest + jsdom
npm run test:watch     # watch mode
npx vitest run src/path/to/File.test.tsx  # single test file
npm run test:coverage  # 30% line threshold
```

## Design System — Source of Truth

### Brand Palette

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| Editorial Cream | hsl(34 32% 95%) | #F5F0E8 | Background |
| Deep Charcoal | hsl(24 13% 10%) | #1C1917 | Foreground |
| Warm Gold | hsl(37 47% 46%) | #B07D3A | Accent (CORRECT) |
| Card surface | hsl(30 32% 98%) | near-white warm | Cards |
| Border | hsl(31 29% 84%) | — | Borders |

The accent is warm gold — NOT indigo. If you see `--accent: 229` anywhere, that's wrong. Fix it to `37 47% 46%`.

### Typography

- Display/emotional headlines: `font-['Playfair_Display'] italic`
- Body/UI copy: `font-['DM_Sans']`
- Never use: Inter, Roboto, Arial, Space Grotesk (legacy, replaced)

### Design Principles

- Light mode: flat surfaces, no shadows, editorial feel — Scandinavian magazine aesthetic
- Dark mode: rich, warm charcoal with subtle shadows — not cold/blue
- Borders: use `border-border/40` (not /30 — too faint in dark mode)
- Radius: `--radius: 1.125rem` — rounded but not bubbly
- Motion: Framer Motion throughout. Use `EASE_CURVE` from `src/lib/motion.ts`
- Micro-interactions: `hapticLight()` on every tap (`src/lib/haptics.ts`)

## Architecture

**Stack**: React 18 + TypeScript 5.8 + Vite, Supabase, TanStack React Query v5, Radix UI + shadcn/ui + Tailwind CSS, Framer Motion

**Path alias**: `@/` maps to `src/`

### Data Flow

- **5 contexts**: AuthContext, ThemeContext, LanguageContext (14 locales, RTL for ar/fa), LocationContext, SeedContext
- **React Query**: offline-first, staleTime 2min, gcTime 30min, retry 1, no refetch on window focus
- **Pages**: lazy-loaded via React Router v6 in `AnimatedRoutes.tsx`, wrapped in `ProtectedRoute`
- **Error handling**: ErrorBoundary + Sentry (20% trace sample rate)

### Edge Functions

- 39 functions, snake_case dirs, each with `index.ts` (Deno runtime, ESM URL imports)
- Shared utilities in `_shared/`
- All functions: `verify_jwt = false` in config.toml, validate JWT manually with `getUser()`
- All AI edge functions must use `enforceRateLimit()` + `checkOverload()` + pass `functionName` to `callBursAI()`

### Rate Limit Tiers (scale-guard.ts)

- free: 0.75x of base limits
- premium: 2.0x of base limits
- `analyze_garment` has `noTierMultiplier: true` — same 30/min limit for all users
- `style_chat`: 60/hour, 15/minute

## Hook Ordering Rule (critical — prevents TDZ bundle crashes)

React hooks that produce values used by other hooks must be declared BEFORE the hooks that consume them. This is not enforced by TypeScript or lint but causes runtime crashes in Vite's production bundle.

Example of the bug:
```typescript
// WRONG — handleAutoCapture uses optimalCropRatio before it exists
const handleAutoCapture = useCallback(() => {
  capture(ref.current, optimalCropRatio); // TDZ crash
}, [optimalCropRatio]);

const { optimalCropRatio } = useAutoDetect({ onStable: handleAutoCapture });
```

For circular dependencies between hooks, use the stable ref pattern:
```typescript
const callbackRef = useRef<() => void>(() => {});
const { optimalCropRatio } = useAutoDetect({
  onStable: useCallback(() => callbackRef.current(), []),
});
const handleAutoCapture = useCallback(() => { ... }, [optimalCropRatio]);
useEffect(() => { callbackRef.current = handleAutoCapture; }, [handleAutoCapture]);
```

## Key Component Inventory

### God Components (large — surgical changes only)

| File | Notes |
|------|-------|
| `supabase/functions/style_chat/index.ts` | ~2300 lines — never edit as whole file |
| `src/pages/AddGarment.tsx` | Large — split in progress |
| `src/pages/Wardrobe.tsx` | Large — split in progress |

### Critical Files — Never Touch

| File | Reason |
|------|--------|
| `src/pages/Insights.tsx` | Permanently frozen |
| `src/integrations/supabase/types.ts` | Auto-generated |
| `src/i18n/locales/en.ts` | Append-only |
| `src/i18n/locales/sv.ts` | Append-only |
| `src/hooks/useMedianCamera.ts` | Capacitor migration pending |
| `src/hooks/useMedianStatusBar.ts` | Capacitor migration pending |
| `src/lib/median.ts` | Capacitor migration pending |

### Hook Patterns

`useGarmentCount()` `useFlatGarments()` `useGarments()` `useProfile()` `useOutfits()` `usePlannedOutfitsForDate(dateStr)` `useStyleDNA()` `useFirstRunCoach()` `useWeather({ city })` `hapticLight()`

## Database Schema (28 tables)

### Core

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (display_name, preferences, home_city, height/weight, stripe_customer_id, is_premium, mannequin_presentation) |
| `garments` | Wardrobe items (title, category, subcategory, colors, material, pattern, fit, formality, season_tags, wear_count, enrichment_status, render_status) |
| `outfits` | Outfit definitions |
| `outfit_items` | Junction: garment + outfit + slot |
| `wear_logs` | Wear history |
| `planned_outfits` | Calendar planner entries |

### AI & Analytics

| Table | Purpose |
|-------|---------|
| `ai_response_cache` | DB-backed AI cache (cache_key, response, expires_at, hit_count) |
| `ai_rate_limits` | Per-user per-function call tracking |
| `analytics_events` | Observability (event_type, metadata: fn, model, latency_ms, status, cost_usd) |
| `chat_messages` | Conversation history |
| `feedback_signals` | Implicit learning from user actions |
| `garment_pair_memory` | Positive/negative garment pairings |
| `job_queue` | Async job processing |

### Billing

| Table | Purpose |
|-------|---------|
| `subscriptions` | Stripe subscription state — source of truth |
| `user_subscriptions` | Legacy plan tracking |
| `stripe_events` | Webhook idempotency log |

## Infrastructure Facts

| System | Details |
|--------|---------|
| SMTP | Resend — do NOT use IONOS SMTP |
| iOS Payments | StoreKit only — Stripe CANNOT be used for digital goods on iOS |
| Web Payments | Stripe checkout + webhook |
| Frontend | Vercel |
| Backend | Supabase (PostgreSQL + Edge Functions + Auth + Storage) |
| Camera | Median.co native bridge currently — Capacitor replaces this in ~2 months |
| Service Worker | `public/sw.js` — static file, no Vite plugin. Cache name must be bumped (`burs-v3` currently) when deploying changes that affect lazy-loaded chunks |

## Testing Conventions

- Tests co-located in `__tests__/` subdirectories
- Test setup: `src/test/setup.ts`
- 30% line coverage threshold — do not drop below
- When adding a new hook: add `__tests__/useMyHook.test.tsx`
- Update existing test assertions when changing default values (e.g. compression quality)

## Environment Variables

### Frontend (required)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Frontend (optional)
- `VITE_SENTRY_DSN`

### Edge Functions (required)
- `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Edge Functions (feature-specific)
- Stripe: `STRIPE_MODE`, `STRIPE_SECRET_KEY_TEST`/`_LIVE`, `STRIPE_WEBHOOK_SECRET_TEST`/`_LIVE`
- Push: VAPID keys
- OAuth: Google OAuth keys

## Vite Chunk Splitting (do not change)

Manual chunks: React, TanStack Query, Radix UI, Framer Motion, Supabase, date-fns, Sentry.
`@imgly/background-removal` excluded from dependency optimization (WASM, loads separately).
