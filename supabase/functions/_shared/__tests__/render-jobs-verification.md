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
