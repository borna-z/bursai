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

## Codex round 7 — structural state-machine pass + end-to-end worker verification (2026-04-17)

Round 7 landed three fixes (two from Codex findings, one from the
structural review) and added `supabase/functions/_shared/__tests__/render-state-machine.md`
documenting the P5 lifecycle as a branch-by-branch state machine.

### Fixes in this round

- **Track A / Bug 1 — render_garment_image finally-block release on internal.**
  Pre-fix the `!consumed` finally branch released the reservation on
  every non-consume exit, including internal (P5 worker) retry attempts.
  That broke Interpretation A: first transient failure released the
  reserve, subsequent retry's consume_credit_atomic hit
  `already_terminal`, the user got a free render. Fix: gate the release
  with `!isInternalInvocation && !consumed`. Worker owns release
  decisions at final failure.
- **Track A / Bug 2 — skipped responses misclassified as retryable failures.**
  `render_garment_image` returns `{ok:true, skipped:true, reason}` for
  legitimate eligibility skips (quality gate reject, gemini_no_image,
  already-rendered-without-force, etc). Pre-fix `invokeRender` treated
  every 200-without-path as an unknown failure → retried until
  `attempts=max` → terminalized as 'failed' with garment state
  overwritten. Fix: extend `RenderResult` with a skip variant, add a
  worker branch that releases the reservation (no consume was written
  → reserve would orphan) and flips the job to 'succeeded' with
  `result_path=null` WITHOUT touching `garments.render_status`.
- **Track B / Finding T-1 — `deferred` response for concurrent in-flight.**
  Surfaced in the structural review (see
  `render-state-machine.md` Scenario 13). The Track A Bug 2 skip-release
  path would fire for `garments.render_status='rendering'`, which is
  the signal that ANOTHER worker attempt is mid-Gemini. Releasing the
  reservation there races with the in-flight consume → user paid
  nothing, got the render. Fix: `render_garment_image` now returns
  `{ok:true, deferred:true, reason}` for the 'Already rendering' early
  return (and for claim-lost paths when the latest garment state is
  'rendering'). Worker has a new `deferred` branch ABOVE skip that
  resets the job to pending WITHOUT writing release, WITHOUT touching
  garments, and WITHOUT decrementing attempts.

### End-to-end preview-branch verification

Preview branch `walcgspruzwfnfxnygnd` (ephemeral, deleted, cost < $0.01).

**Test harness:**
1. Applied P3 render-credit schema + RPCs (reserve/consume/release
   `*_credit_atomic`) and P5 `render_jobs` + `claim_render_job` +
   `recover_stale_render_jobs` via MCP `apply_migration` (stripped
   pg_cron schedule and the pg_net extension because preview cron
   would target production's project_ref).
2. Deployed the real `process_render_jobs` (HEAD of
   `prompt-5-render-queue` post-round-7 fixes) with a preview-only
   auth bypass on the inbound `timingSafeEqual(authHeader,
   serviceRoleKey)` check — MCP doesn't expose the service-role key,
   so external invocation couldn't satisfy it. The worker's *outbound*
   call to `render_garment_image` still uses
   `Deno.env.SUPABASE_SERVICE_ROLE_KEY` which Supabase auto-populates
   on deploy, so the callee side is byte-identical to production.
3. Deployed a stub `render_garment_image` that branches on
   `body.source` (forwarded from `render_jobs.source`):
   - `__test_transient`: returns 500 when `job.attempts ≤ 1`, returns
     a rendered-path + writes `consume_credit_atomic` otherwise.
   - `__test_skip`: returns `{ok:true, skipped:true, reason:"stub skip reason"}`.
   - `__test_defer`: returns `{ok:true, deferred:true, reason:"Already rendering"}`.
4. Seeded three users / profiles / garments / render_credits
   (monthly_allowance=20) / render_jobs / reserve transactions —
   one per scenario. Garments were set to the render_status the
   scenario requires (`'pending'` for transient, `'ready'` with path
   for skip, `'rendering'` for defer).
5. Invoked the worker via HTTP POST to the preview's
   `/functions/v1/process_render_jobs` endpoint twice (first with
   `{jobId}` hint, second with `{}`).

**Per-scenario results:**

#### Scenario 1 — Transient-then-success (Track A Bug 1)

```
Invoke 1 (worker claims attempts=1, stub returns 500):
  results: [{"jobId":"a1...","status":"retry","error":"stub transient failure"}]
  render_jobs: status=pending, attempts=1, error_class='unknown'
  txs: [reserve]    ← NO release (the critical fix)
  credits.reserved=1  ← reservation preserved
  garments.render_status=pending  (unchanged)

Invoke 2 (worker claims attempts=2, stub returns 200 rendered + writes consume):
  results: [{"jobId":"a1...","status":"succeeded"}]
  render_jobs: status=succeeded, attempts=2, result_path='stub-rendered-retry.webp'
  txs: [reserve, consume]
  credits: used_this_period=1, reserved=0
  garments: render_status=ready, rendered_image_path='stub-rendered.webp'
```

**PASS**: 1 reserve, 1 consume, 0 release. Credit correctly charged
once, render succeeded on attempt 2. Pre-fix would have written a
release tx in the first invocation's retry branch → the second
invocation's consume would have hit `already_terminal` → free render.

#### Scenario 2 — Skipped response terminalizes (Track A Bug 2)

```
Invoke 1 (worker claims, stub returns {skipped:true}):
  results: [{"jobId":"b2...","status":"succeeded_skipped"}]
  render_jobs: status=succeeded, attempts=1, result_path=NULL
  txs: [reserve, release]
  credits.reserved=0 (release decremented)
  garments: render_status=ready, rendered_image_path='prior-render.webp'  (UNCHANGED)
```

**PASS**: Skip terminalizes with exactly one release tx, no consume,
garment state preserved verbatim. Pre-fix would have retried the
skip response twice more, terminalized as 'failed' on attempt 3,
and overwritten the garment's prior 'ready' state to 'failed'.

#### Scenario 3 — Deferred response keeps pending, no release (Track B Finding T-1)

```
Invoke 1 (worker claims attempts=1, stub returns {deferred:true}):
  results: [{"jobId":"c3...","status":"deferred_in_flight"}]
  render_jobs: status=pending, attempts=1
  txs: [reserve]   ← NO release (the critical fix)

Invoke 2 (worker re-claims, stub still returns {deferred:true}):
  results: [{"jobId":"c3...","status":"deferred_in_flight"}]
  render_jobs: status=pending, attempts=2
  txs: [reserve]   ← still no release
  credits.reserved=1
  garments.render_status=rendering  (unchanged)
```

**PASS**: Each invocation keeps the job in `pending`, writes no
credit tx, leaves the garment alone. Attempts increments on each
claim but is never decremented (by design per T-1 Scenario 13 in
the state-machine doc — ensures the job can't churn indefinitely;
attempts=max eventually falls to the round-5 heal gate which catches
any orphaned consume). Pre-fix (round-7 Track A without T-1) would
have released the reservation on each invocation, racing with the
concurrent in-flight consume.

### Invariants validated on the same run

- **I1 (one reserve per job):** all three scenarios end with exactly
  one reserve tx per `render_job_id`.
- **I2 (at most one terminal per terminal job):** S1={consume},
  S2={release}, S3=nothing (still pending). No job has both consume
  and release.
- **I3 (no release-after-consume):** S1 has consume, never got
  release.
- **I4 (no terminal without reserve):** every terminal (consume or
  release) was preceded by the scenario's reserve.
- **I5 (status reflects intent):** S1 succeeded with a path, S2
  succeeded with `result_path=null` (skip intent), S3 pending
  (deferred, truly undecided).
- **I7 (no premature release on in-flight):** S3 never wrote release
  despite two defer cycles.
- **I8 (attempts monotonic except on round-5 defer):** S1 attempts
  went 0→1→2 (two claims). S3 attempts went 0→1→2 (two claims, no
  decrement — T-1 design). No rewinds.

### What this verification does NOT cover

- **Real Gemini end-to-end.** Preview branches can't share the
  GEMINI_API_KEY env var, so render_garment_image ran as a stub that
  simulates the three response shapes. The worker's outcome parsing
  and DB writes are exercised with real Supabase-js + real
  RPC-mediated ledger semantics, which is where the round-7 bugs
  lived. Track A Bug 1 (render_garment_image finally-block release
  guard) is strictly inspected at code-review — the preview
  verification covers the worker-side state machine that Bug 1's fix
  was protecting.
- **render_garment_image's own `Already rendering` detection.** The
  real function's line-693 early-return now emits `deferred:true`
  (was `skipped:true`). Tested at code-review + type-check level.
  The preview stub emits the post-fix shape directly to exercise
  the worker's deferred branch.
- **Concurrent claim race (Scenario 12 in state-machine doc).**
  `FOR UPDATE SKIP LOCKED` is a PostgreSQL invariant; not
  re-verified here (round-1 already did).

Preview branch deleted. Cost: < $0.01.

## Codex round 8 — deferred-terminal gate + cron HTTP timeout (2026-04-17)

Two findings from round 8, both real, both fixed.

### Bug 1 — Deferred branch allows infinite loop if garment stuck in `rendering`

Round 7's `deferred_in_flight` branch reset the row to `'pending'` and
returned early, never reaching the `isFinal` gate. `claim_render_job`
still bumped `attempts` on every cycle, but without a terminal check
the job re-queued forever. A garment stuck in `render_status='rendering'`
(e.g. an isolate that crashed between `claimGarmentRender` and any
cleanup path) would block that job's reservation indefinitely.

Fix: gate the deferred branch on `attempts >= max_attempts`. When the
gate trips, reuse the round-5 heal logic first — if a consume tx
exists for this job_id, the concurrent render eventually completed and
the worker should heal to `'succeeded'`. Otherwise: `releaseCredit`,
`render_jobs.status='failed'` with `error_class='stuck_in_flight'`,
flip the garment's `render_status` to `'failed'` with a user-visible
message. See `render-state-machine.md` Scenarios 13b and 13c.

### Bug 2 — Cron HTTP timeout too short for worst-case batch

`timeout_milliseconds := 50000` on the pg_cron schedule couldn't cover
a full worker batch. `MAX_JOBS_PER_RUN=5` with `JOB_CONCURRENCY=2` and
an `invokeRender` timeout of 45s runs up to ~135s serial-batch-time
plus RPC overhead. Under steady load, cron would cut off partway
through, log `cron.job_run_details.status='failed'`, and the next
cron tick (+60s) would start a second worker invocation on top of the
still-running first — two workers contending for pending rows.

Fix: raise `timeout_milliseconds` to `180000` in
`supabase/migrations/20260417180000_priority_5_render_queue.sql`.
Migration not yet merged to `main` (PR #421 is the merge target), so
the edit is applied in place on the original migration file rather
than via a follow-up migration. Verified idempotency: the migration
is still `CREATE TABLE` / `CREATE OR REPLACE FUNCTION` /
`SELECT cron.schedule(...)` throughout, all safe to run as part of
the first forward push.

### Scenario — Stuck `rendering` garment terminalizes at max_attempts

Preview branch: `ctypevbmedgstoeadgwd` (ephemeral, deleted, cost < $0.01).

**Setup:**
- User U = `dddddddd-...`, monthly_allowance=20, reserved=1
- Garment G = `eeeeeeee-...`, `render_status='rendering'` (the ghost —
  never completes, nothing will ever write a consume for this job)
- `render_jobs` J = `d4444444-...`, `status='pending'`, `attempts=0`,
  `max_attempts=3`, `source='__test_defer'`
- 1 reserve tx keyed on `reserve:stuck`

Deployed process_render_jobs with the round-8 deferred-terminal gate
(inlined flat, no withConcurrencyLimit — still exercises the gate
logic). Deployed stub render_garment_image that unconditionally
returns `{ok:true, deferred:true, reason:'Already rendering'}` for
`source='__test_defer'`.

**Three sequential invocations (`curl -X POST /functions/v1/process_render_jobs {"jobId":"..."}`):**

```
Cycle 1: {"status":"deferred_in_flight"}  (attempts bumped to 1 by claim)
Cycle 2: {"status":"deferred_in_flight"}  (attempts bumped to 2)
Cycle 3: {"status":"failed_stuck_deferred"}  (attempts bumped to 3, gate fires)
```

**Post-state (after cycle 3):**

```
render_jobs:
  status        = failed
  attempts      = 3
  error         = "Deferred to in-flight render that did not complete after 3 attempts"
  error_class   = stuck_in_flight
  locked_until  = null

render_credit_transactions (for job):
  [reserve (reserve:stuck, monthly), release (release:<baseKey>, monthly)]

garments:
  render_status = failed
  render_error  = "Concurrent render did not complete"

render_credits:
  monthly_allowance = 20
  used_this_period  = 0   (user NOT charged)
  reserved          = 0   (release decremented)
```

Invariants: I1 ✓ (single reserve). I2 ✓ (single terminal = release).
I3 ✓ (no consume, no double-terminal). I4 ✓ (release found the
reserve). I5 ✓ (user not charged, garment shows definite failure).
I8 ✓ (attempts monotonic 0→1→2→3, terminalized at max per the
round-8 gate).

Pre-round-8 counterfactual: cycle 3 would also return
`deferred_in_flight`, reset to pending. Cycle 4 same. Cycle N same.
Reservation would never converge; user stuck with `reserved=1` in
perpetuity, garment stuck `'rendering'` in the UI.

### Cron timeout fix — code-inspection only

The `timeout_milliseconds := 180000` change in the migration file is
arithmetic, not empirical. Load-testing a 180s cron run on a preview
branch would require real Gemini + 5 live jobs + observing a full
worst-case scheduler cycle — not cost-effective. Verified the
migration file diff and the comment block explains the chosen value
(135s worst-case batch + 45s headroom).

Preview branch deleted. Cost: < $0.01.

## Codex round 9 — unreachable guard + P5-regression timeout (2026-04-17)

Two findings, both real, both fixed. One of them exposed a
methodological gap in round 7/8's preview-branch verification that
this doc records explicitly so we don't repeat it.

### Bug 1 — T-1 `deferred` branch was unreachable (CRITICAL)

`render_garment_image` has two `render_status === 'rendering'` checks
that both sit before the Gemini path:

- **Earlier guard** (`index.ts:611`) catches all three non-fresh
  states (`ready`, `rendering`, `skipped`) with a single
  `skipped:true` / `reason: "Already <state>"` return. Shipped
  pre-P5 when `skipped` was the only contract.
- **Round-7 duplicate guard** (old `index.ts:713`): my T-1 patch
  added a second `if (render_status === 'rendering')` block that
  returned `{deferred:true}`. Dead code — the earlier guard at line
  611 always returned first for the rendering case.

Net effect: internal (worker) invocations received `skipped:true`
instead of `deferred:true`. Round-7's Track A worker skip branch
then wrote a release tx + flipped render_jobs to 'succeeded'. The
real in-flight render eventually completed, its
`consume_credit_atomic` call hit the terminal-uniqueness guard
(release was already written) → returned `already_terminal` → no
consume tx written. User got the render, the ledger never charged
them. **Exact free-render bug T-1 was supposed to prevent**, live
in production-bound code from round 7 through round 8.

Fix: branch on `isInternalInvocation` inside the earlier guard at
line 611. Internal+rendering → `{deferred:true}`. Everything else
(external, or any non-rendering state) → preserves existing
`{skipped:true}` contract. Removed the now-redundant duplicate
guard with a comment explaining why.

### Bug 2 — T-3 now ships in P5, not as a follow-up

The state-machine doc listed T-3 (`GarmentConfirmSheet`'s 60s
polling budget) as a `[P5 follow-up]` for a standalone PR after
launch. Codex round 9 flagged that this classification was wrong:
the 60s budget is a P5-caused regression, not a standalone
improvement. Pre-P5, a failed render surfaced synchronously within
one request. Post-P5, a render can legitimately take minutes
(`max_attempts × 45s` + server retries + Gemini backoff). A 60s
UI-side false-fail invites the user to tap "Try again" → fresh
`clientNonce` → second reservation → double-charge. Must ship in P5.

Fix: extended `GarmentConfirmSheet`'s polling timeout to
`300_000` ms (5 minutes). Exported the value as
`RENDER_POLL_TIMEOUT_MS` so tests can assert it structurally. Added
`src/components/garment/__tests__/GarmentConfirmSheet.test.tsx` with
two assertions: value is `300_000` (not the pre-fix `60_000`), and
value covers the server's `max_attempts × invokeRender-timeout`
budget. Grepped `src/` for other hardcoded `60000` / `60 * 1000` in
the render path — only unrelated matches (day math, stale-indicator
formatting). SwipeableGarmentCard doesn't poll at all.

### Scenario — real-guard deferred test (post-fix behavior)

Preview branch: `umrgvhsjipphgpyarlra` (ephemeral, deleted, cost < $0.01).

Deployed render_garment_image containing the **real post-fix early
guard** (body parsing → garment fetch → branch-on-isInternalInvocation
at the 'rendering' check). The round-7/8 tests deployed a STUB that
returned `{deferred:true}` directly, skipping the guard entirely —
that's why the unreachability didn't surface. See methodology note
below.

Deployed process_render_jobs with the round-8 deferred-terminal
gate. Seeded a stuck garment (render_status='rendering') + pending
render_jobs + reserve tx.

Three sequential invocations. Each result includes a `calleeBody`
field capturing exactly what render_garment_image returned:

```
Cycle 1:
  status    = "deferred_in_flight"
  calleeBody = {ok:true, deferred:true, reason:"Already rendering"}

Cycle 2:
  status    = "deferred_in_flight"
  calleeBody = {ok:true, deferred:true, reason:"Already rendering"}

Cycle 3:
  status    = "failed_stuck_deferred"
  calleeBody = {ok:true, deferred:true, reason:"Already rendering"}
  release   = {ok:true, source:"monthly"}
```

render_garment_image correctly emits `deferred:true` (not `skipped:true`).
Worker's handleRenderJob takes the deferred branch on cycles 1 and
2, terminalizes on cycle 3 via the round-8 max-attempts gate.

### Counterfactual — pre-fix behavior (documents what Bug 1 actually was)

Same preview branch, same seeded state (reset after cycle 3:
render_jobs back to pending attempts=0, release tx deleted,
garments back to 'rendering', render_credits.reserved=1).

Re-deployed render_garment_image with the **pre-round-9 buggy
early guard** — no isInternalInvocation branching on the
'rendering' state. Invoked worker once:

```
Cycle 1 (BUGGY):
  status    = "UNEXPECTED_skipped_for_rendering_internal"
  calleeBody = {ok:true, skipped:true, reason:"Already rendering"}
```

The instrumented worker for this round traps `skipped:true` on an
internal+rendering case as an anomaly and does NOT actually release
(so the counterfactual stays clean for the next test). In **real
round-7/8 production worker code**, this response would have hit
the skip branch at handleRenderJob and written a release tx →
render_jobs.status='succeeded' → user's reservation freed → any
genuinely in-flight render eventually hits already_terminal on
consume = free render.

### Methodology — why rounds 7 and 8 didn't catch this

Rounds 7 and 8 deployed a STUB render_garment_image that switched
on `body.source` and returned the test's desired response shape
directly (`{deferred:true}` for `__test_defer`). The stub skipped
the body parsing + garment fetch + early guard code path. So the
test asserted "if the callee returns `{deferred:true}`, the worker
handles it correctly" — a valid test of the WORKER, but silent on
whether the REAL callee would ever emit `{deferred:true}` in the
first place.

**Rule for future rounds:** any state-machine scenario that
exercises the render_garment_image response contract MUST deploy
render_garment_image code containing the actual early-return
logic, not a stub that bypasses it. The test harness can still stub
Gemini / storage / consume — the guard logic must be real. Round 9
did this by deploying a subset-of-real render_garment_image that
includes body parsing, garment fetch, and the early guard, and
short-circuits before the Gemini section (which requires
GEMINI_API_KEY not present on preview). Sentinel responses at
post-guard positions trap any guard misses.

Applying this rule retroactively: round-7's Scenario 3 claim of
"PASS" was technically correct for what it tested but materially
misleading because what it tested wasn't the thing that mattered.
Round 9's scenario is the canonical deferred verification now.

Preview branch deleted. Cost: < $0.01.

## Codex round 10 — force flag plumbed end-to-end (T-2 resolved) (2026-04-18)

Pre-P5, `SwipeableGarmentCard.handleRender` called `render_garment_image`
directly with `force: true`. That's the only way Regenerate could reach
Gemini past the product-ready eligibility gate AND past the "already
ready" early return. Post-P5, SwipeableGarmentCard called
`enqueueRenderJob` instead; `enqueueRenderJob` didn't accept `force`,
`enqueue_render_job` didn't read it, `render_jobs` had no `force` column,
the worker didn't forward it. `render_garment_image` ran as non-force
on every queued invocation. For a user tapping Regenerate on an
already-rendered garment the response was
`{ok:true, skipped:true, rendered:true, renderedImagePath: <prior path>}`,
the worker's internal healing consume wrote a new consume tx against
the new job_id (user charged), the worker took branch b (renderedPath
present), and `render_jobs.status='succeeded'` landed with `result_path`
= the OLD prior path. User paid for a regenerate that produced nothing
new. The Regenerate button was silently broken.

### Fix (six layers, one flag)

1. **Migration** — added `force BOOLEAN NOT NULL DEFAULT false` to
   `render_jobs` and extended `claim_render_job`'s `RETURNS TABLE` +
   `RETURN QUERY` to include it. Edited in place on
   `20260417180000_priority_5_render_queue.sql` because the migration
   is still Local-only per `npx supabase migration list --linked`.
2. **enqueue_render_job** — parses `body.force` (default false),
   includes it in the `render_jobs` INSERT alongside the existing
   columns.
3. **process_render_jobs** — `ClaimedJob` type gets a `force: boolean`
   field; `invokeRender` payload now includes `force: job.force`.
4. **render_garment_image** — no change; `body.force` was already
   parsed in the shared body-parsing block (line ~472) and consumed
   by both the line-611 "already ready" early guard AND the line-1097
   `skip_product_ready` eligibility gate. The bug was that no
   internal caller ever sent a true value for it.
5. **client lib** — `enqueueRenderJob` accepts `options.force`, default
   false, forwarded in the request body (+ preserved through the
   nonce-retry branch).
6. **SwipeableGarmentCard** — `handleRender` now computes
   `const force = hasRenderedImage` and passes it to both the first
   call and the nonce-preserving retry. Regenerate path gets
   `force=true`; first-time generate (no prior render) stays
   `force=false`.

### Invariant I9 added

`enqueue_render_job.body.force → render_jobs.force → claim_render_job
returns it → process_render_jobs.invokeRender payload → render_garment_image
body.force`. No layer drops the flag. Any future queue refactor that
adds a layer must preserve `force` across it.

### T-2 resolved

State-machine doc's `T-2` entry was about this exact regression.
Reclassified from "NOT FIXED — needs product input" to "RESOLVED in
round 10." Scenario 7 rewritten to reflect the post-fix behavior.

### Preview-branch verification (real-guard + force-sensitive gates)

Preview branch: `qtehyreedtmqztuwudso` (ephemeral, deleted,
cost < $0.01).

Deployed render_garment_image containing the REAL post-round-9 early
guard AND a force-sensitive product-ready gate surrogate (no real
Gemini — a deterministic stub writes `stub-render-<timestamp>.webp`
on pass-through, plus the real consume RPC write). Deployed
process_render_jobs with the round-10 `force` forwarding.

Seeded two users with `monthly_allowance=20, reserved=1` each; both
garments at `render_status='ready', rendered_image_path='prior-render.webp'`.

**Scenario 1 — force=true regenerate:**

```
render_jobs.force = true
Worker invoke → callee received force=true
calleeBody = {ok:true, rendered:true, renderedImagePath:"stub-render-1776510555791.webp"}
forwarded_force = true  (confirms the worker actually sent it)

Post:
  render_jobs.status        = succeeded
  render_jobs.result_path   = stub-render-1776510555791.webp  ← NEW path
  render_credit_transactions = {reserve, consume}
  garments.rendered_image_path = stub-render-1776510555791.webp  ← OVERWROTE prior
  render_credits.used_this_period = 1, reserved = 0
```

Force=true bypassed the line-611 guard AND the product-ready gate,
reached the Gemini stub, wrote a new path + consume, worker
terminalized as succeeded with the new path. User charged exactly
once for a render they actually wanted.

**Scenario 2 — force=false counterfactual:**

```
render_jobs.force = false
Worker invoke → callee received force=false
calleeBody = {ok:true, skipped:true, reason:"Already ready", rendered:true, renderedImagePath:"prior-render.webp"}
forwarded_force = false

Post:
  render_jobs.status        = succeeded
  render_jobs.result_path   = prior-render.webp  ← OLD path
  render_credit_transactions = {reserve, consume}  (consume fired via healing path)
  garments.rendered_image_path = prior-render.webp  ← UNCHANGED
  render_credits.used_this_period = 1, reserved = 0
```

Force=false + render_status='ready' → line-611 early guard fired →
alreadyReadyBody returned with the prior path + healing consume wrote
a new consume tx for this job_id. Worker saw renderedImagePath in the
response → branch b succeeded with the OLD path. **This is the exact
pre-round-10 behavior Codex flagged: user charged for a regenerate
that did not produce a new image.** Post-round-10, this only happens
when the caller genuinely doesn't pass force (legitimate reconciliation,
not a regenerate). Regenerate requests now route through the
force=true path.

### Invariants validated

- **I1** ✓ both scenarios (1 reserve per job_id)
- **I2** ✓ both scenarios (1 consume terminal per job_id, no release)
- **I3** ✓ (no release after consume)
- **I5** ✓ (status reflects intent: S1 got new render, S2 got no new render)
- **I9 (NEW)** ✓ (force=true through six layers ending at stub Gemini
  path; force=false through six layers ending at line-611 skipped path)

Preview branch deleted. Cost: < $0.01.

## Codex round 11 — prior-render preservation + enqueue-failure recovery (2026-04-18)

Two findings, both real, both shipped.

### Bug 1 (CRITICAL) — Force-regenerate terminal failure was destroying existing renders

render_garment_image's `safeRestoreOrFailRender` correctly restored the
garment to its prior `ready + good.webp` state on force=true render
failures. But process_render_jobs's terminal-failure branch then
unconditionally UPDATEd `garments.render_status='failed'`, overwriting
that restoration. During a Gemini outage, a user with a working render
tapping Regenerate would: hit 3 consecutive provider errors → worker
reaches isFinal → overwrites restored state back to 'failed' → user
wakes up to a garment that was perfect yesterday now shown as broken.
Net-negative UX; Regenerate became worse than not having Regenerate
at all during outages.

Fix: worker reads the current garment state at terminal time. If
`render_status='ready' && rendered_image_path` is present (i.e.
safeRestoreOrFailRender ran AND the prior render is still intact),
SKIP the `render_status='failed'` UPDATE. `render_jobs.status='failed'`
still flips (UI/analytics can distinguish "latest render attempt
failed" from "garment has no render").

The preservation check reads actual garment state rather than
deriving behavior from the force flag. Robust to any future
restoration path that lands the garment in ready+path at terminal
time.

New **Invariant I10** added to render-state-machine.md. Scenario 3
split into 3a (first-time generate → garment correctly flipped to
failed) and 3b (force=true regenerate → prior render preserved).

### Bug 2 (MODERATE) — Enqueue failure left garment stuck in `pending`

`buildGarmentIntelligenceFields` sets `garments.render_status='pending'`
on the initial INSERT for render-enabled sources. If
`startGarmentRenderInBackground`'s enqueue fails AND the nonce-
preserving retry also fails (e.g. Supabase Edge Functions outage
+ network blip), no render_jobs row ever exists. Under P5
`resumePendingGarmentRenders` is a no-op (the queue owns durability
for enqueued jobs, but this job was never queued). The garment
would sit at `render_status='pending'` indefinitely.

Fix: new `resetGarmentRenderStateOnEnqueueFailure` helper in
`garmentIntelligence.ts`. Fires on both the nonce-retry-failed path
and the non-retryable fallthrough path. UPDATEs
`garments.render_status='none'` so the Studio photo button reappears
in the UI. 402 is intentionally excluded — pending is the intentional
state across a user's upgrade flow; resetting would silently drop
the regenerate intent mid-upgrade.

Three new unit tests at
`src/lib/__tests__/startGarmentRenderInBackground.test.ts` cover:
reset on retryable failure after retry exhausts; no-reset on 402;
no-reset when the retry itself succeeds.

New **Invariant I11** + new **Scenario 14** added to the doc.

### Preview-branch verification (real guard + real safeRestoreOrFailRender logic)

Preview branch: `spnctjhqocxblvsuhzmv` (ephemeral, deleted,
cost < $0.01).

Deployed render_garment_image containing:
- Real post-round-9 early guard
- Real `safeRestoreOrFailRender` semantics (restore on
  `isForce && priorRenderedPath`, otherwise mark failed)
- Gemini stub that ALWAYS fails (HTTP 500 body)

Deployed process_render_jobs with the round-11 terminal-preservation
check reading actual garment state at isFinal time.

Seeded two scenarios:
- S1: `garment.render_status='ready'`, `rendered_image_path='good.webp'`,
  `render_jobs.force=true`
- S2: `garment.render_status='pending'`, `rendered_image_path=null`,
  `render_jobs.force=false`

**S1 — force=true regenerate, 3 failed attempts:**

```
Cycle 1: retry (safeRestoreOrFailRender restored garment to ready+good.webp)
Cycle 2: retry (same)
Cycle 3: failed, preserved: true
         release tx written (user not charged)

Post-state:
  render_jobs.status           = failed
  render_jobs txs              = [reserve, release]
  garments.render_status       = ready           ← PRESERVED
  garments.rendered_image_path = good.webp       ← PRESERVED
  garments.render_error        = null
```

Worker's terminal-preservation check saw `render_status='ready' +
rendered_image_path='good.webp'` → skipped the failed-UPDATE. Prior
render intact.

**S2 — force=false first-time, 3 failed attempts:**

```
Cycle 1: retry (safeRestoreOrFailRender fell through to
                safeMarkRenderFailed because isForce=false)
Cycle 2: retry
Cycle 3: failed, preserved: false
         release tx written (user not charged)

Post-state:
  render_jobs.status           = failed
  render_jobs txs              = [reserve, release]
  garments.render_status       = failed          ← CORRECTLY FLIPPED
  garments.rendered_image_path = null
  garments.render_error        = stub Gemini failure
```

Preservation check saw no prior good render → executed the
failed-UPDATE. Correct behavior for first-time failure.

### Counterfactual — what the pre-round-11 code did

On S1 pre-fix, cycle 3's worker would have written
`garments.render_status='failed', render_error=<msg>` unconditionally,
overwriting safeRestoreOrFailRender's restoration from earlier cycles.
The user's "good.webp" render would have been lost to the UI even
though `rendered_image_path` column still held the prior value — the
`render_status='failed'` gate in the wardrobe UI would hide it.
Exactly the user-loss scenario Codex round 11 flagged.

### Invariants validated

- **I1** ✓ (single reserve per job)
- **I2** ✓ (single terminal = release, no consume)
- **I5** ✓ (user not charged; S1 garment shows prior render, S2
  garment correctly shows failure)
- **I10** ✓ **NEW** (prior good render preserved across terminal
  failure when restoration path ran)

Preview branch deleted. Cost: < $0.01.

## Codex round 12 — legacy pending cleanup + delete-cascade orphaned reserves (2026-04-18)

Two findings, both real, both shipped.

### Bug 1 (P1) — Legacy pending garments with no render_jobs row

Pre-P5 `startGarmentRenderInBackground` flipped
`garments.render_status='pending'` before calling render_garment_image
synchronously. Failed calls left the garment at 'pending'; the pre-P5
`resumePendingGarmentRenders` recovered them on app open. P5 replaced
that with the durable queue + made `resumePendingGarmentRenders` a
no-op — but the queue can't recover garments that were never enqueued,
which is the state of any garment already stuck at 'pending' at
deploy time.

**Production scope at authoring time** (project ref
`khvkwojtlkcvxjxztduj`): 3 garments at `render_status='pending'`, all
with `rendered_image_path IS NULL`. Safe to reset (no prior render
lost by the reset).

Fix: new one-time migration
`supabase/migrations/20260418000000_reset_legacy_pending_garments.sql`
that does a gated UPDATE setting `render_status='none'` AND
`render_error='Pre-P5 legacy pending state reset — retry to render'`
for every garment where `render_status='pending'` AND no
`render_jobs` row exists for it. Wrapped in a DO block that logs
the reset count via RAISE NOTICE for post-deploy verification. Also
defensively degrades to "reset every pending" if `render_jobs`
doesn't exist yet (preview-branch replay scenarios).

### Bug 2 (P1) — Garment delete orphans active reservations

`render_jobs.garment_id REFERENCES garments(id) ON DELETE CASCADE`, so
`DELETE FROM garments WHERE id=X` removes render_jobs rows for X. But
`render_credit_transactions` has no FK to `render_jobs` by design
(the ledger survives job-row deletion for historical queries). So a
naive delete leaves `reserve` transactions for X's jobs with no
matching render_jobs row, and `render_credits.reserved` stays
elevated forever — no worker can ever see the (now-deleted) job to
terminalize it. Over time, repeated delete-while-active-render
sequences would exhaust users' available credits.

Fix (three commits):

1. **Migration** — edited P5 migration
   `20260417180000_priority_5_render_queue.sql` (still Local-only,
   `migration list --linked` confirmed) to add a new RPC
   `release_reservations_for_garment_delete(p_garment_id UUID)`:
   - SECURITY DEFINER with an ownership gate (auth.uid() must match
     garment.user_id, or caller is service_role for admin tooling).
   - Iterates `render_jobs WHERE garment_id=X AND status IN
     ('pending','in_progress')` — for each, looks up reserve source,
     decrements `render_credits.reserved` (refunds to source-specific
     column), writes a release tx keyed by
     `release:garment_delete:<job_id>` (stable idempotent key).
   - Returns the released count for caller logging.

2. **Application wiring** — three delete sites updated:
   - `src/hooks/useGarments.ts` `useDeleteGarment` — canonical UI
     delete path. Calls RPC before DELETE; logs and continues on
     RPC failure.
   - `src/pages/AddGarment.tsx` `onReplace` — duplicate-replace flow.
     Same pattern.
   - `supabase/functions/seed_wardrobe/index.ts` — admin bulk wipe.
     Loops the per-garment RPC before the user-wide DELETE.

3. **Tests** — three new assertions in
   `src/hooks/__tests__/useGarments.test.tsx`:
   - RPC called with correct garment id before DELETE.
   - RPC error → DELETE still fires.
   - RPC throw → DELETE still fires.

### Preview-branch verification

Preview branch: `lljdzjegrdmpatpzewvc` (ephemeral, deleted, cost
< $0.01).

Applied the round-12 P5 migration + the Bug-1 cleanup migration.
Seeded three users:
- U1: legacy pending garment, NO render_jobs row (Bug 1 target).
- U2: pending garment WITH a render_jobs row (Bug 1 must NOT touch).
- U3: ready garment with an active pending render_jobs row + reserve
  (Bug 2 target).

**Bug 1 migration run:**

```
U1 (legacy pending, no job):  pending → none   ✓
  render_error = 'Pre-P5 legacy pending state reset - retry to render'
U2 (pending, has job):         pending → pending (unchanged) ✓
U3 (ready):                    ready → ready (unchanged) ✓
```

`NOT EXISTS` clause correctly scoped the UPDATE — pending garments
WITH render_jobs rows are left alone because the queue owns them.

**Bug 2 RPC (three auth paths):**

```
Service role path (seed_wardrobe):
  SET "request.jwt.claim.role" = 'service_role'
  → released_count = 1 ✓

Owner path (authenticated user):
  SET "request.jwt.claim.sub"  = '33333333-...'
  SET "request.jwt.claim.role" = 'authenticated'
  → released_count = 1 ✓ (uid_seen matched, role_seen='authenticated')

Unauthorized path (different user's garment):
  SET "request.jwt.claim.sub"  = '11111111-...'  (U1)
  attempting release on U3's garment
  → ERROR 'not authorized for garment cccccccc-...' ✓
```

**Bug 2 post-release + cascade delete:**

```
Post-release ledger:
  U3 txs              = [reserve, release]
  U3 release idem-key = release:garment_delete:c3333333-c333-c333-c333-c33333333333
  U3 render_credits.reserved = 0  (decremented from 1)

After DELETE FROM garments:
  render_jobs rows for c3333333 = 0  (cascade correctly wiped)
  ledger for c3333333            = [reserve, release]  (preserved)
  render_credits.reserved         = 0  (ledger balanced)
  true_orphans                    = 0  (reserve with no job AND no terminal)
```

**Counterfactual (pre-round-12 behavior reproduced):**

```
Fresh garment + reserve for U1. SKIP the release RPC. DELETE FROM
garments directly.

Post-delete:
  render_jobs rows remaining = 0
  ledger for that job        = [reserve]       ← no release (the bug)
  render_credits.reserved    = 1               ← stuck elevated forever
  true_orphans               = 1               ← the signature of the bug
```

Reproduces exactly the failure mode Codex round 12 Bug 2 described:
the user's reserved counter would stay elevated even though no active
job exists, and no normal worker path can release it.

### Invariants validated

- **I1** ✓ (single reserve per job for U2, U3, and the pre-delete
  window for U1's counterfactual job)
- **I2** ✓ (single terminal per job — release, no consume since the
  jobs never ran)
- **I12 (NEW)** ✓ (every delete path tested wrote a release before
  cascade; unauthorized callers rejected)

### Orphan-reservation cleanup cron reclassification

Pre-round-12, the orphan-reservation cleanup cron was listed as a
generic post-launch follow-up (T-9 in the state-machine doc). Round
12 promoted it to a **ship-within-two-weeks safety net**. Rationale:
the round-12 fix handles every CURRENT delete path in the codebase
(the three identified via grep), but admin SQL deletes bypass the
RPC entirely, and future code paths may add new delete sites. The
cron is defense-in-depth against those cases. Authoring-time memory
updated to reflect the new priority.

Preview branch deleted. Cost: < $0.01.

## Codex round 13 — atomic delete-with-release RPC (2026-04-18)

Codex round 13 found two real design flaws in round 12's two-step
"call release RPC, then DELETE" pattern:

- **Bug 1 (P1) — double-refund race:** two concurrent delete calls
  for the same garment could both pass the terminal check and refund
  the balance BEFORE either release insert committed. The
  `ON CONFLICT (idempotency_key) DO NOTHING` guard on the insert
  then silently dropped caller 2's insert, but the balance was
  already double-decremented. Net: user's available credit was
  destroyed without a durable record.

- **Bug 2 (P2) — split client-side transaction:** release RPC +
  DELETE were two separate round trips from the client. If release
  succeeded and DELETE failed (network, RLS, FK), active jobs stayed
  alive with their reservations terminalized. Worker's eventual
  consume hit `already_terminal` → free render.

### Round-13 fix: single atomic RPC

Replaced `release_reservations_for_garment_delete(p_garment_id)`
with `delete_garment_with_release_atomic(p_garment_id, p_user_id)`:

- **One PostgreSQL transaction** — release + DELETE commit together
  or roll back together. Closes Bug 2.
- **`PERFORM 1 FROM render_credits WHERE user_id = p_user_id FOR
  UPDATE`** serializes concurrent callers for the same user.
  Terminal-check + refund + insert happen INSIDE this lock, so
  caller 2 sees caller 1's release tx and skips the refund. Closes
  Bug 1.
- **`FOR UPDATE` on each render_jobs row during iteration** — blocks
  worker `claim_render_job` (whose `SKIP LOCKED` safely waits)
  during the release.
- **Authorization:** `auth.uid() = p_user_id` OR caller is
  service_role. Granted to `authenticated` + `service_role`.
- **Return shape:** `{ok:boolean, released_count:int,
  garment_deleted:boolean, reason?:text}`. `ok:true` +
  `garment_deleted:false` + `reason:'garment_not_found'` is
  idempotent success for retry-after-delete.

Round-12 RPC `release_reservations_for_garment_delete` dropped.
Three delete sites updated to call the new atomic RPC instead of
the two-step pattern:

- `src/hooks/useGarments.ts` `useDeleteGarment`
- `src/pages/AddGarment.tsx` `onReplace`
- `supabase/functions/seed_wardrobe/index.ts`

### Preview-branch verification — five scenarios

Preview branch: `tqanobmnvhqkwrhlprwy` (ephemeral, deleted,
cost < $0.01). Schema matches the post-round-13 P5 migration
(atomic RPC definition + GRANT to authenticated+service_role).

**Scenario 1 — Happy path single delete**

```
Pre:  garment + pending render_jobs + reserve tx, reserved=1
Call: delete_garment_with_release_atomic(g, u) as authenticated owner
Result: {ok:true, released_count:1, garment_deleted:true}
Post:  garment gone, render_jobs gone (cascade), ledger [reserve, release],
       reserved=0
```
PASS — single transaction wrote release + deleted garment. No orphans.

**Scenario 2 — Sequential double-delete (concurrent equivalent)**

```
Pre:   same as S1 for a different user+garment
Call #1: delete_garment_with_release_atomic → {ok:true, released_count:1,
         garment_deleted:true}
Call #2 (same garment id, after #1 committed):
         → {ok:true, released_count:0, garment_deleted:false,
            reason:'garment_not_found'}
Post:  exactly ONE release tx per job_id, reserved=0, garment gone
```
PASS — no double-refund. Second call returns idempotent-success. Under
true concurrency the render_credits FOR UPDATE lock serializes both
callers; the sequential test exercises the same terminal-check code
path caller 2 would hit after caller 1 commits.

**Scenario 3 — Atomicity on DELETE failure (FK violation rolls back release)**

```
Setup: CREATE TABLE s3_blocker (render_job_id UUID PRIMARY KEY
       REFERENCES render_jobs(id) ON DELETE RESTRICT); INSERT a row
       pointing at S3's render_jobs id. Now the CASCADE delete of
       render_jobs will fail with FK violation.
Call:  delete_garment_with_release_atomic(g, u)
Result: RAISE EXCEPTION 'update or delete on table "render_jobs" violates
         foreign key constraint "s3_blocker_render_job_id_fkey"'
Post:  ledger still [reserve] only (release was rolled back),
       reserved=1 (never decremented), garment still present,
       render_jobs row still present
```
PASS — full transaction rollback proves atomicity. Release did NOT
commit when DELETE failed. Closes Bug 2.

**Scenario 4 — Already-terminal tolerance**

```
Pre:   garment + pending render_jobs + reserve tx + a manually-written
       release tx with idempotency_key='release:s4-manual' (simulating
       a prior release that already fired via some other path),
       reserved=0
Call:  delete_garment_with_release_atomic(g, u)
Result: {ok:true, released_count:0, garment_deleted:true}
Post:  ledger [reserve, release] (the pre-existing release, no second),
       release tx count = 1 (not 2), reserved=0, garment gone
```
PASS — terminal-check inside the RPC correctly skipped the refund+insert
when a release already existed. No spurious second release tx. No
`already_terminal` error surfaced to caller.

**Scenario 5 — No active reservations**

```
Pre:   garment with no render_jobs row at all, reserved=0
Call:  delete_garment_with_release_atomic(g, u)
Result: {ok:true, released_count:0, garment_deleted:true}
Post:  garment gone, no ledger writes
```
PASS — RPC skips the release loop entirely when no active jobs exist
and proceeds to the DELETE.

### Invariants validated

- **I1** ✓ (single reserve per job across all scenarios)
- **I2** ✓ (single terminal per job — release only; S4's pre-existing
  release wasn't duplicated)
- **I3** ✓ (no release-after-consume)
- **I12 (REVISED round 13)** ✓ (delete and release are ONE atomic
  operation — S3's rollback proves it)

### What this verification does not cover

- **True concurrent double-delete under heavy load.** MCP
  `execute_sql` calls are serial. The terminal-check + FOR UPDATE
  lock is what provides concurrency safety; Scenario 2's sequential
  simulation exercises the same code path caller 2 takes after
  caller 1 commits. Production-load concurrency would require a
  multi-threaded test harness outside this verification's scope.
- **`authenticated` user attempting to delete another user's garment
  via a forged `p_user_id`.** The `auth.uid() = p_user_id` gate is
  tested in round 12's verification log (same check, unchanged).
- **Admin SQL deletes bypassing the RPC.** Unchanged failure mode
  from round 12; orphan-reservation cleanup cron (ship-within-2-weeks
  follow-up) is the safety net.

Preview branch deleted. Cost: < $0.01.
