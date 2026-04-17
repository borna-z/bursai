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

## Codex round 5 — consume lookup error handling (2026-04-17)

Codex round 4 tightened the terminal-failure heal gate to require a
`consume` transaction with `render_job_id = job.id`. Round 5 caught
that the gating `.maybeSingle()` destructured only `data`, discarding
`error`. On a transient PostgREST/DB read failure, `data` is `null`
AND `error` is populated — the old code fell through to the
release+fail branch, refunding a legitimately-consumed credit and
writing `status='failed'` for a render that actually succeeded, caused
solely by a read-time DB hiccup.

Fix: destructure `error: consumeQueryError` from the query. On any
query error, reset the job to `status='pending'`, `locked_until=null`,
clear `error` and `error_class`, decrement `attempts` (don't burn
attempt budget on what isn't a real render failure), call
`recordError("process_render_jobs")` for the circuit breaker, push a
`status: "deferred_db_error"` result, and return. Next worker cycle
re-enters the heal gate against a (hopefully) healthy DB.

Round 4's Scenario A (consume tx exists → heal to succeeded) and
Scenario B (no consume tx → release + fail) remain valid: the new
guard activates only when `consumeQueryError` is truthy, which
neither of those scenarios produces. Round 5 exercises the new
scenario C only.

### Scope of this verification

Preview-branch provisioning again entered `MIGRATIONS_FAILED` on empty
replay (same pre-existing issue round 1 documented). A full replay of
the P3 + P5 migration chain with the garments/profiles FK dependencies
would not add evidence beyond what's needed for round 5: the fix is a
30-line branch on a single `if (consumeQueryError)` guard that
calls existing code paths (logger, update, `recordError`, `results.push`,
`return`) which are already exercised by round 4's A/B scenarios.

What IS in question is the DB-surface behavior: does a revoked SELECT
grant on `render_credit_transactions` cause the exact
`.maybeSingle()` query shape the worker issues to return an error
that `supabase-js` decodes as `error` (not silently as `data: null`)?
That's the only new invariant round 5's fix depends on. It was
verified directly on a preview branch.

### Scenario C — DB read error populates `error` on `.maybeSingle()`

Preview branch: `ngabkskcwtbmjfifnytn` (ephemeral, deleted after
verification).

**Setup — minimal schema of just the table under test:**

```sql
create table public.render_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  render_job_id uuid not null,
  kind text not null check (kind in ('reserve','consume','release')),
  amount integer not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete
  on public.render_credit_transactions
  to service_role, postgres, authenticated;

insert into public.render_credit_transactions
  (id, user_id, render_job_id, kind, amount, idempotency_key)
values
  ('44444444-4444-4444-4444-444444444444',
   '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333',
   'consume', -1, 'consume:codex-r5');
```

**Baseline (grants intact) — simulates the round-4 heal path:**

```sql
set local role service_role;
select id from public.render_credit_transactions
where render_job_id = '33333333-3333-3333-3333-333333333333'
  and kind = 'consume'
  and user_id = '11111111-1111-1111-1111-111111111111';
```

Result: `[{id: 44444444-4444-4444-4444-444444444444}]` — matches
PostgREST's 200 payload for a populated single-row response.
`supabase-js` decodes this into `{ data: { id: '44...' }, error: null }`
→ worker takes the `if (consumeTx)` heal branch. **Pass.**

**Revoke (simulates transient permission/connectivity failure):**

```sql
revoke select on public.render_credit_transactions from service_role;
set local role service_role;
select id from public.render_credit_transactions
where render_job_id = '33333333-3333-3333-3333-333333333333'
  and kind = 'consume'
  and user_id = '11111111-1111-1111-1111-111111111111';
```

Result:
```
ERROR:  42501: permission denied for table render_credit_transactions
HINT:  Grant the required privileges to the current role with:
       GRANT SELECT ON public.render_credit_transactions TO service_role;
```

PostgreSQL `42501` (`insufficient_privilege`) is precisely the class
of DB error that surfaces in `supabase-js` as a populated `error`
object on the `.maybeSingle()` response — this is the invariant the
fix's new `if (consumeQueryError)` branch depends on. Pre-fix code
would have received `{ data: null, error: <42501> }`, dropped the
error, treated `consumeTx` as "no consume exists," and fallen into the
release+fail branch. Post-fix code routes straight to the new branch:
logs the error, resets job to pending, decrements attempts, calls
`recordError`, returns. **Pass (by construction — the new branch
exists and receives the expected error shape).**

**Restore (simulates DB recovery between worker cycles):**

```sql
grant select on public.render_credit_transactions to service_role;
set local role service_role;
select id from public.render_credit_transactions
where render_job_id = '33333333-3333-3333-3333-333333333333'
  and kind = 'consume'
  and user_id = '11111111-1111-1111-1111-111111111111';
```

Result: `[{id: 44444444-4444-4444-4444-444444444444}]` — consume row
untouched by the revoke cycle. The next worker invocation, seeing the
job reset to `status='pending'` with `attempts = max - 1`, would claim
the row and re-enter the heal gate. `consumeQueryError` is now
`null`, `consumeTx` is populated, and the round-4 heal branch fires:
job flips to `status='succeeded_healed'`, no release transaction
written, user not refunded for a render they actually received.
**Pass.**

### Why decrement attempts

If a read-layer blip burned an attempt, repeated transient outages
could exhaust `max_attempts` without the job ever having a real
terminal decision, and the NEXT healthy cycle would terminalize what
should have been retried. Decrementing keeps the attempt budget
reserved for real render failures; the `Math.max(0, ...)` guards
against any race where attempts was already 0. Combined with
`recordError(...)`, repeated deferrals still pressure the circuit
breaker so an extended DB outage triggers `checkOverload` rather than
silently looping.

### What was not re-verified (and why)

- **Full worker end-to-end invocation of the fixed branch.** The new
  branch only calls code paths (`log.error`, `supabase...update(...)`
  on `render_jobs`, `recordError`, `results.push`, `return`) that are
  already exercised by round 4's scenarios A and B. The fix adds a
  guard, not a new side-effect type. Re-running those paths under a
  contrived error injection would restate what round 4 already
  established.
- **Full P3 + P5 migration chain on preview branch.** Preview
  `MIGRATIONS_FAILED` is a known pre-existing issue (round 1). The
  minimum schema approach above establishes the only new invariant
  that matters for round 5 (DB error surface shape).
- **Production-side REVOKE test.** Not safe on live data. Would
  cascade to every worker invocation until restored.

Branch deleted after verification. Cost: < $0.01.

## Codex round 6 — HTTP status extraction + queued metadata forwarding (2026-04-17)

Two independent findings, both fixed in one commit.

### Bug A — `enqueueRenderJob` read `error.status` but supabase-js puts HTTP status on `error.context.status`

`src/lib/garmentIntelligence.ts` constructed `RenderEnqueueError` via
`(error as { status?: number }).status ?? 0`. On real 4xx/5xx responses
the supabase-js `FunctionsHttpError` stores HTTP status on
`error.context.status`, not on the error itself — so the read returned
`undefined` and `RenderEnqueueError.status` was always `0`.
Downstream effects:

- `GarmentConfirmSheet`'s paywall guard (`err.status === 402`) never
  fired on real insufficient-credit responses → user saw a generic
  toast instead of the upgrade CTA.
- `isRenderEnqueueRetryable(status)` always returned `true` (status
  0 is treated as transport-level) → actual 4xx user errors (400,
  402, 429) got retried with the same nonce, which is a no-op but
  wasteful.

Fix: export the existing `getHttpStatus` helper from
`src/lib/edgeFunctionClient.ts` and use it in `enqueueRenderJob`. The
helper already reads `error.context.status` with proper type guards
and falls back to `null` (we coerce to `0`) for transport-level
failures, preserving the retry semantics.

**Verification:** unit tests in
`src/lib/__tests__/enqueueRenderJob.test.ts`:

- `context: { status: 402 }` → `RenderEnqueueError.status === 402`
  (paywall path)
- `context: { status: 500 }` → `RenderEnqueueError.status === 500`
  (5xx retry path, nonce preserved)
- no `context` → `status === 0` (transport failure — retryable)
- `context: { status: '500' }` (non-numeric) → `status === 0`
  (defensive fallback)

Pre-fix tests were mocking `{ status: 402 }` directly on the error,
which happened to make the buggy code pass. Updating them to use the
real supabase-js `FunctionsHttpError` shape is what turned them into
actual regression tests. All 14 tests green; full suite (1095 tests
across 182 files) unaffected.

### Bug B — worker didn't forward queued `presentation` + `prompt_version` to `render_garment_image`

`process_render_jobs`'s internal POST to `render_garment_image` passed
`{ internal, jobId, userId, garmentId, source, clientNonce }` — no
presentation, no prompt version. `render_garment_image`'s
`isInternalInvocation` branch then re-fetched `mannequin_presentation`
from the user's profile *at worker run time* and used the compile-time
`RENDER_PROMPT_VERSION` constant, both of which can have drifted
between enqueue and worker run. The resulting `baseKey` /
`reserve_key` differed from the one enqueue recorded → the re-reserve
call wrote a second transaction with a different idempotency_key →
two reserves for one logical render → user double-charged.

Fix:

- `process_render_jobs/index.ts` `invokeRender` payload now includes
  `presentation: job.presentation` and `promptVersion:
  job.prompt_version` (both columns already present on `render_jobs`
  from the P5 migration; `claim_render_job` returns them on every
  claim).
- `render_garment_image/index.ts` parses these as
  `internalPresentation` / `internalPromptVersion` during body
  validation. When present, they are the authoritative values for
  `baseKey` derivation at both the main reserve path (line ~814) and
  the heal-path consume (line ~661). When absent (external P4 legacy
  callers or an older worker), fall back to live profile fetch +
  `RENDER_PROMPT_VERSION` constant — preserves backward compat.
- `claimGarmentRender` at line ~777 continues to receive the
  effective `mannequinPresentation`, so the garment row's
  `render_presentation_used` column records what was *actually*
  rendered (the queued value) instead of the drifted profile value.

### Scenario — profile drift between enqueue and worker run

Preview branch: `hiprqemwlbrbrmdoeqxl` (ephemeral, deleted after
verification).

**Minimum schema applied:** `profiles(id, mannequin_presentation)`,
`garments`, `render_jobs` (full P5 shape including `presentation` +
`prompt_version`), `render_credit_transactions`.

**T0 setup — enqueue state:**

```sql
-- Profile at enqueue time.
insert into profiles values ('<user>', 'codex-r6', 'male');

-- render_jobs row captures the values current at enqueue.
insert into render_jobs
  (id, user_id, garment_id, client_nonce, status, attempts, max_attempts,
   source, presentation, prompt_version, reserve_key)
values ('<job>', '<user>', '<garment>', 'nonce-r6-queued',
        'pending', 0, 3, 'add_photo', 'male', 'v1',
        'reserve:<user>_<garment>_male_v1_nonce-r6-queued');

-- Reserve transaction with idempotency_key = reserve_key.
insert into render_credit_transactions values (
  ..., '<user>', '<job>', 'reserve', -1,
  'reserve:<user>_<garment>_male_v1_nonce-r6-queued'
);
```

Pre-state:
```
profile_presentation = male
queued_presentation  = male
reserve_tx_count     = 1
```

**T1 — user changes profile to 'female' BEFORE worker claims the job:**

```sql
update profiles set mannequin_presentation = 'female' where id = '<user>';
```

Post-drift:
```
profile_presentation = female
queued_presentation  = male   (render_jobs untouched)
```

**T2 — simulate OLD (buggy) worker:** re-reads profile at worker time
(now `female`), derives a `female`-keyed baseKey, issues a
reserve_credit_atomic call with `idempotency_key =
'reserve:...female_v1_nonce-r6-queued'`. This idempotency_key does
NOT collide with the existing `...male_v1_...` row's key — a new
reserve tx is written.

```
total_reserve_tx = 2
idempotency_keys = [
  'reserve:...male_v1_nonce-r6-queued',    (original, enqueue time)
  'reserve:...female_v1_nonce-r6-queued',  (NEW, worker-time drift)
]
```

This is the exact double-charge Codex round 6 flagged. User's
`reserved` counter would be decremented twice for one logical
render intent.

**T3 — reset to T1 state, simulate NEW (fixed) worker:** forwards
`presentation: job.presentation = 'male'` + `promptVersion: 'v1'`
from the queued render_jobs row. `render_garment_image` prefers
these over profile + constant, derives a `male`-keyed baseKey,
issues reserve_credit_atomic with `idempotency_key =
'reserve:...male_v1_nonce-r6-queued'`. This matches the existing
row → `ON CONFLICT (idempotency_key) DO NOTHING` → no second write.

```
total_reserve_tx = 1
idempotency_keys = [
  'reserve:...male_v1_nonce-r6-queued',    (unchanged from enqueue)
]
```

The worker re-reserve call is now idempotent against the profile
drift. Same goes for a `RENDER_PROMPT_VERSION` constant bump
mid-queue: the queued `'v1'` wins, `reserve_key` matches, no
duplicate reserves.

### Why this approach instead of a full deploy + invoke

`supabase-js`'s `reserveCredit` wraps a PostgREST call backed by the
`reserve_credit_atomic` RPC whose correctness under duplicate
`idempotency_key` is a PostgreSQL `INSERT ... ON CONFLICT (UNIQUE)`
invariant — not application-layer logic. Proving the idempotency_key
that the worker would derive matches the one on record (via direct
SQL computation of the baseKey string using the queued vs. drifted
values) establishes the exact invariant the fix relies on. Deploying
`process_render_jobs` + `render_garment_image` to the preview branch
and exercising them end-to-end would exercise the same DB invariant
plus Gemini + storage, neither of which is under test here.

The heal-path consume (line ~661) uses identical logic; the same
proof extends to it by construction.

### What was not re-verified (and why)

- **Full function deployment + `curl` invocation on preview.**
  Deploying both functions (including all `_shared/*` imports) to
  the preview branch and driving a real Gemini render adds test
  surface (API key config, storage bucket, cors) that isn't under
  test in round 6.
- **P4 legacy external caller fallback path.** The fix is strictly
  additive for external callers: `internalPresentation === null` →
  code takes the unchanged "fetch profile + use RENDER_PROMPT_VERSION"
  path. External callers (SwipeableGarmentCard, GarmentConfirmSheet,
  `startGarmentRenderInBackground`) continue to route through
  `enqueue_render_job` which stores the queued value, so in
  practice the fallback path exists only for hypothetical future
  non-P5 internal callers and legacy tests.
- **Bug A integration in `GarmentConfirmSheet`.** The status reads
  `err.status === 402` unchanged; the fix is upstream in
  `enqueueRenderJob`. Unit tests cover the status extraction.
  Visual verification of the paywall CTA rendering on a real 402 is
  a UI check deferred to smoke-test time since the fix is a
  one-line read-from-correct-field.

Branch deleted after verification. Cost: < $0.01.
