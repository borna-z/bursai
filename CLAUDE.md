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

**CURRENT PROMPT:** P25
**LAST UPDATED:** 2026-04-25
**LAST CLEANUP:** 2026-04-25 (Wave 4.9 follow-up — P2 handleSyncAll deletion + 3 finding closures)
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
- `[DONE-subsumed]` — prompt's intent was fully delivered by one or more EARLIER prompts whose scope expanded beyond their original spec. The PR(s) that delivered the intent are cited in the prompt body. No new code shipped under this prompt's number — only a tracker flip with citations + investigation notes documenting why the original spec is stale. Distinct from: `[DONE]` (where the prompt's own PR delivers the intent), `[DONE-partial]` (where new follow-up prompts are inserted to track remaining scope), and `[SKIP]` (where the intent is NOT delivered because the user opted out).
- `[BLOCKED]` — waiting on user decision, external dep, or failing CI
- `[SKIP]` — user decided not to do this prompt

### Wave Closure Rule — Findings Cleanup Before Advancing (standing rule, 2026-04-23+)

**Every wave ends with an Nx.9 Findings Cleanup sub-wave.** The next wave does not begin until the cleanup closes. Goal: drain the Findings Log's "NOT RESOLVED" rows attributable to that wave (plus any inherited from earlier waves) to zero, so each wave starts clean.

How it works:
1. After the last functional sub-wave in Wave N ships, the next agent opens **Wave N.9** as the closing sub-wave.
2. The N.9 agent re-reads the entire Findings Log, filters for rows whose Action column does NOT say `RESOLVED in PR #...`, and groups them into PR-sized clusters by theme (schema, docs, i18n, observability, housekeeping).
3. Each cluster ships as a focused PR. The Completion Log row carries the suffix `[cleanup]` so closing PRs are trivially filterable.
4. `CURRENT PROMPT` does not advance past Wave N.9 until every open row attributable to Wave N or earlier is either `RESOLVED` or carries a `Scheduled: Wave Y` annotation deferring it intentionally (used when a cleanup item requires architectural decisions or depends on a future wave's schema).
5. User-action items (secret provisioning, dashboard checks, manual git cleanup) live as checkbox lists inside the N.9 PR bodies — not as their own code PRs.

Scope freeze: N.9 is NOT a place to ship new features or scope-expanded fixes. If a cleanup item needs architectural decisions, it gets `Scheduled:` + opens its own future prompt in the next wave.

History carryover: earlier waves (0-3) accumulated findings before this rule existed. They all roll into **Wave 4.9** — the first application of the rule. Waves 5+ keep their findings self-contained.

### Launch Plan Update (BEFORE opening the PR, included IN the PR)

The tracker update lives INSIDE the fix PR — not after merge. The user's merge ratifies both the fix and the tracker state atomically. Agents cannot add commits to an already-merged PR, so the update MUST be in the same commit or a sibling commit on the same branch, before the PR is opened.

Before opening the PR, the agent MUST:
1. Flip the prompt's status from `[TODO]` to `[DONE] (PR #<num>, YYYY-MM-DD)` — the PR number comes from `gh pr create` output, so do this update as a final amend after the PR is opened, OR leave a placeholder `PR #664` that the agent replaces immediately post-push with a quick `git commit --amend` + `git push --force-with-lease` before the user sees the PR. Either works. The status must never be `[WIP]` in the merged state.
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

**P0c [TODO — Scheduled: W4.9-D]** Append Fix Protocol section to CLAUDE.md *(already present after this Launch Plan block — this prompt just verifies it's in place and adjusts wording based on experience). Executes inside Wave 4.9-D per the Wave Closure Rule.*
- Files: `CLAUDE.md`
- Deploy: none

**P0d [DONE] (PR #637, 2026-04-19; completed via P0d-ii/iii/iv)** 10 integration smoke tests
- Shipped 3 of 10 tests in the original PR (signup, plan-week, garment-add) plus harness, vitest.smoke config, test:smoke npm script, and RUN_SMOKE=1-gated CI job. These 3 avoid Gemini/Stripe and run against production Supabase with `test_` prefixed users that self-clean up.
- Remaining 7 flows (enrichment, render, outfit-generate, outfit-refine, visual-search, shopping-chat, travel-capsule) completed in P0d-iii (PR #640, 2026-04-20). Local CI job enabled in P0d-iv (PR #639, 2026-04-20). Full 10-test suite now runs on every PR against local Supabase + on main-push against prod.
- Files: `src/test/smoke/{harness,signup,plan-week,garment-add}.ts` (new), `vitest.smoke.config.ts` (new), `vitest.config.ts` (exclude smoke), `package.json` (test:smoke script), `.github/workflows/ci.yml` (smoke step), `.env.example` (RUN_SMOKE + SUPABASE_SERVICE_ROLE_KEY_TEST)
- Deploy: none

**P0d-ii [DONE] (PR #638, 2026-04-19; deferred piece completed in P0d-iv)** Test infrastructure decision + setup
- Shipped: harness extension (`SMOKE_TARGET` detection), mock server scaffolding (`mocks/mock-server.ts` + empty `gemini.ts` / `stripe.ts` route stubs), fixtures/README.md, ADR block in LAUNCH_PLAN.md. Existing 3 tests (signup/plan-week/garment-add) unchanged.
- `smoke-local` CI job was gated `if: false` pending schema baseline work. **Resolved in P0d-iv (PR #639, 2026-04-20)**: baseline migration shipped + `if: false` removed, smoke-local now runs on every PR.
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

**P6 [DONE] (PR #650, 2026-04-21)** Outfit ownership check in suggest_accessories
- `outfit_id` from request body queried via service client without user verification.
- Files: `supabase/functions/suggest_accessories/index.ts`
- Deploy: `suggest_accessories`

**P7 [DONE] (PR #651, 2026-04-21)** Cross-user validation in process_job_queue handlers
- Handlers don't verify `job.user_id` matches garment's user_id.
- Files: `supabase/functions/process_job_queue/index.ts`
- Deploy: `process_job_queue`

**P8 [DONE] (PR #652, 2026-04-21)** Complete delete_user_account cascade
- Add DELETEs for garment_pair_memory, feedback_signals, analytics_events, chat_messages, outfit_feedback, push_subscriptions, render_jobs, render_credits, render_credit_transactions, travel_capsules, ai_response_cache, ai_rate_limits.
- Files: `supabase/functions/delete_user_account/index.ts`
- Deploy: `delete_user_account`

#### Wave 2 — Rate Limiting & Idempotency

**P9 [DONE] (PR #657, 2026-04-21)** Add rate limit + overload to 12 functions (Wave 2-A)
- Applied `enforceRateLimit` + `checkOverload` + `RateLimitError` catch to 9 user-facing functions: `import_garments_from_links`, `insights_dashboard`, `send_push_notification`, `restore_subscription`, `create_portal_session`, `delete_user_account`, `calendar`, `google_calendar_auth`, `generate_outfit`. Applied `checkOverload` only to 3 cron-only functions: `daily_reminders`, `process_job_queue`, `cleanup_ai_cache`. `process_garment_image` skipped (being removed in P15). `seed_wardrobe` removed entirely mid-PR — see P11 note below.
- Added 9 new `RATE_LIMIT_TIERS` entries in `_shared/scale-guard.ts` per spec.
- **Scope expansion**: `cleanup_ai_cache` had NO auth gate at all (P1 missed it). Added the same timingSafeEqual hard-reject pattern P1 shipped to `daily_reminders`/`process_job_queue`. Without this, P9's overload gate is toothless.
- Files: 12 function `index.ts`, `_shared/scale-guard.ts`

**P10 [DONE] (PR #657, 2026-04-21)** UUID validation in PublicProfile + ShareOutfit (Wave 2-A)
- Added `src/lib/validators.ts` with `isUuid` + `isValidUsername` regex guards. Both page components now short-circuit to the not-found view when URL params are malformed — no DB trip, no 22P02 error leak.
- Files: `src/lib/validators.ts` (new), `src/pages/PublicProfile.tsx`, `src/pages/ShareOutfit.tsx`

**P11 [DONE-removed] (PR #657, 2026-04-21)** Gate seed_wardrobe delete_all — **SUPERSEDED BY FULL REMOVAL**
- Initial P11 implementation shipped a two-step confirmation-token flow but Codex P1+P2 surfaced two blocking issues: (1) the 5/hour+1/minute rate limit on `seed_wardrobe` breaks the function's own `SeedContext.run()` flow (request_token → delete_all → many `create_batch` calls hit the minute limit immediately); (2) the token-consume step isn't atomic so two concurrent delete_all calls can both pass validation. User call (2026-04-21): seed_wardrobe was an admin/demo-only surface with no production use case — remove entirely instead of gating.
- **Removed** the edge function (`supabase/functions/seed_wardrobe/`), its config.toml entry, the shared rate-limit tier, the WIP migration (`20260421160000_seed_wardrobe_delete_confirmation.sql`), the client surfaces (`src/contexts/SeedContext.tsx`, `src/pages/settings/SeedWardrobe.tsx`, `src/data/seedGarments.ts`, `src/components/layout/SeedProgressPill.tsx`), the route (`/settings/seed-wardrobe`), the AppLayout-level pill, and defensive test mocks across 10 test files. Only surface that linked to the route was SeedProgressPill itself — no Settings page or nav entry referenced it. Locale keys for `seed.*` left as orphans per append-only rule.
- No migration ships from this PR (the WIP was deleted before it ever hit remote).

**P12 [DONE] (PR #658, 2026-04-21)** DB-backed idempotency (Wave 2-B)
- Replaced per-isolate in-memory `Map` with `public.request_idempotency` table. Atomic claim via `upsert({...}, {onConflict:'key', ignoreDuplicates:true})` mirroring the stripe_events pattern — first isolate wins the PK race and proceeds; losers read back the row and return either the cached Response (status > 0) or 409 Retry-After (status === 0, still pending on another isolate).
- Split TTLs: `CLAIM_TTL_MS = 60s` (short, so a crashed isolate doesn't deadlock retries) and `DEFAULT_RESULT_TTL_MS = 5min` (completed response). storeIdempotencyResult upserts with the full 5min TTL, overwriting the 60s placeholder.
- Both `checkIdempotency` and `storeIdempotencyResult` gained a required `supabaseAdmin` second arg. Only 2 consumers in-repo — both updated: `create_checkout_session` and `delete_user_account` hoisted service-client creation above the idempotency check. Also tightened `create_checkout_session`'s outer catch to a generic 500 body (the hoist widened potential error-message leak surface — Codex-style fix shipped upfront).
- Migration `20260421170000_request_idempotency.sql` — idempotent `CREATE TABLE IF NOT EXISTS` + hourly pg_cron cleanup job scheduled via DO-block unschedule-first. Pattern mirrors `20260420200957_oauth_csrf.sql`.
- Files: `supabase/functions/_shared/idempotency.ts`, `supabase/functions/create_checkout_session/index.ts`, `supabase/functions/delete_user_account/index.ts`, new migration, doc update to `supabase/functions/CLAUDE.md`.

**P13 [DONE] (PR #659, 2026-04-21)** User-scope 7 cache namespaces (Wave 2-C)
- Each of the 7 AI functions (`style_twin`, `clone_outfit_dna`, `wardrobe_aging`, `wardrobe_gap_analysis`, `smart_shopping_list`, `suggest_accessories`, `travel_capsule`) got its `cacheNamespace` appended with `_${userId}` and a new `userId` option passed to `callBursAI`.
- Cold-cache penalty: pre-deploy cache rows for these functions are unreachable post-deploy (hash differs) — acceptable, they decay via TTL.

**P14 [DONE] (PR #659, 2026-04-21)** Fix summarize_day + suggest_outfit_combinations cache collisions (Wave 2-C)
- `summarize_day`: namespace upgraded to `summarize_day_${user.id}_${eventsCacheKey}`. Previously two users with identical calendar titles would share a cache entry.
- `suggest_outfit_combinations`: 8-char UUID prefix → full UUID. Prefix birthday collision risk at scale.

**L554 [DONE] (PR #659, 2026-04-21)** `ai_response_cache.user_id` schema change (Wave 2-C, bundled with P13+P14)
- Migration `20260421180000_ai_response_cache_user_id.sql` adds `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE` (nullable) + partial index `WHERE user_id IS NOT NULL`.
- `_shared/burs-ai.ts`: `BursAIOptions` gains optional `userId`; `storeCache` writes `user_id: userId ?? null`.
- `delete_user_account`: explicit `.from("ai_response_cache").delete().eq("user_id", userId)` belt-and-suspenders alongside the FK cascade. Old Codex-P1 comment block replaced with new explanation.
- **Shared-module deploy radius**: `burs-ai.ts` changed → all 22 AI functions bundle the updated `storeCache` + need redeploy. 9 in P13/P14 scope plus 13 additional: `analyze_garment`, `assess_garment_condition`, `burs_style_engine`, `detect_duplicate_garment`, `generate_flatlay`, `generate_garment_images`, `mood_outfit`, `outfit_photo_feedback`, `prefetch_suggestions`, `render_garment_image`, `shopping_chat`, `style_chat`, `visual_search`. Plus `delete_user_account`. Total post-merge deploys: **23 functions + 1 migration**.

#### Wave 3 — PhotoRoom Removal + Ghost Mannequin for All Categories

**P15 [DONE] (PR #660, 2026-04-21)** Unwire PhotoRoom entirely
- Deleted `supabase/functions/process_garment_image/` (the always-skip stub + its config.toml entry). Stripped `startGarmentImageProcessingInBackground` from `src/lib/garmentIntelligence.ts` and its call site in `triggerGarmentPostSaveIntelligence`. Narrowed the `imageProcessing` option union from `'edge' | 'local' | 'skip' | 'full'` → `'local' | 'skip'` (all in-repo callers pass `{ mode: 'skip' }`; 'local' preserved for the Wave 9 Capacitor path). Removed `handleImageProcessing` from `process_job_queue` + dropped `image_processing` from `JOB_HANDLERS`; doc comment updated so orphan `job_queue` rows with `job_type = 'image_processing'` are explicitly called out as frozen (claimJob filters by JOB_HANDLERS keys → unclaimed forever, acceptable per spec).
- **Scope expansion**: removed `image_processing_status === 'pending' | 'processing'` from the polling gate in `GarmentDetail.tsx` (in spec) AND in three sibling hooks — `useGarments`, `useGarmentsByIds`, `useAISuggestions` — that had the identical defect. Fixing all four keeps post-P15 state consistent. Spec's acceptance criterion "polling terminates correctly based on render_status alone" applies equally to all four sites.
- **Vitest flake stabilization (out-of-scope, user-requested)**: full-suite vitest on Windows was non-deterministically flaky pre-P15 — different 5-20 tests timing out per run at the 5s per-test budget, while all affected files passed cleanly in isolation. Confirmed pre-existing by stashing P15 edits and reproducing on pristine main. Added `testTimeout: 15000`, `pool: "forks"`, `maxWorkers: 2` to `vitest.config.ts`. Full suite now runs 1104/1104 reliably. Tradeoff: wall-clock ~1.5-2x slower on a cold run, but deterministic.
- DB columns (`image_processing_status`, `image_processing_provider`, `image_processing_confidence`, `image_processing_error`, `image_processed_at`, `processed_image_path`) remain in place per spec. Default `image_processing_status = 'pending'` in `00000000000000_initial_schema.sql` is a latent footgun — all live insert paths pass `skipImageProcessing: true` (→ `'ready'`), so new rows are safe, but any future bypassing caller would create a stuck row. Tracked in Findings Log for the deferred schema-cleanup PR.
- Post-merge: deploy `process_job_queue`. `process_garment_image` is deleted from `supabase/config.toml`; a separate `npx supabase functions delete process_garment_image --project-ref khvkwojtlkcvxjxztduj` run by the user decommissions the already-deployed prod copy.

**P16 [DONE] (PR #661, 2026-04-21)** Category-aware render prompts
- Shipped as part of the Wave 3-B render-magic bundle. `classifyCategory()` in `render_garment_image/index.ts` maps (category, subcategory) to one of 6 presentation classes (`ghost_mannequin`, `shoes`, `bag`, `flat_lay`, `jewelry`, `accessory_generic`). Each class gets its own hard + negative requirements block — shoes get "clean 3/4-angle product shot, NO feet/legs/mannequin"; bags get "front-on with handle naturally positioned"; jewelry gets "close-up against pure white, NO body parts"; etc. Substring-matching of subcategory hints routes accessory category into the right bucket.

**P17 [DONE] (PR #661, 2026-04-21)** Multi-prompt retry chain in render_garment_image
- 3-attempt chain using distinct prompt variants (`primary` / `tightened` / `minimal`) — shipped as part of Wave 3-B bundle. Each attempt runs the FULL pipeline: Gemini generate → structural bytes check → magic-byte + dimension check → category-aware validator. Retryable failures (gemini_timeout/network/no_image, output_bad_magic/too_small/too_large/low_resolution, validator reject_*) advance to next variant. Hard failures (gemini_auth, gemini_model_path) throw immediately without burning retry budget. `lastAttemptError` captured for diagnostics. On exhaustion: `safeRestoreOrFailRender` preserves prior good render or flips to `render_status='failed'` (F22 banner surfaces the retry action).

**P18 [DONE] (PR #661, 2026-04-21)** Tighten validateRenderedGarmentOutputWithGemini
- Category-aware validation shipped as part of Wave 3-B bundle. `validateRenderedGarmentOutputWithGemini` now takes `category`, `subcategory`, and `expectLogoOrText` params. Three presentation classes (wearable ghost-mannequin / shoes / accessory) get distinct prompts + distinct rejection-list wording. Two new decision codes: `reject_wrong_category` (render produced a different item type than expected) and `reject_logo_missing` (F9 — catches silent branding loss). Two new signals: `correctCategory` + `logoOrTextPreserved`. Caller in `render_garment_image` passes `expectLogoOrText=sourceHasBranding(ai_raw)` so plain items don't get false logo-missing rejects.

**P19 [DONE] (PR #661, 2026-04-21)** Add timeouts to gemini-image-client.ts + render-eligibility.ts
- `fetchWithTimeout(url, init, timeoutMs)` helper added to both modules. `gemini-image-client`: 60s per attempt × up to 3 attempts with exp backoff (1.5s / 3.5s + jitter) on 429/5xx/network/timeout. New error codes `gemini_timeout` + `gemini_network` for outer-loop classification. `render-eligibility`: 25s per call on both eligibility + output validation (no retry — the image-gen caller does retry orchestration at the prompt layer).

#### Wave 4 — AI Retrieval Quality (Right Garments to Gemini)

**P20 [DONE] (PR #664, 2026-04-23)** Semantic pre-filter for mood_outfit
- Shipped as part of Wave 4-B bundle. Extracted `MOOD_MAP` from `mood_outfit/index.ts:22-35` into new `_shared/retrieval.ts`. Added `rankGarmentsForMood()` that scores on formality band fit, color family match, `ai_raw.occasion_tags` overlap, `ai_raw.style_archetype` match, per-garment weather compat, and wear-count decay. Pre-filters wardrobe to top-40; when ≥70% of the top-80 ranked rows are enriched, opts into `filterEnrichedGarments` from Wave 4-A. Replaces opaque `f3` pipe-delimited prompt shape with structured JSON carrying English `formalityLabel()` labels + `occasion_tags` + `style_archetype`. `max_tokens` now dynamic via `estimateMaxTokens({ inputItems: promptGarments.length, ... })`. Added `log.info("retrieval.prefilter", ...)` telemetry with total/ranked/enriched/sent counts.
- Files: `supabase/functions/_shared/retrieval.ts` (NEW), `supabase/functions/mood_outfit/index.ts`
- Deploy: `mood_outfit`

**P21 [DONE] (PR #664, 2026-04-23)** Gap-aware pre-filter for wardrobe_gap_analysis
- Shipped as part of Wave 4-B bundle. Accepts optional `intent` in request body (occasion/formality/season/budget/upcoming_events) — backward-compatible (intent is optional; zero-arg `useWardrobeGapAnalysis()` still works). `scanEventHints()` lifts formality/season keywords from `upcoming_events[*].description` into the structured intent before the AI call (cheap keyword scan, no extra AI round-trip). Replaces old English aggregate prompt text with `computeWardrobeCoverage()` structured JSON (by_category, by_color_family, by_season, by_formality, gaps_derived) + `stratifiedSample(garments, 25)` (representative across categories × wear × recency, not the 25 newest). Tool schema extended with optional `shopping_recommendations: [{ priority, category, item, reasoning, fills_gap, price_range, search_query }]`. Prompt now includes CRITICAL RULE 11 "if wardrobe >60% neutral, don't recommend more neutrals" — coverage-aware. `cacheNamespace` partitions gap-only vs shopping-mode via `intentToCacheKey(intent)` djb2 hash (stable: same intent → same key). Fallback (`fallbackGapAnalysis`) rewritten to consume the same coverage object instead of hardcoded Markov-like ranked list — now respects the neutral-ratio rule. Brand-stripping post-processing extended to `shopping_recommendations`. Existing `gaps` shape unchanged; `useAdvancedFeatures.ts:66-79` destructure continues to work (TS structural typing tolerates extra fields).
- Files: `supabase/functions/_shared/retrieval.ts` (NEW — shared with P20), `supabase/functions/wardrobe_gap_analysis/index.ts`
- Deploy: `wardrobe_gap_analysis`

**P22 [DONE-removed] (PR #664, 2026-04-23)** smart_shopping_list removal (per user decision, follows P11 seed_wardrobe pattern)
- Per plan: don't build an intent-aware `smart_shopping_list` — instead upgrade `wardrobe_gap_analysis` (via P21) to serve the shopping-assistant use case, and remove the orphan function. Zero frontend callers confirmed via grep across `src/`.
- Removed: `supabase/functions/smart_shopping_list/` directory, `[functions.smart_shopping_list]` stanza in `supabase/config.toml`, the tier entry in `supabase/functions/_shared/scale-guard.ts:43`, the rate-limit table row in `supabase/functions/CLAUDE.md`, and the edge-function list row in `docs/ARCHITECTURE.md`.
- Post-merge: run `npx supabase functions delete smart_shopping_list --project-ref khvkwojtlkcvxjxztduj` (user-run) to decommission the already-deployed prod copy.

**P23 [DONE] (PR #663, 2026-04-22)** Fix ID truncation
- Shipped as part of Wave 4-A (P23+P24 bundle). Removed `.slice(0, 8)` at three sites: `_shared/burs-ai.ts:compactGarment` (root cause — inherited by every AI function that calls the helper), `suggest_outfit_combinations/index.ts:111`, `wardrobe_aging/index.ts:56`. Full UUIDs now land in every prompt, eliminating birthday-collision risk at scale. Response validation in both named consumers is exact-match against a full-UUID set (lines 171 / 109), so shorter→longer stays exact-match — no break. Unit tests on `compactGarment` lock in the UUID contract. **Scope expansion**: `prefetch_suggestions/index.ts` line 54 prompt text ("Pick garments by their short ID (first 8 chars)") was code-reviewer blocker — inconsistent with full-UUID wardrobe post-fix. Updated to "Pick garments by their ID."
- Files: `supabase/functions/_shared/burs-ai.ts`, `supabase/functions/suggest_outfit_combinations/index.ts`, `supabase/functions/wardrobe_aging/index.ts`, `supabase/functions/prefetch_suggestions/index.ts`, `supabase/functions/_shared/__tests__/burs-ai.test.ts`

**P24 [DONE] (PR #663, 2026-04-22)** Enrichment guarantee — helpers
- Shipped as part of Wave 4-A. Added four exports to `_shared/burs-ai.ts`: `isEnrichmentReady(status)` + `isEnrichmentFailed(status)` (boolean predicates) + `filterEnrichedGarments<T>(garments)` (uses isEnrichmentReady) + `waitForEnrichment(supabase, garmentIds, opts)` (polls `garments.enrichment_status` until all IDs resolve to a terminal state or the timeout elapses — default 5000ms total / 500ms poll interval). Phantom IDs (input set that the DB query doesn't return — garment deleted or never existed) are bucketed as `failed` so callers don't hang the full timeout on rows that will never appear. **Ready state accepts BOTH `'complete'` and `'completed'`** — Codex P2 review caught that two writers persist different spellings (frontend writes `'complete'`, backend job-queue writes `'completed'`). Mirror pre-existing defect in `_shared/outfit-scoring-body.ts:466` also fixed inline (identical single-spelling check was silently penalizing backend-enriched garments in outfit scoring). Consumers opt-in to `filterEnrichedGarments` + `waitForEnrichment` in Wave 4-B. 12 new unit tests including explicit dual-spelling coverage.
- Files: `supabase/functions/_shared/burs-ai.ts`, `supabase/functions/_shared/outfit-scoring-body.ts`, `supabase/functions/_shared/__tests__/burs-ai.test.ts`, `supabase/functions/CLAUDE.md`

**P25 [TODO]** Style DNA context injection
- Include Q1-Q12 onboarding answers in every AI function's system prompt. (Depends on Wave 7's schema.)
- Files: `supabase/functions/_shared/burs-ai.ts`, consumers
- Deploy: all AI functions (batch)

**P26 [DONE] (PR #665, 2026-04-23)** Real slot mapping via classifySlot
- Shipped as part of Wave 4-C bundle. `generate_outfit/index.ts:73` — after `invokeUnifiedStylistEngine` returns `garment_ids`, fetches garment rows via `serviceClient` and builds a `slotByGarment` Map, then `items` emits `{ slot: slotByGarment.get(id) || "unknown", garment_id: id }`. Falls back to `"unknown"` only when the garment is missing from the fetch or `classifySlot` returns null. `_shared/unified_stylist_engine.ts` — same pattern for the `otherItems` construction in the swap mode path (fetches garments for `activeLookIds.filter(id => id !== currentGarmentId)`, classifies via `classifySlot`, builds `otherItems` array with real slots). Both sites import `classifySlot` from `_shared/burs-slots.ts`. The shared module also gained a `createClient` import so it can fetch candidate garments without requiring the caller to pass the service client in.
- Files: `supabase/functions/generate_outfit/index.ts`, `supabase/functions/_shared/unified_stylist_engine.ts`
- Deploy: `generate_outfit`, `style_chat` (unified_stylist_engine shared-module consumer)

**P27 [DONE] (PR #665, 2026-04-23)** clone_outfit_dna retrieval tightening
- Shipped as part of Wave 4-C bundle. Full rewrite of `clone_outfit_dna/index.ts`. (a) DB queries expanded to SELECT `subcategory`, `ai_raw`, `enrichment_status` on both outfit_items.garments and the candidate-wardrobe fetch. (b) DNA extraction now pulls `ai_raw.style_archetype`, `ai_raw.occasion_tags`, `ai_raw.versatility_score`, `ai_raw.layering_role` per reference-outfit garment — English formality label (Wave 4-B pattern) instead of the old opaque `f3` code. (c) Uses `classifySlot(category, subcategory)` for the DNA slot field (stored `outfit_items.slot` used as fallback only — can be stale after category re-labels). (d) New `extractDNAProfile` builds a structured profile `{ categories, colors (multi-family via colorFamily), formalityBand (low/mid/high|null), archetypes, occasions }`. (e) `scoreCandidate` pre-filter — category overlap (2.0x), color family overlap (1.5x), formality band match (1.5x exact, 0.75x adjacent via mid), archetype overlap (1.0x), occasion overlap (0.75x). Stable sort preserves wardrobe order on ties; top-40 cap. (f) P24 enrichment gate — when ≥70% of candidate wardrobe is enriched, applies `filterEnrichedGarments`; below threshold sends what we have (graceful degrade). (g) Dynamic `estimateMaxTokens({ inputItems: ranked.length, outputItems: 3, perItemTokens: 120, baseTokens: 200 })`. (h) Prompt rule #1 enforces complete outfits (top+bottom+shoes OR dress+shoes + outerwear when reference has it) so variations aren't single garments. Response shape preserved: `{variations: [{name, garment_ids, explanation}]}` — backward-compatible.
- Files: `supabase/functions/clone_outfit_dna/index.ts`
- Deploy: `clone_outfit_dna`

#### Wave 4.5 — Secondary Image + Swap Primary (Product Feature)

Optional second image per garment, addable **only after the garment is already saved and rendered** — not part of the initial AddGarment flow. Once a secondary exists, the user can swap which image is the **primary / source of truth**. The primary is the image the wardrobe card displays AND the image every AI call (enrichment, rendering, outfit generation, all consumers of `image_path`) reads. Swap triggers re-enrichment + re-render so the AI outputs stay in sync with the newly chosen primary. Entirely opt-in per garment, no backfill.

**Design note — why swap values, not a pointer column:** swapping the actual VALUES of `image_path` ↔ `secondary_image_path` via a single atomic UPDATE keeps `image_path` as the universal source of truth. Every current reader (wardrobe card, analyze_garment, render_garment_image, outfit scoring, etc.) continues reading `image_path` with zero code changes — the swap is invisible to them. A separate `primary_is_secondary` enum would require updating every reader.

**P27a [DONE] (PR #666, 2026-04-23)** Schema: nullable `secondary_image_path` on garments
- Shipped as a schema-only PR. New migration `supabase/migrations/20260423213459_garments_secondary_image.sql` — `ALTER TABLE "public"."garments" ADD COLUMN IF NOT EXISTS "secondary_image_path" "text"`. Nullable, no default, no CHECK — matches the existing pattern from `original_image_path`, `processed_image_path`, and `rendered_image_path`. `IF NOT EXISTS` guard makes it idempotent.
- Post-merge: user runs `npx supabase db push --linked --yes` to apply on prod, then `supabase gen types typescript --linked` to regenerate `src/integrations/supabase/types.ts` (auto-generated file per CLAUDE.md — will show the new column after regen; intentionally stale in this PR since no code reads/writes the column yet — P27b is the consumer).
- Files: `supabase/migrations/20260423213459_garments_secondary_image.sql` (new)
- Deploy: none (zero backend code modified; zero function redeploy)

**P27b [DONE] (PR #668, 2026-04-24)** Secondary image flow: add, swap primary, delete (GarmentDetail only — post-save)
- Shipped solo PR. New `src/components/garment/SecondaryImageManager.tsx` slotted under the hero in `GarmentDetail.tsx`. Zero backend code changed; zero edge-function redeploy. (a) **Add**: hidden file input with `accept="image/*" capture="environment"` (native camera picker on mobile, file chooser on desktop — matches what LiveScan's browser-fallback branch emits); compress via the existing `compressImage()` helper; upload to `garments/${userId}/${garmentId}_secondary.{ext}` via `uploadGarmentImage()`; single UPDATE sets `secondary_image_path`. No AI re-trigger. (b) **Swap**: "Use as primary" button. Single-statement UPDATE swaps the VALUES of `image_path` ↔ `secondary_image_path` AND clears `ai_raw` / `ai_analyzed_at` / `ai_provider` / `silhouette` / `visual_weight` / `texture_intensity` / `style_archetype` / `occasion_tags` / `versatility_score` / `rendered_image_path` / `rendered_at` / `render_error`, sets `enrichment_status='pending'` + `render_status='pending'`. Optimistic concurrency via `.eq('image_path', previousImagePath)` catches concurrent swaps (second tab, shared account). Kicks `triggerGarmentPostSaveIntelligence` with `skipRender:true` then `enqueueRenderJob(..., { force: true })` with single transport-retry using same nonce (mirrors `startGarmentRenderInBackground` recovery). Spends one render credit — documented in the AlertDialog confirm copy. (c) **Delete**: storage delete first (logged, non-fatal — orphaned storage < broken UI), then NULL the column. No AI re-trigger. (d) **Guardrail**: all three actions disabled while `render_status ∈ {pending, rendering}` OR `enrichment_status ∈ {processing, in_progress}` OR a local mutation is in flight (`isUploading` / `isSwapping` / `isDeleting`). `aria-disabled` pattern — button stays clickable, handler short-circuits and toasts `garment.secondary_busy_toast` instead of silent no-op. (e) **UI**: 64×64 `LazyImage` thumbnail + copy + action row ("Use as primary", "Remove"). `AlertDialog` confirmations mirror the existing delete-garment pattern. Motion via `EASE_CURVE` / `DURATION_MEDIUM`. Haptics on every action. (f) **i18n**: 14 new `garment.secondary_*` keys appended to `en.ts` + `sv.ts` (append-only). (g) **Types regen (commit 1)**: `src/integrations/supabase/types.ts` regenerated post-P27a so `secondary_image_path` surfaces in Row/Insert/Update shapes. **No Median-hook file touched**. **Zero edge-function redeploy.** 
- Design decision — why read-then-UPDATE instead of literal self-referential SQL: supabase-js `.update()` can't emit `SET x = y, y = x` (column references in values aren't supported); an RPC would contradict spec "no swap RPC". Read-then-UPDATE with optimistic-concurrency `.eq('image_path', previousImagePath)` is atomic at the DB level for the UPDATE step; the read-write race is negligible given RLS owner-only writes + `isSwapping` local lock + pre-existing render/enrichment gate.
- Design decision — file-input-only capture: spec says "Browser fallback to file input is already built into LiveScan". My implementation IS that file-input fallback, standalone. Full LiveScan reuse would have required a new capture-return route with state handoff (LiveScan is 831 lines, full-page only). Blast radius of the simpler approach is O(1) component vs O(route + state + navigation).
- Files: `src/pages/GarmentDetail.tsx`, `src/components/garment/SecondaryImageManager.tsx` (new), `src/i18n/locales/en.ts` + `sv.ts`, `src/integrations/supabase/types.ts` (regen)
- Deploy: none

#### Wave 4.9 — Findings Cleanup (closing sub-wave, first application of Wave Closure Rule)

Closes Wave 4 by draining all open findings — pre-existing (Waves 0-3) plus any discovered during 4-B / 4-C / 4.5. PR clusters are tentative until the Wave 4.9 opening agent re-audits the Findings Log at entry (new findings from 4-B/4-C/4.5 MUST be added to scope). Each PR's Completion Log row carries the `[cleanup]` suffix.

**W4.9-A [DONE] (PR #669, 2026-04-24)** Schema cleanup — drop image_processing_* columns + remove outfit-scoring gate + delete orphan job_queue rows + backfill enrichment_status spelling
- Shipped as part of Wave 4.9 cleanup. Drops **7** columns (spec named 6 + added `image_processing_version` to satisfy "zero `image_processing_*` refs post-drop" acceptance): `image_processing_status`, `image_processing_provider`, `image_processing_version`, `image_processing_confidence`, `image_processing_error`, `image_processed_at`, `processed_image_path`. CHECK constraint `garments_image_processing_status_check` + INDEX `idx_garments_processing_status` drop automatically via column-drop cascade. DELETE orphan `job_queue` rows where `job_type='image_processing'`. Backfills `enrichment_status`: `'complete'`→`'completed'`, `'in_progress'`→`'processing'`. Frontend writers updated: `src/lib/garmentIntelligence.ts:429,445` (`'in_progress'`→`'processing'` + `'complete'`→`'completed'`), `src/pages/GarmentDetail.tsx:202,216` (same), `src/components/onboarding/QuickUploadStep.tsx:108` (`'complete'`→`'completed'`). `isEnrichmentReady` helper's dual-spelling acceptance kept indefinitely (spec point 5). **Scope expansion**: (a) `src/lib/garmentImage.ts` `getGarmentProcessingMessage()` signature tightened — dropped the dead `status` param since `image_processing_status` no longer exists; `GarmentProcessingBadge.tsx`, `GarmentDetail.tsx:126,334`, and `garmentImage.test.ts` updated in lockstep. (b) `src/lib/garmentIntelligence.ts` `buildGarmentIntelligenceFields()` stripped of `skipImageProcessing` param + all 7 column writes; Pick union narrowed to `enrichment_status | original_image_path | render_status`. Two callers (`buildGarmentInsert.ts:48`, `backgroundGarmentSave.ts:81`) dropped the now-dead `skipImageProcessing: true` arg. `GARMENT_IMAGE_PROCESSING_VERSION` constant removed from `src/config/constants.ts:15` (last reference). (c) `_shared/outfit-scoring-body.ts` penalty calculation rewritten to drop `imageReady`/`imageConfidence` variables and their branches (-0.3 image-ready penalty + -0.25 image-confidence penalty removed); `GarmentReadinessSignals` interface narrowed by 2 fields. (d) `_shared/outfit-scoring.ts` `GarmentRow` interface: dropped `image_processing_status` + `image_processing_confidence`. (e) `burs_style_engine/index.ts:851` SELECT string dropped those 2 columns. (f) `types.ts` auto-gen file manually edited — removed 21 field entries across `Row`/`Insert`/`Update` blocks for the 7 dropped columns (post-merge, user regenerates via `supabase gen types typescript --linked` to confirm). (g) **Pre-existing deno-check blockers cleared**: `_shared/outfit-scoring.ts:889-895` bare `as GarmentRow` cast widened to `as unknown as GarmentRow` (stub literal legitimately lacks `created_at` / `enrichment_status` / `ai_raw`); `_shared/outfit-scoring.ts:1309` `missing` variable typed explicitly as `string[]` so the downstream `missing.push('shoes')` compiles. Both pre-dated my PR (verified via stash test) but CI deno-check on `burs_style_engine/index.ts` (triggered by my SELECT-string edit) would have failed with them lingering. (h) **EnrichmentStatus type union widened** (`src/components/garment/GarmentEnrichmentPanel.tsx:78`) to include both old and new spellings (`'in_progress' | 'processing'` and `'complete' | 'completed'`) — transition-period defensive programming; matches `isEnrichmentReady` helper's acceptance. (i) **Test fixtures**: 10 test files de-noised of dropped-column keys (`useAISuggestions.test.tsx` × 9 lines, `useLiveScan.test.tsx`, `backgroundGarmentSave.test.ts`, `garmentIntelligence.test.ts`, `GarmentDetail.test.tsx`, `RefineChips.test.tsx`, `GarmentCardSystem.test.tsx`, `Plan.test.tsx`, `ShareOutfit.test.tsx`, `PublicProfile.test.tsx`).
- Files: 2 new migrations (`20260424004046_drop_image_processing_columns.sql`, `20260424004047_backfill_enrichment_status.sql`), 22 source files + 10 test files updated.
- Post-merge: user runs `npx supabase db push --linked --yes` (applies both migrations). Then `supabase gen types typescript --linked > src/integrations/supabase/types.ts` in a follow-up commit to confirm type drift is clean. Deploy: `burs_style_engine` (only runtime consumer of the outfit-scoring-body change).

**W4.9-B [DONE] (PR #670, 2026-04-24)** Docs + i18n drift — LAUNCH_PLAN.md P8 spec correction + drop 5 orphan avatar i18n keys
- Shipped bundled with W4.9-D (zero-code-impact doc cleanup + Fix Protocol audit share the "maintenance" theme). (a) **LAUNCH_PLAN.md P8 spec corrected** at two spots: (i) line 707's bullet reworded so the `ai_response_cache` entry points to the L554 note below rather than claiming a `cache_namespace` column that never existed; (ii) the in-code-block comment block (lines 735-754) rewritten to reflect that L554 (PR #659) shipped the `user_id` column + index + cascade FK, and the explicit `.eq("user_id", userId).delete()` line is now present as belt-and-suspenders. Historical context preserved so future maintainers understand the earlier `cache_namespace` / `cache_key` dead-end. (b) **5 orphan `settings.avatar_*` keys removed from all 14 locale files** (70 instances total, consistent sed-based bulk-delete with the exact regex `/^\s+'settings\.(change_photo|avatar_updated|avatar_error|avatar_invalid|avatar_too_large)':.*,\s*$/d`). Keys: `settings.change_photo`, `settings.avatar_updated`, `settings.avatar_error`, `settings.avatar_invalid`, `settings.avatar_too_large`. Post-edit grep confirms zero matches for `settings.avatar_` in `src/`. Safe to delete — PR #654 (Wave 0+1 cleanup sweep B) removed the only caller in `ProfileCard.tsx`. Append-only locale rule protects LIVE keys; dead ones can be removed.
- Files: `LAUNCH_PLAN.md`, `src/i18n/locales/*.ts` (14 locale files)
- Deploy: none

**W4.9-C [DONE] (PR #671, 2026-04-24)** Observability — Sentry hook on validator_unavailable fail-open path
- Shipped a minimal edge-function observability helper (`supabase/functions/_shared/observability.ts`) since no edge function previously integrated with Sentry. Helper: (a) parses `SENTRY_DSN` from env via `typeof Deno !== "undefined"` guard (so vitest/Node can import it without exploding — same pattern as `_shared/burs-ai.ts:27`); (b) `captureWarning(event, tags)` emits a structured `console.warn` for Supabase Logs queryability AND fires-and-forgets a POST to Sentry's `store` endpoint when DSN is configured — any transport failure is swallowed (must not block the render path); (c) `classifyValidatorError(err)` narrows the reason tag to `validator_timeout` / `validator_fetch_failed` / `validator_bad_response` (matches Wave 3-B Finding #8 taxonomy). Wired into `render_garment_image/index.ts:1679` fail-open branch — when the validator throws on attempt 1, we emit `render_validator_unavailable` with tags `{attempt: 1, category: categoryClass, reason}`. The existing `console.warn` left in place as belt-and-suspenders. No new SDK dependency; ~100 LOC helper. When `SENTRY_DSN` is unset, zero-runtime-cost beyond the structured log. User action: provision `SENTRY_DSN` via `npx supabase secrets set SENTRY_DSN=<dsn>` for visibility in prod Sentry — tracked as post-launch setup, NOT a merge blocker per spec.
- Files: `supabase/functions/_shared/observability.ts` (new), `supabase/functions/render_garment_image/index.ts`
- Deploy: `render_garment_image`

**W4.9-D [DONE] (PR #670, 2026-04-24)** P0c execution — verify/adjust Fix Protocol wording
- Shipped bundled with W4.9-B. Audited the Fix Protocol section end-to-end against 10 PRs of actual practice and updated two spots where prose diverged from reality: (a) "While writing code #3" — the strict "Do NOT fix a second bug in this prompt" rule now includes three explicit exceptions (CI blocker uncovered by the current change; shared-code defect whose absence would regress the PR's acceptance; tight sibling defect failing the same grep/acceptance criterion). Captures the W4.9-A deno-check fix pattern + the P15 sibling-hook sweep pattern. Scope expansions now documented under "Scope expansion" section (not "Out of scope"), with mandatory Findings Log row. (b) "Launch Plan Update #1" — expanded to mention `[DONE-partial]` status explicitly (used for P0d split into P0d-ii/iii/iv); item #4 now notes the `[cleanup]` suffix convention for closing-wave PRs (standing Wave Closure Rule convention). Item #6 clarifies "same commit or sibling commit on same branch" so tracker + fix commits are never separated across PRs. All other Fix Protocol rules (Before writing code / Before committing / Before pushing / PR body template) audited and left unchanged — they accurately reflect current practice.
- Files: `CLAUDE.md` (Fix Protocol section only)
- Deploy: none

**W4.9 user-action items (checkbox list inside the W4.9-A or W4.9-B PR body; track completion, not a code change):**
- [x] Provision `SUPABASE_SERVICE_ROLE_KEY_TEST` GitHub repo secret (P0d-iv Finding) — done 2026-04-25 by user; verified by CI run #24930703508 succeeding on rerun.
- [x] `git merge --abort` in main repo + `git checkout main && git pull --ff-only` + prune unused worktrees via `git worktree remove` (P4 Finding) — done 2026-04-25 in Wave 4.9 follow-up cleanup PR; tmp-db-push branch deleted, worktree registry 12→4.
- [x] Supabase Dashboard → Edge Functions → Schedules audit for `calendar.handleSyncAll` caller; if dead, file mini-PR (P2 Finding) — done 2026-04-25 in Wave 4.9 follow-up cleanup PR; pg_cron + telemetry confirmed dead, function deleted.

#### Wave 5 — Refine Button + AI Chat Fixes

**P28 [DONE-subsumed] (subsumed by P26 PR #665 + P30 PR #672, 2026-04-25)** Refine anchors garment instead of full outfit (user's repro)
- Original spec described a pre-P26 defect: "refine flow calls unified stylist with mode='swap' + single anchor_garment_id, losing full outfit context." The defect no longer exists on `main`. Investigated end-to-end on commit `8a240d0c` (post-P30 merge) and verified the refine path correctly threads the full outfit context through every layer:
  - **UI entry** — `src/components/chat/OutfitSuggestionCard.tsx:332` fires `onRefine(garments.map(g => g.id), explanation)` — passes the FULL outfit array, never an anchor. `src/components/chat/RefineChips.tsx` and `RefineBanner.tsx` are presentational and don't construct payloads.
  - **Frontend handler** — `src/pages/AIChat.tsx` `handleEnterRefine(garmentIds, explanation)` stores the full list in `useRefineMode.activeGarmentIds` + `activeExplanation`. The send-message flow at AIChat.tsx:813-839 includes `active_look.garment_ids` (full outfit) + `locked_slots` in every refine-mode message body.
  - **`style_chat/index.ts:1471-1479`** — calls `invokeUnifiedStylistEngine` with `active_look_garment_ids: activeLook.garmentIds`, `locked_garment_ids: [...refinementPlan.lockedGarmentIds, ...(anchorLocked ? [anchorGarmentId] : [])]`, and `requested_edit_slots: refinementPlan.requestedEditSlots`. All three threaded.
  - **`_shared/unified_stylist_engine.ts:83`** — `const mode = request.mode === "refine" ? "generate" : request.mode;` — the engine intentionally maps refine→generate but PRESERVES `active_look_garment_ids` (line 124), `locked_garment_ids`, and `requested_edit_slots`. This is the multi-garment refinement path, not a single-anchor swap.
  - **`burs_style_engine`** — `buildActiveLookSlotMap` + `rankCombosForRefinement` (in `_shared/outfit-scoring.ts`) enforce that locked garments are preserved and at least one requested-edit slot is changed. Full-outfit context is the entire basis of ranking.
  - **`useSwapGarment.ts`** — this hook is the SINGLE-garment swap flow (replaces one item in an existing outfit), not the refine flow. It correctly passes `other_items` (the rest of the outfit) so the swap candidate is scored against the full context. Confused with refine in the original P28 spec; not actually defective.
- Why subsumed: **P26 (PR #665)** fixed the slot-mapping defect in `unified_stylist_engine.ts:90-111` that was the root cause cited in P28 — it replaced fail-open-with-`slot:"unknown"` with `classifySlot()`, so multi-garment refinement got real slot context. **P30 (PR #672)** added the `applyActiveLookRefinementOverride` so the LLM classifier consistently routes refine intents (rounds 21-28 hardened the heuristic against false positives + false negatives). Together, they delivered every piece of the P28 acceptance criterion.
- Files originally scoped: `src/hooks/useSwapGarment.ts`, `supabase/functions/_shared/unified_stylist_engine.ts`, `supabase/functions/style_chat/index.ts` (refine path)
- Deploy: none (no code changes — tracker-only PR documenting the subsumption)

**P29 [DONE-subsumed] (subsumed by architecture + P26 PR #665, 2026-04-25)** AI chat activeLook persistence
- Original spec: "Verify `StyleChatActiveLookInput` serializes correctly across messages." End-to-end audit on `main` (commit `ca0bf856`, post-PR #673 merge) confirms the serialization is fully working at every layer:
  - **Type drift** — `src/lib/styleChatContract.ts:21-27` (frontend) and `supabase/functions/_shared/style-chat-contract.ts` (backend) define `StyleChatActiveLookInput` IDENTICALLY (`garment_ids?: string[]`, `explanation?: string | null`, `source?: string | null`, `anchor_garment_id?: string | null`, `anchor_locked?: boolean`). Zero drift.
  - **Client serialization (turn N)** — `src/pages/AIChat.tsx:820-838` builds `active_look` for every send. When `refineMode.isRefining`, sources from `refineMode.activeGarmentIds` (full outfit). On follow-up turns without refineMode, sources from `currentVisibleLook.active_look` (which derives from prior assistant message's `stylistMeta.active_look`) — preserves `anchor_garment_id` + `anchor_locked` from prior turn correctly.
  - **DB persistence** — `AIChat.tsx:407-426` `persistMessages` writes `JSON.stringify({ kind: 'stylist_message', content, stylistMeta })` to `chat_messages.content`. The `stylistMeta` payload includes `active_look` with `anchor_garment_id` intact.
  - **DB readback** — `AIChat.tsx:395-405` `loadMessages` queries chat_messages and `parseStoredMessage()` (lines 85-105) deserializes via `isStyleChatResponseEnvelope` guard. Round-trips faithfully.
  - **Active look hydration** — `AIChat.tsx:638-642` `getLatestActiveLook(messages)` reconstructs the latest `StyleChatResponseEnvelope` from message history, including `active_look.anchor_garment_id` / `anchor_locked`.
  - **Backend deserialization** — `style_chat/index.ts:927-944` extracts `active_look` from `req.json()` and casts to `StyleChatActiveLookInput`. Lines 947-949 promote `explicitActiveLook.anchor_garment_id` to `selectedGarmentIds` when `anchor_locked` is true. Line 1164 passes `selectedGarmentIds` to `getWardrobeContext` → `wardrobe-context.ts:118` `detectAnchorGarment` honors the explicit anchor first.
  - **Backend response construction** — `style_chat/index.ts:1840-1866` builds the response envelope's `active_look.anchor_garment_id` from `refinementPlan.anchorGarmentId` and `anchor_locked` from `refinementPlan.anchorLocked` (computed at line 812 from `params.anchor && params.selectedGarmentIds.includes(params.anchor.id) && !params.anchorReleased`). Persisted back to client → completes the round trip.
- Why subsumed: the persistence + serialization machinery was established as part of the broader stylist-chat contract (predates P26) and refined for slot accuracy via **P26 (PR #665)** which made `selectedGarmentIds`-driven anchor resolution work correctly. P29's "verify serialization" requirement is satisfied by the audit above with zero defects identified.
- Files originally scoped: `supabase/functions/_shared/style-chat-contract.ts`, `supabase/functions/style_chat/index.ts`, `src/pages/AIChat.tsx`
- Deploy: none (no code changes — tracker-only PR documenting the subsumption)

**P30 [DONE] (PR #672, 2026-04-24)** style_chat classifier fallback
- Shipped as a solo PR (bundled P28/P29/P31 deferred — P28 spec largely pre-P26 and requires deeper investigation before fix). Added `applyActiveLookRefinementOverride(result, input)` to `_shared/style-chat-classifier.ts` as a deterministic post-classifier override: when `hasActiveLook=true` AND classifier returned `intent: "conversation"` AND the user message contains a refinement keyword (`warmer|cooler|formal|casual|swap|change|different|elevated|softer|sharper`), flip intent to `"refine_outfit"` and (if classifier didn't fill one) infer `refinement_hint` from the specific keyword via 11-pattern ordered match (warmer → `warmer`, shoes → `swap_shoes`, elevated → `more_formal`, etc.). No override when `hasActiveLook=false` — classifier prompt already handles that correctly (rule at line 77: routes to conversation + needs_more_context=true). Classifier-provided hint wins if already non-null (we only infer when null). 9 new unit tests added (flip cases + negative cases + passthrough). Shared-module scope — `_shared/style-chat-classifier.ts` is consumed only by `style_chat` per CLAUDE.md Shared Module Deploy Map. CI `deno-check` job only runs on changed edge-function entry-points (P0b convention), so this PR won't trigger `deno check supabase/functions/style_chat/index.ts` — which is fine because the 5 pre-existing style_chat errors (Finding Log row) are not reachable by this PR's change.
- Files: `supabase/functions/_shared/style-chat-classifier.ts`, `supabase/functions/_shared/__tests__/style-chat-classifier.test.ts`
- Deploy: `style_chat`

**P31 [DONE-subsumed] (subsumed by architecture, 2026-04-25)** RefineChips/RefineBanner payload fix
- Original spec: "Send full outfit payload, not anchor-only." End-to-end audit on `main` (commit `ca0bf856`) confirms the architecture already enforces full-outfit payload correctly:
  - **`src/components/chat/RefineChips.tsx:26-99`** — chip components are intentionally STATELESS message-emitters. Each chip's onClick at line 90 calls `onChipTap(chip.message)` with a plain text string only. Zero payload construction. No knowledge of garment IDs at the chip layer.
  - **`src/components/chat/RefineBanner.tsx:15-58`** — purely PRESENTATIONAL. Renders thumbnails of active garments. Only tap handler is the X button at line 49 calling `onStopRefining()`. Zero payload logic.
  - **Parent (`src/pages/AIChat.tsx`) owns payload construction** — `handleChipTap` at line 1168-1170 forwards the plain message text to `sendMessage()`. The structured request body is built at `AIChat.tsx:810-841` where, when `refineMode.isRefining`, the request includes `active_look: { garment_ids: refineMode.activeGarmentIds, ... }` — i.e., the FULL outfit, not just an anchor. Locked slots are also threaded via `locked_slots: refineMode.lockedSlots`.
- Why subsumed: the original P31 spec was written assuming RefineChips constructed payloads directly. The architecture has chip components as dumb visual primitives and the parent (AIChat) as the payload owner — by design, full outfit is always sent on every refine-mode message. No code change is needed in RefineChips.tsx or RefineBanner.tsx.
- Files originally scoped: `src/components/chat/RefineChips.tsx`, `src/components/chat/RefineBanner.tsx`
- Deploy: none (no code changes — tracker-only PR documenting the subsumption)

#### Wave 6 — Localization

**P32 [DONE] (PR #680, 2026-04-25)** Extend langName maps to 14 locales
- Spec named 5 functions but `smart_shopping_list` was removed in P22. Net scope: 4 functions.
- **mood_outfit/index.ts:266** + **wardrobe_aging/index.ts:54**: replaced binary `langName = locale === "sv" ? "svenska" : "English"` with full 14-locale `LOCALE_NAMES` map. Default fallback "English" preserved.
- **travel_capsule/index.ts:486-488**: extended existing 8-locale `LOCALE_NAMES` (was sv/en/no/da/fi/de/fr/es) to all 14 (added it/pt/nl/pl/ar/fa). Standardized capitalization on canonical native names (Svenska / Norsk / Dansk / Suomi — was lowercase + "finska" Swedish-ized).
- **clone_outfit_dna/index.ts**: function had NO locale awareness. Added `locale = "en"` default to the request body destructure (line 219), `LOCALE_NAMES` map, and `Respond in ${langName}.` rule #5 in the system prompt. Caller `useCloneOutfitDNA()` in `src/hooks/useAdvancedFeatures.ts` updated to pull `locale` from `useLanguage()` and ship it in the body. Test mock added in `src/hooks/__tests__/useAdvancedFeatures.test.tsx` (new `useLanguageMock` for the LanguageContext stub) and assertion updated to expect `body: { outfit_id: 'o1', locale: 'en' }`.
- Native names map: sv→Svenska, en→English, no→Norsk, da→Dansk, fi→Suomi, de→Deutsch, fr→Français, es→Español, it→Italiano, pt→Português, nl→Nederlands, pl→Polski, ar→العربية, fa→فارسی. Matches `src/i18n/types.ts:9-24` SUPPORTED_LOCALES list.
- Files: `supabase/functions/{mood_outfit,wardrobe_aging,clone_outfit_dna,travel_capsule}/index.ts`, `src/hooks/useAdvancedFeatures.ts`, `src/hooks/__tests__/useAdvancedFeatures.test.tsx`
- Deploy: 4 functions (`mood_outfit`, `wardrobe_aging`, `clone_outfit_dna`, `travel_capsule`)

**P33 [DONE] (PR #678, 2026-04-25)** Localize NotFound + Auth + ResetPassword
- Original spec: "Entire NotFound.tsx + placeholders in Auth.tsx + ResetPassword.tsx." Audit on main `016df4ce` revealed Auth.tsx + ResetPassword.tsx already fully localized (all visible UI strings via `t()`); only NotFound.tsx had hardcoded strings. NotFound.tsx imports `useLanguage`, lines 20+22 wrap `"Page not found"` → `t('notfound.title')` and `"Return to Home"` → `t('notfound.return_home')`. 2 new keys appended to en.ts + sv.ts.
- Files: `src/pages/NotFound.tsx`, `src/i18n/locales/en.ts`, `src/i18n/locales/sv.ts`
- Deploy: none

**P34 [DONE] (PR #678, 2026-04-25)** Localize ShareOutfit + PublicProfile meta tags
- ShareOutfit.tsx lines 148-156: 3 hardcoded `${outfit.occasion} Outfit | Styled by BURS` titles + 3 hardcoded fallback descriptions. Replaced with `t('share.meta_title_template').replace('{occasion}', outfit.occasion)` (placeholder pattern) + `t('share.meta_description_full')` + `t('share.meta_description_short')`.
- PublicProfile.tsx lines 142-143: hardcoded `${displayName} — BURS Style Profile` + `Check out ${displayName}'s style on BURS`. Replaced with `t('profile.meta_title_template').replace('{name}', displayName)` + `t('profile.meta_description_template').replace('{name}', displayName)`.
- 5 new keys appended to en.ts + sv.ts using the `{occasion}` / `{name}` placeholder convention (chosen because the existing `t: (key) => string` signature has no built-in interpolation; `.replace()` is the path-of-least-resistance).
- Files: `src/pages/ShareOutfit.tsx`, `src/pages/PublicProfile.tsx`, `src/i18n/locales/en.ts`, `src/i18n/locales/sv.ts`
- Deploy: none

**P35 [DONE] (PR #679, 2026-04-25)** Localize AddGarment + LiveScan + OutfitDetail + Onboarding fallbacks
- Audit revealed AddGarment.tsx + OutfitDetail.tsx already fully localized; defects concentrated in LiveScan.tsx + 5 onboarding components.
- **LiveScan.tsx** lines 764-765 + 783: hardcoded CoachMark `title="Scan anything"` + `body="Point at a garment..."` + `aria-label="Scan"` replaced with `t('livescan.coach.scan_title')` + `t('livescan.coach.scan_body')` + `t('livescan.scan_aria')`. `t` already in scope from existing `useLanguage()` destructure at line 42.
- **GetStartedStep.tsx** lines 47-48: hardcoded `eyebrow="Ready"` + `title="Your wardrobe is ready."` replaced with `t('onboarding.getstarted.eyebrow_ready')` + `t('onboarding.getstarted.title_ready')` (existing `onboarding.getstarted.title` is "Where to start" — different copy, can't reuse).
- **LanguageStep.tsx** lines 25-26: hardcoded `eyebrow="Onboarding"` + `title="Choose your language."` replaced with `t('onboarding.eyebrow_generic')` + the existing `t('onboarding.language.title')` ("Choose language" / "Välj språk"). Slight UX delta (drops "your" + period) but reuses existing key per the append-only rule's spirit.
- **AccentColorStep.tsx** lines 61, 69, 75: live-preview demo strings `Outline` (button), `Favorit` (badge — note the leftover Swedish word in the English-default code path!), `Premium` (badge) replaced with `t('onboarding.accent.preview_outline')` + `t('onboarding.accent.preview_favorite')` + `t('onboarding.accent.preview_premium')`. Preview now reflects the user's chosen locale (AccentColorStep runs after LanguageStep in the onboarding flow).
- **QuickStyleQuiz.tsx** lines 461-463: hardcoded `eyebrow="Style profile"` + `title="Tell us how you dress."` + `description="Ten quick answers..."` replaced with `t('onboarding.quiz.eyebrow')` + `t('onboarding.quiz.title_intro')` + `t('onboarding.quiz.intro_desc')`.
- **QuickUploadStep.tsx** lines 152-153: hardcoded `eyebrow="Onboarding"` + `title="Add your first piece."` replaced with `t('onboarding.eyebrow_generic')` (shared with LanguageStep) + `t('onboarding.upload.title_intro')`. Existing description fallback pattern at line 154 (`t('onboarding.quickUpload.subtitle') || 'Snap or pick up to 5 items...'`) left unchanged — already follows the safe pattern.
- **Scope expansion (Fix Protocol criterion (c) — sibling defect)**: code-reviewer flagged 3 more hardcoded strings in LiveScan.tsx that fall under the same "no hardcoded user-facing English strings on this screen" acceptance criterion. Lines 754 + 756 + 766 had `"SCANNING"` / `"Point camera at your clothing item"` / `ctaLabel="Generate a look"` hardcoded. Fixed inline via 3 additional keys: `livescan.scanning_label` (Title Case 'Scanning' / 'Skannar' — relies on `.label-editorial` CSS for uppercase, matches eyebrow convention from PR #678 P36 fix), `livescan.scan_instruction`, `livescan.coach.cta_label`.
- **16 new keys** appended to en.ts + sv.ts (append-only). Other 12 locale files NOT touched per convention.
- Files: `src/pages/LiveScan.tsx`, `src/components/onboarding/{GetStartedStep,LanguageStep,AccentColorStep,QuickStyleQuiz,QuickUploadStep}.tsx`, `src/i18n/locales/en.ts`, `src/i18n/locales/sv.ts`
- Deploy: none

**P36 [DONE] (PR #678, 2026-04-25)** Localize Insights.tsx
- Authorized carve-out from the "Permanently frozen" rule on Insights.tsx — P36 explicitly localizes it per spec.
- Line 36 weekday array `['M', 'T', 'W', 'T', 'F', 'S', 'S']` (English-only narrows) replaced with date-fns `format(new Date(2024, 0, day), 'EEEEE', { locale: dateFnsLocale })` for days 1-7 (2024-01-01 was a Monday, so days 1-7 map to Mon-Sun in the active locale's narrow weekday format). `useLanguage()` destructure extended to pull `dateFnsLocale`. `useMemo` deps array gained `dateFnsLocale` so re-running on locale change.
- Line 64 hardcoded `eyebrow="INSIGHTS"` replaced with `eyebrow={t('nav.insights')}`. **Code-reviewer fix pre-push**: initial draft introduced a new `insights.eyebrow_label` key with pre-uppercased values ('INSIGHTS' / 'INSIKTER'), but that diverged from the codebase convention where every other `eyebrow={t(...)}` call uses Title Case (`'Saved looks'`, `'Travel capsule'`, `'AI Stylist'`, etc.) and relies on the `.caption-upper` CSS class (`src/index.css:312`) to render uppercase. Pre-uppercased values would have trapped future translators into ALL-CAPS for non-Latin scripts (Arabic/Persian/Hebrew have no case). Switched to existing `nav.insights` key (already 'Insights' / 'Insikter' in both locales) — matches UnusedOutfits.tsx:162 sibling pattern. Net result: zero new keys for P36, all behavior delivered through existing infrastructure.
- Line 65 title fallback `t('insights.yourStyleStory') || 'Your Style Story'` already followed the safe-pattern (i18n key + English fallback). Audit verified COMPLIANT — left unchanged.
- Files: `src/pages/Insights.tsx`, `src/i18n/locales/en.ts`, `src/i18n/locales/sv.ts`
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

**P40 [DONE] (PR #681, 2026-04-25)** Multi-locale regexes
- **OutfitGenerate.tsx:78** — `FORMAL_KEYWORDS` regex was English-only (13 keywords). Expanded to 50+ formality-trigger words across 12 Latin-script locales (sv/en/no/da/fi/de/fr/es/it/pt/nl/pl). Added `/u` flag so `\b` word boundaries handle non-ASCII (möte, présentation, etc.). RTL scripts (ar/fa) intentionally omitted from FORMAL_KEYWORDS — calendar event titles in Arabic/Persian are uncommon for the launch markets and `\b` semantics around RTL scripts have edge cases worth testing first.
- **shopping_chat/index.ts:137** — `CHAT_SHORT_RE` regex was English-only (22 greetings/affirmations). Expanded to ~85 tokens across all 14 locales including ar/fa native script (e.g. مرحبا/أهلا "hello", شكرا "thanks", سلام "hi", ممنون "thanks"). `/iu` flags. Order grouped by language family (Germanic, Romance, Slavic, RTL). Acceptable harmless duplicates across language families (e.g. "hej" sv+da, "ja" de+nl, "no" en+es) — JS regex alternation handles them fine.
- **Translator-pass needed**: high confidence on sv/en, reasonable on da/no/de/fr/es, low on fi/it/pt/nl/pl (single-best-guess), low on ar/fa (greetings only, no formality words). Logged in Findings Log as scheduled translator-pass.
- Verification (Node.js regex sanity test): `möte` → FORMAL true, `meeting` → FORMAL true, `random` → FORMAL false; `hej` → CHAT true, `thanks!` → CHAT true, `مرحبا` → CHAT true, `long sentence` → CHAT false.
- Files: `src/pages/OutfitGenerate.tsx`, `supabase/functions/shopping_chat/index.ts`
- Deploy: `shopping_chat`

**P41 [DONE] (PR #677, 2026-04-25)** Fix UnusedOutfits Swedish/English key mixing
- Replaced `OCCASIONS = ['vardag', 'jobb', 'dejt', 'fest', 'casual', 'smart_casual']` (4 Swedish + 2 English mix) with the canonical English-keyed 6-occasion vocabulary `['casual', 'work', 'date', 'party', 'workout', 'travel']` — matches `src/components/outfit/OutfitGeneratePicker.tsx:29-36`, `src/components/plan/QuickGenerateSheet.tsx:62-69`, and `src/components/home/AdjustDaySection.tsx:10-15`. Backend `burs_style_engine` already accepts both Swedish-keyed and English-keyed values (en.ts has `occasion.vardag` AND `occasion.casual` → both "Casual" via `occasionLabel(t, occasion)` in `src/lib/humanize.ts:75-81`), so this is a behavior-preserving change for downstream display.
- Also localized the inline `"unused pieces"` string at line 290 — wrapped in `t('insights.unused_pieces_label')`. Two new keys appended to `en.ts` + `sv.ts` (append-only): `'insights.unused_pieces_label': 'unused pieces'` / `'oanvända plagg'`.
- Files: `src/pages/UnusedOutfits.tsx`, `src/i18n/locales/en.ts`, `src/i18n/locales/sv.ts`
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

#### Wave 10.5 — Vertex AI + Gemini 3 Migration (Pre-Launch)

Migrates BURS's entire AI surface from Google AI Studio + Gemini 2.5 → **Vertex AI** (`aiplatform.googleapis.com`, region `europe-west4`, service-account OAuth) + **Gemini 3.x** models. Model mapping: `gemini-2.5-flash` → `gemini-3-flash` (GA), `gemini-2.5-flash-lite` → `gemini-3.1-flash-lite-preview`, `gemini-2.5-flash-image` → `gemini-3.1-flash-image-preview` ("Nano Banana 2").

**Full plan, audit table, breaking changes, risks, cost:** see [`docs/VERTEX_MIGRATION_PLAN.md`](docs/VERTEX_MIGRATION_PLAN.md).

Slotted between Wave 10 and Wave 11 so the AI upgrade lands before TestFlight (Wave 11 P80) but after the subscription + IAP plumbing stabilizes. 6 PRs corresponding to the 6 phases in the plan doc.

**P(V1) [TODO]** Phase 1 — Shared Vertex client + auth shim
- New `supabase/functions/_shared/vertex-auth.ts` (SA JSON → JWT → OAuth token + cache). Rewrite `_shared/burs-ai.ts` transport: Vertex REST + Bearer auth + OpenAI↔native adapter + preview-model fallback + SSE keepalive injection. Update `_shared/scale-guard.ts` `estimateCost()` pricing map.
- Files: `supabase/functions/_shared/vertex-auth.ts` (new), `supabase/functions/_shared/burs-ai.ts`, `supabase/functions/_shared/scale-guard.ts`
- Deploy: **none** (code ships on main, no caller uses the new path until Phase 2).
- Pre-req: new Supabase secrets `GCP_SERVICE_ACCOUNT_JSON_B64`, `GCP_PROJECT_ID`, `GCP_LOCATION=europe-west4` provisioned by user. Vertex AI quota increase submitted for all three target models in `europe-west4`.

**P(V2) [TODO]** Phase 2 — Tier 1 functions (5, one PR)
- Flip `wardrobe_aging`, `style_twin`, `summarize_day`, `wardrobe_gap_analysis`, `prefetch_suggestions` to new transport. Model IDs auto-upgrade via `COMPLEXITY_CHAINS`.
- Deploy: 5 functions. Gate: 24h clean prod telemetry.

**P(V3) [TODO]** Phase 3 — Tier 2 functions (7, two PRs)
- Non-multimodal PR: `detect_duplicate_garment`, `suggest_accessories`, `suggest_outfit_combinations`, `clone_outfit_dna`, `travel_capsule`.
- Multimodal PR: `visual_search`, `assess_garment_condition` + token-budget benchmark for §4.3 image tokenization.
- Deploy: 7 functions. Gate: 24h clean telemetry after multimodal PR.

**P(V4) [TODO]** Phase 4 — Tier 3 hot path (8 PRs: 7 function flips + 1 prep-only)
- Order: `analyze_garment` → `outfit_photo_feedback` → `burs_style_engine` → `generate_outfit` → `mood_outfit` (streaming+keepalive, single-turn) → **PR 4-6 thought-signature plumbing (prep-only, no function flip)** → `shopping_chat` (streaming) → `style_chat` (streaming, LAST).
- Deploy: 7 functions. PR 4-6 deploys no function — just lands the migration + shared signature adapter.
- Schema: `chat_messages.thought_signature TEXT NULL` migration ships in PR 4-6 BEFORE either chat function flips (Codex P1 on PR #667 — original sequence flipped shopping_chat before the signature plumbing, creating a 24h degradation window).

**P(V5) [TODO]** Phase 5 — Image generation + text gate (1 PR)
- `_shared/gemini-image-client.ts` → `gemini-3.1-flash-image-preview` (Nano Banana 2) + Vertex endpoint + OAuth.
- `_shared/render-eligibility.ts` text-gate → `gemini-3-flash` + Vertex.
- `RENDER_PROMPT_VERSION` v2 → v3 (invalidates stale credit reservations per Wave 3-B precedent).
- Visual quality benchmark across 6 category variants before merge.
- Deploy: `render_garment_image`, `generate_garment_images`, `generate_flatlay`. Gate: 48h clean telemetry.

**P(V6) [TODO]** Phase 6 — Cleanup + canonical doc flip
- Remove OpenAI-compat adapter layer in `_shared/burs-ai.ts`. Remove `GEMINI_API_KEY` secret (after 7-day stability window). Collapse 3 `GEMINI_*_URL_OVERRIDE` env vars into single `VERTEX_URL_OVERRIDE`. Update smoke-test mock server to Vertex REST shapes.
- **Canonical doc flips** (only land AFTER migration is proven):
  - Root `CLAUDE.md` "AI" row in Project Identity → new target-state description.
  - `supabase/functions/CLAUDE.md` § "AI Calls" routing table → new model IDs + env-var list.
- Deploy: all 22 AI functions (burs-ai.ts shared-module radius).

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
| 2026-04-19 | P0a | `src/i18n/locales/en.ts`, `src/i18n/locales/sv.ts` | Duplicate keys `capsule.generating` and `common.delete` in both locale files — surfaced by Vite build warnings when the new pre-commit hook ran. Locale files are append-only per CLAUDE.md so this cannot be fixed inline. | **RESOLVED in PR #653** (Wave 0+1 cleanup sweep, 2026-04-21): duplicate later-occurrences removed from both locale files, earlier namespace-scoped definitions preserved. User-visible string change on en.ts: `capsule.generating` "Generating..." → "Building packing list..." (the earlier, more specific definition now wins). `common.delete` had identical values — no visible change. |
| 2026-04-19 | P0b | `.github/workflows/ci.yml:26` | Type-check step uses `bun run tsc --noEmit` without `--skipLibCheck`. CLAUDE.md pipeline + pre-commit hook both use `--skipLibCheck`. CI is stricter than local — a lib-type bump could fail CI without tripping local. | **RESOLVED in PR #653** (Wave 0+1 cleanup sweep, 2026-04-21): `--skipLibCheck` added to the CI type-check step so it matches the local pipeline + pre-commit hook. |
| 2026-04-19 | P0b | `.github/workflows/ci.yml:34-41` | Bundle-size check echoes `WARNING` on overflow but exits 0 → never blocks a merge. Silently passes regressions. | **RESOLVED in PR #653** (Wave 0+1 cleanup sweep, 2026-04-21): bundle-size check now exits 1 with `::error::` annotation on overflow, so regressions block the merge instead of passing with a silent warning. |
| 2026-04-19 | P0b | `.github/workflows/ci.yml` | CI has no `deno check supabase/functions/<fn>/index.ts` step. Fix Protocol requires it for edge-function changes but CI doesn't enforce. | **RESOLVED in PR #653** (Wave 0+1 cleanup sweep, 2026-04-21): added `deno-check` job with three-dot diff detection of changed `supabase/functions/<name>/index.ts`. Only runs when edge-function entry-points changed (not on `_shared/` — that would force check-all and spike CI time). Uses `denoland/setup-deno@v1` + `actions/cache` on `~/.cache/deno` so subsequent runs skip ESM URL resolution. |
| 2026-04-19 | P0d-ii | `supabase/migrations/` | **Schema drift** — earliest migration (`20260124173453_...`) `ALTER TABLE`s `public.garments`, but no `CREATE TABLE garments` (or other base tables) migration exists in the repo. Base schema was authored in Studio UI without a backfilled migration file. `supabase start` + `supabase db reset` against an empty local DB fails with `ERROR: relation "public.garments" does not exist`. Surfaced when P0d-ii's smoke-local CI job ran for the first time. | Dedicated fix: new prompt **P0d-iv — Schema baseline migration (drift repair)** inserted between P0d-iii and P0e. P0d-ii's `smoke-local` job is gated `if: false` until P0d-iv re-enables it. **Resolved in P0d-iv (PR #639, 2026-04-20).** |
| 2026-04-20 | P0d-iv | `supabase/migrations/2026*.sql` (deleted) | **Prod schema internal inconsistency** — multiple historical migrations had DDL statements that silently failed on prod over months of Studio UI edits. Examples: triggers referencing `public.update_updated_at_column()` (function exists only in `storage` schema), functions with `_role app_role` parameters where the column on prod is `text`, policies referencing `requester_id`/`addressee_id` where prod has `user_id`/`friend_id`. The 67 migration files describe a schema that never fully existed. | Resolved by Strategy V in P0d-iv: dump prod schema as baseline, delete the 67 files, repair remote tracking. Migration history preserved in git log. Future migrations build on the baseline. |
| 2026-04-20 | P0d-iv | `.github/workflows/ci.yml` smoke-prod step + `src/test/smoke/harness.ts` `shouldRunSmoke` gate | **Silent-skip CI hiding broken tests.** `shouldRunSmoke` returns false when `SUPABASE_SERVICE_ROLE_KEY_TEST` is missing; Vitest then reports every smoke `describe.skipIf` as skipped and the CI step exits 0 regardless. On main, the secret has never been provisioned, so every post-merge smoke run has been reporting green while actually running zero assertions. Surfaced when P0d-iv's local CI (with local credentials auto-exported) became the first environment that actually ran `signup.test.ts` end-to-end, revealing two assertions (`display_name` truthy, `preferences.onboarding.completed === false`) that never matched `handle_new_user()` behaviour. | **FULLY RESOLVED 2026-04-25**: PR #653 (2026-04-21) shipped fail-loud guard. User provisioned `SUPABASE_SERVICE_ROLE_KEY_TEST` as a GitHub Actions repo secret 2026-04-25. Verification: main CI run #24930703508 (push of P30 PR #675 squash) initially failed at Bun-installer 502, re-ran cleanly, smoke-prod step exited green — secret resolves correctly + smoke tests run for real on every push-to-main now. Both remediations complete. |
| 2026-04-20 | P0d-iv | `supabase/migrations/00000000000000_initial_schema.sql` — `public.init_render_credits()` | **Prod trigger function silently relies on undefined search_path behaviour.** `handle_new_user()` schema-qualifies every reference (`public.profiles`, `public.subscriptions`), so it works when fired as `supabase_auth_admin` (role-level `search_path=auth`). `init_render_credits()` uses the bare name `INSERT INTO render_credits ...`; under `search_path=auth` it should fail with `relation "render_credits" does not exist`, and it does locally. Prod evidently resolves it (5/5 recent users have render_credits rows) but the mechanism doesn't reproduce in a fresh Supabase CLI stack on identical PG/role config. | Minimum-deviation fix in P0d-iv: added `ALTER FUNCTION public.init_render_credits() SET search_path = public;` at the end of the baseline. This is a proconfig-only override — the dumped function body is untouched — and hardens local against the same footgun CLAUDE.md's "Secrets inside migrations" block warns about for SECURITY DEFINER functions. |
| 2026-04-20 | P0d-iv | `storage.buckets` on prod + `src/components/settings/ProfileCard.tsx` + `src/pages/PublicProfile.tsx` + `src/hooks/useAvatarUrl.ts` | **`avatars` storage bucket + its 4 policies were dropped from prod at an unknown date**, but client code still calls `supabase.storage.from('avatars')` for upload / delete / signed-URL reads. Avatar upload is currently broken for every new user; the 2 of 7 prod profiles with `avatar_path` populated point to objects in a bucket that no longer exists (their signed-URL reads 404). The old `20260308075837_192365b0-b62f-42b9-88b5-8b0091f3c2cf.sql` migration that created the bucket + policies was deleted in P0d-iv Strategy V — intentionally, because "baseline equals prod" and prod no longer has the bucket. Surfaced by Codex review on PR #639. | **Product decision: remove, not restore.** The baseline stays truthful (no `avatars` bucket, matching prod). **RESOLVED in PR #654** (Wave 0+1 cleanup sweep B, 2026-04-21): deleted `src/hooks/useAvatarUrl.ts` + its test file, stripped avatar upload/delete path from `src/components/settings/ProfileCard.tsx` (now renders initials-only Avatar), removed signed-URL fetch from `src/pages/PublicProfile.tsx`, dropped `avatar_path` from `src/lib/schemas.ts` + from 3 test fixture mocks, and shipped migration `20260421124000_drop_profiles_avatar_path.sql` that `ALTER TABLE public.profiles DROP COLUMN IF EXISTS avatar_path`. **Post-merge action**: run `npx supabase db push --linked --yes` to apply the migration, then regenerate `src/integrations/supabase/types.ts` via `supabase gen types typescript --linked` and commit the regen in a follow-up PR (types.ts is auto-generated per CLAUDE.md and intentionally stale in this PR — it still declares `avatar_path` but no code references it). |
| 2026-04-20 | P0d-iii | `supabase/functions/_shared/burs-ai.ts:17` | **`GEMINI_URL` is a hardcoded `const`**, not read from env. That makes edge-function Gemini calls impossible to reroute through the mock server booted by `src/test/smoke/mocks/mock-server.ts` — the whole reason P0d-ii's mock infrastructure exists. Surfaced when writing P0d-iii smoke tests: to hit `analyze_garment` / `render_garment_image` / etc. under local Supabase with a mocked Gemini, the edge-runtime needs `GEMINI_URL` overridable via `Deno.env.get("GEMINI_URL_OVERRIDE") ?? "https://generativelanguage..."`. **Resolved in P0d-iii (PR #640, 2026-04-20)** — approach expanded per user (CTO) direction. Three shared URLs made overridable (`GEMINI_URL_OVERRIDE` in `burs-ai.ts`, `GEMINI_IMAGE_URL_OVERRIDE` in `gemini-image-client.ts`, `GEMINI_TEXT_URL_OVERRIDE` in `render-eligibility.ts`), all backward-compatible (unset → original hardcoded value). 7 tests rewritten to invoke edge functions via `supabase.functions.invoke()`; CI workflow boots `start-mock-server.ts` + `supabase functions serve --env-file`. AI function redeploy **not completed this session** — Supabase deploy bundler hit `esm.sh 522 Origin unreachable` repeatedly on `import 'https://esm.sh/@supabase/supabase-js@2'`; external infra blocker. Backward-compat of the env-var pattern means prod is safe without deploy: functions keep using the hardcoded URLs until next successful deploy picks up the env-var fallback. Follow-up RESOLVED 2026-04-20: all 24 consumers successfully redeployed. |
| 2026-04-20 | P0a | `.husky/pre-commit` | File lacks `#!/usr/bin/env sh` shebang. On Windows, git.exe cannot exec the hook directly → pre-commit runs are skipped unless the agent wraps it via `core.hooksPath`. Surfaced by P0d-iv and P0d-iii agent sessions — both had to use a wrapper to run the full tsc + eslint + build pipeline. | Tiny follow-up prompt (P0a-ii) prepends shebang. Parallel PR alongside PR #640. |
| 2026-04-20 | P0d-iii | `supabase/functions/travel_capsule/index.ts:838` (resolveId) + `:762` (deterministic fallback) | `resolveId()` expects string ids, but the deterministic fallback at line 762 writes garment objects into capsule_items. Downstream `id.trim()` crashes on the object path. Surfaced when P0d-iii's `travel-capsule.test.ts` mock routing revealed the fallback path — test was tightened so happy path avoids the crash, but the production code path is latent. | **RESOLVED in PR #656** (Wave 0+1 cleanup sweep D, 2026-04-21): Option A chosen — fixed the fallback to emit IDs matching AI shape. `buildDeterministicFallback` now returns `capsule_items: Array.from(capsuleMap.keys())` (string[]) instead of `.values()` (GarmentRow[]). Downstream recovery at line 867 updated: `fallback.capsule_items.filter(id => validIds.has(id))` — no object→id mapping. outfits[i].items was already string[] via `candidate.items`. Post-merge: deploy `travel_capsule`. |
| 2026-04-20 | P1 | `supabase/functions/process_job_queue/index.ts`, `supabase/functions/daily_reminders/index.ts` | **Mistake pattern — cron-only vs user-facing auth.** Initial P1 agent brief included a `getUser()` fallback pattern copied from `detect_duplicate_garment` for cron-only functions. Codex caught that the fallback allowed any authenticated end-user to invoke service-role-escalated code (DoS against queue processing + notification storm). Correct pattern for cron-only endpoints is hard-reject of non-service-role callers via `timingSafeEqual(token, SERVICE_ROLE_KEY)`. User-facing functions continue to use the `getUser()` fallback. | Fixed in follow-up commit on PR #643. For future prompts: user-facing functions use `getUser()` fallback; cron-only functions use hard-reject only. |
| 2026-04-20 | P0e | process (not a file) | **Prompt ordering mistake.** P1 and P2 were executed before P0e because the P1 agent brief instructed "move CURRENT PROMPT to P2" (should have been "P0e"). No correctness impact — P0e is independent of P1/P2 scope — but Wave 0 safety net was briefly incomplete during Wave 1 work. | Future prompt briefs must verify CURRENT PROMPT against the prompt list and move to the earliest `[TODO]`, not just the next-numbered prompt. |
| 2026-04-20 | P2 | `supabase/functions/calendar/index.ts` (handleSyncAll) | **Possible dead code.** `handleSyncAll` has no discoverable caller — zero in-repo invokers, zero matching rows in `cron.job` for 'calendar' or 'sync_all' patterns. May be dead code OR called by a Supabase Dashboard scheduled function outside pg_cron. | **RESOLVED in PR #676** (Wave 4.9 follow-up cleanup, 2026-04-25): re-audited on main `f2cd0301` — `cron.job` table query for `command ILIKE '%calendar%' OR command ILIKE '%sync_all%'` returned 0 rows; `analytics_events` query for `metadata->>'fn' = 'calendar'` over 7-day window returned 0 rows; in-repo grep for `handleSyncAll` / `sync_all` returned only the function's own self-references (definition + dispatcher case + doc comment). Confirmed dead. Deleted: (a) the `handleSyncAll` function (~71 LOC at lines 398-468), (b) the `case 'sync_all':` dispatcher arm, (c) the `timingSafeEqual` import (was only used by handleSyncAll), (d) the `"sync_all"` line in the file's header doc comment. Net: -69 LOC. The dispatcher now returns the default 400 "Unknown action" for any future caller of `action: 'sync_all'`. Deploy: `calendar`. |
| 2026-04-21 | P4 | `supabase/functions/prefetch_suggestions/index.ts` (cron-batch path, lines 123+) | **Cron-batch path has no auth gate.** P4 hardened the single-user-trigger path but the else branch (cron batch mode) accepts any caller with no Authorization check. A drive-by anon POST with an empty body (or any body missing `trigger: "first_5_garments"`) falls through to the batch path and triggers up to 100 parallel AI calls — DoS / cost-amplification vector against Gemini. This is `verify_jwt = false` in config.toml, so there's no platform-level gate either. | **RESOLVED in PR #655** (Wave 0+1 cleanup sweep C, 2026-04-21): applied the P1 cron-only hard-reject pattern to the batch-mode else branch. Imported `timingSafeEqual` from `_shared/timing-safe.ts`. After the single-user-trigger block returns, the batch path now pre-checks `Authorization` header via `timingSafeEqual(token, SUPABASE_SERVICE_ROLE_KEY)` and 401s any non-service-role caller before entering the 100-user AI batch loop. Post-merge: deploy `prefetch_suggestions`. |
| 2026-04-21 | P4 | main repo `C:\Users\borna\OneDrive\Desktop\BZ\Burs\bursai-working` | **Stale mid-merge cruft in main repo.** Main repo is stuck on branch `prompt-p0d-iii-deploy-retry` at `6de4c09a` with an in-progress merge bringing `origin/main` (d02d6ac5) into the branch — CLAUDE.md conflict unresolved, 8 files auto-merged (all already on origin). Leftover from a prior agent session. P4 worked around it by using the existing `heuristic-swanson-e41ab7` worktree (clean on main at d02d6ac5) and `npm ci`-ing dependencies there. | **RESOLVED in PR #676** (Wave 4.9 follow-up cleanup, 2026-04-25): main repo now on `main` clean (synced to `f2cd0301`); legacy `tmp-db-push` branch deleted; stale partial `types.ts` regen with stderr-leak garbage discarded (verified the official regen against `f2cd0301` produces zero content diff vs the manually-de-noised W4.9-A version — only CRLF/LF differences). Worktree registry pruned 12→4 via `git worktree remove -f -f` (kept: main + heuristic-swanson-e41ab7 + amazing-jepsen-6ca359 vertex-migration-plan + quizzical-edison-f17334 current shell). Locked agent-* worktrees + claude/* + p0d-iv-drift-repair + p0d-smoke-poc registry entries removed; on-disk directories remain due to Windows file locks (held by stale processes that can't be killed without reboot) but git no longer tracks them. |
| 2026-04-21 | P5 | `src/hooks/__tests__/useDeepLink.test.tsx` lines 48, 66 | **Test fixtures still use legacy `app.bursai.com` domain.** Deep-link test fixtures construct URLs like `https://app.bursai.com/u/borna` and `https://app.bursai.com/outfit/abc-123`. Real prod domain is `burs.me` (via `app.burs.me`). Fixtures will match URL shape regardless of domain — no functional test regression today — but if the hook ever adds domain-whitelisting, these fixtures will silently diverge from prod behaviour. Surfaced by the P5 grep sweep for `bursai.com` across the repo. | **RESOLVED in PR #653** (Wave 0+1 cleanup sweep, 2026-04-21): both fixtures updated from `app.bursai.com` to `app.burs.me`. |
| 2026-04-21 | (cleanup B) | `src/i18n/locales/*.ts` — `settings.avatar_invalid`, `settings.avatar_too_large`, `settings.avatar_updated`, `settings.avatar_error`, `settings.change_photo` | **Orphaned avatar i18n keys in 14 locale files.** The 5 keys were only referenced by the avatar upload path in `ProfileCard.tsx`, which was removed in PR B (Wave 0+1 cleanup sweep). Keys remain in locale files per CLAUDE.md's append-only rule. No functional impact — `t()` just returns the key itself if called, but no code paths call these anymore. Surfaced by code-reviewer during PR B review. | Fold into a future locale-cleanup wave that consolidates orphan keys (same wave that handles the `capsule.generating` dedupe pattern). Not launch-blocking. |
| 2026-04-21 | P8 | `LAUNCH_PLAN.md` P8 spec (lines 714-717) | **Spec column-name error — and the approach itself is unfixable without schema change.** Spec's code snippet used `.like("cache_namespace", ...)` but that column doesn't exist on `ai_response_cache`. Initial P8 commit tried `.like("cache_key", ...)` as a fix — Codex P1 on PR #652 correctly flagged that cache_key is a SHA-256 hash (via `createBursAICacheKey` in `_shared/burs-ai.ts` line 235 — `hashKey(stableSerialize(...))`), so the UUID substring is hashed away and a LIKE matches zero rows. Both spec and first-fix approaches silently do nothing. Ai_response_cache cleanup is NOT possible without adding a `user_id` column to the table (requires migration + backfill + `storeCache` update in burs-ai.ts + redeploy of all 22 AI functions). GDPR-wise, the table's short TTLs (30 min – 12 h) make natural expiration-based decay acceptable ("without undue delay" is satisfied within a day). | Fixed in P8 PR (Codex commit): removed the broken line entirely, replaced with an honest comment explaining the TTL-decay mitigation and pointing to the schema-change follow-up. LAUNCH_PLAN.md P8 spec should be updated in a future doc-sweep. Dedicated schema-change follow-up prompt should add `user_id` column to `ai_response_cache` — likely bundled with P13 cache-namespace work since both touch the cache layer. |
| 2026-04-21 | (doc fix) | `LAUNCH_PLAN.md` P1 spec (lines 360-378) | **Stale spec advising insecure auth pattern.** LAUNCH_PLAN.md's P1 cron-only section still showed the `if (!isServiceRole) { require user JWT }` fallback pattern that Codex rejected on PR #643. Since LAUNCH_PLAN.md is the source-of-truth agents read for pattern reference (CLAUDE.md is the tracker), this would trap future cron-auth work — notably P7 on `process_job_queue` handlers. CLAUDE.md's earlier Findings Log row (2026-04-20, P1) documented the hard-reject correction in tracker-space only; the spec file was never updated. Surfaced when the user asked to sweep LAUNCH_PLAN.md for tracker-style drift after P5 shipped. | Fixed in PR #649 (doc-only): P1 cron-only section rewritten to show the hard-reject pattern (`timingSafeEqual` + return 401, no JWT fallback). Added a pattern-selection rule of thumb covering user-facing vs cron-only vs dual-mode. No code/status changes; `CURRENT PROMPT` stays P6. |
| 2026-04-21 | P9 | `supabase/functions/cleanup_ai_cache/index.ts` (pre-patch) | **P1 auth-gap miss.** The original P1 Wave 1 prompt hardened `summarize_day`, `process_job_queue`, and `daily_reminders` — but `cleanup_ai_cache` has the same cron-only, mass-DB-delete profile and was not included in P1's scope. Anon callers could invoke it repeatedly (`verify_jwt = false` in config.toml, zero auth in the function body) to both burn DB query budget and evict hot cache rows prematurely. Would also make P9's overload gate toothless (overload guard trips on error, not on successful-but-abusive repeated anon calls). Surfaced when P9 started adding overload to the function and noticed the missing auth. | **RESOLVED in this PR (Wave 2-A, P9 scope expansion)**: added the same `timingSafeEqual(token, SERVICE_ROLE_KEY)` hard-reject pattern that P1 shipped to the sibling cron-only functions. Imported `timingSafeEqual` from `_shared/timing-safe.ts`. Deploy: `cleanup_ai_cache`. |
| 2026-04-21 | P9 | `_shared/scale-guard.ts` | **Shared-module change triggers multi-consumer deploy.** P9 added 9 new `RATE_LIMIT_TIERS` entries to `_shared/scale-guard.ts` (10 originally planned; `seed_wardrobe` tier removed mid-PR alongside the function itself — see P11 row below). Per CLAUDE.md's Shared Module Deploy Map, any change to `_shared/scale-guard.ts` requires redeploying ALL AI functions because the module is bundled individually per function. Adding (never modifying) entries is technically safe — existing functions won't look up the new keys — but CI smoke-local bundles the same shared module into every function at test time, so bundler drift is possible. | Mitigation: the 12 touched functions in this PR are being redeployed anyway (they consume new tier entries or the new overload import). Existing untouched AI functions (`burs_style_engine`, `style_chat`, etc.) need NOT be redeployed in this PR — the additions are purely additive. This is the same pattern as prior shared-module changes (the P5 VAPID fix, the P7 `submitJob` signature tighten). Not a new finding per se — just a reminder to keep the deploy scope to the 12 functions that actually changed. |
| 2026-04-21 | P15 | `vitest.config.ts` (repo-wide full-suite flakes) | **Non-deterministic test suite on Windows.** Full-suite `npx vitest run` was flaky pre-P15 — each invocation failed a DIFFERENT subset of 5-20 tests at the default 5000ms per-test timeout, while every affected file passed cleanly when run in isolation (9/9 assertions in ~7s wall-clock). Root cause: vitest defaults to the `threads` pool with one worker per CPU core; on Windows, parallel workers hammer the filesystem during module resolution + jsdom bootstrap, and the worst-case combined transform + environment setup exceeds the 5s per-test budget, clipping legit component-render tests that actually take 1-3s. Confirmed pre-existing (not caused by P15) by stashing all P15 edits and reproducing on pristine main. User explicitly asked for a fix even though pre-existing. | **RESOLVED in this PR (Wave 3-A, P15 scope expansion)**: added three settings to `vitest.config.ts` — `testTimeout: 15000` (bumped from default 5000ms), `pool: "forks"` (process isolation instead of shared-memory threads), `maxWorkers: 2` (cap parallelism regardless of CPU count). Vitest 4's new top-level option names (was `poolOptions.forks.maxForks` in v2/v3). Full suite now runs 1104/1104 reliably across multiple invocations. Tradeoff: wall-clock end-to-end ~1.5-2x slower on cold cache (100-340s observed vs 368s pre-fix, but variance is high — not a regression, just the variance was hidden before because half the runs were bailing on timeouts). Longer-term cleanup (future test-infra PR): audit which tests legitimately take >3s and split into a dedicated slow-suite, OR move back to `threads` once the filesystem hotspots are identified. |
| 2026-04-21 | P15 | `supabase/migrations/00000000000000_initial_schema.sql:909` (schema baseline) | **Latent default-value footgun.** The baseline defines `garments.image_processing_status TEXT NOT NULL DEFAULT 'pending'`. P15 deleted `process_garment_image` (the only thing that transitioned `pending` → `ready`), but the column + default stay per spec. All live insert paths go through `buildGarmentIntelligenceFields` which passes `skipImageProcessing: true` (→ `'ready'`), so new rows are safe. Any FUTURE insert caller that bypasses that helper would create a row that polling gates no longer transition (though P15 also removed those gates — so the practical effect is benign per-user display, but outfit-scoring gate in `_shared/outfit-scoring-body.ts:467` would reject the garment from outfit generation until its default is changed). Surfaced by code-reviewer on P15 PR. | Tracked for the deferred schema-cleanup PR that drops the 6 image_processing_* columns. That PR should (a) drop columns, (b) drop the default, (c) remove the outfit-scoring gate. Not launch-blocking — the only in-repo insert callers today use the helper. Orphan `job_queue` rows with `job_type = 'image_processing'` are also out there (claimJob filters by JOB_HANDLERS keys → frozen forever post-P15); same cleanup PR should also DELETE them. |
| 2026-04-21 | Wave 3-B | `supabase/functions/render_garment_image/index.ts` + `_shared/gemini-image-client.ts` + `_shared/render-eligibility.ts` + `_shared/mannequin-presentation.ts` + `RenderPendingOverlay.tsx` (audit surface) | **Render-pipeline deep audit** — the user asked for "find every improvement, even the smallest, so rendering feels like magic and gets it right every time." End-to-end audit turned up 12 improvements beyond the P16-P19 spec scope: **F2** category-first prompt ordering, **F5** enriched mannequin presentation (per-sex body-shape hints), **F9** logo-preservation signal in validator, **F13** input-image preflight (magic-byte + dimension check before burning Gemini), **F15** exp-backoff retry on Gemini 5xx/429 in the client transport, **F16** output MIN_SIZE 10KB→30KB, **F17** output dimension check (512×512 min), **F18** output magic-byte validation, **F20** time-estimate hint on the pending overlay ("Takes about 20 seconds"), **F21** i18n for the overlay strings (added 7 `render.*` keys to en + sv), **F22** new `RenderFailedBanner` component surfacing `render_status='failed'` with a one-tap retry (was silently falling back to the original photo before). **RENDER_PROMPT_VERSION bumped v1→v2** — folded into the credit-ledger baseKey so in-flight v1 reservations keep their replay path intact while new requests mint fresh v2 reservations. | **RESOLVED in this PR (Wave 3-B)**. Shipped together because they all touch the same two edge functions + shared modules — splitting would have produced 12 conflicting PRs racing for the same files. Code-reviewer approved. Post-merge: deploy `render_garment_image` only (no migration; `_shared/gemini-image-client.ts` + `_shared/render-eligibility.ts` + `_shared/mannequin-presentation.ts` are consumed only by `render_garment_image` at runtime, so no other function needs redeploy — confirmed by grep). |
| 2026-04-21 | Wave 3-B (deferred) | Render-pipeline polish that didn't make P16-P19 scope | **Deferred follow-up findings from Wave 3-B audit** (do NOT block launch; tracked for future polish): **F3** prose-vs-bullets prompt experiment (needs A/B on a sample of users, not a one-shot decision), **F4** per-category negative-example enrichment, **F8** color-drift validation gate (currently unchecked — Gemini sometimes shifts navy→black, beige→tan), **F14** aspect-ratio output validation (config requests 4:5 but no output enforcement), **F19** server-side concurrent-reservation debounce (user hitting Regenerate twice with different nonces can still double-charge), **F23** per-attempt progress UI (currently user waits 60s with no signal during retries), **F24/F25/F26** observability (per-attempt telemetry + finer failure taxonomy + cost-per-render tracking). Code-reviewer Wave 3-B also flagged: **#5** RenderFailedBanner optimistic-rollback race (enqueue succeeds server-side but client never reads response → client reverts to `'failed'` but job is actually pending) — initially logged as low-risk "worker claim writes authoritative state," but **Codex P1 round 2 on PR #661 correctly elevated this**: before the worker reconciles, the banner re-renders, user clicks Try Again, fresh clientNonce creates a SECOND reservation, user is double-charged. **RESOLVED in PR #661 fix commit 3**: the catch block now classifies via `isRenderEnqueueRetryable(error.status)` — retryable/transport errors keep the optimistic `'pending'` flip in place (shimmer takes over, worker wins), only definitive 4xx denials or non-enqueue errors revert to `'failed'`. **#8** validator fail-open-on-first-attempt should emit a Sentry alert hook on `validator_unavailable` so aggregate outages are visible. | Track in this Findings Log; fold into a follow-up "render-polish v2" prompt after first 30 days of real-user telemetry informs priorities. Not launch-blocking. |
| 2026-04-21 | P15 | `src/hooks/useGarments.ts` + `useGarmentsByIds.ts` + `useAISuggestions.ts` (same defect pattern) | **Spec scope missing 3 of 4 defect sites.** P15 LAUNCH_PLAN.md spec named only `src/pages/GarmentDetail.tsx` for the `image_processing_status === 'pending' | 'processing'` polling-gate removal, but the identical defect existed in three sibling hooks: `useGarments.ts` (lines 104-105), `useGarmentsByIds.ts` (lines 24-25), `useAISuggestions.ts` (lines 167-168). Leaving them would mean any pre-P15 garment stuck at `'pending'` (from previously-broken stub runs) would cause these hooks to refetch indefinitely post-merge. Spec's acceptance criterion "polling terminates correctly based on render_status alone" applies equally to all four sites, so fixing all four is consistent with spec intent. | **RESOLVED in this PR (Wave 3-A, P15 scope expansion)**: all 4 polling sites updated with identical surgical removal (drop the 2 `image_processing_status` conditions; keep `render_status` conditions). Documented in PR body under "Scope expansion". Future prompts that name one file of a shared pattern should explicitly check for identical siblings before scoping. |
| 2026-04-22 | P23 | `supabase/functions/prefetch_suggestions/index.ts:54` | **Prompt-text drift surfaced by the `compactGarment` fix.** P23 dropped the `.slice(0, 8)` in `compactGarment()` so every caller now emits full UUIDs. `prefetch_suggestions` is the only direct caller — its prompt text told the model "Pick garments by their short ID (first 8 chars)", which became inconsistent once the wardrobe lines carried 36-char UUIDs. Model would have returned 8-char prefixes; nothing downstream resolves those to full IDs so the entire cached response (`daily_suggestions_${userId}`, TTL 43200s) would be unusable for the next 12h per user. Caught by code-reviewer as a blocker. Same pattern to watch for whenever a shared helper's output shape changes: grep the shared helper's callers and audit their surrounding prose, not just the function signature. | **RESOLVED in this PR (Wave 4-A scope expansion)**: prompt updated to "Pick garments by their ID." `prefetch_suggestions` now in the functional-change list alongside the 2 spec-named consumers. No new Findings — fully closed. |
| 2026-04-22 | P24 | `supabase/functions/_shared/burs-ai.ts` `waitForEnrichment` | **Minor hardening follow-up flagged by code-reviewer, then tightened twice by Codex.** (r3) `waitForEnrichment` accepted `opts.pollIntervalMs` and `opts.timeoutMs` without bounds-checking — `0` or negative values would turn the loop into a busy-poll against Supabase. (r4) `Math.max(50, NaN)` returns NaN and `Math.max(0, Infinity)` returns Infinity; `sleep(NaN)` resolves immediately and `remaining <= 0` never holds for NaN, so the first clamp pass was still vulnerable to non-finite inputs. Helpers are library-only in Wave 4-A but must be defensive before Wave 4-B consumers opt-in. | **RESOLVED in this PR (Wave 4-A, Codex P2 r3+r4)**: coerce via `Number.isFinite(raw) ? raw : default` FIRST, THEN apply `Math.max(0, ...)` for timeout and `Math.max(50, ...)` for poll. 50ms floor respects Supabase connection-reuse budget. Regression tests: `pollIntervalMs: 0` (≤6 calls in 200ms), `timeoutMs: -100` (fast exit), `pollIntervalMs: NaN` (≤3 calls in 200ms), `pollIntervalMs: Infinity` (≤3 calls in 200ms), `timeoutMs: Infinity` (<500ms on completed row — proves deadline math stays bounded). |
| 2026-04-22 | P24 | `garments.enrichment_status` writers (frontend vs job queue) | **Two spellings coexist for the "ready" terminal state.** Frontend enrichment paths (`src/lib/garmentIntelligence.ts:437` — the MAIN enrichment path, `src/pages/GarmentDetail.tsx:215`, `src/components/onboarding/QuickUploadStep.tsx:108`) write `'complete'`. Backend job-queue path (`supabase/functions/process_job_queue/index.ts:269`) writes `'completed'`. Pre-existing mirror bug also found: `_shared/outfit-scoring-body.ts:466` `const enrichmentReady = garment.enrichment_status === 'complete'` — job-queue-enriched garments were silently getting the 0.55 unenriched penalty in outfit scoring, regardless of actual ai_raw completeness. Surfaced by Codex P2 review on PR #663, warning that the `filterEnrichedGarments` helper (P24) written against `'completed'` alone would silently drop frontend-enriched garments when consumers adopt it. Also `'in_progress'` (frontend) vs `'processing'` (backend) spelling divergence present for the non-terminal state, but no reader discriminates those today so no live bug. | **RESOLVED in this PR (Wave 4-A scope expansion)**: (1) added `isEnrichmentReady(status)` + `isEnrichmentFailed(status)` helpers in `_shared/burs-ai.ts` accepting both `'complete'` and `'completed'` as ready; (2) `filterEnrichedGarments` + `waitForEnrichment` both use the helpers; (3) fixed `_shared/outfit-scoring-body.ts:466` inline to accept both spellings — burs_style_engine redeploy already in scope so no extra deploy cost. Tests extended with explicit dual-spelling cases. Future schema-cleanup PR should standardize writers on one spelling (recommendation: `'completed'` + `'processing'` — the longer forms — since they match the job_queue pattern used in `stripe_events`, `render_jobs`, and other internal state machines) + backfill existing `'complete'` rows to `'completed'`. Not this PR — requires a migration, data backfill, and a writer sweep. |
| 2026-04-23 | P20 | `supabase/functions/_shared/outfit-validation.ts:67,120` | **Pre-existing TS2677 caught by CI deno-check.** Two `presentSlots.filter((slot): slot is string => slot !== 'unknown')` calls had broken type predicates. `slot`'s parameter type is `CanonicalOutfitSlot` (a narrow union including `'unknown'`); claiming `slot is string` widens the type, which TS rejects — "type predicate's type must be assignable to parameter's type." Zero runtime impact (the filter works; `string` was just a bogus claimed output type), but strict deno check refuses to compile. Been latent since before PR #653 added the deno-check CI step — no earlier PR touched a function whose dependency graph includes `outfit-validation.ts`, so no deno-check ever ran against it. My Wave 4-B edit to `mood_outfit/index.ts` was the first PR to trigger `deno check supabase/functions/mood_outfit/index.ts`, which recursively type-checks `outfit-validation.ts`. Scope-expanded into the Wave 4-B PR because it was a direct CI blocker. | **RESOLVED in this PR (Wave 4-B scope expansion)**: dropped the broken type predicate on both lines — `.filter((slot) => slot !== 'unknown')`. Return type is `CanonicalOutfitSlot[]`, implicitly widens to the outer `presentSlots: string[]` return shape. Zero runtime change. The shared module's deploy radius expands to `_shared/outfit-validation.ts` consumers: `mood_outfit` (already in scope) + any other caller that imports it. Grep verified: `generate_outfit`, `style_chat`, `burs_style_engine`, and the shared modules that chain off it. Since the fix is type-only (no behaviour change), these consumers don't need new deploys unless they're already being deployed for other reasons. |
| 2026-04-23 | P20 | `supabase/functions/mood_outfit/index.ts:196-215` | **Codex P1 on PR #664 — slot-coverage regression from RETRIEVAL_LIMIT=40 truncation.** My initial Wave 4-B pre-filter ranked and truncated to 40 garments without preserving a complete-outfit path. On skewed wardrobes (e.g. 35 tops + 3 bottoms + 2 shoes), the top 40 by mood-score could drop ALL bottoms or ALL shoes — even though the outer `canBuildCompleteOutfitPath(garments)` check (line 204) confirmed the full wardrobe DOES have a valid path. Model would then receive a prompt from which no valid `top+bottom+shoes` or `dress+shoes` outfit could be built, `validateCompleteOutfit` would fail, and the user would see a "Not enough garments to build a complete mood outfit" error on a wardrobe that previously worked. A regression from the pre-P20 "send all garments" behaviour. | **RESOLVED in this PR (Wave 4-B, Codex P1 fix)**: after the initial `scoredPool.slice(0, RETRIEVAL_LIMIT)` cut, check `canBuildCompleteOutfitPath(promptGarments)`. If the subset can't build a path, greedily extend from the next-best-ranked garments (`scoredPool` outside the top 40) and then the unranked `garments` wardrobe fallback, stopping as soon as a complete path is restored. Worst case adds a handful of items — `estimateMaxTokens` uses `promptGarments.length` dynamically so the token budget tracks. New telemetry field `slot_coverage_forced` logs when this fired so we can measure real-world frequency. |
| 2026-04-23 | P21 | `supabase/functions/_shared/retrieval.ts:397-435` (scanEventHints) | **Codex P2 on PR #664 — substring collisions in event hint extraction.** `scanEventHints()` used `haystack.toLowerCase().includes(k)` against a 14-key FORMALITY_HINTS and 14-key SEASON_HINTS map. Two defect classes: (a) substring collisions — "informal" contains "formal" so an event described as "informal brunch" would set `formality: 'high'` instead of `'low'`; (b) common English words overlap season keys — "may" and "fall" are both modal verbs, "spring into action" is a common idiom. Because these hints are merged into the structured intent BEFORE the AI call AND before `intentToCacheKey()`, users could receive consistently mis-targeted gap/shopping recommendations AND those wrong recommendations would be cached under a mis-derived intent hash. | **RESOLVED in this PR (Wave 4-B, Codex P2 fix)**: (1) switched both hint maps to word-boundary regex matching — `new RegExp(\`\\b${escaped}\\b\`, 'i')` with module-level regex pre-compilation; (2) reordered FORMALITY_HINTS so longer multi-word phrases ("black tie", "smart casual", "business casual") precede their single-word component words, so whichever matches first wins the longest-phrase-wins race naturally; (3) intentionally DROPPED `"may"` and `"fall"` from the season map — word boundaries don't fix verb-ambiguity ("I may go", "don't fall"), and the cost of a wrong season-hint is higher than the benefit (it's merged into the cache key). `"april"` + `"autumn"` preserve the same coverage unambiguously. |
| 2026-04-23 | P21 | `supabase/functions/_shared/retrieval.ts` `computeWardrobeCoverage` | **Codex P2 round 2 on PR #664 — unnormalized category aliases leaked false gaps.** `computeWardrobeCoverage` recorded raw lowercase category keys from `g.category`, but the `gaps_derived` rule at the same line range only checks canonical singular names (`top`, `bottom`, `shoes`, `outerwear`, `dress`, `accessory`). User data carries both singular and plural/legacy variants (`tops`, `bottoms`, `shoe`, `accessories`, etc.). A wardrobe of 10 items all tagged `"tops"` would therefore see `by_category = { "tops": 10 }`, which means `by_category.top` is 0, which fires the `"no top in wardrobe"` gap-derived rule. That false gap then gets fed into the AI prompt AND into the fallback scorer's heuristics, cascading into wrong recommendations. The fallback scorer itself already guarded against this via `categoryCount(cats, ["top", "tops"])`-style pattern, but the coverage object upstream did not. | **RESOLVED in this PR (Wave 4-B, Codex round 2 P2 fix)**: added `CATEGORY_ALIAS_MAP` + exported `canonicalCategory()` helper in `_shared/retrieval.ts`. Maps `tops→top`, `bottoms→bottom`, `shoe→shoes`, `accessories→accessory`, `outerwears→outerwear`, `dresses→dress`. `computeWardrobeCoverage` now keys `by_category` on the canonical name, so `gaps_derived` sees `by_category.top = 10` regardless of whether the DB rows store `"top"` or `"tops"`. Existing fallback `coverage.by_category.shoes \|\| coverage.by_category.shoe` in `wardrobe_gap_analysis/index.ts` becomes redundant (second OR branch always 0) but is kept as belt-and-suspenders in case future aliases land outside the map. |
| 2026-04-23 | P21 | `supabase/functions/_shared/retrieval.ts` `stratifiedSample` round-robin fill | **Codex P2 round 2 on PR #664 — round-robin break disabled category rotation.** The remainder-fill path was documented as "round-robin across category buckets" but had an unconditional `break` at the end of the outer `offset` loop. The nested inner loop took ALL items from bucket 1, then ALL from bucket 2, etc. — that's bucket-order concatenation, not round-robin. Concrete impact: when the proportional quota pass under-fills `n`, the fill path favors whatever bucket comes first in `entries` (sorted by length desc), skewing the representative sample toward the largest category. Minority-category coverage suffered. | **RESOLVED in this PR (Wave 4-B, Codex round 2 P2 fix)**: rewrote the fill loop as a genuine round-robin — step one index per bucket per `offset` pass, bounded by `maxLen = max(bucket.length)` so the loop terminates. `taken.has(g.id)` skip preserves the dedup invariant. Result: minority buckets get proportional presence at each offset; no silent large-bucket bias. |
| 2026-04-23 | P21 | `supabase/functions/wardrobe_gap_analysis/index.ts` fallback candidates | **Codex P1 round 3 on PR #664 — fallback could return empty gaps.** After my P21 rewrite, `fallbackGapAnalysis` built its `candidates` array via conditional pushes (shoeCount < 2, bottomCount < 2 or skewed, topCount < 3 or skewed, outerwearCount < 1, accessoryCount < 2, by_formality.high === 0 && total >= 10). A reasonably complete wardrobe can pass every check, leaving `candidates = []`. The subsequent `.sort().slice(0,5)` then yields `gaps: []`. When Gemini is unreachable, the endpoint used to return a ranked fallback; now it could return nothing, giving the user no actionable recommendation. Regression vs pre-Wave-4-B behaviour (the old Markov-like list always returned 5 items). | **RESOLVED in this PR (Wave 4-B, Codex round 3 P1 fix)**: added 3 unconditional baseline candidates before the slice — "Dark wash straight-leg jeans" (score 30), "White cotton t-shirt" (score 25), "Simple leather watch" (score 20). Conditional items score 65-100 so they still win the top-5 slot on skewed wardrobes, but `gaps` is guaranteed to have ≥3 entries even when every conditional guard fails. If intent is provided, the shopping-recommendations path also benefits (it re-ranks the same `candidates` pool). |
| 2026-04-23 | P27 | `supabase/functions/clone_outfit_dna/index.ts:274-280` (top-40 slice) | **Code-reviewer IMPORTANT on PR #665 — top-40 cap can strip a whole slot.** Same defect pattern Codex flagged on P20 mood_outfit (PR #664). Repro: reference outfit is top+bottom+shoes, user has 60 tops scoring high and only 2 shoes scoring low (shoes fail color/archetype gates). All 40 slots go to tops; the model then can't produce a complete outfit per prompt rule #1 and either hallucinates shoe IDs or returns incomplete variations. | **RESOLVED in this PR (Wave 4-C, code-reviewer fix pre-push)**: imported `canBuildCompleteOutfitPath` from `_shared/outfit-validation.ts`. After the initial `scoredPool.slice(0, 40)` cut, checks `canBuildCompleteOutfitPath(ranked.map(r => r.g))`. If the subset can't build a complete path, greedily extends from the next-best-scored overflow (scoredPool beyond index 40), then from the unranked wardrobe as final fallback, stopping as soon as a complete path is restored. Mirrors exactly the `mood_outfit/index.ts:196-215` pattern shipped in PR #664. Worst case adds a handful of items — `estimateMaxTokens({inputItems: ranked.length, ...})` already uses dynamic input count so the budget tracks. |
| 2026-04-23 | P27 | `supabase/functions/clone_outfit_dna/index.ts:303` slot-coverage recovery loop | **Codex P1 on PR #665 — recovery loop iterated `gatedWardrobe` instead of full `wardrobe`.** When the enrichment gate is active (ratio ≥ 0.7), `gatedWardrobe = filterEnrichedGarments(wardrobe)` drops non-enriched items. `scoredPool` is derived from `gatedWardrobe`, so after the 40-item slice the greedy step-A loop iterates `scoredPool.slice(40)` (correct — still within the enriched pool), but the step-B fallback iterated `gatedWardrobe` — which is the same set `scoredPool` was derived from. On wardrobes where the ONLY candidate for a missing slot (often the one shoe or one bottom a user has) is non-enriched, step-B silently iterates items already in `seen` and `canBuildCompleteOutfitPath` stays false. The model then gets an impossible candidate set and either hallucinates IDs or returns incomplete variations. | **RESOLVED in this PR (Wave 4-C, Codex P1 fix)**: step-B fallback now iterates the full `wardrobe` (pre-gate set), matching exactly the `mood_outfit` pattern from PR #664. Also consolidated the `seen` Set into a single instance reused across step-A, step-B, and the new outerwear step — each extension step updates the same set so candidates aren't re-added. |
| 2026-04-23 | P27 | `supabase/functions/clone_outfit_dna/index.ts:293` outerwear coverage | **Codex P2 on PR #665 — `canBuildCompleteOutfitPath` doesn't require outerwear.** The helper validates base paths (top+bottom+shoes OR dress+shoes) but never requires outerwear. Prompt rule #1 asks the model to include outerwear whenever the reference outfit has it, so on outerwear-based references (e.g. coat + trousers + shoes) the pre-filter can return zero outerwear candidates and still pass the slot-coverage gate. The model then must either hallucinate an outerwear ID or violate rule #1. | **RESOLVED in this PR (Wave 4-C, Codex P2 fix)**: after the base slot-coverage pass, checks `referenceHasOuterwear` (any reference item classified as outerwear) and `ranked.some(slot === "outerwear")`. If reference has outerwear and ranked pool has none, greedy-adds the best-scored outerwear from `scoredPool.slice(40)` first (preserves scoring), falls back to the full `wardrobe` if the overflow also lacks outerwear. If neither has outerwear, accepts graceful degrade — user genuinely has no outerwear in their wardrobe, base outfit still valid. |
| 2026-04-23 | P27 | `supabase/functions/clone_outfit_dna/index.ts` enrichment gate | **Code-reviewer SUGGESTION on PR #665 — inlined dual-spelling check duplicated P24 helper.** The initial Wave 4-C rewrite inlined `g.enrichment_status === 'complete' || g.enrichment_status === 'completed'` when computing `enrichmentRatio`. P24 (PR #663) shipped `isEnrichmentReady()` in `_shared/burs-ai.ts` as the canonical predicate — accepts both spellings centrally so future schema-cleanup (W4.9-A) flips to a single canonical value without requiring a grep-and-replace across consumers. | **RESOLVED in this PR (Wave 4-C, code-reviewer suggestion applied pre-push)**: replaced inlined check with `isEnrichmentReady(g.enrichment_status)` import from `_shared/burs-ai.ts`. Single source of truth. |
| 2026-04-23 | P21 | `src/test/smoke/mocks/gemini.ts` `hasShoppingIntent` detector | **Codex P2 round 3 on PR #664 — intent detector fired on non-intent mode.** The mock's intent detection regex was `/shopping intent\|shopping_recommendations\|fills_gap/i`. Codex flagged that `shopping_recommendations` and `fills_gap` are present in the tool schema description text AND could bleed into the message content if a future caller serializes tool schema into the prompt (some callers inline tool descriptions for models that don't support structured tool-calling). Impact: the mock always emitted `shopping_recommendations` regardless of actual intent, so the smoke test's "without intent → gaps only" backward-compat case couldn't catch regressions in that code path. | **RESOLVED in this PR (Wave 4-B, Codex round 3 P2 fix)**: narrowed the regex to `/shopping assistant mode\|shopping intent/i` — both markers appear ONLY in the prompt text of intent-mode requests (`modeInstructions` emits "You are in SHOPPING ASSISTANT mode" only when intent is provided; the SHOPPING INTENT block header is gated the same way). Tool-schema field names can no longer trigger the intent branch. |
| 2026-04-24 | P27b | `src/components/garment/SecondaryImageManager.tsx` raw-file fallback + confirm-time busy recheck | **Codex P1+P2 round 5 on PR #668 (TWO findings).** (i) **P1 — `compressImage` fails hard** — my add flow did `const { file: compressed } = await compressImage(file)` and aborted on any throw. `compressImage` uses `createImageBitmap` + `OffscreenCanvas` — both known to be unavailable or flaky in some Median/WebView environments (documented in `useAddGarment`'s raw-file fallback). Users on those environments would have the add feature entirely broken instead of gracefully degrading to a larger raw upload. Fix: mirror `useAddGarment`'s pattern — `try/catch` around `compressImage`, fall back to raw `file` on failure, log the compression error. (ii) **P2 — Busy gate only enforced before dialog open** — `handleSwapConfirm` (and `handleDeleteConfirm`) had no busy recheck at confirm-time. If `render_status` / `enrichment_status` flipped to busy WHILE the dialog was open (background refetch or another tab), confirming still fired a swap/delete — potentially double-charging a render credit mid-flight. Fix: re-check `isBusy` at the top of both confirm handlers; if busy, close dialog + show busy-toast + return. | **RESOLVED in this PR (Wave 4.5-B, Codex P1+P2 round 5 fix)**: both applied. Tests: full vitest 1121/1121 passing; tsc + eslint clean. |
| 2026-04-24 | P27b | `src/components/garment/SecondaryImageManager.tsx` upload path + render ordering | **Codex P1+P2 round 4 on PR #668 (TWO findings).** (i) **P1 — Upload path collision after prior swap** — my `handleFileChange` wrote to a fixed `${user.id}/${garment.id}_secondary.${ext}` path. Scenario that collides: user adds secondary A → swaps (A's `_secondary` path moves to `image_path`) → removes secondary (deletes what was the original) → adds new secondary B → upload to the fixed path OVERWRITES A's content (the current primary). Subsequent "Remove" then deletes the live primary. Fix: unique crypto-random suffix per upload (`secondary_${uniqueTag}.${ext}`, `uniqueTag = crypto.randomUUID().slice(...)`) + `upsert: false` (defense-in-depth against any residual collision). Orphan objects from future replace flows cleaned by the post-launch storage-GC cron (already logged). (ii) **P2 — Render racing enrichment** — earlier design fired `triggerGarmentPostSaveIntelligence` with `skipRender:true` and a SEPARATE `startGarmentRenderInBackground` immediately after. But my swap UPDATE cleared `ai_raw` to null; the render worker could pick up the job BEFORE enrichment wrote fresh ai_raw, producing a render from stale/minimal metadata with no automatic redo. Fix: added `renderOptions: { force?: boolean }` to `TriggerGarmentPostSaveIntelligenceOptions` — when provided, the internal `startGarmentRenderInBackground` call that fires AFTER enrichment settles uses that option. Swap flow now passes `renderOptions: { force: true }` into the single `triggerGarmentPostSaveIntelligence` call and drops the parallel render trigger. Single source of truth for ordering; render guaranteed to see fresh ai_raw. | **RESOLVED in this PR (Wave 4.5-B, Codex P1+P2 round 4 fix)**: both applied. Tests: full vitest 1121/1121 passing; tsc + eslint clean. |
| 2026-04-24 | P27b | `src/components/garment/SecondaryImageManager.tsx` original_image_path + cache invalidation | **Codex P1+P2 round 3 on PR #668 (TWO findings).** (i) **P1 — Update `original_image_path` in swap** — my swap UPDATE only touched `image_path` and `secondary_image_path`. But `getPreferredGarmentImagePath` in `src/lib/garmentImage.ts` prefers `original_image_path` over `image_path` when no rendered image is ready. Post-swap: `render_status='pending'` (we set it) → falls through to `original_image_path || image_path`, and `original_image_path` STILL pointed at the old primary's raw upload. Result: wardrobe card + hero showed the OLD photo all the way through enrichment + render, and permanently if render failed. Whole point of the "Use as primary" feature broken until render completed. Fix: add `original_image_path: newPrimary` to the same UPDATE so it's tracked in lockstep with `image_path`. (ii) **P2 — Invalidate broader wardrobe query set** — my local `invalidate()` only busted `['garment', garment.id]`. But list screens read from `['garments', userId, filters]`, `['garments-by-ids']`, `['garments-count', userId]`, `['garments-smart-counts']`, plus `['ai-suggestions']`, `['insights']`, etc. — 10+ query keys with multi-minute stale windows. After a swap/add/delete, stale caches meant the wardrobe list + insights dashboard + AI suggestions all showed old images until their staleTime expired. Canonical helper `invalidateWardrobeQueries` in `src/hooks/useGarments.ts` (already used by `useUpdateGarment` + `useDeleteGarment` for this exact reason) busts the full set. Fix: replace the local one-key `invalidate` with `invalidateWardrobeQueries(queryClient, user?.id)`. | **RESOLVED in this PR (Wave 4.5-B, Codex P1+P2 round 3 fix)**: both applied. Tests: full vitest 1121/1121 passing; tsc + eslint clean. |
| 2026-04-24 | P27b | `src/components/garment/SecondaryImageManager.tsx` swap OC + delete race | **Codex P1 round 2 on PR #668 (TWO findings).** (i) **Swap OC narrow on only image_path** — `handleSwapConfirm` used `.eq('image_path', previousImagePath)` alone for optimistic concurrency, but the UPDATE also rewrites `secondary_image_path`. Concurrent-tab scenario: tab A reads garment → tab B adds + swaps its own secondary → tab A's stale `secondary_image_path` (now either orphaned or re-assigned by B's swap) gets promoted into primary. Fix: `.eq('secondary_image_path', previousSecondaryPath)` added alongside, so ANY concurrent write in EITHER column fails the OC guard cleanly. (ii) **Delete race — storage delete before DB clear** — `handleDeleteConfirm` removed the storage object at `path` BEFORE nulling the DB pointer. Under a concurrent swap in another tab that moved `path` from `secondary_image_path` to `image_path` (via the value-exchange UPDATE), our delete would remove the now-live hero asset. Fix: reordered to DB-first — `.update({ secondary_image_path: null }).eq('secondary_image_path', path)` commits the pointer clear ONLY if the path still occupies secondary; if the OC miss hits (zero rows matched, path was moved), we bail without touching storage. Only after the DB clear do we remove the storage object. | **RESOLVED in this PR (Wave 4.5-B, Codex P1 round 2 fix)**: both applied as described. Tests: full vitest 1121/1121 passing; tsc + eslint clean. |
| 2026-04-24 | P27b | `src/components/garment/SecondaryImageManager.tsx` swap recovery | **Codex P1 round 1 on PR #668 — non-retryable render enqueue failures stranded garment at `render_status='pending'`.** My swap flow wrote `render_status='pending'` in the single-statement UPDATE, then called `enqueueRenderJob(..., { force: true })` directly with a manual retry block. The retry block covered only the retryable-error path (5xx/transport via `isRenderEnqueueRetryable`); non-retryable errors (402 insufficient credits, 4xx other) were caught by an `else` branch that ONLY logged and moved on. No `render_jobs` row got inserted, so the worker had nothing to reconcile; the garment stayed at `'pending'` forever with no recovery. Exactly the defect class `resetGarmentRenderStateOnEnqueueFailure` exists to prevent in `startGarmentRenderInBackground` (Codex rounds 11 + 14 on PR #421). | **RESOLVED in this PR (Wave 4.5-B, Codex P1 fix)**: (a) `startGarmentRenderInBackground` in `garmentIntelligence.ts` exported + accepts `options: { force?: boolean }` param; tightened its `source` type from `string` to `RenderTriggerSource` and removed the interior `as RenderTriggerSource` casts. `force` threads through to both the initial `enqueueRenderJob` call AND the same-nonce retry. (b) `SecondaryImageManager.handleSwapConfirm` now delegates the render trigger to `startGarmentRenderInBackground(garment.id, 'manual_enhance', { force: true })` — inherits the full 402-reset / retryable-retry / server-state-check / non-retryable-reset tree for free. Net diff: -15 LOC in SecondaryImageManager (manual retry block removed), +5 LOC in garmentIntelligence.ts (export + param + thread). Single source of truth for render-enqueue recovery. |
| 2026-04-24 | P27b | `src/components/garment/SecondaryImageManager.tsx` | **Code-reviewer SUGGESTION on PR #668 — no dedicated unit tests for the new component.** The three handlers (add/swap/delete), the optimistic-concurrency miss path, and the busy-gate toast branch are each exercised only transitively via the GarmentDetail test (which mocks the component wholesale). A standalone `SecondaryImageManager.test.tsx` would lock in: (a) OC-miss path invalidates + surfaces `common.something_wrong` correctly, (b) busy-gate blocks clicks + toasts, (c) delete proceeds to DB null when storage delete throws, (d) swap re-fires the new `startGarmentRenderInBackground` helper correctly. Not launch-blocking — the existing GarmentDetail mock prevents the test file from regressing, and the handlers follow the same patterns already tested elsewhere. | Scheduled: future test-coverage PR. Not Wave 4.9 scope (4.9 is findings-cleanup + schema); track as nice-to-have. |
| 2026-04-24 | P27b | `garments` storage bucket orphan accumulation | **Code-reviewer SUGGESTION on PR #668 — storage GC cron for orphaned secondary images.** `SecondaryImageManager.handleDeleteConfirm` catches storage delete failures as non-fatal (logs + proceeds with DB null). Over months, transient Supabase-storage hiccups OR partial swap flows could accumulate orphaned `${userId}/${garmentId}_secondary.*` objects with no DB pointer — same risk class as orphaned render-job rows. A background cron (pg_cron + edge function) that sweeps `garments/${userId}/` for objects without a matching `image_path` OR `secondary_image_path` row would close the leak. Low urgency (orphan size is bounded by user × swap count and each object is ~100-500KB). | Scheduled: post-launch storage-hygiene pass. Not launch-blocking. |
| 2026-04-24 | W4.9-A | `supabase/functions/_shared/outfit-scoring.ts:889` + `:1336` | **Pre-existing deno-check blockers in shared module.** Two TypeScript errors in `outfit-scoring.ts` predated this PR (confirmed via `git stash + deno check` on main): (a) line 889 — inline stub literal cast `as GarmentRow` has been type-insufficient since day one (stub misses `created_at` / `enrichment_status` / `ai_raw`); (b) line 1336 — `missing.push('shoes')` against a `missing` variable that filter-narrowed to `('top' | 'bottom' | 'dress')[]` at line 1308. Both errors were invisible in CI because `deno-check` only runs on changed edge-function entry-points (standing rule from PR #653), and no PR since deno-check shipped has touched `burs_style_engine/index.ts` — until W4.9-A's SELECT-string edit. | **RESOLVED in this PR (Wave 4.9-A scope expansion, deno-check unblocker)**: (a) widened the cast to `as unknown as GarmentRow` per deno's error message guidance — safe double-cast since the stub is a narrow fallback for `items.find(slot==='shoes')?.garment`. (b) typed `missing: string[]` explicitly so the `missing.push('shoes')` compiles. Zero runtime behaviour change — the fallback literal is only read by `garmentText()` which ignores unset fields. |
| 2026-04-24 | P30 | `supabase/functions/style_chat/index.ts:1161-1164,1337` | **5 pre-existing deno-check blockers in style_chat/index.ts** (4× `TS2345` SupabaseClient type mismatch on `getCalendarContext` / `getRecentOutfitsContext` / `getRejectionsContext` / `getWardrobeContext` calls; 1× `TS2304` undefined `StyleChatIntentKind`). Verified pre-existing on main via `git stash + deno check`. Not introduced by P30 — P30 only touches `_shared/style-chat-classifier.ts`, and CI deno-check scopes to changed entry-points only (P0b convention), so this PR doesn't exercise the check. | Scheduled: whichever future PR directly modifies `supabase/functions/style_chat/index.ts` will inherit these as CI blockers (same pattern as W4.9-A's outfit-scoring.ts pre-existing fixes). Likely triggered by a Wave 5 P28+P29 follow-up once those prompts are re-scoped against the post-P26 code. Not launch-blocking — Supabase bundler transpiles regardless of deno check success. |
| 2026-04-24 | P30 | Wave 5 spec drift | **P28 spec is partially pre-P26 and describes already-fixed code** — the "fail-open with `slot: "unknown"`" defect called out at `unified_stylist_engine.ts:82-91` was RESOLVED in P26 (PR #665). Current `unified_stylist_engine.ts` uses `classifySlot` for `other_items` in swap mode; style_chat's refinement path already passes full `active_look_garment_ids` + `locked_garment_ids` at lines 1471-1479. The user's repro ("pressing refine button just anchors a garment instead of whole outfit") may be a narrower remaining edge case OR may be already fixed by P26. Need targeted repro before scoping a P28 code fix. P29 (activeLook persistence across turns) requires grepping for serialization paths across AIChat.tsx + styleChatContract.ts before a fix can be planned. P31 depends on P28 outcome (RefineChips/RefineBanner payload fix is a frontend verification of P28's backend scope). | **RESOLVED in PR #673 (P28 tracker, 2026-04-25)** — full end-to-end investigation on `main` (commit `8a240d0c`, post-P30 merge) confirms the refine flow correctly threads full outfit context at every layer: UI (`OutfitSuggestionCard.tsx:332` passes `garments.map(g => g.id)`, never anchor), client handler (`AIChat.tsx` `handleEnterRefine` stores full list and includes `active_look.garment_ids` + `locked_slots` on every refine-mode message), backend (`style_chat/index.ts:1471-1479` threads `active_look_garment_ids` + `locked_garment_ids` + `requested_edit_slots`; `unified_stylist_engine.ts:83` maps `mode:"refine"`→`"generate"` while preserving full context at line 124; `burs_style_engine` uses `buildActiveLookSlotMap` + `rankCombosForRefinement` to enforce locked-preservation + edit-slot-change). P28's intent fully delivered by P26 (slot mapping, PR #665) + P30 (classifier routing, PR #672). P28 status flipped to `[DONE-subsumed]`. **P29 + P31 follow-up audit (PR #674, 2026-04-25)** — both also `[DONE-subsumed]`: P29 serialization verified working at every layer (types match, client serializes, DB persists + readbacks, backend threads anchor through wardrobe-context lookup, response echoes anchor back); P31 verified architecturally subsumed (`RefineChips` + `RefineBanner` are intentionally stateless presentational components, parent `AIChat.tsx:810-841` owns payload construction and ships `active_look.garment_ids: refineMode.activeGarmentIds` plus `locked_slots` on every refine-mode message). Wave 5 fully complete (P28 + P29 + P31 subsumed, P30 shipped as PR #672). |
| 2026-04-24 | W4.9-A | `src/components/garment/GarmentEnrichmentPanel.tsx:78` | **Code-reviewer P1 on W4.9-A — stale `EnrichmentStatus` union type.** Declared `'none' \| 'pending' \| 'in_progress' \| 'complete' \| 'failed'` but the W4.9-A backfill migration canonicalizes writers to `'processing'` + `'completed'`. Runtime keeps working (JS doesn't enforce types; the `as EnrichmentStatus` cast at `GarmentDetail.tsx:77` widens), but the type lies. Line 82's `enrichmentStatus === 'processing'` check (newly added in W4.9-A) would have been dead-typed. | **RESOLVED inline (Wave 4.9-A, code-reviewer P1 fix pre-push)**: widened the union to include both pre- and post-backfill spellings: `'none' \| 'pending' \| 'in_progress' \| 'processing' \| 'complete' \| 'completed' \| 'failed'`. Mirrors `isEnrichmentReady` helper's dual-spelling acceptance — defensive programming through the transition window. |
| 2026-04-25 | P41 | `src/i18n/locales/{en,sv,...}.ts` — `occasion.{vardag,jobb,fest,dejt}` keys | **Orphan-key sweep candidate (code-reviewer Suggestion, non-blocker).** P41 dropped the 4 Swedish-keyed occasion strings from `UnusedOutfits.tsx`'s OCCASIONS array. The corresponding locale keys (`occasion.vardag`, `occasion.jobb`, `occasion.fest`, `occasion.dejt`) defined in en.ts:1704-1707 + sv.ts:1607-1610 + the other 12 locale files MAY still be reached by other callers — a grep sweep across `src/` showed many files referencing these strings (mood detection regexes, calendar event keyword matchers, etc.) so the keys probably stay reachable. Confirm via grep before any future locale-cleanup wave removes them. Not launch-blocking. | Scheduled: post-launch locale-cleanup wave that consolidates dual-keyed entries (related to other dual-spelling sweeps tracked in Findings Log: enrichment_status `complete`/`completed`, color names Swedish/English). |
| 2026-04-25 | P41 | Wave 6 audit-first miss | **Audit-first protocol caught a defect missed by the audit sub-agent.** Initial Wave 6 P41 audit verdict was `DONE-subsumed` based on consistent `t()` usage in UnusedOutfits.tsx — the agent searched for inconsistent t() namespaces and found none. But the agent missed `src/pages/UnusedOutfits.tsx:29`'s defective OCCASIONS array `['vardag', 'jobb', 'dejt', 'fest', 'casual', 'smart_casual']` (4 Swedish + 2 English mix) AND line 290's hardcoded `"unused pieces"` text. The defective OCCASIONS array is the actual "Swedish/English mixing" referenced by the prompt — it cycles through 6 generated outfits via `OCCASIONS[index % OCCASIONS.length]` and gets passed to `burs_style_engine` as the `occasion` field. Both en.ts (`occasion.vardag` AND `occasion.casual`) and `getOccasionLabel(t, occasion)` happily handle either key, so no user-visible defect — but the inconsistency violated the prompt's intent. Caught when the main agent independently read the file before the planned tracker-only flip per Wave 5 P28 precedent (always verify before flipping subsumed). | **RESOLVED in this PR (P41 actual code fix, not tracker-only flip)**: array replaced with canonical English-keyed 6-occasion vocabulary `['casual', 'work', 'date', 'party', 'workout', 'travel']` matching `OutfitGeneratePicker.tsx:29-36`, `QuickGenerateSheet.tsx:62-69`, `AdjustDaySection.tsx:10-15`. Line 290 localized via new key `insights.unused_pieces_label`. Lesson for future audits: grep-for-t()-coverage is not enough — also read constant arrays/maps and verify their values match canonical vocabularies elsewhere in the codebase. |
| 2026-04-25 | P36 | `src/lib/dateLocale.ts:51` `getDateFnsLocale` | **First-render flash for non-en locales — and async-load never re-renders consumers.** P36's date-fns weekday formatting depends on `dateFnsLocale` from `useLanguage()`. `getDateFnsLocale(locale)` returns `enUS` synchronously when the per-locale chunk hasn't loaded yet. The `loadDateFnsLocale(locale).catch(() => {})` fire-and-forget at LanguageContext.tsx:68 never updated component state, so consumers stayed pinned to enUS until some unrelated re-render happened. Codex P2 (PR #678) flagged this as a deterministic regression for non-en users in Insights and any other dateFnsLocale consumer. | **RESOLVED in PR #678 fix-up commit (Codex P2 round 1)**: LanguageProvider now tracks `dateFnsLocale` in state and updates it when `loadDateFnsLocale(locale)` resolves. First-render flash to enUS is now bounded to the chunk-load duration (~50ms) and consumers automatically re-render once the chunk lands. Same pattern applies to the no-provider fallback path. |
| 2026-04-25 | P33+P34+P36 | NotFound + ShareOutfit + PublicProfile + Insights via LanguageContext | **Codex P1 + P2 batch on PR #678.** (P1 NotFound) Replacing literal strings with `t('notfound.*')` made the component depend on LanguageProvider, but tests and any out-of-provider caller now render fallback humanized text ("Title" / "Return home") instead of intended copy. (P2 PublicProfile) `String.prototype.replace` treats `$&`/`$'`/`` $` `` in user-controlled `display_name` as JS regex special tokens, mangling `<title>` / og: / twitter: meta tags. (P2 ShareOutfit) `t('share.meta_title_template').replace(...)` returns the humanized template name 'Meta title template' on cold start before LanguageProvider's dict loads — meta tags briefly broken. (P2 Insights x2) Same async-locale issue as P36 row above. | **RESOLVED in PR #678 fix-up commit**: new shared `src/lib/i18nFallback.ts` with `safeT()` (humanize-fallback detection + explicit English fallback) and `interpolateMeta()` (function replacer + humanize-fallback detection + hardcoded fallback template). NotFound uses `safeT` for hardcoded `'Page not found'` / `'Return to Home'`. PublicProfile + ShareOutfit use `interpolateMeta` for safe interpolation of user-controlled `display_name` / `outfit.occasion` into meta-tag templates with hardcoded English fallbacks. LanguageContext date-fns rerender fix (above row) closes the Insights x2 P2. Verification: tsc 0, eslint 0, NotFound test 2/2 pass, full vitest 1328/1328 pass. |
| 2026-04-25 | P35 | `src/components/onboarding/AccentColorStep.tsx` | **Dead code — zero importers in `src/`.** Code-reviewer on PR #679 flagged that AccentColorStep.tsx has zero importers (verified via grep — only the file itself contains the string `AccentColorStep`). Component is unrendered. P35 localized it defensively (3 keys for live-preview labels at lines 61, 69, 75), but the work is wasted since the file never renders. The leftover Swedish "Favorit" (line 69 pre-fix) is also moot as a user-facing concern for the same reason. | Scheduled: post-launch dead-code sweep — delete AccentColorStep.tsx + remove the 3 `onboarding.accent.preview_*` keys from en.ts + sv.ts. Not launch-blocking. |
| 2026-04-25 | P32 | `supabase/functions/travel_capsule/index.ts:492-493` | **Pre-existing dead vars in travel_capsule.** `localeName` (line 492) and `isSv` (line 493) are declared but never read. Pre-existing on main — caught by code-reviewer during P32 review. The actual locale prompt-injection happens at line 647 via `LOCALE_NAMES[locale] || "English"` directly, NOT through `localeName`. ESLint config at `eslint.config.js:8` excludes `supabase/**` so CI never caught this. P32's LOCALE_NAMES extension is correct (line 647 picks up the new 14 entries) — these dead vars don't affect the fix. | Scheduled: post-launch dead-code sweep — delete the 2 unused declarations. Not launch-blocking. |
| 2026-04-25 | P40 | `src/pages/OutfitGenerate.tsx:78` + `supabase/functions/shopping_chat/index.ts:137` | **Translator-pass needed for full multi-locale regex accuracy.** P40 expanded FORMAL_KEYWORDS (~50 tokens, 12 Latin locales) and CHAT_SHORT_RE (~85 tokens, all 14 locales). Confidence: high on sv/en, reasonable on da/no/de/fr/es, low on fi/it/pt/nl/pl (single-best-guess), low on ar/fa (greetings only, no formality words for FORMAL_KEYWORDS). Native speakers should review for: (a) missing common variants; (b) over-matching on common words that aren't formality/greeting triggers in their context; (c) FORMAL_KEYWORDS expansion to ar/fa once `\b` Unicode boundary semantics are vetted with RTL scripts. Codex P2 (PR #681): locale-scope FORMAL_KEYWORDS via per-locale map (Polish "cena"=price no longer collides with Spanish/Italian "cena"=dinner); broaden CHAT_SHORT_RE punctuation to support Spanish ¿¡ and Arabic ،؟. | **PARTIALLY RESOLVED in PR #681 fix commit (Codex P2)**: locale-scoping + non-ASCII punctuation. Translator-pass for token coverage still scheduled post-launch. |

### Completion Log

| Date | PR | Prompt | Summary |
|------|-----|--------|---------|
| 2026-04-19 | #635 | P0a | Husky pre-commit hook runs tsc + eslint + build |
| 2026-04-19 | #636 | P0b | Tighten CI lint step: fail on eslint warnings (`--max-warnings 0`) |
| 2026-04-19 | #637 | P0d | Smoke-test POC: harness + 3 tests (signup, plan-week, garment-add) + CI step gated on `RUN_SMOKE=1`. Split into P0d-ii (infra) + P0d-iii (remaining 7 flows). |
| 2026-04-19 | #638 | P0d-ii | Test infra (partial): harness extension + mock-server scaffolding (Node stdlib) + ADR. `smoke-local` CI job exists but is gated `if: false` pending P0d-iv — first CI run exposed missing base-schema migration. Drift repair tracked as new P0d-iv. |
| 2026-04-20 | #664 | P0d-iv | Schema drift repair via Strategy V: baseline dump (36 tables) as sole source of schema truth; 67 historical migrations deleted (they described a fiction — lots of silently-failed DDL); remote tracking table repaired in one atomic transaction; smoke-local CI re-enabled. Commit 1 preserves the attempted Strategy W idempotency pass in git history. |
| 2026-04-20 | #640 | P0d-iii | Smoke-test suite expanded from 3 to 10. 7 new tests (enrichment, render, outfit-generate, outfit-refine, visual-search, shopping-chat, travel-capsule) invoke the target edge function via `supabase.functions.invoke()` and assert the response envelope — NOT DB-only. Three hardcoded Gemini URLs made overridable in `_shared/burs-ai.ts` + `_shared/gemini-image-client.ts` + `_shared/render-eligibility.ts` (backward-compat: identical behaviour when env vars unset). Mock Gemini server + `start-mock-server.ts` entrypoint + CI workflow wiring via `supabase functions serve --env-file`. AI tests skip in smoke-prod (`shouldRunAiSmoke` gate) so prod Gemini isn't hit. 10/10 passing locally with mock interception verified. **Deploy of 24 AI functions deferred** — `esm.sh 522` blocker from Supabase bundler; backward-compat keeps prod safe until retry. See Findings Log row for `_shared/burs-ai.ts:17` (now resolved). |
| 2026-04-20 | #641 | P0a-ii | Fix .husky/pre-commit: add missing shebang so Windows git.exe executes the hook |
| 2026-04-20 | #642 | P0d-iii-deploy | Retry-deployed all 24 AI function consumers of the Gemini URL env-var refactor. esm.sh 522 cleared; no code changes. |
| 2026-04-20 | #643 | P1 | Add JWT verification + service-role bypass to summarize_day (JWT-only), process_job_queue (bypass), daily_reminders (bypass) |
| 2026-04-20 | #644 | P2 | Calendar handleSyncAll: reject anon-key callers, service-role only (DoS fix) |
| 2026-04-20 | #645 | P0e | Wave 0 catch-up: CI step checks `supabase migration list --linked` + `db push --dry-run` on any PR touching supabase/migrations/ |
| 2026-04-20 | #646 | P3 | OAuth hardening for google_calendar_auth: server-side `redirect_uri` allowlist (hardcoded 3 URIs + optional `ALLOWED_CALENDAR_REDIRECT_URIS` env extras) + single-use CSRF token `state = <user_id>.<nonce>` backed by new `public.oauth_csrf` table (10-min TTL, consumed on callback, hourly `oauth_csrf_cleanup` pg_cron). Client passes `state` from URL back to backend verbatim. Post-merge: `supabase db push` provisions the table + cron, then deploy `google_calendar_auth`. |
| 2026-04-21 | #647 | P4 | prefetch_suggestions identity check: single-user-trigger path now validates caller's JWT via `supabase.auth.getUser(token)` and asserts `user.id === body.user_id` before running `processSingleUser`. 401 on missing/invalid token, 403 on mismatch. Cron-batch path intentionally untouched (separate unauditted gap — see Findings Log). Post-merge: deploy `prefetch_suggestions`. |
| 2026-04-21 | #648 | P5 | Email domain fix: VAPID `mailto:` contact string in `webpush.setVapidDetails()` changed from `hello@bursai.com` to `hello@burs.me` in both `send_push_notification` and `daily_reminders`. VAPID `sub` claim is an RFC 8292 abuse-contact identifier — FCM/APNs don't validate it, zero behavioural impact on push delivery. Post-merge: deploy both functions. |
| 2026-04-21 | #649 | (doc fix) | LAUNCH_PLAN.md P1 cron-only section rewritten: removed the `if (!isServiceRole) { JWT fallback }` anti-pattern that Codex rejected on PR #643. Replaced with the hard-reject `timingSafeEqual` pattern that actually shipped. Added a rule-of-thumb block (user-facing vs cron-only vs dual-mode) so future prompts picking auth patterns have one canonical reference. No code changes; CURRENT PROMPT stayed P6. |
| 2026-04-21 | #650 | P6 | Outfit ownership check in `suggest_accessories`: before the parallel query fetching `outfit_items` via service client, added a single-query ownership check (`outfits.select(id).eq(id).eq(user_id).maybeSingle()`) that returns 404 on "not yours" OR "doesn't exist" (collapses both paths into one response — no enumeration oracle). Codex P2 follow-up: split `outfitError` to 500 (retriable/monitored) vs `!outfitRow` to 404 (enumeration-safe). Post-merge: deploy `suggest_accessories`. |
| 2026-04-21 | #651 | P7 | Cross-user validation in `process_job_queue` handlers: `handleGarmentEnrichment` and `handleImageProcessing` now require `userId` and filter the garments query on both `.eq("id", garmentId)` AND `.eq("user_id", userId)`. Error message is "Garment not found or not owned" — collapses missing-garment and cross-user cases. `handleBatchAnalysis` left alone (no garment_id in payload, no attack vector). Also tightened `submitJob` in `_shared/scale-guard.ts`: `userId?: string` → `userId: string` (defensive type constraint; zero in-repo callers today so no breakage). Post-merge: deploy `process_job_queue`. |
| 2026-04-21 | #652 | P8 | Complete delete_user_account cascade: added DELETEs for 10 orphan-row tables (`render_credit_transactions`, `render_jobs`, `render_credits`, `feedback_signals`, `garment_pair_memory`, `analytics_events`, `ai_rate_limits`, `outfit_feedback`, `push_subscriptions`, `travel_capsules`). Spec said 12 but `chat_messages` was already in the existing cascade. Render FK order preserved (transactions→jobs→credits). Silent-delete pattern matches existing file convention for leaf cleanups. **`ai_response_cache` intentionally NOT cleaned** — Codex P1 follow-up caught that `cache_key` is a SHA-256 hash so any LIKE filter matches zero rows. Mitigation: short TTLs (30 min – 12 h) across the codebase mean orphan cache rows decay naturally within a day. Proper fix requires a `user_id` column on the table — tracked as follow-up (likely bundled with P13). GDPR right-to-erasure hygiene. Post-merge: deploy `delete_user_account`. |
| 2026-04-21 | #659 | P13+P14+L554 | **Wave 2-C cache-layer bundle.** (a) P13 — user-scoped `cacheNamespace` + added `userId` option in 7 AI functions (`style_twin`, `clone_outfit_dna`, `wardrobe_aging`, `wardrobe_gap_analysis`, `smart_shopping_list`, `suggest_accessories`, `travel_capsule`). (b) P14 — `summarize_day` namespace now includes user.id (previously keyed only on 40-char event-title slice — identical calendars cross-leaked); `suggest_outfit_combinations` uses full UUID instead of 8-char prefix. (c) L554 schema change — new migration `20260421180000_ai_response_cache_user_id.sql` adds `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE` + partial index. `_shared/burs-ai.ts` `storeCache` populates the column from the new `userId` option. `delete_user_account` gets an explicit `ai_response_cache.delete().eq("user_id", userId)` step (belt-and-suspenders alongside FK cascade). Old Codex-P1 "can't clean this table" comment retired. Code-reviewer approved. **Blast radius**: burs-ai.ts shared module → all 22 AI functions need redeploy (9 in scope + 13 untouched), plus `delete_user_account`. Post-merge: `supabase db push --linked --yes` then deploy 23 functions. Cold-cache penalty on the 9 scope functions (TTL decay 30min-12h) is intentional and noted. |
| 2026-04-21 | #658 | P12 | **Wave 2-B solo PR. DB-backed idempotency.** Replaced `_shared/idempotency.ts` in-memory `Map` with `public.request_idempotency` Postgres table. Atomic claim via `upsert(..., {ignoreDuplicates:true})` — exact pattern from `stripe_events` in stripe_webhook. First isolate wins the primary-key race; losers read the row and return either the cached Response (status>0) or 409 with Retry-After (status=0 still pending). Split TTLs: CLAIM_TTL_MS=60s (crashed-isolate retries don't deadlock), DEFAULT_RESULT_TTL_MS=5min (completed response). Both helpers gained required `supabaseAdmin` arg; 2 consumers (`create_checkout_session`, `delete_user_account`) updated to hoist the service client above the idempotency check. Also tightened `create_checkout_session` outer catch to a generic 500 string (the hoist widened potential error-message leak surface — fixed preemptively). New migration `20260421170000_request_idempotency.sql` with idempotent DDL + hourly pg_cron cleanup job (mirrors oauth_csrf pattern). Deploy: `create_checkout_session`, `delete_user_account` + `npx supabase db push --linked --yes`. |
| 2026-04-21 | #657 | P9+P10+P11 | **Wave 2-A themed PR.** (a) P9 — overload + rate-limit swept across 12 functions. 9 user-facing (`import_garments_from_links`, `insights_dashboard`, `send_push_notification`, `restore_subscription`, `create_portal_session`, `delete_user_account`, `calendar`, `google_calendar_auth`, `generate_outfit`) get the full `enforceRateLimit` + `checkOverload` + `RateLimitError` catch pattern. 3 cron-only (`daily_reminders`, `process_job_queue`, `cleanup_ai_cache`) get `checkOverload` only. 9 new `RATE_LIMIT_TIERS` entries in `_shared/scale-guard.ts`. `process_garment_image` skipped (P15). **Scope expansion**: `cleanup_ai_cache` had NO auth gate at all (P1 missed it) — added the same `timingSafeEqual` hard-reject pattern P1 shipped to sibling cron-only functions. (b) P10 — `src/lib/validators.ts` (new) with `isUuid` + `isValidUsername`; applied in `PublicProfile.tsx` + `ShareOutfit.tsx` to short-circuit malformed URL params. (c) P11 — **seed_wardrobe REMOVED entirely** (not gated). Codex P1+P2 surfaced blocking issues with the initial gating attempt: rate limit breaks the function's own multi-call flow, and the token-consume step wasn't atomic. User call: seed_wardrobe is admin/demo-only with no prod use case — remove rather than gate. Dropped: function dir, config.toml entry, tier entry, WIP migration, `SeedContext.tsx`, `SeedWardrobe.tsx`, `seedGarments.ts`, `SeedProgressPill.tsx`, the `/settings/seed-wardrobe` route + AppLayout-level pill, and defensive test mocks across 10 test files. Also cosmetic fix: calendar.ts helper signatures loosened from `ReturnType<typeof createClient>` to `any` (pre-existing supabase-js generic narrowing that broke deno-check the first time it ran against calendar). Post-merge: deploy 12 edge functions (no migration). |
| 2026-04-21 | #661 | P16+P17+P18+P19 | **Wave 3-B themed PR. Render-magic bundle.** Shipped 4 launch-plan prompts plus 12 audit findings in a single PR because they share the same hot path (`render_garment_image` + its 3 shared-module dependencies). (a) **P16** category-aware prompts via `classifyCategory()` → 6 presentation classes (ghost_mannequin / shoes / bag / flat_lay / jewelry / accessory_generic). (b) **P17** 3-attempt retry chain with distinct prompt variants (primary / tightened / minimal) — full pipeline per attempt, retryable rejects advance to next variant, hard failures (auth/model_path) throw immediately. (c) **P18** category-aware validation with 2 new decision codes (reject_wrong_category, reject_logo_missing) + 2 new signals. (d) **P19** fetchWithTimeout across image-gen (60s × 3-attempt backoff) + text gates (25s). Plus audit findings **F2** prompt lead-with-category, **F5** enriched mannequin-presentation body-shape hints, **F9** logo-preservation signal, **F13** input preflight (magic-byte + 400×400 min dims), **F15** 5xx/429 exp-backoff in client, **F16-F18** output hard-gate (30KB min bytes + 512×512 min dims + magic-byte validation), **F20+F21** RenderPendingOverlay time hint + full i18n, **F22** new `RenderFailedBanner` component with one-tap retry surfacing `render_status='failed'`. **RENDER_PROMPT_VERSION bumped v1→v2** (folded into credit-ledger baseKey — in-flight v1 reservations preserve replay path; new requests get fresh v2 reservations). Verification: tsc 0 errors, eslint 0 warnings, build clean, vitest 1104/1104. Code-reviewer approved (1 finding verified safe via clarifying comment; remaining findings logged for follow-up). Post-merge: deploy `render_garment_image` only. |
| 2026-04-22 | #663 | P23+P24 | **Wave 4-A themed PR. Retrieval-quality shared infra.** Bundled because both touch `_shared/burs-ai.ts` and share the 22-function redeploy cycle. (a) **P23 ID truncation** — removed `.slice(0, 8)` at three sites, not just the 2 in the original spec. Root cause `_shared/burs-ai.ts:compactGarment:189` fixed upstream so every AI function calling the helper inherits the fix; `suggest_outfit_combinations/index.ts:111` (prompt-exposed `unusedIds`) and `wardrobe_aging/index.ts:56` (prompt-exposed `garmentList`) fixed at the consumer. Response validation in both named consumers is exact-match against a full-UUID set — shorter→longer stays exact-match, no break. **Scope expansion (code-reviewer blocker fix):** `prefetch_suggestions/index.ts` line 54 still instructed the model to "Pick garments by their short ID (first 8 chars)" which became inconsistent once `compactGarment` emitted full UUIDs. Reviewer flagged this as a BLOCKER — without it, the model would have returned 8-char prefixes into a wardrobe of 36-char UUIDs, invalidating the entire cache. Updated to "Pick garments by their ID." (b) **P24 enrichment helpers** (library only) — added `isEnrichmentReady(status)` + `isEnrichmentFailed(status)` + `filterEnrichedGarments<T>(garments)` + `waitForEnrichment(supabase, garmentIds, opts)` to `_shared/burs-ai.ts`. Ready state accepts BOTH `'complete'` (frontend writers) and `'completed'` (backend job queue) — Codex P2 round 2 caught the spelling divergence which would have silently dropped frontend-enriched garments. Same fix applied inline to `_shared/outfit-scoring-body.ts:466` where the identical single-spelling check was a pre-existing defect (job-queue-enriched garments got the 0.55 unenriched penalty in outfit scoring despite being fully enriched). waitForEnrichment polls until ready/failed/timeout; phantom IDs bucket as failed. Consumers opt-in per later wave. 17 new unit tests added (3 compactGarment UUID assertions + 3 filterEnrichedGarments cases including dual-spelling + 11 waitForEnrichment scenarios including dual-spelling, numeric clamp, and non-finite coercion regressions). Verification: tsc 0, eslint 0, build clean, vitest 1115/1115. Code-reviewer approved after the prefetch_suggestions fix. **Blast radius**: `_shared/burs-ai.ts` bundles into all 22 AI functions → redeploy all 22 post-merge (per Shared Module Deploy Map). Functional change is narrower — 3 functions have behaviour changes: `prefetch_suggestions` (sole caller of `compactGarment` + prompt text updated), `suggest_outfit_combinations` (direct prompt build at line 111), `wardrobe_aging` (direct prompt build at line 56). **Cold-cache scope**: those 3 functions' `ai_response_cache` rows become unreachable post-deploy because the prompt payload (which feeds `cache_key` via SHA-256) now contains full UUIDs instead of 8-char prefixes. TTLs are short (1800s–43200s) — natural decay within 12h, acceptable per P13 precedent. Post-merge: `supabase functions deploy` for all 22 in groups of 5. |
| 2026-04-21 | #660 | P15 | **Wave 3-A solo PR. Unwire PhotoRoom entirely.** Deleted `supabase/functions/process_garment_image/` (the always-skip stub) + its `supabase/config.toml` entry. Stripped `startGarmentImageProcessingInBackground` from `src/lib/garmentIntelligence.ts` + its call site in `triggerGarmentPostSaveIntelligence`. Narrowed `imageProcessing` option union from `'edge' | 'local' | 'skip' | 'full'` → `'local' | 'skip'` (all in-repo callers pass `{ mode: 'skip' }`; 'local' preserved for Wave 9 Capacitor path). Removed `handleImageProcessing` from `process_job_queue` + dropped `image_processing` from `JOB_HANDLERS`. **Scope expansion**: removed the same `image_processing_status === 'pending' | 'processing'` polling gate from `GarmentDetail.tsx` (in spec) AND from 3 sibling hooks (`useGarments`, `useGarmentsByIds`, `useAISuggestions`) that had the identical defect — keeps post-P15 state consistent. **Out-of-scope stabilization (user-requested)**: fixed pre-existing vitest full-suite flakes on Windows by adding `testTimeout: 15000`, `pool: "forks"`, `maxWorkers: 2` to `vitest.config.ts`. Confirmed pre-existing by stashing P15 edits + reproducing on pristine main; full suite was flaking 5-20 tests per invocation on the default 5s per-test budget. Now 1104/1104 reliable. Code-reviewer approved. DB columns (`image_processing_status`, `image_processing_provider`, etc.) intentionally LEFT IN PLACE per spec — separate schema-cleanup PR will drop them + the orphan `job_queue` image_processing rows (tracked in Findings Log). Post-merge: deploy `process_job_queue` + run `npx supabase functions delete process_garment_image --project-ref khvkwojtlkcvxjxztduj` to decommission the prod edge function. |
| 2026-04-23 | #666 | P27a | **Wave 4.5-A solo PR. Schema-only migration — nullable `secondary_image_path` column on `public.garments`.** Single `ALTER TABLE ... ADD COLUMN IF NOT EXISTS secondary_image_path text`. No default, no CHECK, no RLS change — matches existing `original_image_path` / `processed_image_path` / `rendered_image_path` pattern. Idempotent guard makes safe to re-run. Zero backend code modified, zero frontend code modified, zero edge-function redeploy. **Design intent**: swap-primary in P27b will be an atomic `UPDATE garments SET image_path = secondary_image_path, secondary_image_path = image_path` — swaps the VALUES, not a pointer column, so `image_path` stays universal source of truth and every reader (wardrobe card, analyze_garment, render_garment_image, outfit scoring, React Query selectors) continues working with zero code changes. Post-merge: user runs `npx supabase db push --linked --yes` to apply, then `supabase gen types typescript --linked` to regenerate `src/integrations/supabase/types.ts` (CLAUDE.md auto-generated file; intentionally stale in this PR since no code reads/writes the column yet — P27b is the consumer in a follow-up PR). |
| 2026-04-23 | #665 | P26+P27 | **Wave 4-C themed PR. Slot mapping + clone_outfit_dna deep audit.** Bundled per plan — both fix retrieval-side metadata sent to Gemini. (a) **P26 real slot mapping** — `generate_outfit/index.ts:73` replaced `slot: "unknown"` hardcode with a `classifySlot`-driven map. After `invokeUnifiedStylistEngine` returns, fetches `(id, category, subcategory)` for the selected garment_ids via `serviceClient` and builds `slotByGarment: Map<string, string>`; `items` emits `{ slot: slotByGarment.get(id) || "unknown", garment_id: id }`. Falls back to `"unknown"` only when the garment disappeared mid-request or category/subcategory is unrecognisable. Same pattern applied to `_shared/unified_stylist_engine.ts` swap path (lines 87-91) — `otherItems` built from real classified slots instead of blanket `"unknown"`. The shared module gained a `createClient` import so it can fetch garment metadata itself without requiring callers to pass a service client. **Root CLAUDE.md fix**: Shared Module Deploy Map row for `unified_stylist_engine.ts` updated from `style_chat` to `style_chat, generate_outfit` (grep confirms both are consumers; the old row was stale). (b) **P27 clone_outfit_dna retrieval tightening** — full rewrite of `clone_outfit_dna/index.ts`. DB queries expanded to SELECT `subcategory + ai_raw + enrichment_status` on both `outfit_items.garments` and the candidate wardrobe fetch. New helpers: `aiRawField` (safe extract), `describeGarmentForDNA` + `describeCandidateForPrompt` (structured multi-field lines with English formality labels instead of opaque `f3` codes), `extractDNAProfile` (structured `{ categories, colors (multi-family via colorFamily), formalityBand (low/mid/high|null), archetypes, occasions }`), `scoreCandidate` (category overlap 2.0x / color family 1.5x / formality exact 1.5x or adjacent-via-mid 0.75x / archetype 1.0x / occasion 0.75x). P24 enrichment gate — when ≥70% of the candidate wardrobe is enriched, applies `filterEnrichedGarments`; below threshold sends what we have (graceful degrade). Stable-sort top-40 pre-filter — ties preserve wardrobe order. Dynamic `estimateMaxTokens({ inputItems: ranked.length, outputItems: 3, perItemTokens: 120, baseTokens: 200 })`. Prompt rule #1 enforces complete outfits (top+bottom+shoes OR dress+shoes + outerwear when reference has it) so variations can't be single garments. Slot in DNA uses `classifySlot(category, subcategory)` with stored `outfit_items.slot` as fallback only — stored slot can be stale after category re-labels. Response shape `{variations: [{name, garment_ids, explanation}]}` preserved — backward-compatible, no frontend change. **Shared module radius**: `unified_stylist_engine.ts` touch → both `style_chat` + `generate_outfit` need redeploy (per corrected Deploy Map). `burs-ai.ts`, `burs-slots.ts`, `retrieval.ts`, `scale-guard.ts` — not modified. Post-merge: deploy `generate_outfit` + `clone_outfit_dna` + `style_chat`. No migration. |
| 2026-04-23 | #664 | P20+P21+P22 | **Wave 4-B themed PR. Retrieval pre-filters + shopping-merge.** Also carries the standing Wave Closure Rule addition + Wave 4.5 secondary-image feature + Wave 4.9 cleanup wave plan (docs-only additions to CLAUDE.md + LAUNCH_PLAN.md, staged in prior session). (a) **P20 mood_outfit pre-filter** — new `_shared/retrieval.ts` module (MOOD_MAP, MOOD_SCORING, rankGarmentsForMood, computeWardrobeCoverage, stratifiedSample, formalityLabel, colorFamily, intentToCacheKey, scanEventHints + types). mood_outfit now ranks the wardrobe against the mood (formality band / color family / occasion tags / style archetype / per-garment weather compat / wear-count decay), caps prompt payload at 40, opts into Wave 4-A `filterEnrichedGarments` when ≥70% of the top 80 are enriched, replaces opaque `f3` pipe-delimited format with structured JSON carrying English formalityLabel + occasion_tags + style_archetype, switches `max_tokens` to `estimateMaxTokens({ inputItems: promptGarments.length, ... })`, logs `retrieval.prefilter` telemetry. (b) **P21 wardrobe_gap_analysis becomes gap + shopping assistant** — accepts optional `intent` in request body (occasion/formality/season/budget/upcoming_events); `scanEventHints()` lifts keywords from upcoming_events descriptions into structured intent before AI call; prompt now contains `computeWardrobeCoverage()` structured JSON instead of English aggregate text, plus `stratifiedSample(garments, 25)` (representative across category × wear × recency, not 25 newest); tool schema optionally emits `shopping_recommendations: [{ priority, category, item, reasoning, fills_gap, price_range, search_query }]`; cacheNamespace partitions gap-only vs shopping-mode via `intentToCacheKey(intent)` djb2 hash; fallback rewritten to consume coverage math (respects "if >60% neutral don't recommend neutrals" rule); brand-stripping extended to shopping_recommendations. Backward-compatible — `useAdvancedFeatures.ts:66-79` destructure stays as-is (TS structural typing tolerates extra fields). (c) **P22 smart_shopping_list REMOVED** (per user decision, P11 pattern) — zero frontend callers confirmed; dropped function dir, config.toml stanza, scale-guard tier entry, CLAUDE.md rate-limit row, ARCHITECTURE.md function list row. Post-merge: `npx supabase functions delete smart_shopping_list --project-ref khvkwojtlkcvxjxztduj`. (d) **Wave 4-B mock + smoke test**: new `gemini.ts` branch for wardrobe_gap_analysis ahead of the outfit branch; new `wardrobe-gap-analysis-shopping.test.ts` with two cases (intent → both envelopes; no intent → gaps-only backward-compat). Verification: tsc 0 errors, eslint 0 warnings, build clean, vitest 1121/1121. Code-reviewer LGTM (2 nits applied inline — NaN clamp on rankForMood limit + autumn→fall season alias). **Deploy**: `mood_outfit` + `wardrobe_gap_analysis` only. `_shared/retrieval.ts` is consumed only by those two functions; `_shared/scale-guard.ts` tier removal is subtractive — no other AI function looked up the `smart_shopping_list` key. No migration (schema untouched). |
| 2026-04-24 | #672 | P30 | **Wave 5 partial — style_chat classifier fallback.** Drains the "make it warmer" misroute bug: LLM classifier sometimes returns `intent: "conversation"` on refine messages even when an active look is present, leaving users with an active outfit stranded in the conversational path. Added `applyActiveLookRefinementOverride(result, input)` to `_shared/style-chat-classifier.ts` as a deterministic post-classifier override. Shipped as a solo PR (not the P28+P30+P31 bundle originally planned) because P28 spec was written pre-P26 and describes already-fixed code in unified_stylist_engine.ts — requires deeper investigation before ship. 9 new unit tests added (20 total pass). Shared-module change confined to classifier so CI deno-check skips style_chat/index.ts (which has 5 pre-existing errors — tracked as Findings Log row). Verification: tsc 0, eslint 0, vitest 78/78 in shared suite + full suite green. Deploy: `style_chat`. |
| 2026-04-24 | #671 | W4.9-C | **Wave 4.9-C solo PR [cleanup]. Observability — Sentry hook on validator_unavailable fail-open path.** Drains Wave 3-B Finding #8 (aggregate validator outages were silently invisible until user-facing render quality degraded). Shipped a minimal `_shared/observability.ts` helper since no edge function previously integrated with Sentry. Helper parses `SENTRY_DSN` via `typeof Deno !== "undefined"` guard (so vitest/Node can transitively import observability.ts consumers safely), POSTs to Sentry's simpler `/store/` ingest endpoint (no SDK dependency, ~100 LOC total), and degrades to structured `console.warn` when DSN is unset (discoverable in Supabase Logs). `classifyValidatorError()` narrows the reason tag to `validator_timeout` / `validator_fetch_failed` / `validator_bad_response`. Wired into the single fail-open branch at `render_garment_image/index.ts:1679` — when `validateRenderedGarmentOutputWithGemini` throws on attempt 1, we emit `captureWarning('render_validator_unavailable', {attempt: 1, category: categoryClass, reason})` fire-and-forget. Existing console.warn left in place as belt-and-suspenders. User action post-merge: `npx supabase secrets set SENTRY_DSN=<dsn>` + configure Sentry alert rule for the new message type (tracked as post-launch setup, spec calls it out as NOT a merge blocker). Verification: tsc 0, eslint 0, deno check clean. Deploy: `render_garment_image`. |
| 2026-04-24 | #670 | W4.9-B+D | **Wave 4.9-B+D bundled PR [cleanup]. Docs + i18n drift + Fix Protocol audit.** Zero-code-impact cleanup. **W4.9-B**: (a) LAUNCH_PLAN.md P8 section cleaned — line 707's bullet reworded to point to the L554 note; in-code-block comment block (lines 735-754) rewritten to reflect that L554 (PR #659) shipped the `user_id` column + cascade FK + explicit `.eq("user_id", userId).delete()` line. Historical context preserved for future maintainers. (b) 5 orphan `settings.avatar_*` i18n keys (`change_photo`, `avatar_updated`, `avatar_error`, `avatar_invalid`, `avatar_too_large`) removed from all 14 locale files (70 instances total via consistent sed-based bulk-delete with per-locale line preservation). Post-edit grep for `settings.avatar_` in `src/` returns zero. Safe — PR #654 removed the only caller (`ProfileCard.tsx` avatar path). **W4.9-D**: audited Fix Protocol section end-to-end; minimal edits where prose diverged from actual practice: (a) "While writing code #3" strict "Do NOT fix" rule now lists three CI-blocker / shared-code / sibling-defect exceptions that reflect real scope-expansion patterns from Wave 4.9-A (deno fixes) and P15 (sibling hook sweep). (b) "Launch Plan Update #1" explicitly mentions `[DONE-partial]` status + the `[cleanup]` suffix convention for closing-wave PRs + "same commit or sibling commit on same branch" clarification for tracker-fix atomicity. All other Fix Protocol rules left unchanged (accurate vs current practice). Verification: tsc 0, eslint 0, build clean, vitest green. Deploy: none. |
| 2026-04-24 | #669 | W4.9-A | **Wave 4.9-A solo PR [cleanup]. Schema cleanup — drop 7 dead columns from `garments` + delete orphan `job_queue` rows + backfill `enrichment_status` canonical spelling.** Drains P15 + P24 Findings Log rows. Two new migrations (`20260424004046_drop_image_processing_columns.sql`, `20260424004047_backfill_enrichment_status.sql`) — column drops are cascading (CHECK `garments_image_processing_status_check` + INDEX `idx_garments_processing_status` vanish automatically). 22 source files + 10 test files updated — pre-drop grep sweep returns zero live references for `image_processing_`, `image_processed_at`, `processed_image_path`. Highlights: (a) `buildGarmentIntelligenceFields` in `garmentIntelligence.ts` narrowed from 10-column Pick to 3-column Pick (enrichment_status + original_image_path + render_status only); `skipImageProcessing` param removed; 2 callers updated. (b) `getGarmentProcessingMessage` in `garmentImage.ts` signature tightened from `(status, renderStatus, displaySource)` → `(renderStatus, displaySource)`; `GarmentProcessingBadge.tsx` + `GarmentDetail.tsx` + `garmentImage.test.ts` updated in lockstep — the dropped `'failed'` status branch was fully subsumed by the existing `renderStatus='failed'` branch (same output copy). (c) `outfit-scoring-body.ts` penalty calc rewritten: dropped the `imageReady`/`imageConfidence` variables + `-0.3` image-ready penalty + `-0.25` image-confidence penalty + recently-added compound penalty; `GarmentReadinessSignals` interface narrowed by 2 fields; max-cap `Math.min(1.6, penalty)` still binds. (d) `outfit-scoring.ts` GarmentRow type + `burs_style_engine/index.ts:851` SELECT string dropped the 2 now-missing columns in lockstep. (e) `types.ts` manually de-noised of 21 dropped-column field entries (7 cols × 3 blocks) — CLAUDE.md auto-gen-file rule intentionally bypassed here with a synchronized migration; user regenerates via `supabase gen types typescript --linked` post-merge to confirm. (f) 3 writers switched to canonical enrichment spellings: `'complete'`→`'completed'`, `'in_progress'`→`'processing'`. `isEnrichmentReady` helper's dual-spelling acceptance kept indefinitely (defensive). **Scope expansions**: fixed 2 pre-existing deno-check blockers in `outfit-scoring.ts` (bare `as GarmentRow` → `as unknown as GarmentRow`; `missing: string[]` type widening) — both verified pre-existing via `git stash + deno check`, but my PR's burs_style_engine SELECT-string edit triggers CI deno-check. Widened `EnrichmentStatus` union type in `GarmentEnrichmentPanel.tsx:78` to accept both old + new spellings (code-reviewer P1 fix pre-push). Verification: tsc 0 errors, eslint 0 warnings, build clean, vitest 1119/1119, deno check `burs_style_engine/index.ts` clean. Post-merge: `npx supabase db push --linked --yes` applies both migrations, then `supabase gen types typescript --linked > src/integrations/supabase/types.ts` in a follow-up commit. Deploy: `burs_style_engine` (only runtime consumer of outfit-scoring-body that this change affects). |
| 2026-04-25 | #678 | P33+P34+P36 | **Wave 6 frontend localization bundle — NotFound + ShareOutfit/PublicProfile meta tags + Insights eyebrow/weekdays.** Three prompts bundled because all are pure frontend, all touch the same locale files, and zero deploys are involved (W4.9-B+D bundling precedent). (a) **P33** — Audit revealed Auth.tsx + ResetPassword.tsx already fully localized; only NotFound.tsx had hardcoded strings. Added `useLanguage()` import + replaced `"Page not found"` → `t('notfound.title')` and `"Return to Home"` → `t('notfound.return_home')`. 2 new keys. (b) **P34** — ShareOutfit.tsx lines 148-156 had 3 hardcoded `${outfit.occasion} Outfit | Styled by BURS` titles + 3 hardcoded fallback descriptions; PublicProfile.tsx lines 142-143 had hardcoded `${displayName} — BURS Style Profile` title + `Check out ${displayName}'s style on BURS` description. Replaced with placeholder-pattern keys: `t('share.meta_title_template').replace('{occasion}', outfit.occasion)`, `t('share.meta_description_full')`, `t('share.meta_description_short')`, `t('profile.meta_title_template').replace('{name}', displayName)`, `t('profile.meta_description_template').replace('{name}', displayName)`. **Placeholder convention chosen** because the existing `t: (key: string) => string` signature has no built-in interpolation; `.replace('{x}', value)` is the simplest path that doesn't require a context API change. 5 new keys. (c) **P36** — Authorized carve-out from "Permanently frozen Insights.tsx" rule per spec. Line 36 hardcoded `['M', 'T', 'W', 'T', 'F', 'S', 'S']` weekday narrows replaced with `format(new Date(2024, 0, day), 'EEEEE', { locale: dateFnsLocale })` for days 1-7. `useLanguage()` destructure extended to pull `dateFnsLocale`. `useMemo` deps gained `dateFnsLocale` so re-renders on locale change. Line 64 hardcoded `eyebrow="INSIGHTS"` → `eyebrow={t('nav.insights')}` (uses existing key, matches UnusedOutfits.tsx:162 sibling pattern + Title Case + `.caption-upper` CSS). Title fallback at line 65 already followed safe-pattern (`t('insights.yourStyleStory') || 'Your Style Story'`) — left unchanged per audit. **Total: 7 new keys appended to en.ts + sv.ts** (append-only). All 12 other locale files untouched per convention (will fall back to key string until translator pass). Verification: tsc 0 errors, eslint 0 warnings, build clean (only pre-existing vite-react-swc deprecation warning unrelated to this PR), vitest 11/11 on Insights/ShareOutfit/PublicProfile tests. Code-reviewer approved. Deploy: none. |
| 2026-04-25 | #679 | P35 | **Wave 6 P35 — LiveScan + Onboarding components localization.** Audit revealed AddGarment.tsx + OutfitDetail.tsx already fully localized; defects concentrated in LiveScan.tsx (originally CoachMark only, scope expanded to 6 strings on the same screen) and 5 onboarding components: GetStartedStep.tsx (lines 47-48 eyebrow + title), LanguageStep.tsx (lines 25-26 eyebrow + title — title reuses existing `onboarding.language.title` key), AccentColorStep.tsx (lines 61, 69, 75 live-preview labels including the leftover Swedish "Favorit" in English code path — see Findings Log; component is dead code with zero importers), QuickStyleQuiz.tsx (lines 461-463 eyebrow + title + description), QuickUploadStep.tsx (lines 152-153 eyebrow + title). **Scope expansion (Fix Protocol criterion (c))**: LiveScan.tsx lines 754 + 756 + 766 had additional hardcoded strings (`"SCANNING"` label, `"Point camera at your clothing item"` instruction, `ctaLabel="Generate a look"`) flagged by code-reviewer as sibling defects on the same screen — fixed inline. **16 new keys** appended to en.ts + sv.ts (append-only): `livescan.coach.scan_title`, `livescan.coach.scan_body`, `livescan.coach.cta_label`, `livescan.scan_aria`, `livescan.scanning_label`, `livescan.scan_instruction`, `onboarding.eyebrow_generic` (shared LanguageStep + QuickUploadStep), `onboarding.getstarted.eyebrow_ready`, `onboarding.getstarted.title_ready`, `onboarding.accent.preview_outline`, `onboarding.accent.preview_favorite`, `onboarding.accent.preview_premium`, `onboarding.quiz.eyebrow`, `onboarding.quiz.title_intro`, `onboarding.quiz.intro_desc`, `onboarding.upload.title_intro`. Other 12 locale files NOT touched per convention. Verification: tsc 0 errors, eslint 0 warnings on touched files, build clean (only pre-existing vite-react-swc deprecation warning), vitest 1022/1022 (full suite). Code-reviewer approved. Deploy: none. |
| 2026-04-25 | #680 | P32 | **Wave 6 P32 — Extend langName maps to 14 locales.** Spec named 5 functions but `smart_shopping_list` was removed in P22; net scope is 4 functions. (a) `mood_outfit/index.ts:266` + `wardrobe_aging/index.ts:54` had binary `langName = locale === "sv" ? "svenska" : "English"` — replaced with full 14-entry `LOCALE_NAMES` map. (b) `travel_capsule/index.ts:486-488` had a partial 8-locale map (sv/en/no/da/fi/de/fr/es); extended to 14 with capitalization standardized to canonical native names (was lowercase + "finska" the Swedish-ized form, now `Suomi` the Finnish native form). (c) `clone_outfit_dna/index.ts` had NO locale awareness — defaulted to English regardless of caller. Added `locale = "en"` to the request-body destructure, the `LOCALE_NAMES` map, and `Respond in ${langName}.` as rule #5 in the system prompt. Caller `useCloneOutfitDNA` in `src/hooks/useAdvancedFeatures.ts` updated to pull `locale` from `useLanguage()` and include it in the body; test mock + assertion updated. Native-name map matches `src/i18n/types.ts:9-24` SUPPORTED_LOCALES (sv→Svenska, en→English, no→Norsk, da→Dansk, fi→Suomi, de→Deutsch, fr→Français, es→Español, it→Italiano, pt→Português, nl→Nederlands, pl→Polski, ar→العربية, fa→فارسی). Verification: tsc 0 errors, eslint 0 warnings, vitest useAdvancedFeatures 10/10. Code-reviewer approved. Deploy: 4 functions (mood_outfit, wardrobe_aging, clone_outfit_dna, travel_capsule). |
| 2026-04-25 | #676 | W4.9-followup | **Wave 4.9 follow-up cleanup PR [cleanup].** Drains the remaining open Findings Log rows attributable to Waves 0-4.9. Code change: deletes the dead `handleSyncAll` function from `supabase/functions/calendar/index.ts` (-69 LOC: 71-LOC function body + dispatcher case + `timingSafeEqual` import + 1-line doc comment). P2 finding RESOLVED — re-audited on main `f2cd0301`: zero `cron.job` rows reference `calendar` or `sync_all`; zero `analytics_events` rows for `metadata->>'fn' = 'calendar'` over 7d; only in-repo references were the function's own self-referential definition. Tracker updates (CLAUDE.md): (a) P2 row marked RESOLVED with full re-audit evidence; (b) P0d-iv row promoted from PARTIALLY RESOLVED → FULLY RESOLVED (user provisioned `SUPABASE_SERVICE_ROLE_KEY_TEST` 2026-04-25, verified by CI run #24930703508 rerun success); (c) P4 main-repo-cleanup row marked RESOLVED (main repo synced to `f2cd0301`, `tmp-db-push` branch deleted, stale `types.ts` partial regen with stderr-leak garbage discarded, worktree registry pruned 12→4); (d) W4.9 user-action checkbox list flipped all 3 items from `[ ]` to `[x]`. Also confirmed: `types.ts` regen produces zero content diff vs manually-de-noised W4.9-A version (only CRLF/LF) — manual edit was perfect. Verification: tsc 0 errors, eslint 0 warnings, build clean (Husky pre-commit), code-reviewer subagent approved. Deploy: `calendar` only (no shared module fanout). |
| 2026-04-25 | #674 | P29+P31 | **Wave 5 closure tracker-only PR — flips P29 + P31 to `[DONE-subsumed]`, completes Wave 5.** Zero code changes. Two parallel sub-agent investigations on `main` (commit `ca0bf856`, post-P28-tracker merge): (a) **P29** — every layer of `StyleChatActiveLookInput` serialization verified working: types match between `src/lib/styleChatContract.ts:21-27` and `supabase/functions/_shared/style-chat-contract.ts`; client serializes via `AIChat.tsx:820-838` (refine-mode pulls from `refineMode.activeGarmentIds`, follow-up turns hydrate from `currentVisibleLook.active_look` preserving `anchor_garment_id` + `anchor_locked`); DB persistence via `AIChat.tsx:407-426` `persistMessages` + readback via `parseStoredMessage` (lines 85-105) round-trips `stylistMeta.active_look` faithfully; `getLatestActiveLook(messages)` (line 638) reconstructs envelope from history; backend `style_chat/index.ts:927-944` deserializes + lines 947-949 promote `anchor_garment_id` to `selectedGarmentIds` when `anchor_locked` is true; response envelope at lines 1840-1866 echoes `anchor_garment_id` + `anchor_locked` back to client. Persistence machinery established pre-P26 + sharpened by **P26 (PR #665)** anchor-resolution fix. (b) **P31** — RefineChips (`RefineChips.tsx:26-99`) is intentionally a STATELESS message-emitter (calls `onChipTap(chip.message)` with plain text only at line 90 — zero payload construction). RefineBanner (`RefineBanner.tsx:15-58`) is purely PRESENTATIONAL (only X-button calls `onStopRefining`). Parent `AIChat.tsx:810-841` owns payload construction and includes `active_look.garment_ids: refineMode.activeGarmentIds` (FULL outfit) + `locked_slots` whenever `refineMode.isRefining`. Architecture-by-design subsumption — original P31 spec misread the chip components as payload owners. Tracker PR: (a) flipped P29 status `[TODO]` → `[DONE-subsumed]` with 6-layer audit trail; (b) flipped P31 status `[TODO]` → `[DONE-subsumed]` with architecture-by-design rationale; (c) advanced `CURRENT PROMPT` P29 → P25 (next `[TODO]` in numeric order — P25 depends on Wave 7 schema so realistically next actionable is Wave 6 P32); (d) `LAST UPDATED` stays 2026-04-25. Zero code changes; tsc/eslint/build no-op. **Wave 5 fully complete** (P28+P29+P31 subsumed, P30 shipped). Deploy: none. |
| 2026-04-25 | #673 | P28 | **Wave 5 P28 [DONE-subsumed] tracker-only PR.** Zero code changes. Investigated P28 end-to-end on `main` (commit `8a240d0c`, post-P30 merge) and verified the refine flow already correctly threads full outfit context at every layer — UI (`OutfitSuggestionCard.tsx:332` passes `garments.map(g => g.id)`, never anchor), client handler (`AIChat.tsx` `handleEnterRefine` stores full list and ships `active_look.garment_ids` + `locked_slots` on every refine-mode message), backend (`style_chat/index.ts:1471-1479` threads `active_look_garment_ids` + `locked_garment_ids` + `requested_edit_slots`; `unified_stylist_engine.ts:83` maps `mode:"refine"`→`"generate"` while preserving full context at line 124; `burs_style_engine` uses `buildActiveLookSlotMap` + `rankCombosForRefinement` to enforce locked-preservation + edit-slot-change). P28's intent fully delivered by **P26 (PR #665)** — slot mapping fix that replaced fail-open `slot:"unknown"` with `classifySlot()` — and **P30 (PR #672)** — classifier routing that surfaces refine intents to the override path. Tracker PR: (a) extended Status Legend with `[DONE-subsumed]` (analogous to `[DONE-partial]`); (b) flipped P28 status from `[TODO]` to `[DONE-subsumed]` with full investigation notes citing each layer; (c) updated the existing Wave 5 spec drift Findings Log row to definitive `RESOLVED` verdict for P28; (d) advanced `CURRENT PROMPT` from P28 to P29 (next `[TODO]`); (e) `LAST UPDATED` 2026-04-24 → 2026-04-25. Zero code changes; tsc/eslint/build no-op. Note: **P29 + P31 still TODO** per same investigation likely subsumed but left for the user to scope explicitly. Deploy: none. |
| 2026-04-25 | #677 | P41 | **Wave 6 P41 — UnusedOutfits Swedish/English key mixing.** Replaced `OCCASIONS = ['vardag', 'jobb', 'dejt', 'fest', 'casual', 'smart_casual']` (4 Swedish + 2 English mix) at `src/pages/UnusedOutfits.tsx:29` with the canonical English-keyed 6-occasion vocabulary `['casual', 'work', 'date', 'party', 'workout', 'travel']` — matches `OutfitGeneratePicker.tsx:29-36`, `QuickGenerateSheet.tsx:62-69`, `AdjustDaySection.tsx:10-15`. Localized the inline `"unused pieces"` text at line 290 via new key `'insights.unused_pieces_label'` ("unused pieces" / "oanvända plagg") appended to `src/i18n/locales/en.ts` + `sv.ts` per append-only rule. Behavior-preserving for downstream display: `getOccasionLabel(t, occasion)` in `src/lib/humanize.ts:75-81` already handled both Swedish-keyed and English-keyed values via the `occasion.${occasion.toLowerCase()}` key lookup, and en.ts had both `occasion.vardag` AND `occasion.casual` (rendered as "Casual"). **Initial Wave 6 audit verdict'd P41 as DONE-subsumed; main agent caught the OCCASIONS array defect during pre-flip independent verification (Wave 5 P28 precedent — always verify before flipping subsumed) — see Findings Log row.** Verification: tsc 0 errors, eslint 0 warnings, build clean, vitest unchanged (no new tests added — change is internal data shape + 1 i18n key, both validated by build). Deploy: none. |
| 2026-04-25 | #681 | P40 | **Wave 6 P40 — Multi-locale regexes (FORMAL_KEYWORDS + CHAT_SHORT_RE).** `OutfitGenerate.tsx:78` `FORMAL_KEYWORDS` expanded from English-only 13 keywords to 50+ formality-trigger words across 12 Latin-script locales with `/u` flag for non-ASCII `\b` boundaries. `shopping_chat/index.ts:137` `CHAT_SHORT_RE` expanded from 22 English tokens to ~85 across all 14 locales including ar/fa native script. RTL scripts intentionally omitted from FORMAL_KEYWORDS pending `\b` Unicode-boundary testing. Translator-pass logged in Findings Log. **Codex P2 fix-up commit**: locale-scope FORMAL_KEYWORDS via per-locale map (Polish "cena"=price collision with Spanish/Italian "cena"=dinner eliminated); broaden CHAT_SHORT_RE punctuation to leading [¿¡]? + trailing class adds ¿¡؟،, supporting `¿hola?`, `¡hola!`, `مرحبا،`, `مرحبا؟`. **Pre-existing TS2345 deno-check fix-up commit**: cast `supabase as ReturnType<typeof createClient>` at `getWardrobeContext` call site — same fix pattern as PR #675's style_chat fix. Verification: tsc 0 errors, eslint 0 warnings, Node.js regex sanity tests confirm correct matching. Deploy: `shopping_chat`. |
| 2026-04-24 | #668 | P27b | **Wave 4.5-B solo PR. Secondary image add/swap/delete on GarmentDetail.** Consumer for P27a's `secondary_image_path` column. New `SecondaryImageManager.tsx` under `src/components/garment/` slots under the hero image in GarmentDetail. (a) **Add**: hidden file input (`accept="image/*"` + `capture="environment"` — native camera picker on mobile, file chooser on desktop, matches LiveScan's browser-fallback branch output) → `compressImage()` → `uploadGarmentImage()` to `garments/${userId}/${garmentId}_secondary.{ext}` → UPDATE sets `secondary_image_path`. No AI re-trigger. (b) **Swap**: "Use as primary" button → single-statement UPDATE exchanges the VALUES of `image_path` ↔ `secondary_image_path` AND clears `ai_raw` / `ai_analyzed_at` / `ai_provider` / `silhouette` / `visual_weight` / `texture_intensity` / `style_archetype` / `occasion_tags` / `versatility_score` / `rendered_image_path` / `rendered_at` / `render_error`, sets `enrichment_status='pending'` + `render_status='pending'`. Optimistic concurrency via `.eq('image_path', previousImagePath)` catches concurrent swaps. Kicks `triggerGarmentPostSaveIntelligence` with `skipRender:true` then delegates the render trigger to the newly-public `startGarmentRenderInBackground(garment.id, 'manual_enhance', { force: true })` — inherits the full 402-reset / retryable-retry / server-state-check / non-retryable-reset tree. Spends 1 render credit — documented in AlertDialog confirm copy. (c) **Delete**: storage delete first (logged, non-fatal) → NULL the column. No AI re-trigger. (d) **Guardrail**: actions disabled via `aria-disabled` pattern while `render_status ∈ {pending, rendering}` OR `enrichment_status ∈ {pending, processing, in_progress}` OR mutation in flight. Clicks show busy-toast instead of silent no-op. (e) **UI**: 64×64 LazyImage thumbnail + action row + two AlertDialog confirmations. Motion via `EASE_CURVE` / `DURATION_MEDIUM`. Haptics on every action. (f) **i18n**: 14 new `garment.secondary_*` keys appended to `en.ts` + `sv.ts`. (g) **Design decisions**: read-then-UPDATE (supabase-js can't emit self-referential `SET x=y,y=x`; RPC contradicts spec "no swap RPC"; read-write race negligible given RLS + mutation-local lock + render/enrichment gate); file-input-only capture (spec says "browser fallback is already built into LiveScan" — standalone file input IS that fallback, avoiding a new capture-return route + state handoff). (h) **Shared-module refactor (Codex P1 round 1 fix)**: `startGarmentRenderInBackground` in `src/lib/garmentIntelligence.ts` exported + accepts `options: { force?: boolean }`. Existing internal caller (line 397 in `triggerGarmentPostSaveIntelligence`) passes no options → default `force=false` → zero behavior change. Swap flow passes `force: true` → full recovery tree reused. Also tightened the `source` param from `string` to `RenderTriggerSource`; removed two interior `as RenderTriggerSource` casts. (h2) **Concurrency hardening (Codex P1 round 2 fix)**: (i) swap OC guard expanded to `.eq('secondary_image_path', previousSecondaryPath)` alongside the `.eq('image_path', previousImagePath)` check — matches BOTH columns, so ANY concurrent write on EITHER column fails cleanly. (ii) delete flow reordered DB-first-then-storage with OC guard `.eq('secondary_image_path', path)` — prevents deleting the now-live hero asset if a concurrent swap moved `path` to primary between our read and our storage remove. (h3) **Display coherence + cache invalidation (Codex P1+P2 round 3 fix)**: (i) swap UPDATE also sets `original_image_path: newPrimary` — `getPreferredGarmentImagePath` prefers `original_image_path` over `image_path` when no render is ready, so leaving the raw-upload column stale meant wardrobe cards showed the OLD photo until render completed (and permanently if render failed). (ii) replaced local one-key `invalidate()` with the canonical `invalidateWardrobeQueries(queryClient, user?.id)` helper — busts 10+ wardrobe query keys (`garments`, `garments-by-ids`, `garments-count`, `insights`, `ai-suggestions`, etc.) so list screens refresh immediately post-mutation instead of waiting for staleTime. (h4) **Upload-path uniqueness + render-after-enrichment sequencing (Codex P1+P2 round 4 fix)**: (i) Upload path now tagged with `crypto.randomUUID().slice(0,12)` suffix (`secondary_${tag}.${ext}`) so each upload gets its own storage object; prevents the post-swap collision where a fixed `_secondary.jpg` could overwrite the current primary's bytes. `upsert:false` as defense-in-depth. (ii) Added `renderOptions: { force?: boolean }` to `TriggerGarmentPostSaveIntelligenceOptions` in `garmentIntelligence.ts`; the internal post-enrichment `startGarmentRenderInBackground` call now forwards it. Swap flow threads `renderOptions: { force: true }` into ONE `triggerGarmentPostSaveIntelligence` call and drops the separate direct render trigger — guarantees render sees fresh `ai_raw` after enrichment completes, no stale-metadata race. (h5) **Raw-file fallback + confirm-time busy recheck (Codex P1+P2 round 5 fix)**: (i) `compressImage` wrapped in try/catch — raw `file` used on failure (mirrors `useAddGarment` pattern for Median/WebView environments where `createImageBitmap` / `OffscreenCanvas` fail). (ii) `handleSwapConfirm` and `handleDeleteConfirm` re-check `isBusy` at confirm-time, not just at dialog-open — prevents bypassing the gate if render/enrichment state flips busy while the dialog is open. (i) **Test**: `GarmentDetail.test.tsx` updated with a SecondaryImageManager mock mirroring the existing GarmentEnrichmentPanel / GarmentOutfitHistory / GarmentSimilarItems pattern — new component's `useAuth()` call needs a provider the test doesn't wrap. Types regen (commit 1) surfaces `secondary_image_path` in Row/Insert/Update shapes. Stray "Initialising login role..." stderr debug line from the regen was stripped inline. Code-reviewer approved; Codex P1 fix applied pre-merge. Post-merge: **no deploy** — zero backend code modified; every AI function + wardrobe card continues reading `image_path` unchanged. |

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
3. If a second bug is found: note it in the PR body under "Out of scope" AND add it to the Launch Plan Findings Log. Do NOT fix it in this prompt **unless one of these applies**:
   - (a) It's a direct CI blocker for this PR (e.g., pre-existing deno-check errors uncovered because this PR touches the affected function's entry-point).
   - (b) It's a defect in shared code that this PR's change necessarily exposes and whose absence would silently regress the PR's acceptance criteria.
   - (c) It's a tight sibling defect that fails the same grep/acceptance criterion used by the prompt (e.g., "zero `image_processing_*` refs" requires cleaning all 24 consumer files, not just the 3 named writers).
   In those cases, document the expansion in the PR body under "Scope expansion" (not "Out of scope") AND still add a Findings Log row explaining the trigger + rationale.

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
1. Flip the prompt's status from `[TODO]` to `[DONE] (PR #<num>, YYYY-MM-DD)` — or `[DONE-partial]` if the prompt is split and explicit follow-up prompts are inserted in the prompt list (see the Status Legend at the top of the Launch Plan section).
2. Move `CURRENT PROMPT` pointer to the next `[TODO]` prompt.
3. Update `LAST UPDATED` to today (format: YYYY-MM-DD).
4. Append a row to the Completion Log. For closing-wave (Nx.9) PRs, suffix the prompt column with `[cleanup]` so the row is trivially filterable (standing Wave Closure Rule convention).
5. Add any new findings to the Findings Log — including scope expansions flagged under "While writing code #3" above.
6. Commit CLAUDE.md changes IN THE SAME PR as the fix (same commit or a sibling commit on the same branch — the user's merge then ratifies both fix and tracker atomically).

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
| `_shared/unified_stylist_engine.ts` | `style_chat`, `generate_outfit` |
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
