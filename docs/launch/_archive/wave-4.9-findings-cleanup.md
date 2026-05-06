## Wave 4.9 — Findings Cleanup (closing sub-wave, first application of Wave Closure Rule)

Wave 4.9 closes Wave 4 by draining every open Findings Log row attributable to Waves 0-3 + anything discovered during Wave 4-B / 4-C / 4.5 implementation. PR clusters below are the starting scope as of the rule's introduction (2026-04-23); the Wave 4.9 opening agent re-audits the Findings Log at entry and adds any newer open rows.

Each Wave 4.9 PR's Completion Log row carries the `[cleanup]` suffix for filterability.

---

### W4.9-A — Schema cleanup (biggest PR)

**Problem**
Four findings share the `garments` + `job_queue` tables and MUST ship together because they interlock: drop a column that a gate still reads → gate breaks at runtime; drop the column without backfilling `enrichment_status` spelling → helpers silently see partial data.

**Fix**
1. New migration `supabase/migrations/<ts>_drop_image_processing_columns.sql`:
   ```sql
   ALTER TABLE public.garments
     DROP COLUMN IF EXISTS image_processing_status,
     DROP COLUMN IF EXISTS image_processing_provider,
     DROP COLUMN IF EXISTS image_processing_confidence,
     DROP COLUMN IF EXISTS image_processing_error,
     DROP COLUMN IF EXISTS image_processed_at,
     DROP COLUMN IF EXISTS processed_image_path;
   DELETE FROM public.job_queue WHERE job_type = 'image_processing';
   ```
2. New migration `supabase/migrations/<ts>_backfill_enrichment_status.sql`:
   ```sql
   UPDATE public.garments SET enrichment_status = 'completed' WHERE enrichment_status = 'complete';
   UPDATE public.garments SET enrichment_status = 'processing' WHERE enrichment_status = 'in_progress';
   ```
3. Remove the `image_processing_status !== 'ready'` gate line in `supabase/functions/_shared/outfit-scoring-body.ts` around line 467 (verify line number at edit time — shifting content may have moved it).
4. Update 3 frontend writers to emit canonical enrichment_status values:
   - `src/lib/garmentIntelligence.ts:437` — `'complete'` → `'completed'`
   - `src/pages/GarmentDetail.tsx:215` — `'complete'` → `'completed'`
   - `src/components/onboarding/QuickUploadStep.tsx:108` — `'complete'` → `'completed'`
5. Keep `isEnrichmentReady` helper's dual-spelling acceptance (shipped in P24) indefinitely as defensive programming — bounded cost, future-proofs against writer drift.
6. Pre-drop grep sweep: `grep -rn "image_processing_" src/ supabase/` must return zero non-migration matches before running the column-drop migration. Attach grep output to PR body.
7. Pre-drop backup: from Supabase SQL editor, run `COPY public.garments TO '/tmp/garments_backup_pre_4_9_a.csv' CSV HEADER;` and save the file off-server for 30 days.

**Files**
- `supabase/migrations/<ts>_drop_image_processing_columns.sql` (new)
- `supabase/migrations/<ts>_backfill_enrichment_status.sql` (new)
- `supabase/functions/_shared/outfit-scoring-body.ts`
- `src/lib/garmentIntelligence.ts`
- `src/pages/GarmentDetail.tsx`
- `src/components/onboarding/QuickUploadStep.tsx`

**Acceptance**
- `SELECT DISTINCT enrichment_status FROM garments` returns only `{completed, processing, pending, failed}` post-backfill.
- `SELECT column_name FROM information_schema.columns WHERE table_name='garments' AND column_name LIKE 'image_processing%'` returns zero rows.
- `SELECT count(*) FROM public.job_queue WHERE job_type = 'image_processing'` returns 0.
- Full `npx vitest run` passes; tsc/eslint/build clean.
- `deno check supabase/functions/burs_style_engine/index.ts` clean post-edit.

**Deploy** `burs_style_engine` (only runtime consumer of outfit-scoring-body whose behavior changes here).

---

### W4.9-B — Docs + i18n drift

**Problem**
Two doc-only findings bundled because both are zero-code-impact and share the "documentation maintenance" theme.

**Fix**
1. Fix LAUNCH_PLAN.md P8 spec column-name error (P8 Finding): the `.like("cache_namespace", ...)` reference in the P8 Fix section points to a column that never existed on `ai_response_cache`. Replace that code block with the TTL-decay mitigation comment that actually shipped in PR #652 + a pointer to the L554 schema change (PR #659) that fixed the underlying impossibility via a `user_id` column.
2. Remove 5 orphan `settings.avatar_*` i18n keys from all 14 locale files (cleanup B Finding). Keys: `settings.avatar_invalid`, `settings.avatar_too_large`, `settings.avatar_updated`, `settings.avatar_error`, `settings.change_photo`. Safe to delete — PR #654 removed the only caller (`ProfileCard.tsx` avatar upload path). The append-only rule in CLAUDE.md protects LIVE keys; dead ones can be removed.
3. Confirm via grep: `grep -rn "settings.avatar_" src/` returns zero matches post-edit.

**Files**
- `LAUNCH_PLAN.md` (P8 section body)
- `src/i18n/locales/en.ts` + `sv.ts` + 12 other locale files (14 total)

**Acceptance**
- `grep -rn "settings.avatar_" src/` returns zero matches.
- LAUNCH_PLAN.md P8 section no longer references a `cache_namespace` column.
- tsc/eslint/build clean; vitest passes.

**Deploy** None.

---

### W4.9-C — Observability hook: validator_unavailable fail-open

**Problem**
When `validateRenderedGarmentOutputWithGemini` fails open on attempt 1 (the "fail-open-on-first-attempt" path — shipped intentionally in Wave 3-B so a validator outage doesn't block rendering), there is no signal. Aggregate validator outages are invisible until user-facing render quality degrades. Wave 3-B Finding #8.

**Fix**
At the fail-open branch in `supabase/functions/render_garment_image/index.ts`, add:
```ts
Sentry.captureMessage('render_validator_unavailable', {
  level: 'warning',
  tags: {
    attempt: attemptIndex,      // 1, 2, or 3
    category: presentationClass,
    reason: classifiedReason,   // 'validator_fetch_failed' | 'validator_timeout' | 'validator_bad_response'
  },
});
```

Use the existing reason-classification code path (same variable names as current code — do not invent new ones). If classifiedReason is `undefined`, pass `'unknown'`.

**Files**
- `supabase/functions/render_garment_image/index.ts`

**Acceptance**
- Sentry DSN receives the new message type in a preview deploy (manually triggered via known-bad validator URL override).
- Tag values populate correctly.
- Production Sentry alert rule configured is a follow-up task, NOT a merge blocker.

**Deploy** `render_garment_image`.

---

### W4.9-D — P0c execution: Fix Protocol wording audit

**Problem**
P0c was scheduled at the start of Wave 0 as "verify the Fix Protocol section in CLAUDE.md is in place and adjust wording based on experience." It has been superseded multiple times since — the Launch Plan Update rule now lives inside Fix Protocol; the code-reviewer agent call is post-code pre-push, not gated. Some prose no longer matches current practice.

**Fix**
Read the Fix Protocol section of root CLAUDE.md end-to-end. For each bullet, confirm it reflects what we actually do today. Where prose diverges:
- Update wording to match current practice.
- Preserve section structure; don't reorganize.
- Leave correct rules untouched even if adjacent ones need edits.

Prose-only audit. No code, no migration.

**Files**
- `CLAUDE.md` (Fix Protocol section only)

**Acceptance**
- A new agent reading Fix Protocol for the first time finds instructions that produce the workflow we actually follow (Agent(code-reviewer) post-code pre-push, Launch Plan Update inside the fix PR, etc.).
- No unreferenced rules remain; no references to removed tools/workflows.

**Deploy** None.

---

### Wave 4.9 user-action items (checkbox list inside W4.9-A or W4.9-B PR body)

These are user tasks, not agent tasks. Tracking them here ensures nothing slips:

- [ ] Provision `SUPABASE_SERVICE_ROLE_KEY_TEST` in GitHub repo Settings → Secrets and variables → Actions (P0d-iv Finding). Until this lands, every push-to-main smoke-prod CI step fails loud by design (shipped in PR #653).
- [ ] In `C:\Users\borna\OneDrive\Desktop\BZ\Burs\bursai-working` (primary repo, NOT a worktree): `git merge --abort && git checkout main && git pull --ff-only`. Then list worktrees (`git worktree list`) and prune unused ones (`git worktree remove <path>`). Surfaced during P4 session (stale merge state from prior agent).
- [ ] Audit Supabase Dashboard → Edge Functions → Schedules for any entry targeting `calendar` or `sync_all`. If none present: `calendar.handleSyncAll` handler is dead code — file follow-up mini-PR to delete. P2 Finding.

---

