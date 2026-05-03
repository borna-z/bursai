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

### Launch Plan — Current Wave

**CURRENT PROMPT:** Wave 8.5 P86 — Pair memory auto-write across all flows (PR A foundation shipped as PR #709 covering P83+P84+P85+P87; PR B remaining: P86+P88+P89+P90+P91+P92)
**CURRENT WAVE FILE:** `docs/launch/wave-8.5-style-memory.md`
**LAST UPDATED:** 2026-05-01
**LAST CLEANUP:** 2026-04-28 (Wave 4.9 hygiene PR #697 — flipped 3 stuck Findings Log rows whose underlying fixes shipped via PRs #641 / #669 / #670 but whose Action column was never backfilled; tracker now reflects the actual closure state)
**TOTAL SCOPE:** ~95 prompts across 14 waves (P0a–P92, plus W4.9 + W7.9 closing sub-wave clusters)

### How to Resume

When the user says "continue the launch plan" (or equivalent like "next prompt", "continue", "keep going"):
1. Read `CURRENT PROMPT` above.
2. Open `CURRENT WAVE FILE` — that file has the full spec (problem, fix, files, acceptance, deploy) for THIS wave only.
3. Do NOT open any other wave file unless the spec explicitly references it. The Wave Index below is a status table, not a reading list.
4. Load only the files named in the prompt's `Files` section (respect Token Conservation rules).
5. Follow the Fix Protocol (section below).
6. Update `CURRENT PROMPT` and `CURRENT WAVE FILE` when the wave completes — the tracker update lives INSIDE the fix PR (see "Launch Plan Update" below).

Standing rules common to every wave: `docs/launch/standing-rules.md`.

### Wave Index (status only — do not load wave files unless working on them)

| Wave | File | Status |
|------|------|--------|
| 0 | `docs/launch/wave-0-safety-net.md` | ✅ DONE |
| 1 | `docs/launch/wave-1-security.md` | ✅ DONE |
| 2 | `docs/launch/wave-2-rate-limiting.md` | ✅ DONE |
| 3 | `docs/launch/wave-3-ghost-mannequin.md` | ✅ DONE |
| 4 | `docs/launch/wave-4-ai-retrieval.md` | ✅ DONE |
| 4.5 | `docs/launch/wave-4.5-secondary-image.md` | ✅ DONE |
| 4.9 | `docs/launch/wave-4.9-findings-cleanup.md` | ✅ DONE |
| 5 | `docs/launch/wave-5-refine-chat.md` | ✅ DONE |
| 6 | `docs/launch/wave-6-localization.md` | ✅ DONE |
| 7 | `docs/launch/wave-7-onboarding.md` | ✅ DONE (Wave 7.9 follow-up cleanup PENDING — staged on branch `wave-7-9-followup`, not yet merged) |
| 8 | `docs/launch/wave-8-subscriptions.md` | ✅ DONE (functional scope; Wave 8.9 closure deferred per user direction 2026-04-29 — 3 open Findings rows carry `Scheduled: post-launch` annotations) |
| 8.5 | `docs/launch/wave-8.5-style-memory.md` | 🔄 CURRENT |
| 9 | `docs/launch/wave-9-capacitor.md` | 🔜 TODO |
| 10 | `docs/launch/wave-10-app-store.md` | 🔜 TODO (also contains Wave 10.5 — Vertex AI / Gemini 3 migration) |
| 11 | `docs/launch/wave-11-launch.md` | 🔜 TODO |

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

### Findings Discipline (standing rule for every session)

Every session — implementation, fix, audit, cleanup, anything — MUST:

1. **Log new findings as they're spotted, not at session end.** Add a Findings Log row IMMEDIATELY when a bug is found that won't be fixed in the current PR. Format follows the existing table: `Date | Prompt | Location | Description | Action`. The `Action` column starts as `Track for: <future prompt or wave>` and gets flipped to `RESOLVED in PR #<num>` when fixed. Never let a session end with discovered-but-unlogged bugs.
2. **Log fix actions at the same time as the fix commit.** When a Findings Log row gets resolved, the same PR that resolves it MUST update the Action column. Don't wait for a follow-up tracker PR.
3. **Run an audit at the close of every wave.** The Wave Closure Rule (already documented above) requires an Nx.9 sub-wave. From now on, that sub-wave MUST include a parallel-subagent audit pass over the wave's surface — at minimum, code-reviewer-style review of (a) backend changes, (b) state machine integrations, (c) cross-cutting concerns, (d) the largest single-PR change in the wave. Findings flow into the log; must-fix items flow into a `Wave N Pre-Launch Audit — Must-Fix` heading at the top of `docs/launch/findings-log.md` (like the Wave 7 one in that file).
4. **Audits are read-only by default.** When the user requests an audit, the audit phase makes ZERO edits — it produces a findings list. Fixing happens in subsequent PRs that cite the findings by number/severity. This separation lets the user triage which findings to ship pre-launch vs defer.

### Session Workflow Patterns, Findings Log, Completion Log

Moved out of CLAUDE.md (2026-05-03 token-trim) to keep the always-loaded tracker tight. Load only when relevant:

- **Findings Log** → `docs/launch/findings-log.md` — open findings + resolutions. Read when triaging an open finding, citing a `RESOLVED in PR #X` row, or running a Wave Closure (Nx.9) audit. Append new rows here, not in CLAUDE.md.
- **Completion Log** → `docs/launch/completion-log.md` — one row per merged PR. Read when checking what shipped, drift-detecting against `git log --oneline main`, or composing a wave-closure summary. Append new rows here, not in CLAUDE.md.
- **Session Workflow Patterns** → `docs/launch/session-workflow-patterns.md` — the canonical 10 patterns from Wave 7 overnight work (sub-agent dispatch, code-reviewer always before push, Codex loop, parallel audit agents, worktree isolation, etc.). Read once at session start if you have not seen them before; the Fix Protocol below is the day-to-day version.

Write rules (binding even though the tables now live elsewhere): see Findings Discipline above and Launch Plan Update above.

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
