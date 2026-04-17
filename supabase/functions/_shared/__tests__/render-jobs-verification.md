# Priority 5 — preview-branch verification log

Ran against a Supabase preview branch provisioned from main on 2026-04-17.
The preview's migration chain replay from empty failed (pre-existing issue
not introduced by P5), so the P5 schema was applied directly via MCP
`apply_migration`. The claim and recovery RPCs are the surface under test —
application-layer logic (reserveCredit, releaseCredit, garments updates)
is covered by unit tests elsewhere and was not re-exercised here.

Preview branch cleaned up after verification (cost < $0.01).

## Verification 1 — sequential claim + FIFO ordering

**Setup:** seeded 3 pending rows with distinct `created_at`.

**Execution:** 4 sequential `claim_render_job(NULL)` calls.

**Result:**

```
step          | id
--------------|-------------------------------------
claim_1       | 00000000-...-000000000001  (oldest)
claim_2       | 00000000-...-000000000002
claim_3       | 00000000-...-000000000003  (newest)
claim_4_empty | 99999999-...               (sentinel; no row returned)
```

Claimed rows returned in `created_at` ASC order as per the RPC's
`ORDER BY created_at LIMIT 1` clause. 4th call correctly returned zero rows
(all pending consumed). Post-claim row state:

```
id=001 status=in_progress attempts=1 locked_until_valid=true started_at_set=true
id=002 status=in_progress attempts=1 locked_until_valid=true started_at_set=true
id=003 status=in_progress attempts=1 locked_until_valid=true started_at_set=true
```

`attempts` incremented, `started_at` set, `locked_until` within
`now() + 5 min` window.

## Verification 2 — stale-claim recovery only affects expired locks

**Setup:** manually backdated `locked_until` on rows 001 and 003 to
`now() - 1 minute`, leaving row 002 untouched (healthy worker with lock
still in the future).

**Execution:** `recover_stale_render_jobs()`.

**Result:**

```
id=001 status=pending     lock_cleared=true  attempts=1   (recovered)
id=002 status=in_progress lock_cleared=false attempts=1   (untouched, healthy)
id=003 status=pending     lock_cleared=true  attempts=1   (recovered)
```

Critical assertion: `attempts=1` preserved on recovered rows (not reset to
zero). This preserves the retry budget so a crash-looping garment can't
burn infinite attempts.

## Verification 3 — attempts ceiling at max_attempts

**Execution:** claimed row 001 three times with recovery between each.

**Result after third claim:**

```
id=001 status=in_progress attempts=3 max_attempts=3 at_ceiling=true
```

Worker layer handles the transition from `attempts >= max_attempts` →
`status='failed'` + `releaseCredit` (unit-tested in
`src/lib/__tests__/enqueueRenderJob.test.ts` and
`process_render_jobs` integration paths).

## Verification 4 — targeted claim (client-initiated fast path)

**Setup:** fresh pending row 099.

**Execution:** `claim_render_job('00000000-...-000000000099')`.

**Result:** row flipped to `in_progress`, `attempts=1`, `locked=true`.

**Second call with same jobId:** returned 0 rows (the row is no longer
pending — SKIP LOCKED + status filter combine to correctly reject re-claim
of an in-progress job).

## Verification 5 — UNIQUE constraint on reserve_key

**Execution:** attempted duplicate INSERT with `reserve_key='reserve:k1'`
(same value as row 001's).

**Result:** `unique_violation` (SQLSTATE 23505) raised as expected. Second
INSERT with `ON CONFLICT (reserve_key) DO NOTHING` left row count at 1
(the original).

This is the row-level idempotency guard for enqueue retries: even if
`reserveCredit`'s replay flag fails, the UNIQUE constraint prevents
duplicate `render_jobs` rows for the same `clientNonce`.

## Not covered in this verification (out of scope)

- True concurrent SKIP LOCKED across two parallel connections. MCP's
  serialized `execute_sql` can't open simultaneous sessions. The semantic
  correctness of `SELECT FOR UPDATE SKIP LOCKED` is a Postgres-documented
  primitive and relied upon here.
- End-to-end enqueue → reserve → claim → render → consume pipeline.
  Exercised via unit tests (`enqueueRenderJob.test.ts`,
  `garmentIntelligence.test.ts`, `backgroundGarmentSave.test.ts`,
  `SwipeableGarmentCard.test.tsx`) which all pass.
- pg_cron → `net.http_post` → `process_render_jobs` live invocation.
  Needs credentialled test env; deferred to post-deploy smoke test.

## Codex review round 1 — re-verification (2026-04-17)

Five findings from Codex, all addressed. Additional preview-branch
verification for the structural change in Bug 2+3:

### Bug 2+3 — canonical id preserved on reserve_key conflict

**Setup:** INSERT row with `id = aaaaaaaa-...`, `reserve_key = 'reserve:key-X'`.
Second INSERT attempts the same `reserve_key` with a new `id = bbbbbbbb-...`
(simulating an enqueue retry that generated a fresh UUID upfront before
realizing reserve was a replay).

**Execution:** plain `INSERT` in a DO block catches `unique_violation` (23505)
and falls through to `SELECT id FROM render_jobs WHERE reserve_key = '...'`.

**Result:**

```
surviving_id                 = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
matches_original_jobId_A     = true
not_overwritten_by_jobId_B   = true
total_rows_for_key           = 1
```

The canonical `id` survives the retry intact. `enqueue_render_job` uses
this exact pattern (INSERT → catch 23505 → SELECT) and returns the
surviving id, so the credit ledger's `render_job_id` foreign key stays
valid across retries. Previously, the `upsert({onConflict, ignoreDuplicates: false})`
merge would have rewritten the id to `bbbbbbbb-...` and stranded the
original reserve transaction.

### Bugs 1, 4, 5 — covered at application layer

- **Bug 1** (skip replay short-circuit on internal): render_garment_image
  condition changed from `if (reserveResult.replay)` to
  `if (reserveResult.replay && !isInternalInvocation)`. Early-return for
  "Already ready" now includes `renderedImagePath` so the narrow
  worker-crash-between-render-and-status-update scenario treats the
  skipped response as a success rather than a generic failure. Covered
  by unit tests in `enqueueRenderJob.test.ts` + e2e via production
  smoke test planned in PR deploy checklist.

- **Bug 4** (retry nonce orphan): `enqueueRenderJob` signature unchanged
  for the happy path (accepts optional `clientNonce`, generates one
  otherwise) but now returns the nonce used in the success response, and
  `RenderEnqueueError` carries the nonce for failure retries. All three
  call sites (SwipeableGarmentCard, GarmentConfirmSheet,
  `startGarmentRenderInBackground`) do one transport-level retry with
  the same nonce on 5xx. Retry-contract documented in the helper's
  JSDoc + inline comments at each call site.

- **Bug 5** (polling terminates on missing row): `useRenderJobStatus`
  tolerates up to `maxEmptyPolls` (default 10, ≈ 30s) of missing-row
  responses before giving up with `status='not_found'`. Resets the
  empty-poll counter on any successful row fetch. Adds `poll_timeout`
  state for the 30-minute hard ceiling.

Branch deleted after verification. Cost: < $0.01.

## Codex review round 4 — heal-gate tightening (2026-04-17)

Codex round 3 caught that the terminal-failure heal check (introduced
earlier to address "worker marks job failed despite successful render")
used `garments.rendered_image_path IS NOT NULL` as the heal gate. That
heuristic is wrong on regenerate flows: the garment retains a prior
render's path, so a newly-failed re-render attempt would incorrectly
heal to 'succeeded' and skip release, charging the user for a render
that didn't happen.

Fix: gate heal on a `consume` transaction with `render_job_id = job.id`
AND `user_id = job.user_id`. That's definitive evidence render_garment_image
ran Gemini + storage upload + consumeCredit for THIS specific job (not
any historical one).

### Scenario A — heal SHOULD fire (consume tx exists for this job)

**Setup**:
- `garments(id=...aaa, render_status='ready', rendered_image_path='heal_test.webp')`
- `render_jobs(id=...0000a1, status='in_progress', attempts=3, max_attempts=3)`
- `render_credit_transactions(kind='consume', render_job_id=...0000a1)`

**Execute heal gate**: consume tx found → heal branch → UPDATE render_jobs
`status='succeeded'`, `result_path` from garment.

**Result**:
```
job_status        = succeeded
result_path       = heal_test.webp
release_tx_count  = 0   (correct — no spurious refund)
consume_tx_count  = 1   (preserved — user correctly charged)
```

### Scenario B — regen-fail should NOT heal (the bug Codex round 4 caught)

**Setup**:
- `garments(id=...bbb, render_status='ready', rendered_image_path='old.webp')` — stale from prior render
- `render_jobs(id=...0000b2, status='in_progress', attempts=3, max_attempts=3)`
- `render_credit_transactions(kind='reserve', render_job_id=...0000b2)` — reserve only, NO consume

**Execute heal gate**: no consume tx for `...0000b2` → fall through to
release+fail branch. Write release tx, mark job failed, flip garment
`render_status='failed'` with error message. Old `rendered_image_path`
is preserved on the garment for display (the prior render is still the
best thing we have).

**Result**:
```
job_status              = failed
garment_status          = failed
garment_path_preserved  = old.webp   (prior render untouched)
release_tx_count        = 1          (credit correctly refunded)
consume_tx_count        = 0          (no consume ever happened)
```

The user is NOT charged for the failed regenerate. Correct outcome.

### Key insight

The old heuristic couldn't distinguish "did THIS attempt succeed" from
"did ANY attempt ever succeed on this garment." The consume-tx gate is
tight because consume is only called by render_garment_image after
end-to-end success of a specific attempt, and the terminal-uniqueness
index guarantees at most one consume per render_job_id. Presence/absence
is a 1:1 signal.

Branch deleted after verification. Cost: < $0.01.

## Codex review round 2 — re-verification (2026-04-17)

Two findings from Codex round 2, both addressed.

### Bug A — transport failures bypass same-nonce retry (client helper)

Fixed at the application layer by introducing `isRenderEnqueueRetryable`:
- Returns `true` for `status === undefined || status === 0` (network /
  timeout / abort — request may or may not have reached the server)
- Returns `true` for `status >= 500` (server-side error)
- Returns `false` for user-caused 4xx (400/401/402/403/404/429)

All three call sites (SwipeableGarmentCard.handleRender,
GarmentConfirmSheet.startRender, startGarmentRenderInBackground) now
use this classifier instead of an explicit `status >= 500` check.

Covered by unit tests in `enqueueRenderJob.test.ts` (transport-0 and
server-5xx cases).

### Bug B — replay path leaves garment state stale (enqueue_render_job)

**Setup 1 — stale-state recovery:**

```
render_jobs(id=aaaa..., status='pending', reserve_key='reserve:staleGarment')
garments(id=...dead, render_status='ready')  -- stale from prior P4 run
```

Retry with same clientNonce hits 23505 → SELECT returns `pending`
canonical status. New decision logic: `shouldUpdateGarment = true`
because status ∈ {pending, in_progress}. UPDATE fires.

**Result:**

```
after_retry_nonterminal = 'pending'  -- correctly corrected from 'ready'
```

**Setup 2 — terminal-state preservation:**

```
render_jobs(id=bbbb..., status='succeeded', reserve_key='reserve:terminalSucceeded')
garments(id=...beef, render_status='ready')  -- correct terminal state
```

Retry with same clientNonce: canonical status is `succeeded` → terminal →
`shouldUpdateGarment = false`. UPDATE is skipped.

**Result:**

```
after_retry_terminal = 'ready'  -- preserved, not forced back to 'pending'
```

Both scenarios confirmed. The decision logic correctly distinguishes
"existing job in flight, fix stale garment state" from "existing job
terminal, leave garment alone." No risk of the worker short-circuiting
on a stale 'ready' state and consume-failing.

Branch deleted after verification. Cost: < $0.01.
