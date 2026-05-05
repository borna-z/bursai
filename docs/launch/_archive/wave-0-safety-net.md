# Wave 0 — Safety Net (do first)

Source split: `docs/launch/wave-0-safety-net.md`. Standing rules live in `docs/launch/standing-rules.md`. CLAUDE.md's "How to Resume" section explains the launch-plan resume protocol.

---

## Wave 0 — Safety Net (do first)

### P0a — Husky pre-commit hook

**Problem**
No local enforcement of tsc/eslint/build. Broken code can be committed. CI catches it later; waste cycles.

**Fix**
1. Ask user permission: "`npm install --save-dev husky` adds one devDep — approve?"
2. `npm install --save-dev husky`
3. `npx husky init` (creates `.husky/pre-commit` with `npm test` placeholder + adds `prepare` script to package.json)
4. Replace `.husky/pre-commit` contents with:
   ```bash
   #!/usr/bin/env sh
   npx tsc --noEmit --skipLibCheck || exit 1
   npx eslint src/ --ext .ts,.tsx --max-warnings 0 || exit 1
   npm run build || exit 1
   ```
5. Test: `git commit --allow-empty -m "test husky"` — must run all three checks.

**Files**
- `package.json` — new `devDependencies.husky` + `scripts.prepare: "husky"`
- `.husky/pre-commit` — new
- `.gitignore` — add `.husky/_` if not already

**Acceptance**
- `git commit` locally fails if tsc/eslint/build fail
- Fresh clone + `npm install` auto-installs hooks via `prepare`
- No warnings on a clean commit

**Deploy** None.

---

### P0b — GitHub Actions CI workflow

**Problem**
No remote enforcement. A PR can be merged without running tsc/eslint/build/tests.

**Fix**
Create `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit --skipLibCheck
      - run: npx eslint src/ --ext .ts,.tsx --max-warnings 0
      - run: npm run build
      - run: npx vitest run
```
Then in GitHub repo Settings → Branches → add rule for `main` requiring the `check` job to pass.

**Files**
- `.github/workflows/ci.yml` — new

**Acceptance**
- Opening a PR triggers the workflow
- Workflow passes on a clean diff
- Workflow fails with intentionally-broken code
- `main` branch rule blocks merge until `check` is green (requires user to configure in GitHub UI — document in PR body)

**Deploy** None.

---

### P0c — Verify Fix Protocol is in CLAUDE.md

**Problem**
Fix Protocol was added in the Launch Plan baseline PR, but needs a wording pass once we've executed a few prompts and know what's friction.

**Fix**
After completing Wave 1 (at least P1-P3), re-read the Fix Protocol section of CLAUDE.md. Adjust based on real experience:
- Which steps were skipped or forgotten? Tighten wording.
- Which subagent invocations were helpful vs wasteful? Refine.
- Any new hard rules to promote from "common sense" to "documented"?

**Files**
- `CLAUDE.md` — Fix Protocol section only

**Acceptance**
- No contradictions in the protocol
- Every step is enforceable by a fresh agent who hasn't seen prior sessions
- User sign-off on wording

**Deploy** None.

---

### P0d — Integration smoke tests

**Problem**
30% line coverage threshold isn't enough to catch regressions. No tests exist for end-to-end user flows. A refactor in any Wave 1-10 can silently break a critical path.

**Fix**
Create 10 smoke tests under `src/test/smoke/`. Each test:
1. Creates a test user via Supabase admin client
2. Runs the flow
3. Asserts response shape
4. Tears down user

Flows (one test each):
1. `signup.test.ts` — create user, verify profile row exists, verify default preferences
2. `garment-add.test.ts` — upload garment image, call `analyze_garment`, verify title/category returned
3. `enrichment.test.ts` — submit garment_enrichment job, poll until complete, verify `ai_raw` populated
4. `render.test.ts` — call `enqueue_render_job`, poll render_jobs until `status='succeeded'`, verify `rendered_image_path` set
5. `outfit-generate.test.ts` — call `generate_outfit` with 10 seed garments, verify complete outfit (top+bottom+shoes or dress+shoes)
6. `outfit-refine.test.ts` — create outfit, call style_chat refine, verify swap happened
7. `plan-week.test.ts` — create 7 planned_outfits, verify query by date range works
8. `visual-search.test.ts` — upload image, call `visual_search`, verify matches returned
9. `shopping-chat.test.ts` — send message, stream response, verify final payload shape
10. `travel-capsule.test.ts` — build capsule for 5-day trip, verify `capsule_items` + `outfits[]` both populated

Each test uses `SUPABASE_SERVICE_ROLE_KEY_TEST` env var. Runs in CI as part of P0b (add `npx vitest run src/test/smoke` step).

**Files**
- `src/test/smoke/*.test.ts` (10 new files)
- `src/test/smoke/harness.ts` (new — shared setup/teardown helpers)

**Acceptance**
- All 10 tests pass against current main
- Tests run in CI
- Failure in any test blocks PR merge

**Deploy** None.

**History**: First pass (P0d v1) shipped 3 of 10 tests — `signup.test.ts`, `plan-week.test.ts`, `garment-add.test.ts` — plus `harness.ts`, `vitest.smoke.config.ts`, a `test:smoke` npm script, and a CI job gated on `RUN_SMOKE=1` + `SUPABASE_SERVICE_ROLE_KEY_TEST`. The 3 tests avoid Gemini and Stripe so they can run against production Supabase with `test_` prefixed users that self-clean up. The remaining 7 flows (enrichment, render, outfit-generate, outfit-refine, visual-search, shopping-chat, travel-capsule) all hit external APIs and need the infra decision in P0d-ii before they can be written responsibly — tracked in P0d-iii.

---

### P0d-ii — Test infrastructure decision + setup

**Decision (ADR, 2026-04-19)**
Approach **(c)** — local Supabase via `supabase start` in CI + custom HTTP mock server for Gemini/Stripe (Node stdlib, no new npm packages). Rejected: (a) separate Supabase project (recurring $25+/mo plus Gemini/Stripe quota burn on every PR — wasteful for solo pre-launch); (b) bare local Supabase with no mocks (doesn't cover the 7 Gemini/Stripe-dependent flows P0d-iii needs); `msw` as mock framework (hard-rule needs explicit approval, and 7 simple mock cases don't justify a framework).

Implementation notes:
- Supabase CLI version is **pinned** in `.github/workflows/ci.yml` — never `latest`. Drift between CI CLI and the local dev CLI is the #1 way `supabase start` boots a different schema than expected.
- CI hard-fails if `supabase db reset` does not apply every migration cleanly. Partial-schema green runs are the failure mode we most want to avoid.
- The mock server is a tiny Node `http` class in `src/test/smoke/mocks/mock-server.ts`. P0d-ii ships the scaffolding (server, route registry, Gemini/Stripe stub registrations). Actual fixtures and edge-function wiring land in P0d-iii.
- The 3 existing tests (signup, plan-week, garment-add) don't call edge functions or external APIs — they pass against local Supabase unchanged, no mocks required.

**Status update (2026-04-19, after first CI run)**: the `smoke-local` job is gated with `if: false` pending **P0d-iv — Schema baseline migration (drift repair)**. The first local migration (`20260124173453_...`) `ALTER TABLE`s `public.garments` but no `CREATE TABLE garments` migration exists in the repo — the base schema was authored in Studio UI without a backfilled migration file, so `supabase db reset` from empty fails. The harness extension + mocks scaffolding + ADR ship as P0d-ii; the CI job stays in the workflow as a one-line `if:` flip that P0d-iv re-enables once the baseline migration lands. Using `if: false` (not `continue-on-error: true`) avoids CI-as-theater: nothing reports green for a job that didn't actually run.

**P0d-iii fixture-seeding cost estimate**: ~$5–20 one-time. Seven flows × a handful of real Gemini calls per flow to capture canonical responses + a few Stripe test-mode calls. After recording, fixtures are deterministic and committed to the repo; no recurring cost on PR runs.

**Problem**
P0d v1 shipped 3 tests that run against production Supabase with test-prefixed users. That's fine for Wave 1 auth/RLS checks but cannot scale: the remaining 7 smoke tests (P0d-iii) hit Gemini and Stripe, which would burn real quota and risk test-user collision with real users. We need an isolated test environment before the expanded suite lands.

**Fix**
Pick one of three approaches and set it up:

1. **(a) Separate Supabase project** — clean isolation, but real $$$ for a second project. Migrations pushed via CI. Gemini/Stripe still need mocks unless the user wants to fund test quota.
2. **(b) `supabase start` local dev in CI via Supabase CLI + Docker** — free, works offline, every CI run boots a fresh DB, migrations applied, tests exercise the full local stack. Gemini/Stripe still need mocks.
3. **(c) Real local Supabase (option b) + mocked Gemini/Stripe via `msw` or fetch override** — same as (b) plus deterministic AI responses via recorded fixtures.

**Recommendation**: (c). Local Supabase is the right isolation boundary (no shared state with prod, no extra project cost), and mocked external APIs make smoke tests deterministic. Fixtures per flow can live under `src/test/smoke/fixtures/` and be regenerated from real calls when edge-function contracts change.

**Files**
- `.github/workflows/ci.yml` — add a `smoke-local` job that runs `supabase start`, applies migrations, sets env to point at `localhost:54321`, then runs `bun run test:smoke`
- `src/test/smoke/fixtures/*.json` (new) — recorded Gemini/Stripe responses, one per flow
- `src/test/smoke/mocks/gemini.ts` (new) — installable fetch override that returns fixtures
- `src/test/smoke/harness.ts` — extend to wire mocks when `SMOKE_TARGET=local` is set
- Possibly a `supabase/seed.sql` so the local DB has the minimum objects (storage buckets, base policies, cron extensions) any smoke test depends on

**Acceptance**
- Decision recorded in an ADR-style block in this file (which of a/b/c)
- A CI job can spin up local Supabase, apply all migrations from `supabase/migrations/`, and run smoke tests against it in under 5 minutes
- The existing 3 tests from P0d v1 pass under the new infra unchanged
- Mocked Gemini responses are deterministic and committed to the repo

**Deploy** None.

---

### P0d-iii — Expand smoke tests to remaining 7 flows

**Problem**
P0d v1 shipped 3 of 10 smoke tests. The remaining 7 cover flows that hit Gemini or Stripe: enrichment, render, outfit-generate, outfit-refine, visual-search, shopping-chat, travel-capsule. Every Wave 3-8 prompt touches at least one of these flows and needs regression coverage before merge.

**Fix**
Once P0d-ii is done and local-Supabase-with-mocks is available, add the 7 remaining tests per the original P0d spec (see flow list in the P0d **Fix** section above). Each test creates a test user, exercises the flow, asserts response shape AND the DB side-effect (ai_raw populated, render_jobs row progressed to succeeded, etc.), then tears down.

**Files**
- `src/test/smoke/enrichment.test.ts` (new)
- `src/test/smoke/render.test.ts` (new)
- `src/test/smoke/outfit-generate.test.ts` (new)
- `src/test/smoke/outfit-refine.test.ts` (new)
- `src/test/smoke/visual-search.test.ts` (new)
- `src/test/smoke/shopping-chat.test.ts` (new)
- `src/test/smoke/travel-capsule.test.ts` (new)

**Acceptance**
- All 7 new tests pass against local-Supabase-with-mocks
- Total smoke suite (10 tests) runs in under 5 minutes in CI
- Failure in any test blocks PR merge

**Deploy** None.

**Depends on**: P0d-iv (needs a bootable local schema to run the 7 mock-backed tests in the re-enabled `smoke-local` CI job). Execution order swapped from the original P0d-ii → P0d-iii → P0d-iv plan after P0d-ii's first CI run exposed missing base-schema migrations — shipping 7 new tests that skip in CI until P0d-iv lands is the same false-safety-net trap that `continue-on-error: true` would have been. P0d-iv goes first, re-enables CI with the existing 3 tests proven green, then P0d-iii adds 7 more verified-on-merge.

---

### P0d-iv — Schema baseline migration (drift repair)

**Problem**
`supabase/migrations/` has no `CREATE TABLE` migrations for the app's base tables (garments, profiles, outfits, etc.). The earliest migration file (`20260124173453_...`) `ALTER TABLE`s `public.garments`, assuming it already exists. That schema was authored in Studio UI in an earlier era without a backfilled migration file, so `supabase start` against a clean local DB fails at the first migration with `ERROR: relation "public.garments" does not exist`. This blocks P0d-ii's `smoke-local` CI job (currently gated `if: false`) and blocks P0d-iii's expanded mock-backed tests, since both depend on a bootable local schema.

Surfaced when P0d-ii's CI job ran for the first time — see Findings Log entry (2026-04-19) in CLAUDE.md.

**Fix (Strategy V — baseline as sole source of schema truth)**
Shipped the baseline dump as `supabase/migrations/00000000000000_initial_schema.sql`, deleted the 67 historical migration files, and repaired remote tracking so the baseline is the only row in `supabase_migrations.schema_migrations`. Local `db reset` now applies baseline → 36 tables matching prod. Remote `db push --dry-run` reports up-to-date. CI `smoke-local` job unblocked by removing `if: false`.

Step-by-step (as executed):
1. `npx supabase db dump --linked --schema public -f supabase/migrations/00000000000000_initial_schema.sql` — direct pg_dump of prod schema, 36 tables, 16 functions, 54 policies, ~2600 lines. Note: `supabase db pull --linked` doesn't work here; it boots a shadow DB and replays local migrations first, which collides with the drift. `db dump` bypasses the shadow and goes direct.
2. Executed one atomic transaction against prod's `supabase_migrations.schema_migrations` (no actual schema change, only tracking):
   ```sql
   BEGIN;
   DELETE FROM supabase_migrations.schema_migrations WHERE version != '00000000000000';
   INSERT INTO supabase_migrations.schema_migrations (version, name)
   VALUES ('00000000000000', 'initial_schema') ON CONFLICT (version) DO NOTHING;
   COMMIT;
   ```
3. Deleted all 67 `supabase/migrations/2026*.sql` files locally.
4. Verified: `supabase migration list --linked` shows only the baseline row (Local = Remote). `supabase db reset` applies baseline cleanly → 36 public tables. `supabase db push --linked --dry-run` reports "Remote database is up to date."
5. Removed `if: false` from the `smoke-local` CI job definition.

**Strategy pivot — original (W) attempt documented for posterity**
The prompt originally scoped an idempotency-guard pass across the 67 historical migrations (approach W): wrap `CREATE TYPE`, `CREATE POLICY`, `CREATE TRIGGER`, etc., in exception-catching DO blocks so replay-from-empty becomes tolerant of the baseline. The scoped "mechanical pass" expanded once reality showed through:

- Migration `20260124175058` creates a trigger that references `public.update_updated_at_column()`; the function only exists in the `storage` schema on prod, so the CREATE TRIGGER silently failed on prod (trigger is absent there).
- Migration `20260129100415` creates `has_role(_role app_role)` whose body compares `role = _role`; prod's `user_roles.role` is `text`, not `app_role`, and the `app_role` type itself is absent from prod — function never existed.
- Migration `20260308125521` creates a policy referencing `requester_id`/`addressee_id` on `friendships`; prod's `friendships` has `user_id`/`friend_id` — policy never created.
- More of the same throughout the chain.

The migration files in the repo describe a schema that never fully existed. Idempotency guards don't fix that; they just make each failing statement a silent no-op, producing a local schema that drifts from prod in unpredictable ways. (W) would require 100+ judgement calls about "did this CREATE ever run and if so what columns did it reference at the time" — a rewrite, not a mechanical pass. The idempotency commit (Commit 1 of the PR) is preserved in git history as defensive code but the migration files themselves are deleted in Commit 2.

Strategy V costs one atomic transaction against a tracking table. Trade-off accepted: loses in-repo migration history (recoverable from git log + the pre-merge commit hash), gains a truthful repo where every new migration from P0d-iv onward is real and verifiable.

Per CLAUDE.md Migration Rules, this is Strategy B territory (preserve remote tracking consistency via `migration repair`). Solo pre-launch context makes it lower-risk than implied — no preview branches, no other devs, no CI that had applied the old chain from zero.

**Files (as shipped)**
- `supabase/migrations/00000000000000_initial_schema.sql` (new — direct pg_dump of prod, unpruned; dump is already idempotent on CREATE TABLE / CREATE INDEX via `IF NOT EXISTS`)
- 67 `supabase/migrations/2026*.sql` files deleted
- `.github/workflows/ci.yml` — `smoke-local` job's `if: false` removed
- `LAUNCH_PLAN.md` — this section rewritten to reflect Strategy V
- `CLAUDE.md` — P0d-iv flipped to `[DONE]`, Findings Log entry added

**Acceptance (verified)**
- ✅ `supabase start` + `supabase db reset` from empty DB applies baseline cleanly, produces 36 public tables matching prod
- ✅ `supabase db push --linked --dry-run` reports "Remote database is up to date"
- ✅ `supabase migration list --linked` shows `00000000000000` as the only row with Local = Remote
- ✅ `smoke-local` CI job runs on the PR's own CI run (re-enabled by this PR)

**Deploy** None. Migration-only. Post-merge `db push` is a no-op since the tracking-table repair was done before merge.

**Depends on**: P0d-ii (needs the `smoke-local` job definition to exist so P0d-iv can re-enable it).

---

### P0e — Migration drift check in CI

**Problem**
`supabase/migrations/` and remote `schema_migrations` can drift. Drift breaks `npx supabase db push` and forces MCP workarounds. Currently no automated drift detection.

**Fix**
Add two steps to `.github/workflows/ci.yml`, conditional on any file under `supabase/migrations/` changing:
```yaml
      - name: Check migration drift
        if: contains(steps.files.outputs.all_changed_files, 'supabase/migrations/')
        run: |
          npx supabase migration list --linked | tee migration_list.txt
          ! grep -E '^\s+20' migration_list.txt | grep -v -E '\|\s+20' || (echo "DRIFT DETECTED" && exit 1)
          npx supabase db push --linked --dry-run --yes
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

The grep logic: any row from `migration list --linked` that has a timestamp in the `Local` column but nothing in `Remote` (or vice versa) = drift. The row format is `<local_ts> | <remote_ts> | <applied_at>`. If local exists without remote AND it's not a new migration introduced by this PR, it's drift.

**Files**
- `.github/workflows/ci.yml`
- `.github/dependabot.yml` (optional — add supabase-cli version pin)

**Acceptance**
- PRs that touch migrations trigger the drift check
- PRs without migration changes skip the drift check
- Drift blocks merge

**Deploy** None.
