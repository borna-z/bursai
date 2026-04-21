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

**CURRENT PROMPT:** P6
**LAST UPDATED:** 2026-04-21
**TOTAL SCOPE:** 84 prompts across 12 waves

### How to Resume the Plan

When the user says "continue the launch plan" (or equivalent like "next prompt", "continue", "keep going"):
1. Read `CURRENT PROMPT` above.
2. Open `LAUNCH_PLAN.md` at the project root and find the matching prompt heading — that file holds the full spec (problem, fix, files, acceptance, deploy) for every prompt. The compact list below in THIS file is for status tracking only.
3. Load ONLY the files named in the prompt's `Files` section (respect Token Conservation rules).
4. Follow the Fix Protocol (section below).
5. Update the Launch Plan status AS PART of the fix PR (not after merge — see "Launch Plan Update" below).

### Status Legend
- `[TODO]` — not started
- `[WIP]` — branch open, PR not yet merged
- `[DONE]` — merged to main (PR link appended)
- `[DONE-partial]` — prompt has been split; a partial scope merged in one PR and the rest is tracked by explicit follow-up prompts (e.g., `Px-ii`, `Px-iii`). Use only when the split is recorded in LAUNCH_PLAN.md and new follow-up prompts are inserted in the prompt list below.
- `[BLOCKED]` — waiting on user decision, external dep, or failing CI
- `[SKIP]` — user decided not to do this prompt

### Launch Plan Update (BEFORE opening the PR, included IN the PR)

The tracker update lives INSIDE the fix PR — not after merge. The user's merge ratifies both the fix and the tracker state atomically. Agents cannot add commits to an already-merged PR, so the update MUST be in the same commit or a sibling commit on the same branch, before the PR is opened.

Before opening the PR, the agent MUST:
1. Flip the prompt's status from `[TODO]` to `[DONE] (PR #<num>, YYYY-MM-DD)` — the PR number comes from `gh pr create` output, so do this update as a final amend after the PR is opened, OR leave a placeholder `PR #TBD` that the agent replaces immediately post-push with a quick `git commit --amend` + `git push --force-with-lease` before the user sees the PR. Either works. The status must never be `[WIP]` in the merged state.
2. Move `CURRENT PROMPT` pointer to the next `[TODO]` prompt.
3. Update `LAST UPDATED` to today's date (format: YYYY-MM-DD).
4. Append a Completion Log row with the PR number and one-line summary.
5. Add any findings discovered outside prompt scope to the Findings Log.
6. Commit CLAUDE.md changes IN THE SAME PR as the fix — do NOT open a separate tracker PR.

If the user rejects the PR entirely: the agent closes the PR and, in the next session, reverts the Launch Plan changes before starting the next prompt. If the user requests changes: amend the PR; the tracker stays aligned with the fix automatically.

If an earlier merged PR somehow shipped without its tracker update (shouldn't happen if this protocol is followed): next session detects the drift by reading the Completion Log vs `git log --oneline main` and opens a single catch-up tracker PR before starting the next prompt.

### Prompt List

#### Wave 0 — Safety Net (one afternoon, do first)

**P0a [DONE] (PR #635, 2026-04-19)** Husky pre-commit hook
- Install `husky` as devDependency. Add `.husky/pre-commit` running tsc + eslint + build.
- Files: `package.json`, `.husky/pre-commit` (new)
- Deploy: none

**P0a-ii [DONE] (PR #641, 2026-04-20)** Add shebang to .husky/pre-commit so Windows git.exe can exec the hook
- Prepend `#!/usr/bin/env sh` as line 1 of `.husky/pre-commit`. Without this, Windows skips the hook silently — verified by two prior agent sessions that needed `core.hooksPath` wrappers.
- Files: `.husky/pre-commit`
- Deploy: none

**P0b [DONE] (PR #636, 2026-04-19)** GitHub Actions CI workflow
- Block PR merge on tsc/eslint/build/vitest failure.
- Files: `.github/workflows/ci.yml` (existed — tightened, was not actually new)
- Deploy: none

**P0c [TODO]** Append Fix Protocol section to CLAUDE.md *(already present after this Launch Plan block — this prompt just verifies it's in place and adjusts wording based on experience)*
- Files: `CLAUDE.md`
- Deploy: none

**P0d [DONE-partial] (PR #637, 2026-04-19)** 10 integration smoke tests
- Shipped 3 of 10 tests (signup, plan-week, garment-add) plus harness, vitest.smoke config, test:smoke npm script, and RUN_SMOKE=1-gated CI job. These 3 avoid Gemini/Stripe and run against production Supabase with `test_` prefixed users that self-clean up.
- Remaining 7 flows (enrichment, render, outfit-generate, outfit-refine, visual-search, shopping-chat, travel-capsule) blocked on test infra — see P0d-ii and P0d-iii below.
- Files: `src/test/smoke/{harness,signup,plan-week,garment-add}.ts` (new), `vitest.smoke.config.ts` (new), `vitest.config.ts` (exclude smoke), `package.json` (test:smoke script), `.github/workflows/ci.yml` (smoke step), `.env.example` (RUN_SMOKE + SUPABASE_SERVICE_ROLE_KEY_TEST)
- Deploy: none

**P0d-ii [DONE-partial] (PR #638, 2026-04-19)** Test infrastructure decision + setup
- Shipped: harness extension (`SMOKE_TARGET` detection), mock server scaffolding (`mocks/mock-server.ts` + empty `gemini.ts` / `stripe.ts` route stubs), fixtures/README.md, ADR block in LAUNCH_PLAN.md. Existing 3 tests (signup/plan-week/garment-add) unchanged.
- Deferred to P0d-iv: enabling the `smoke-local` CI job. The job definition exists in `.github/workflows/ci.yml` but is gated `if: false` — first CI run exposed pre-existing drift where the earliest local migration ALTERs `public.garments` without a `CREATE TABLE` migration anywhere in the repo. Baseline schema migration is P0d-iv's scope.
- Files: `.github/workflows/ci.yml` (existing prod job tagged `SMOKE_TARGET=prod`; new `smoke-local` job gated off), `src/test/smoke/harness.ts` (extended), `src/test/smoke/mocks/{mock-server,gemini,stripe}.ts` (new), `src/test/smoke/fixtures/README.md` (new), `LAUNCH_PLAN.md` (ADR + new P0d-iv section)
- Deploy: none

**P0d-iii [DONE] (PR #640, 2026-04-20)** Expand smoke tests to remaining 7 flows
- Added 7 new smoke tests: `enrichment`, `render`, `outfit-generate`, `outfit-refine`, `visual-search`, `shopping-chat`, `travel-capsule`. Total suite now 10. Each test invokes its target edge function via `supabase.functions.invoke()` and asserts the response envelope — NOT DB-only. All 10 pass locally against a fresh `supabase db reset` (Strategy V baseline) and are wired into both `smoke-local` and `smoke-prod` CI jobs.
- Three hardcoded Gemini URLs made overridable via env vars: `GEMINI_URL_OVERRIDE` in `_shared/burs-ai.ts`, `GEMINI_IMAGE_URL_OVERRIDE` in `_shared/gemini-image-client.ts`, `GEMINI_TEXT_URL_OVERRIDE` in `_shared/render-eligibility.ts`. All backward-compatible — unset env vars reproduce the original hardcoded endpoints exactly. `smoke-local` CI boots the mock Gemini server via `src/test/smoke/mocks/start-mock-server.ts` and injects the three URL overrides into the edge-runtime via `supabase functions serve --env-file`. AI tests skip in smoke-prod (via `shouldRunAiSmoke` gate) so prod Gemini isn't hit.
- Deploy of 24 AI functions deferred — `esm.sh 522 Origin unreachable` blocker from the Supabase deploy bundler. Backward-compat of the env-var pattern keeps prod safe until retry (prod functions continue using the hardcoded URLs until the next successful deploy picks up the fallback).
- Files: 7 new test files under `src/test/smoke/`, 3 shared files promoted to env-overridable URLs, mock server + `start-mock-server.ts` entrypoint, `.github/workflows/ci.yml` updated to boot the mock and wire URL overrides.
- Deploy: none in this PR (24 AI function redeploy deferred to a follow-up once esm.sh is reachable).

**P0d-iv [DONE] (PR #639, 2026-04-20)** Schema baseline migration (drift repair) — re-enable smoke-local CI
- Shipped via Strategy V (baseline as sole source of schema truth). Dumped prod schema via `supabase db dump --linked --schema public`, committed as `00000000000000_initial_schema.sql` (36 tables, ~2600 lines). Deleted 67 historical migrations whose SQL described a schema that no longer exists anywhere (triggers referencing functions in the wrong schema, policies on renamed columns, functions with type-mismatched bodies — all silently-failed DDL accumulated over months of Studio UI edits). Repaired remote tracking via single atomic SQL transaction: deleted 67 rows from `supabase_migrations.schema_migrations`, inserted the baseline row. Re-enabled `smoke-local` CI by removing `if: false`.
- Original plan was Strategy W (idempotency-guard pass across 67 migrations). Commit 1 shipped that pass and is preserved in git history as defensive code, but reality showed W would take 100+ judgement calls about "did this CREATE ever actually run on prod" — a rewrite, not a mechanical pass. Commit 2 pivoted to V. Full writeup in LAUNCH_PLAN.md's P0d-iv section.
- Files: `supabase/migrations/00000000000000_initial_schema.sql` (new), 67 migration files deleted, `.github/workflows/ci.yml` (removed `if: false`), `LAUNCH_PLAN.md` + `CLAUDE.md` (tracker updates)
- Depends on: P0d-ii
- Execution order: ran BEFORE P0d-iii (swapped from original plan — dependency graph demands a bootable schema before writing 7 new mock-backed tests, same principle as rejecting `continue-on-error: true`)
- Deploy: none (migration + tracking repair only; post-merge `db push` is a no-op)

**P0e [DONE] (PR #645, 2026-04-20)** Migration drift check in CI
- Add `npx supabase migration list --linked` + `npx supabase db push --dry-run` as required CI steps for any PR touching `supabase/migrations/`.
- Files: `.github/workflows/ci.yml`
- Deploy: none

#### Wave 1 — Security (launch-blocking)

**P1 [DONE] (PR #643, 2026-04-20)** Auth gaps: summarize_day + process_job_queue + daily_reminders
- All three run with no caller identity verification. Add `getUser()` pattern from `detect_duplicate_garment`.
- Files: `supabase/functions/summarize_day/index.ts`, `supabase/functions/process_job_queue/index.ts`, `supabase/functions/daily_reminders/index.ts`
- Deploy: each function individually after merge

**P2 [DONE] (PR #644, 2026-04-20)** Remove anon-key bypass in calendar sync_all
- `handleSyncAll` accepts anon key OR service-role; anon path enables DoS against Google API. Service-role only.
- Files: `supabase/functions/calendar/index.ts`
- Deploy: `calendar`

**P3 [DONE] (PR #646, 2026-04-20)** OAuth hardening in google_calendar_auth
- Allowlist `redirect_uri`, replace `state: user.id` with CSRF token + user_id tuple.
- Files: `supabase/functions/google_calendar_auth/index.ts`, `src/pages/GoogleCalendarCallback.tsx`, new migration `supabase/migrations/20260420200957_oauth_csrf.sql`
- Deploy: `google_calendar_auth` (+ `npx supabase db push --linked --yes` post-merge to provision the `oauth_csrf` table and the `oauth_csrf_cleanup` pg_cron schedule)

**P4 [DONE] (PR #647, 2026-04-21)** prefetch_suggestions identity check
- Single-user-trigger mode accepts arbitrary `user_id`. Verify caller's JWT matches `body.user_id`.
- Files: `supabase/functions/prefetch_suggestions/index.ts`
- Deploy: `prefetch_suggestions`

**P5 [DONE] (PR #648, 2026-04-21)** Email domain fix
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
| 2026-04-19 | P0a | `src/i18n/locales/en.ts`, `src/i18n/locales/sv.ts` | Duplicate keys `capsule.generating` and `common.delete` in both locale files — surfaced by Vite build warnings when the new pre-commit hook ran. Locale files are append-only per CLAUDE.md so this cannot be fixed inline. | Fold into the next locale-touching prompt (likely Wave 6) — consolidate duplicate keys. |
| 2026-04-19 | P0b | `.github/workflows/ci.yml:26` | Type-check step uses `bun run tsc --noEmit` without `--skipLibCheck`. CLAUDE.md pipeline + pre-commit hook both use `--skipLibCheck`. CI is stricter than local — a lib-type bump could fail CI without tripping local. | Align when convenient — add `--skipLibCheck` or document divergence. Not launch-blocking. |
| 2026-04-19 | P0b | `.github/workflows/ci.yml:34-41` | Bundle-size check echoes `WARNING` on overflow but exits 0 → never blocks a merge. Silently passes regressions. | Promote to `exit 1` on overflow, or drop the step. Decide during performance-work wave. |
| 2026-04-19 | P0b | `.github/workflows/ci.yml` | CI has no `deno check supabase/functions/<fn>/index.ts` step. Fix Protocol requires it for edge-function changes but CI doesn't enforce. | Add a matrix step that runs `deno check` on any changed `supabase/functions/**/index.ts` in the PR. |
| 2026-04-19 | P0d-ii | `supabase/migrations/` | **Schema drift** — earliest migration (`20260124173453_...`) `ALTER TABLE`s `public.garments`, but no `CREATE TABLE garments` (or other base tables) migration exists in the repo. Base schema was authored in Studio UI without a backfilled migration file. `supabase start` + `supabase db reset` against an empty local DB fails with `ERROR: relation "public.garments" does not exist`. Surfaced when P0d-ii's smoke-local CI job ran for the first time. | Dedicated fix: new prompt **P0d-iv — Schema baseline migration (drift repair)** inserted between P0d-iii and P0e. P0d-ii's `smoke-local` job is gated `if: false` until P0d-iv re-enables it. **Resolved in P0d-iv (PR #639, 2026-04-20).** |
| 2026-04-20 | P0d-iv | `supabase/migrations/2026*.sql` (deleted) | **Prod schema internal inconsistency** — multiple historical migrations had DDL statements that silently failed on prod over months of Studio UI edits. Examples: triggers referencing `public.update_updated_at_column()` (function exists only in `storage` schema), functions with `_role app_role` parameters where the column on prod is `text`, policies referencing `requester_id`/`addressee_id` where prod has `user_id`/`friend_id`. The 67 migration files describe a schema that never fully existed. | Resolved by Strategy V in P0d-iv: dump prod schema as baseline, delete the 67 files, repair remote tracking. Migration history preserved in git log. Future migrations build on the baseline. |
| 2026-04-20 | P0d-iv | `.github/workflows/ci.yml` smoke-prod step + `src/test/smoke/harness.ts` `shouldRunSmoke` gate | **Silent-skip CI hiding broken tests.** `shouldRunSmoke` returns false when `SUPABASE_SERVICE_ROLE_KEY_TEST` is missing; Vitest then reports every smoke `describe.skipIf` as skipped and the CI step exits 0 regardless. On main, the secret has never been provisioned, so every post-merge smoke run has been reporting green while actually running zero assertions. Surfaced when P0d-iv's local CI (with local credentials auto-exported) became the first environment that actually ran `signup.test.ts` end-to-end, revealing two assertions (`display_name` truthy, `preferences.onboarding.completed === false`) that never matched `handle_new_user()` behaviour. | Two remediations, neither in P0d-iv scope: (1) provision the `SUPABASE_SERVICE_ROLE_KEY_TEST` GitHub secret on main so the smoke-prod step stops skipping; (2) harden the CI step so a missing required secret fails the job loudly instead of silently exiting 0. Candidate follow-up in P0d-iii or a dedicated tracker prompt. P0d-iv includes a collateral test fix (drop the fictional assertions) to unblock the green local run — see PR #639's "Out of scope, included as collateral" section. |
| 2026-04-20 | P0d-iv | `supabase/migrations/00000000000000_initial_schema.sql` — `public.init_render_credits()` | **Prod trigger function silently relies on undefined search_path behaviour.** `handle_new_user()` schema-qualifies every reference (`public.profiles`, `public.subscriptions`), so it works when fired as `supabase_auth_admin` (role-level `search_path=auth`). `init_render_credits()` uses the bare name `INSERT INTO render_credits ...`; under `search_path=auth` it should fail with `relation "render_credits" does not exist`, and it does locally. Prod evidently resolves it (5/5 recent users have render_credits rows) but the mechanism doesn't reproduce in a fresh Supabase CLI stack on identical PG/role config. | Minimum-deviation fix in P0d-iv: added `ALTER FUNCTION public.init_render_credits() SET search_path = public;` at the end of the baseline. This is a proconfig-only override — the dumped function body is untouched — and hardens local against the same footgun CLAUDE.md's "Secrets inside migrations" block warns about for SECURITY DEFINER functions. |
| 2026-04-20 | P0d-iv | `storage.buckets` on prod + `src/components/settings/ProfileCard.tsx` + `src/pages/PublicProfile.tsx` + `src/hooks/useAvatarUrl.ts` | **`avatars` storage bucket + its 4 policies were dropped from prod at an unknown date**, but client code still calls `supabase.storage.from('avatars')` for upload / delete / signed-URL reads. Avatar upload is currently broken for every new user; the 2 of 7 prod profiles with `avatar_path` populated point to objects in a bucket that no longer exists (their signed-URL reads 404). The old `20260308075837_192365b0-b62f-42b9-88b5-8b0091f3c2cf.sql` migration that created the bucket + policies was deleted in P0d-iv Strategy V — intentionally, because "baseline equals prod" and prod no longer has the bucket. Surfaced by Codex review on PR #639. | **Product decision: remove, not restore.** The baseline stays truthful (no `avatars` bucket, matching prod). The client-side code references are dead feature code — dedicated follow-up prompt to delete `src/hooks/useAvatarUrl.ts`, the avatar upload path in `src/components/settings/ProfileCard.tsx`, and the signed-URL read in `src/pages/PublicProfile.tsx`, plus drop `profiles.avatar_path` in a separate migration once the code is gone. Not in P0d-iv scope. |
| 2026-04-20 | P0d-iii | `supabase/functions/_shared/burs-ai.ts:17` | **`GEMINI_URL` is a hardcoded `const`**, not read from env. That makes edge-function Gemini calls impossible to reroute through the mock server booted by `src/test/smoke/mocks/mock-server.ts` — the whole reason P0d-ii's mock infrastructure exists. Surfaced when writing P0d-iii smoke tests: to hit `analyze_garment` / `render_garment_image` / etc. under local Supabase with a mocked Gemini, the edge-runtime needs `GEMINI_URL` overridable via `Deno.env.get("GEMINI_URL_OVERRIDE") ?? "https://generativelanguage..."`. **Resolved in P0d-iii (PR #640, 2026-04-20)** — approach expanded per user (CTO) direction. Three shared URLs made overridable (`GEMINI_URL_OVERRIDE` in `burs-ai.ts`, `GEMINI_IMAGE_URL_OVERRIDE` in `gemini-image-client.ts`, `GEMINI_TEXT_URL_OVERRIDE` in `render-eligibility.ts`), all backward-compatible (unset → original hardcoded value). 7 tests rewritten to invoke edge functions via `supabase.functions.invoke()`; CI workflow boots `start-mock-server.ts` + `supabase functions serve --env-file`. AI function redeploy **not completed this session** — Supabase deploy bundler hit `esm.sh 522 Origin unreachable` repeatedly on `import 'https://esm.sh/@supabase/supabase-js@2'`; external infra blocker. Backward-compat of the env-var pattern means prod is safe without deploy: functions keep using the hardcoded URLs until next successful deploy picks up the env-var fallback. Follow-up RESOLVED 2026-04-20: all 24 consumers successfully redeployed. |
| 2026-04-20 | P0a | `.husky/pre-commit` | File lacks `#!/usr/bin/env sh` shebang. On Windows, git.exe cannot exec the hook directly → pre-commit runs are skipped unless the agent wraps it via `core.hooksPath`. Surfaced by P0d-iv and P0d-iii agent sessions — both had to use a wrapper to run the full tsc + eslint + build pipeline. | Tiny follow-up prompt (P0a-ii) prepends shebang. Parallel PR alongside PR #640. |
| 2026-04-20 | P0d-iii | `supabase/functions/travel_capsule/index.ts:838` (resolveId) + `:762` (deterministic fallback) | `resolveId()` expects string ids, but the deterministic fallback at line 762 writes garment objects into capsule_items. Downstream `id.trim()` crashes on the object path. Surfaced when P0d-iii's `travel-capsule.test.ts` mock routing revealed the fallback path — test was tightened so happy path avoids the crash, but the production code path is latent. | Dedicated prompt in a future wave — coerce resolveId inputs to string or fix fallback to emit ids, not objects. Not a launch-blocker (deterministic fallback rarely triggers in prod), but should be fixed before sign-off. |
| 2026-04-20 | P1 | `supabase/functions/process_job_queue/index.ts`, `supabase/functions/daily_reminders/index.ts` | **Mistake pattern — cron-only vs user-facing auth.** Initial P1 agent brief included a `getUser()` fallback pattern copied from `detect_duplicate_garment` for cron-only functions. Codex caught that the fallback allowed any authenticated end-user to invoke service-role-escalated code (DoS against queue processing + notification storm). Correct pattern for cron-only endpoints is hard-reject of non-service-role callers via `timingSafeEqual(token, SERVICE_ROLE_KEY)`. User-facing functions continue to use the `getUser()` fallback. | Fixed in follow-up commit on PR #643. For future prompts: user-facing functions use `getUser()` fallback; cron-only functions use hard-reject only. |
| 2026-04-20 | P0e | process (not a file) | **Prompt ordering mistake.** P1 and P2 were executed before P0e because the P1 agent brief instructed "move CURRENT PROMPT to P2" (should have been "P0e"). No correctness impact — P0e is independent of P1/P2 scope — but Wave 0 safety net was briefly incomplete during Wave 1 work. | Future prompt briefs must verify CURRENT PROMPT against the prompt list and move to the earliest `[TODO]`, not just the next-numbered prompt. |
| 2026-04-20 | P2 | `supabase/functions/calendar/index.ts` (handleSyncAll) | **Possible dead code.** `handleSyncAll` has no discoverable caller — zero in-repo invokers, zero matching rows in `cron.job` for 'calendar' or 'sync_all' patterns. May be dead code OR called by a Supabase Dashboard scheduled function outside pg_cron. | Future cleanup prompt — verify Dashboard → Edge Functions → Schedules for a calendar sync entry. If nothing, delete `handleSyncAll` entirely. |
| 2026-04-21 | P4 | `supabase/functions/prefetch_suggestions/index.ts` (cron-batch path, lines 123+) | **Cron-batch path has no auth gate.** P4 hardened the single-user-trigger path but the else branch (cron batch mode) accepts any caller with no Authorization check. A drive-by anon POST with an empty body (or any body missing `trigger: "first_5_garments"`) falls through to the batch path and triggers up to 100 parallel AI calls — DoS / cost-amplification vector against Gemini. This is `verify_jwt = false` in config.toml, so there's no platform-level gate either. | Dedicated follow-up prompt — apply the cron-only hard-reject pattern (P1 `process_job_queue`/`daily_reminders` pattern): require `timingSafeEqual(token, SUPABASE_SERVICE_ROLE_KEY)` before entering the batch loop. Out of P4 scope because P4's spec only named "single-user-trigger mode"; scope-creeping would bundle auth changes across both modes into one PR. |
| 2026-04-21 | P4 | main repo `C:\Users\borna\OneDrive\Desktop\BZ\Burs\bursai-working` | **Stale mid-merge cruft in main repo.** Main repo is stuck on branch `prompt-p0d-iii-deploy-retry` at `6de4c09a` with an in-progress merge bringing `origin/main` (d02d6ac5) into the branch — CLAUDE.md conflict unresolved, 8 files auto-merged (all already on origin). Leftover from a prior agent session. P4 worked around it by using the existing `heuristic-swanson-e41ab7` worktree (clean on main at d02d6ac5) and `npm ci`-ing dependencies there. | User action: from main repo, `git merge --abort` + `git checkout main` + `git pull --ff-only`. Also 9 worktrees under `.claude/worktrees/` from prior agents — prune unused ones with `git worktree remove <path>` once no longer needed. Not launch-blocking; agents can keep using clean worktrees. |
| 2026-04-21 | P5 | `src/hooks/__tests__/useDeepLink.test.tsx` lines 48, 66 | **Test fixtures still use legacy `app.bursai.com` domain.** Deep-link test fixtures construct URLs like `https://app.bursai.com/u/borna` and `https://app.bursai.com/outfit/abc-123`. Real prod domain is `burs.me` (via `app.burs.me`). Fixtures will match URL shape regardless of domain — no functional test regression today — but if the hook ever adds domain-whitelisting, these fixtures will silently diverge from prod behaviour. Surfaced by the P5 grep sweep for `bursai.com` across the repo. | Out-of-scope for P5 (which specifically scoped to the two edge-function files). Fold into a future frontend-cleanup prompt that updates test fixtures to `app.burs.me`. Not launch-blocking. |
| 2026-04-21 | (doc fix) | `LAUNCH_PLAN.md` P1 spec (lines 360-378) | **Stale spec advising insecure auth pattern.** LAUNCH_PLAN.md's P1 cron-only section still showed the `if (!isServiceRole) { require user JWT }` fallback pattern that Codex rejected on PR #643. Since LAUNCH_PLAN.md is the source-of-truth agents read for pattern reference (CLAUDE.md is the tracker), this would trap future cron-auth work — notably P7 on `process_job_queue` handlers. CLAUDE.md's earlier Findings Log row (2026-04-20, P1) documented the hard-reject correction in tracker-space only; the spec file was never updated. Surfaced when the user asked to sweep LAUNCH_PLAN.md for tracker-style drift after P5 shipped. | Fixed in PR #649 (doc-only): P1 cron-only section rewritten to show the hard-reject pattern (`timingSafeEqual` + return 401, no JWT fallback). Added a pattern-selection rule of thumb covering user-facing vs cron-only vs dual-mode. No code/status changes; `CURRENT PROMPT` stays P6. |

### Completion Log

| Date | PR | Prompt | Summary |
|------|-----|--------|---------|
| 2026-04-19 | #635 | P0a | Husky pre-commit hook runs tsc + eslint + build |
| 2026-04-19 | #636 | P0b | Tighten CI lint step: fail on eslint warnings (`--max-warnings 0`) |
| 2026-04-19 | #637 | P0d | Smoke-test POC: harness + 3 tests (signup, plan-week, garment-add) + CI step gated on `RUN_SMOKE=1`. Split into P0d-ii (infra) + P0d-iii (remaining 7 flows). |
| 2026-04-19 | #638 | P0d-ii | Test infra (partial): harness extension + mock-server scaffolding (Node stdlib) + ADR. `smoke-local` CI job exists but is gated `if: false` pending P0d-iv — first CI run exposed missing base-schema migration. Drift repair tracked as new P0d-iv. |
| 2026-04-20 | #TBD | P0d-iv | Schema drift repair via Strategy V: baseline dump (36 tables) as sole source of schema truth; 67 historical migrations deleted (they described a fiction — lots of silently-failed DDL); remote tracking table repaired in one atomic transaction; smoke-local CI re-enabled. Commit 1 preserves the attempted Strategy W idempotency pass in git history. |
| 2026-04-20 | #640 | P0d-iii | Smoke-test suite expanded from 3 to 10. 7 new tests (enrichment, render, outfit-generate, outfit-refine, visual-search, shopping-chat, travel-capsule) invoke the target edge function via `supabase.functions.invoke()` and assert the response envelope — NOT DB-only. Three hardcoded Gemini URLs made overridable in `_shared/burs-ai.ts` + `_shared/gemini-image-client.ts` + `_shared/render-eligibility.ts` (backward-compat: identical behaviour when env vars unset). Mock Gemini server + `start-mock-server.ts` entrypoint + CI workflow wiring via `supabase functions serve --env-file`. AI tests skip in smoke-prod (`shouldRunAiSmoke` gate) so prod Gemini isn't hit. 10/10 passing locally with mock interception verified. **Deploy of 24 AI functions deferred** — `esm.sh 522` blocker from Supabase bundler; backward-compat keeps prod safe until retry. See Findings Log row for `_shared/burs-ai.ts:17` (now resolved). |
| 2026-04-20 | #641 | P0a-ii | Fix .husky/pre-commit: add missing shebang so Windows git.exe executes the hook |
| 2026-04-20 | #642 | P0d-iii-deploy | Retry-deployed all 24 AI function consumers of the Gemini URL env-var refactor. esm.sh 522 cleared; no code changes. |
| 2026-04-20 | #643 | P1 | Add JWT verification + service-role bypass to summarize_day (JWT-only), process_job_queue (bypass), daily_reminders (bypass) |
| 2026-04-20 | #644 | P2 | Calendar handleSyncAll: reject anon-key callers, service-role only (DoS fix) |
| 2026-04-20 | #645 | P0e | Wave 0 catch-up: CI step checks `supabase migration list --linked` + `db push --dry-run` on any PR touching supabase/migrations/ |
| 2026-04-20 | #646 | P3 | OAuth hardening for google_calendar_auth: server-side `redirect_uri` allowlist (hardcoded 3 URIs + optional `ALLOWED_CALENDAR_REDIRECT_URIS` env extras) + single-use CSRF token `state = <user_id>.<nonce>` backed by new `public.oauth_csrf` table (10-min TTL, consumed on callback, hourly `oauth_csrf_cleanup` pg_cron). Client passes `state` from URL back to backend verbatim. Post-merge: `supabase db push` provisions the table + cron, then deploy `google_calendar_auth`. |
| 2026-04-21 | #647 | P4 | prefetch_suggestions identity check: single-user-trigger path now validates caller's JWT via `supabase.auth.getUser(token)` and asserts `user.id === body.user_id` before running `processSingleUser`. 401 on missing/invalid token, 403 on mismatch. Cron-batch path intentionally untouched (separate unauditted gap — see Findings Log). Post-merge: deploy `prefetch_suggestions`. |
| 2026-04-21 | #648 | P5 | Email domain fix: VAPID `mailto:` contact string in `webpush.setVapidDetails()` changed from `hello@bursai.com` to `hello@burs.me` in both `send_push_notification` and `daily_reminders`. VAPID `sub` claim is an RFC 8292 abuse-contact identifier — FCM/APNs don't validate it, zero behavioural impact on push delivery. Post-merge: deploy both functions. |

## Prompt Workflow — Do This After Every Single Prompt

### Step 1 — Verify code quality

```bash
npx tsc --noEmit --skipLibCheck     # must return 0 errors
npx eslint . --max-warnings 0       # must return 0 warnings (match CI scope)
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
- `npx eslint . --max-warnings 0` → 0 warnings (match CI scope — whole repo)
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

### Launch Plan Update (part of the fix PR — see Launch Plan section for full rules)
Before opening the PR:
1. Flip the prompt's status from `[TODO]` to `[DONE] (PR #<num>, YYYY-MM-DD)`
2. Move `CURRENT PROMPT` pointer to the next `[TODO]` prompt
3. Update `LAST UPDATED` to today
4. Append a row to the Completion Log
5. Add any new findings to the Findings Log
6. Commit CLAUDE.md changes IN THE SAME PR as the fix

The PR number placeholder is resolved by amending the commit immediately after `gh pr create` (see Launch Plan section).

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
