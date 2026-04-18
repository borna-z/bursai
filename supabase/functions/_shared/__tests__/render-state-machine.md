# P5 Render Queue — State Machine

A branch-by-branch specification of the render lifecycle: what state each actor sees, what state they write, what invariants must hold. Written post-round-7, after the Track A fixes (internal release guard + skip terminalization) and the Track B fix (`deferred` response for concurrent in-flight).

This is the document you read when deciding whether a proposed change to P5 is safe. If a change violates one of the invariants or creates a new branch not listed here, update the doc first.

Scope: render_jobs + render_credit_transactions + garments, from user tap through worker completion.

---

## Terminology

- **Job**: one row in `public.render_jobs`. Identified by `render_jobs.id`. Carries the canonical job_id threaded through the credit ledger.
- **Logical render intent**: one user decision to render garment G. One logical intent should map to exactly one job and exactly one terminal credit transaction (consume OR release, never both, never neither once terminalized).
- **clientNonce**: caller-generated UUID. Combined with `user_id × garment_id × presentation × prompt_version` it forms the `baseKey`. The `reserve_key` is `reserve:<baseKey>` (UNIQUE on render_jobs) — same-nonce retries idempotently resolve to the original job.
- **Terminal**: a row is terminal when `render_jobs.status ∈ {'succeeded','failed'}`. Terminal jobs are never claimed again.
- **Internal invocation**: `render_garment_image` called by `process_render_jobs` with `{ internal: true, jobId, userId, presentation, promptVersion, ... }` + service-role Authorization. Skips rate-limit, skips JWT auth, treats reserve as replay-expected.

## State variables tracked throughout

Every branch below reports its effect on these three variables (plus any credit-tx writes):

| Variable | Domain |
|---|---|
| `render_jobs.status` | `'pending' \| 'in_progress' \| 'succeeded' \| 'failed'` |
| `render_credit_transactions` for this `render_job_id` | set of `{kind ∈ 'reserve'|'consume'|'release'}` rows |
| `garments.render_status` | `'none' \| 'pending' \| 'rendering' \| 'ready' \| 'failed' \| 'skipped'` |

Plus: `render_jobs.attempts`, `render_jobs.locked_until`, `garments.rendered_image_path`.

---

## Invariants (MUST hold at steady state)

**I1 — Exactly one reserve per job.** For any `render_job_id`, the set `{tx ∈ transactions : kind='reserve' ∧ render_job_id=id}` has size ≤ 1. Enforced by `render_jobs.reserve_key UNIQUE` + `reserve_credit_atomic`'s idempotency check on `idempotency_key`.

**I2 — Exactly one terminal per terminal job.** Once `render_jobs.status ∈ {'succeeded','failed'}`, there is exactly one row with `kind ∈ {'consume','release'}` for this `render_job_id`. Enforced by the partial unique index on `render_credit_transactions(render_job_id) WHERE kind IN ('consume','release')`.

**I3 — No release-after-consume (within the same job).** If a consume row exists for a job, release_credit_atomic must return `already_terminal` on any subsequent call. Enforced by `release_credit_atomic`'s pre-check for existing consume/release rows.

**I4 — No terminal without prior reserve.** Consume and release RPCs both SELECT the reserve tx by `render_job_id` before writing terminal. If no reserve is found, they return `no_reservation` (or equivalent). The worker must never call consume/release for a job that has no reserve.

**I5 — render_jobs.status reflects user-visible intent.** `'succeeded'` means the user got a render (or a legitimate no-op skip on an already-rendered garment). `'failed'` means the user did NOT get a render this job AND the reservation has been released. `'pending'`/`'in_progress'` means undecided.

**I6 — No more than one concurrent Gemini call per garment.** Even if two worker slots claim two different `render_jobs` rows for the same garment, only one should reach Gemini. Enforced by `claimGarmentRender` (flips `garments.render_status` to `'rendering'` atomically when prior was non-rendering).

**I7 — No premature release on an in-flight render; and no premature terminal-fail write when the release call itself races a late consume.** If a concurrent render is in progress (`garments.render_status='rendering'`) for this garment, the worker must NOT release the reservation — doing so would race with the in-flight consume. This is what the `deferred` response handles (round 7 structural review). Additionally, on **every `releaseCredit` call that precedes a `render_jobs.status='failed'` transition**, the worker MUST inspect the result: a `{ok:false, reason:'already_terminal'}` means a consume tx landed between the pre-release heal-gate check and the release RPC (a narrow TOCTOU window inside a single worker tick). The worker treats that result as evidence the concurrent render succeeded and heals to `status='succeeded'` with the garment's `rendered_image_path`, instead of writing the terminal `status='failed'` (+ `garments.render_status='failed'`) — which would overwrite the correct state the concurrent render just populated. Pre-heal, a narrow race could surface a successful render as "failed" in the UI AND destroy the result_path on the garment.

Rounds 15 and 16 added the post-release heal to the two existing terminal-release branches:
- `process_render_jobs/index.ts:~255` — **deferred-stuck at max_attempts** (round 15).
- `process_render_jobs/index.ts:~591` — **genuine terminal failure at max_attempts** (round 16).

The third `releaseCredit` call site in `process_render_jobs` — the skip-terminalization branch at `~399` — does NOT match this pattern (it precedes `status='succeeded'`, not `='failed'`). The fourth call site lives in the legacy P4-direct path of `render_garment_image` (`~1365`) and releases only for external, non-consumed invocations; no `render_jobs` row exists in that path so there is no `status='failed'` transition for the heal to protect. Any **new** `releaseCredit` call site that precedes a failed-status write MUST include this heal — enforced by code review against this invariant. The pre-merge "sanity checklist" near the end of this doc now includes the specific audit question.

**I8 — Attempts monotonic, no rewind except on the consume-query-defer path.** `claim_render_job` increments `render_jobs.attempts`. The only branch that decrements is the round-5 `deferred_db_error` path (read-layer outage on the heal gate). The `deferred_in_flight` path (round 7) does NOT decrement — the attempt is happening concurrently. **However, the deferred path terminalizes at `attempts >= max_attempts`** (round-8 gate): a garment stuck in `'rendering'` state for max_attempts cycles is treated as a ghost (isolate crashed without cleanup, no live render to wait for) and the job terminalizes as `'failed'` with release. Before hitting that terminal, the round-5 heal gate still applies — if a late-landing consume tx is present for the job, heal to `'succeeded'` instead.

**I9 — Force flag is preserved across every queue layer.** Round 10 added this invariant. `enqueue_render_job`'s request body carries `force` (default false). The value lands on `render_jobs.force` via the INSERT. `claim_render_job` returns `force` alongside the other row fields. `process_render_jobs` forwards `force: job.force` in its fetch-to-render_garment_image payload. `render_garment_image`'s body parsing reads `body.force` for BOTH external (P4 legacy) and internal (P5 worker) invocations; the flag gates both the line-611 "already ready/rendering/skipped" early return and the line-1097 product-ready eligibility gate. Net contract: what a caller passes at enqueue is the value the eligibility gates see at render time. Before round 10, P5 dropped the flag between enqueue and render_garment_image — regenerate requests silently no-op'd. Any future refactor that adds a new queue layer must preserve force through that layer or this invariant breaks.

**I10 — Terminal job failure never degrades a prior successful garment state.** Round 11 added this invariant. If `garments.render_status='ready'` with a non-empty `rendered_image_path` at the moment the worker decides terminal failure, the worker MUST NOT UPDATE the garment to `render_status='failed'`. The `render_jobs` row still flips to 'failed' (so the UI/analytics can distinguish "latest render attempt failed" from "garment has no render"), but the garment itself stays at 'ready' with its prior good path. This protects against destructive regeneration-during-outage scenarios: user with a working render taps Regenerate → Gemini is down → three attempts all fail → `safeRestoreOrFailRender` in render_garment_image has been restoring the prior path on each attempt → terminal handler used to overwrite that restoration back to 'failed' → user woke up to a garment that was perfect yesterday now broken. The preservation check reads the actual garment state, not the force flag: it's robust to any future restoration path that lands the garment in 'ready'+path at terminal time.

**I11 — Enqueue failure never leaves a garment stuck in `render_status='pending'` state, including business denials like 402.** Round 11 added this invariant; round 14 strengthened it to cover 402. `buildGarmentIntelligenceFields` sets `render_status='pending'` on the initial garment INSERT for studio-render flows. If `startGarmentRenderInBackground` exhausts its retries without ever creating a render_jobs row — network outage + retry also fails, OR 402 trial_studio_locked / insufficient_credits — the recovery path MUST reset `render_status='none'` so the garment isn't orphaned. `resumePendingGarmentRenders` is a no-op under P5 (the queue owns durability for enqueued jobs); pending state with no queued job can only occur in the enqueue-failure window, and that window must self-heal in `startGarmentRenderInBackground`'s own catch block. Round 11 initially excluded 402, reasoning the upgrade flow would re-trigger enqueue and pending preserved intent. That was wrong: 402 returns BEFORE any render_jobs row is written, so the worker has nothing to process, and nothing else self-heals the garment either. The post-round-14 UX is consistent: every terminal enqueue-failure path lands the garment in `'none'`, and the user re-triggers render from the wardrobe CTA (after upgrading, if 402 was the cause).

**I12 — Garment delete and reservation release are ONE atomic operation.** Round 12 introduced a two-step "call release RPC, then DELETE" pattern. Round 13 revised it to a single atomic RPC after Codex identified two real failure modes in the two-step design:

- **Double-refund race** — two concurrent delete calls could both pass the terminal check and refund the balance BEFORE either's release insert committed. The second insert then silently dropped on `ON CONFLICT (idempotency_key) DO NOTHING`, but the balance was already double-credited.
- **Split client-side transaction** — release committed but DELETE failed left active render_jobs rows alive with their reservations terminalized; the worker's eventual consume hit `already_terminal`, producing a free render.

The round-13 RPC `delete_garment_with_release_atomic(p_garment_id, p_user_id)` replaces the two-step pattern:

- Single PostgreSQL transaction. Either both release AND delete commit, or both roll back.
- `PERFORM 1 FROM render_credits WHERE user_id = p_user_id FOR UPDATE` serializes concurrent deletes for the same user. The terminal-uniqueness check runs AFTER the lock, so the second concurrent call sees the first's release tx and skips the refund+insert (no double-refund).
- `FOR UPDATE` on each `render_jobs` row during iteration prevents worker-concurrent mutation (claim_render_job's `SKIP LOCKED` safely skips while we hold the lock).
- Partial unique index `idx_render_credit_tx_terminal_unique` on `render_credit_transactions(render_job_id) WHERE kind IN ('consume','release')` is a secondary guard against double-terminal writes.
- Authorization: authenticated users can call for their own garments (auth.uid() = p_user_id); service_role bypasses for admin tooling. Granted to `authenticated` + `service_role`.
- Return shape: `{ ok: boolean, released_count: int, garment_deleted: boolean, reason?: text }`. `ok:true + garment_deleted:false + reason:'garment_not_found'` is idempotent success for retry-after-delete.

Every delete path (UI `useDeleteGarment`, `AddGarment.tsx` duplicate-replace, `seed_wardrobe` bulk wipe) calls this RPC and nothing else — no separate `.from('garments').delete()`. The orphan-reservation cleanup cron remains the safety net for admin SQL deletes that bypass the RPC.

**I13 — Client-side state resets on enqueue failure must verify server-side state first, not infer from a client-visible transport error.** Round 16 added this invariant. A retryable transport or 5xx failure does NOT prove the enqueue failed server-side: the server can complete the reserve + `render_jobs` INSERT and then return 5xx (or have its TCP connection drop) before the client sees a success response. Both the first attempt AND the nonce-preserving retry can land in that state — the server's `ON CONFLICT (reserve_key) DO NOTHING` + reserve-replay path makes the retry a no-op INSERT, still returning 5xx from the same crash point. If `startGarmentRenderInBackground`'s retry-exhausted catch block were to reset `garments.render_status='none'` based only on the client-side error, the user would see a "re-trigger" CTA, tap it, and fire a fresh enqueue with a new `clientNonce` → new `reserve_key` → **second reservation AND a second render_jobs row** for the same logical intent. The original row still ticks forward under the worker. Double-charge (two reservations held), wasted Gemini call (two renders for the same intent once the orphan row is eventually consumed).

The reset path MUST first query `render_jobs` directly: `(user_id, garment_id, reserve_key LIKE '%<clientNonce>')`. Suffix-match on the clientNonce is safe because UUIDs are globally unique — no client-side duplication of the server's `presentation` / `RENDER_PROMPT_VERSION` derivation needed. If a row is found, leave the garment's `render_status` alone — the durable worker owns it from here (worker drives it to 'ready' on success, or 'failed' via the round-11 / round-16 guards on terminal failure). If no row is found (genuine server-side failure), reset to 'none' per I11. If the query itself errors, fall through to the reset — the alternative (leaving garment at 'pending' indefinitely when we also can't reach the DB) is worse UX than the narrow double-charge case.

This invariant is specifically about the **retry-exhausted** branch of `startGarmentRenderInBackground`, where the first attempt hit a retryable failure (status 0/undefined/5xx). The 402 branch (I11) and the non-retryable fallthrough are not covered by I13 because 402 denial returns **before** any `render_jobs` INSERT (no row could exist), and non-retryable 4xx errors (400/401/403/404/429) likewise fail pre-INSERT on the server. 409 (`replay_terminal`) is a narrow edge case — the server-side check would find the row and skip the reset anyway — but the current code falls through to the generic reset; a future hardening pass may want to distinguish 409 from other non-retryable 4xx, out of round-16 scope.

---

## Actors + their state transitions

### Actor A — **enqueue_render_job** (client-initiated)

Entered from: `src/lib/garmentIntelligence.ts:109` via `SwipeableGarmentCard`, `GarmentConfirmSheet`, or `startGarmentRenderInBackground`.

Reads: `profiles.mannequin_presentation`, `garments.*`, existing `render_jobs` (UNIQUE conflict path).

Writes:
- `render_credit_transactions(kind='reserve')` via `reserve_credit_atomic`
- `render_jobs` row (pending, attempts=0, max_attempts=3, reserve_key=baseKey)
- `garments.render_status = 'pending'` (via `buildGarmentIntelligenceFields`'s `enableRender`, only when the render_jobs canonical is non-terminal)
- Fire-and-forget POST to `process_render_jobs` for low-latency worker kickoff

Exits:
- **Fresh insert**: `{jobId, status:'pending', source, replay:false}` → HTTP 200
- **Replay (same clientNonce hits UNIQUE 23505)**: SELECT existing row, return `{jobId: existing.id, status: <canonical>, source, replay:true}` → HTTP 200
- **Reserve denied (402)**: `{error: 'insufficient_credits'}` → HTTP 402; no render_jobs row written; reserve_credit_atomic returned ok:false with non-rpc reason
- **Reserve RPC transport error**: `{error: 'credit_ledger_unavailable'}` → HTTP 503; `recordError` fires
- **Body validation error**: `{error: ...}` → HTTP 400; no side effects

### Actor B — **process_render_jobs** (worker; cron + fire-and-forget)

Entered from: pg_cron every 60s (with `p_job_id=NULL`, oldest pending), or from enqueue's fire-and-forget POST (with the specific `p_job_id`).

Per invocation:
1. Call `recover_stale_render_jobs` RPC → resets any `in_progress` rows with expired `locked_until` back to `'pending'` (attempts unchanged).
2. If body carries `{jobId}` → claim that specific row; else loop `claim_render_job(NULL)` up to `MAX_JOBS_PER_RUN`, concurrency `JOB_CONCURRENCY`.
3. For each claim: call `invokeRender` (fetch to `render_garment_image` with internal + queued metadata). Handle outcome.

### Actor C — **render_garment_image** (callee; invoked by worker or external P4-legacy callers)

Entered from: worker (internal) or direct user-surface (external, P4 legacy path pre-queue).

Branches by early-return point, classified by `(garment.render_status, invocation kind)`:

### Actor D — **pg_cron** (infrastructure)

Schedule: every 60s, POST to `process_render_jobs` with `Bearer <vault.secrets.service_role_key>`. If vault secret is missing (one-time post-deploy step per migration comment lines 188–203), cron silently fails; fire-and-forget path from enqueue still works.

### Actor E — **credit ledger RPCs** (DB-side)

- `reserve_credit_atomic(p_user, p_job, p_amount, p_idem, p_source)` → writes reserve tx, bumps `render_credits.reserved`. Idempotent on `idempotency_key`; on replay returns `{ok:true, replay:true}`.
- `consume_credit_atomic(p_user, p_job, p_amount, p_idem)` → SELECTs existing reserve by `render_job_id`, checks no terminal exists, writes consume tx, decrements `reserved` and increments the appropriate used counter (monthly/trial/topup per reserve's source). Returns `already_terminal` if a consume or release already exists.
- `release_credit_atomic(p_user, p_job, p_idem)` → SELECTs existing reserve, checks no terminal exists, writes release tx, decrements `reserved`. Returns `already_terminal` if consume or release already exists. Idempotent on `idempotency_key` → on replay with same key returns `{ok:true, duplicate:true}`.

---

## Worker outcome table (post-round-7)

For each `invokeRender` return shape, what `handleRenderJob` does:

| renderResult shape | Branch | render_jobs action | credit-ledger action | garments action | result status |
|---|---|---|---|---|---|
| `{ok:true, deferred:true, reason}`, `attempts < max_attempts` | round 7 (pre-terminal) | `status='pending'`, clear `locked_until`, clear `error`, **attempts unchanged** (claim_render_job bumped it; leaving it bumped means we converge on max_attempts if the 'rendering' state is stuck) | none | none | `deferred_in_flight` |
| `{ok:true, deferred:true, reason}`, `attempts >= max_attempts`, consume tx **exists** | round 8 (heal at terminal) | `status='succeeded'`, `result_path=<garment.rendered_image_path>`, clear `locked_until` | none — consume already written by the (formerly in-flight) render | none | `succeeded_healed` |
| `{ok:true, deferred:true, reason}`, `attempts >= max_attempts`, no consume | round 8 (terminal) | `status='failed'`, `error='Deferred to in-flight render that did not complete after N attempts'`, `error_class='stuck_in_flight'`, clear `locked_until` | `releaseCredit` | `render_status='failed'`, `render_error='Concurrent render did not complete'` | `failed_stuck_deferred` |
| `{ok:true, skipped:true, reason}` | round 7 Track A | `status='succeeded'`, `result_path=null`, `completed_at=now()`, clear `locked_until` | `releaseCredit` (idempotent) | **none** — garment keeps its pre-skip state | `succeeded_skipped` |
| `{ok:true, rendered_image_path}` | original | `status='succeeded'`, `result_path=<path>`, `completed_at=now()` | none — render_garment_image already called consume | none — render_garment_image already wrote `render_status='ready'` + path | `succeeded` |
| `{ok:false, ...}`, `attempts < max_attempts` | retry | `status='pending'`, clear `locked_until`, `error=<msg>`, `error_class=<class>` | none | none | `retry` |
| `{ok:false, ...}`, `attempts >= max_attempts`, consume tx **exists** for job | heal (round 4) | `status='succeeded'`, `result_path=<garment.rendered_image_path>`, clear `locked_until` | none — consume already written by a prior attempt's successful Gemini call that the worker missed | none — garment already `'ready'` from prior attempt | `succeeded_healed` |
| `{ok:false, ...}`, `attempts >= max_attempts`, consume tx **does not exist** | terminal fail | `status='failed'`, `completed_at=now()`, `error=<msg>`, `error_class=<class>`, clear `locked_until` | `releaseCredit` | `render_status='failed'`, `render_error=<msg>` | `failed` |
| `{ok:false, ...}`, `attempts >= max_attempts`, consume-tx query errors | defer DB (round 5) | `status='pending'`, clear `locked_until`, `error/error_class=null`, `attempts = max(0, attempts-1)` | none | none | `deferred_db_error` |
| worker crash mid-processing (thrown) | crash | **no write this cycle**; stale recovery picks it up after `locked_until` expires (5min) | none | none | `worker_error` |

---

## 12 scenarios

Each scenario: trigger → pre-state → action → post-state → invariant check (references the invariants above). All use a canonical test user U, canonical garment G, canonical clientNonce C.

### Scenario 1 — Happy path

**Trigger:** User taps Studio photo. `SwipeableGarmentCard.handleRender` → `enqueueRenderJob(G, 'retry')`.

**Pre:** `render_jobs`: no row for (U,G,C). `render_credit_transactions`: 0 for this job_id. `garments.render_status`: `'none'`.

**Action:**
1. Enqueue: `reserve_credit_atomic` writes reserve tx. INSERT render_jobs (status='pending', attempts=0, reserve_key). Update `garments.render_status='pending'`.
2. Fire-and-forget POST to worker. Worker claims (attempts=1, status='in_progress', locked_until=now+5min). Calls render_garment_image internal.
3. render_garment_image: garment render_status is 'pending', `force` undefined. `claimGarmentRender` succeeds → `render_status='rendering'`. reserveCredit replays OK. Gemini runs. Storage write succeeds. `consume_credit_atomic` writes consume. garment.render_status='ready' + rendered_image_path. Returns 200 `{ok:true, rendered:true, renderedImagePath}`.
4. Worker invokeRender sees renderedPath → returns `{ok:true, rendered_image_path}`. handleRenderJob branch: succeeded. UPDATE render_jobs status='succeeded', result_path, completed_at.

**Post:** `render_jobs.status='succeeded'`. Credit txs for job: `{reserve, consume}`. `garments.render_status='ready'` with path.

**Invariants:** I1 ✓ (1 reserve). I2 ✓ (1 terminal: consume). I3 ✓ (no release). I5 ✓ (status reflects delivery). I6 ✓ (one Gemini call). I8 ✓ (attempts=1, monotonic).

### Scenario 2 — Transient Gemini failure, attempts < max

**Trigger:** Same as S1, but Gemini returns 500 on first try.

**Pre:** Same as S1.

**Action:**
1–2: Same as S1.
3. render_garment_image: Gemini returns 500 → `safeMarkRenderFailed`. Finally block: `!isInternalInvocation` is FALSE (we're internal), so **no release fires**. Returns 500 with error body.
4. Worker invokeRender sees `!res.ok` → returns `{ok:false, status:500, errorClass:'provider', errorMessage}`. handleRenderJob: `isFinal = (attempts=1 >= max=3)` is false. Retry branch: UPDATE render_jobs status='pending', locked_until=NULL, error=msg, error_class='provider'. recordError fires (provider class).
5. Next worker cycle (cron at +60s): claim bumps attempts=2. render_garment_image: garment.render_status was reset by `restorePriorState` in render_garment_image's catch to 'pending' (or 'none' if no prior success). claimGarmentRender succeeds. Gemini retries — success this time. Ledger: reserveCredit replays (idempotent), consume writes. garment.render_status='ready'.
6. Worker: same as S1 step 4.

**Post:** `render_jobs.status='succeeded'`, attempts=2. Credit txs: `{reserve, consume}` (single reserve preserved across retries — round-7 Bug 1 fix). `garments.render_status='ready'`.

**Invariants:** I1 ✓ (reserve idempotent). I2 ✓. I3 ✓. I5 ✓. I7 ✓ (no premature release on attempt 1 failure — this is the round-7 Bug 1 fix). I8 ✓.

### Scenario 3a — Terminal failure, first-time generate (no prior render)

**Trigger:** User taps Studio photo on a never-rendered garment. Gemini returns errors on all three worker cycles. `force=false`.

**Pre:** `render_jobs.status='pending'`, `force=false`, `garment.render_status='pending'`, `garment.rendered_image_path=null`. Credit txs: `{reserve}`.

**Action:** 3 cycles of claim → Gemini fail → reset to pending (attempts bumps 1→2→3). Fourth claim: `attempts=3`, hits `isFinal`. Heal gate: no consume tx exists. Genuine-failure branch: `release_credit_atomic` writes release tx. UPDATE render_jobs status='failed'. Worker's post-round-11 garment-preservation check reads the current garment state: `render_status='pending'` (not 'ready') AND no `rendered_image_path` → `hasPriorGoodRender === false` → UPDATE garments with `render_status='failed'`, `render_error=<message>`.

**Post:** `render_jobs.status='failed'`. Credit txs: `{reserve, release}`. `garments.render_status='failed'`, `garments.rendered_image_path=null`. User sees the failure state in their wardrobe, can manually retry.

**Invariants:** I1 ✓. I2 ✓ (terminal = release, 1 row). I3 ✓ (no consume). I4 ✓ (release finds reserve). I5 ✓ (user not charged, status reflects failure). I8 ✓. I10 ✓ (no prior good render to preserve → failure state correctly surfaced).

### Scenario 3b — Terminal failure, force=true regenerate with existing good render

**Trigger:** User has `garment.render_status='ready'` + `rendered_image_path='good.webp'`. User taps Regenerate → enqueue with `force=true`. Gemini returns errors on all three worker cycles (Gemini outage, provider returning 500s).

**Pre:** `render_jobs.status='pending'`, `force=true`. `garment.render_status='ready'`, `garment.rendered_image_path='good.webp'`. Credit txs: `{reserve}`.

**Action (post-round-11):**

1. Worker claims, invokes render_garment_image with `force=true`.
2. Inside render_garment_image: line-611 guard is bypassed (`!force` is false). Claim fires. Reserve replays. Gemini call → 500.
3. `safeRestoreOrFailRender(supabase, garment.id, {render_error}, context, priorRenderedPath='good.webp', isForce=true)` runs. Because `isForce && priorRenderedPath` → UPDATE garments `render_status='ready', rendered_image_path='good.webp', render_error=null` — garment is restored to the prior good state.
4. render_garment_image returns 500 to the worker.
5. Worker's invokeRender returns `{ok:false}` → handleRenderJob retry branch: UPDATE render_jobs status='pending'.
6. Repeat cycles 2, 3. Both fail with Gemini 500. Each cycle, safeRestoreOrFailRender re-restores the garment to 'good.webp' + ready.
7. Cycle 4: `attempts=3`, hits `isFinal`. Heal gate: no consume tx. Genuine-failure branch: `release_credit_atomic` writes release tx. UPDATE render_jobs status='failed'.
8. **Post-round-11 garment-preservation check** reads current garment state: `render_status='ready'` AND `rendered_image_path='good.webp'` (restored by step 6's safeRestoreOrFailRender). `hasPriorGoodRender === true` → SKIP the `render_status='failed'` UPDATE. Garment stays at 'ready' with the prior good render intact.

**Post:** `render_jobs.status='failed'` (so P10/P11 UI can show "latest regen failed"). Credit txs: `{reserve, release}`. **`garments.render_status='ready'`, `garments.rendered_image_path='good.webp'`** — prior good render preserved.

**Pre-round-11 counterfactual:** the terminal-failure branch unconditionally wrote `garments.render_status='failed'`, overwriting the restoration done by safeRestoreOrFailRender. User's existing "good.webp" render was destroyed during a Gemini outage they didn't cause. The Regenerate button was net-negative UX during outages — users lost their existing good renders.

**Invariants:** I1 ✓. I2 ✓. I3 ✓. I5 ✓ (user not charged; prior render still visible). I8 ✓. **I10 ✓ (prior good render preserved across terminal failure).**

### Scenario 4 — Worker crash after Gemini success, before DB status-write

**Trigger:** render_garment_image completes Gemini + writes garment.rendered_image_path + writes consume tx + returns 200, BUT the worker's Deno isolate crashes between receiving the 200 response and executing the `UPDATE render_jobs SET status='succeeded'`.

**Pre:** Mid-rendering. `render_jobs.status='in_progress'`, attempts=1, locked_until=now+5min. Credit txs: `{reserve}`. garments.render_status='rendering'.

**Action:**
1. Gemini succeeds. render_garment_image updates garment to 'ready' + path. Writes consume tx.
2. Worker crash — no status update.
3. `locked_until` expires after 5 min.
4. Next worker cycle: `recover_stale_render_jobs` resets render_jobs to 'pending' (attempts unchanged).
5. Next claim: attempts=2, in_progress. render_garment_image: garment.render_status='ready' + path. Takes `Already ready` branch. Healing consume call: `already_terminal` (consume already exists from step 1). Response includes `renderedImagePath` + `skipped:true`.
6. Worker invokeRender: renderedPath check fires FIRST → returns `{ok:true, rendered_image_path}`. Worker branch b: UPDATE render_jobs status='succeeded'.

**Post:** `render_jobs.status='succeeded'`, attempts=2. Credit txs: `{reserve, consume}` (healing consume hit already_terminal, no new row). `garments.render_status='ready'`.

**Invariants:** I1 ✓. I2 ✓. I3 ✓. I5 ✓ (user correctly charged). I6 ✓. I8 ✓.

### Scenario 5 — Worker crash AFTER Gemini success, BEFORE consume tx

**Premise check:** Can this happen? Looking at render_garment_image's sequence (lines ~1180–1295): Gemini → storage upload → update garment to 'ready' → call `consume_credit_atomic`. If the isolate crashes between the garment-UPDATE and the consume-RPC, we land here.

**Pre:** `render_jobs.status='in_progress'`. Credit txs: `{reserve}`. garments.render_status='ready' with path. No consume tx.

**Action:**
1. Stale recovery after 5min → render_jobs back to pending.
2. Next claim, attempts++. render_garment_image fetches garment: `render_status='ready'` + path. Takes `Already ready` internal branch. Healing consume call SUCCEEDS this time (no prior consume/release for this job_id). Writes consume tx. Returns `{ok:true, rendered:true, renderedImagePath, skipped:true}`.
3. Worker: renderedPath check fires → branch b succeeded.

**Post:** `render_jobs.status='succeeded'`. Credit txs: `{reserve, consume}`. garments.render_status='ready'.

**Invariants:** All ✓.

This is the precise scenario the "healing consume" for internal callers was designed to handle (render_garment_image line 625–681).

### Scenario 6 — Transient DB error on heal-gate lookup (round 5)

**Trigger:** Worker reaches `isFinal=true`, issues `.from('render_credit_transactions').maybeSingle()` to check for consume. PostgREST returns a transient error (e.g. connection blip, `permission denied` from a mid-runtime role-grant mishap).

**Pre:** `render_jobs.status='in_progress'`, attempts=max. Consume tx exists (prior attempt succeeded, worker crashed before UPDATE).

**Action:** Round-5 defer branch: log error, UPDATE render_jobs status='pending', locked_until=NULL, `attempts = max(0, attempts-1)`, clear error/error_class. `recordError` fires. Return `deferred_db_error`. Next worker cycle re-enters heal gate with healthy DB → finds consume → heal branch → succeeded_healed.

**Post (end-of-sequence):** status='succeeded', txs={reserve, consume}. Attempts decremented once (budget preserved across the DB blip).

**Invariants:** All ✓. I8 documented exception — attempts decrement is the ONLY rewind branch.

### Scenario 7 — User retry via P10 UI (fresh clientNonce)

**Trigger:** User taps "Regenerate Studio photo" some time after a prior render succeeded. UI generates a fresh clientNonce C2.

**Pre:** Prior job (C1) was terminal succeeded. Credit txs for C1's job: `{reserve, consume}`. `garments.render_status='ready'` with path from C1. `garments.rendered_image_path='prior.webp'`.

**Action (post-round-10):**
1. User taps "Regenerate" on `SwipeableGarmentCard`. `handleRender` sees `hasRenderedImage === true` → invokes `enqueueRenderJob(garment.id, 'retry', { force: true })`.
2. `enqueue_render_job` receives `body.force = true`. Derives new baseKey/reserve_key from clientNonce C2. reserve_credit_atomic writes a fresh reserve tx for new `render_job_id` J2. INSERTs render_jobs row J2 with `force=true`. garments.render_status unchanged (terminal-preservation in `shouldUpdateGarment`).
3. Worker claims J2. `claim_render_job` returns the full row including `force=true`. `invokeRender` payload now includes `force: true`.
4. render_garment_image internal invocation receives `body.force === true`:
   - Line-611 early guard: `!force` is false → SKIPS the Already-ready/rendering/skipped early return.
   - Product-ready gate (line ~1097): `!force` is false → SKIPS the `skip_product_ready` early return even if Gemini eligibility returns that decision.
   - Gemini runs → storage upload → garment.rendered_image_path set to the NEW path → consume_credit_atomic fires for J2.
5. Worker invokeRender sees renderedPath → worker branch b: UPDATE render_jobs status='succeeded', result_path=new path.

**Post:** render_jobs J2.status='succeeded', result_path=<new-render>. Credit txs for J2: `{reserve, consume}`. garments.rendered_image_path=<new-render> (replacing the old). User correctly charged once for this regenerate intent.

**Pre-round-10 counterfactual (the bug T-2 was):** `enqueue_render_job` didn't accept `force`. render_jobs had no `force` column. Worker didn't forward `force`. render_garment_image saw `force=undefined` → line-611 `!force && render_status==='ready'` fired → returned `alreadyReadyBody = {ok:true, skipped:true, rendered:true, renderedImagePath: <PRIOR path>}`. For internal invocations, a healing consume runs before the return (render_garment_image line ~625–681) writing a `consume` tx against the NEW render_job_id. The worker's invokeRender sees `body.renderedImagePath` is set → takes the renderedPath branch (branch b, NOT the skip branch) → marks render_jobs succeeded with `result_path = <prior path>`.

Net effect pre-fix: reserve+consume for J2 both wrote (user charged), but `garments.rendered_image_path` was NEVER overwritten — the response handed back the OLD path. User paid again for the regenerate AND got nothing new. That's the UX regression Codex round 10 surfaced.

The round-10 fix makes this Scenario's post-state match intent: Gemini runs, garment.rendered_image_path overwritten with a NEW render, consume tx written for J2, user charged once for the new render they actually wanted.

**Invariants (post-round-10):** I1 ✓ (single reserve). I2 ✓ (single consume per regenerate intent). I3 ✓. I5 ✓ (status reflects that user got a new render). **I9 — force preservation — NEW.**

**Pre-round-10:** T-2 finding was this exact scenario. Now resolved.

### Scenario 8 — Replay path (same clientNonce twice, e.g. transport retry)

**Trigger:** Enqueue fires with nonce C. Transport error (5xx / network). Client retries with same C.

**Pre:** Second call enters enqueue_render_job. Reserve has already been written on the first call (reserve_credit_atomic's idempotency_key hit → returns `{ok:true, replay:true}`). render_jobs row may or may not exist (depends on whether first call's INSERT committed).

**Action (two sub-cases):**
- **First call's INSERT completed:** second call's INSERT hits 23505 (UNIQUE on reserve_key). Catch branch SELECTs by reserve_key, returns `{jobId: existing.id, replay: true}`.
- **First call's INSERT rolled back pre-commit but reserve did commit (rare):** second call's INSERT succeeds. render_jobs row is fresh.

Both branches preserve canonical `render_jobs.id`. Caller's jobId matches. Polling uses this id.

**Post:** 1 reserve tx, 1 render_jobs row. I1 ✓.

### Scenario 9 — Skip response (eligibility / no-op)

**Trigger:** Garment already has a prior render (`render_status='ready'` + path) from a non-P5 path, OR quality gate rejects in a post-P5 render, OR Gemini returns no image. Worker picks up, calls render_garment_image.

**Action:** render_garment_image returns `{ok:true, skipped:true, reason:<non-rendering-reason>}` (without renderedImagePath). Worker invokeRender routes to skip branch.

`handleRenderJob` skip branch: release credit + UPDATE render_jobs status='succeeded' result_path=null. Does NOT touch garments.render_status.

**Post:** render_jobs.status='succeeded', result_path=null. Credit txs: `{reserve, release}`. garments.render_status unchanged.

**Invariants:** I1 ✓, I2 ✓ (terminal=release), I3 ✓, I5 ✓ (status='succeeded' means "the worker is done with this job," not "user got a new render" — the result_path=null disambiguates). I7 ✓ — skip reason is NOT 'Already rendering', which goes to the `deferred` path.

### Scenario 10 — Stale-claim recovery

**Trigger:** Worker crashed mid-processing. render_jobs row sits `in_progress` with expired `locked_until`.

**Action:** Next worker invocation runs `recover_stale_render_jobs` at the top. UPDATE rows where status='in_progress' AND locked_until<NOW() → set status='pending', locked_until=NULL, updated_at=NOW(). **Attempts NOT decremented** (by design — each claim/stale-recovery round counts as one attempt toward max_attempts; a render that repeatedly hits stale recovery IS a render worth giving up on after max_attempts).

**Post:** Row is claimable again. No side effects on credit ledger or garments.

**Invariants:** All ✓. Observation: "attempts" here means "claim attempts," not "Gemini-call attempts." With 3 max_attempts and aggressive stale recovery, effectively ~1.5–2 real Gemini retries under pessimistic scheduling.

### Scenario 11 — Profile drift between enqueue and execute

**Trigger:** User enqueues with `profiles.mannequin_presentation='male'`. Worker doesn't run for 30s. Meanwhile user changes profile to `'female'`.

**Pre (at worker time):** `render_jobs.presentation='male'`. `profiles.mannequin_presentation='female'`. Credit txs: `{reserve}` with `idempotency_key='reserve:<male baseKey>'`.

**Action (round-6 fix):** Worker's `invokeRender` payload forwards `presentation: job.presentation = 'male'` + `promptVersion: job.prompt_version = 'v1'`. render_garment_image's internal branch uses these as authoritative. baseKey derived with `male` → `reserveKey` matches existing → reserve_credit_atomic hits idempotency replay (no new reserve). Gemini runs with 'male' presentation.

**Post:** Credit txs: `{reserve, consume}` (1 reserve, round-6 fix verified). garment rendered with 'male' presentation (the queued intent).

**Invariants:** I1 ✓ (round-6 fix holds). I2 ✓. I5 ✓.

### Scenario 12 — Concurrent claim race

**Trigger:** Two worker invocations fire simultaneously (cron + fire-and-forget, or two cron overlaps).

**Action:** Both call `claim_render_job` which uses `SELECT FOR UPDATE SKIP LOCKED`. Only one wins the lock on a pending row. The other gets NULL → its loop iteration does nothing for this job.

**Post:** Exactly one worker processes the job. I6 ✓.

### Scenario 13 (bonus) — Concurrent in-flight render (round-7 structural finding)

**Trigger:** Worker 1 times out on Gemini (45s fetch abort). handleRenderJob resets render_jobs to pending. Meanwhile, render_garment_image's background Deno isolate is STILL running — its Gemini call (started at T+0) returns at, say, T+47s. Before the background completes, worker 2 claims the now-pending row.

**Pre (at worker 2's claim):** `render_jobs.status='pending'` (just reset by worker 1). Credit txs: `{reserve}`. `garments.render_status='rendering'` (set by render_garment_image's earlier claimGarmentRender before Gemini). Worker 1's background is still executing.

**Action (round-7 fix):**
1. Worker 2's claim bumps attempts. render_jobs.status='in_progress'.
2. Worker 2 calls render_garment_image. Garment fetch: render_status='rendering'. Takes the **new `deferred` branch** (round 7 fix) — returns `{ok:true, deferred:true, reason:'Already rendering'}`.
3. Worker 2 invokeRender: deferred check fires BEFORE skipped/renderedPath → returns `{ok:true, deferred:true, reason}`.
4. Worker 2 handleRenderJob deferred branch: UPDATE render_jobs status='pending', locked_until=NULL, clear error, **attempts unchanged**. No release. No touch to garments.
5. Meanwhile worker 1's background completes: writes garment.render_status='ready' + path, writes consume tx.
6. Next worker cycle: claim the pending row, attempts++. render_garment_image: garment.render_status='ready' + path. Already-ready branch. Healing consume hits already_terminal (consume already exists). Response includes renderedImagePath.
7. Worker invokeRender: renderedPath fires (PRIOR to deferred/skipped checks). Returns `{ok:true, rendered_image_path}`. handleRenderJob: branch b succeeded.

**Post:** render_jobs.status='succeeded'. Credit txs: `{reserve, consume}`. garments.render_status='ready'.

**Pre-fix counterfactual:** worker 2 would have taken the round-7 Track A skip branch → release tx written + status='succeeded' → later worker 1 background consume hits already_terminal → no consume tx written → user got a free render (consume never wrote, reserve was released → reserved counter returned to 0, but used_this_period never bumped). **Invariant I7 violation.** This is the bug the `deferred` shape prevents.

**Invariants:** I1 ✓, I2 ✓, I3 ✓, I5 ✓, I6 ✓ (one Gemini call, worker 1's), I7 ✓ (no premature release), I8 ✓ (attempts increments once per cycle; deferred pre-terminal cycles don't decrement, terminalize at max_attempts per the round-8 gate).

#### Scenario 13b — Deferred loop never converges (round-8 stuck-in-flight guard)

**Trigger:** Garment's `render_status='rendering'` is a ghost — an isolate crashed mid-render before any cleanup path could flip the state back to 'pending' / 'none' / 'failed'. No live concurrent render exists; the stale state just looks like one.

**Pre:** `render_jobs.status='pending'`. Credit txs: `{reserve}`. `garments.render_status='rendering'` (stale, nothing will ever write a consume for this job).

**Action:**
1. Worker cycle 1: claim → attempts=1 → render_garment_image returns `{deferred:true}` → worker's deferred branch checks `attempts (1) >= max_attempts (3)` → false → reset to pending. `attempts=1`, `status='pending'`.
2. Worker cycle 2: claim → attempts=2 → same → reset to pending. `attempts=2`, `status='pending'`.
3. Worker cycle 3: claim → attempts=3 → same `{deferred:true}` → worker's deferred branch checks `attempts (3) >= max_attempts (3)` → TRUE. Heal-gate check: no consume tx. Genuine stuck-in-flight: `releaseCredit` + `render_jobs.status='failed'` + `error_class='stuck_in_flight'` + garment flip to `render_status='failed'`.

**Post:** `render_jobs.status='failed'`. Credit txs: `{reserve, release}`. `garments.render_status='failed'`, `render_error='Concurrent render did not complete'`.

**Pre-round-8 counterfactual:** the deferred branch returned early without a terminal gate. The job would loop indefinitely — attempts would climb past max_attempts forever, reserved counter would stay elevated, user-facing `render_status='rendering'` would never converge.

**Invariants:** I1 ✓ (single reserve). I2 ✓ (release is the single terminal). I3 ✓ (no consume wrote). I4 ✓ (release found the reserve). I5 ✓ (user not charged, garment fails cleanly). I8 ✓ (attempts monotonic, terminalized at max_attempts per the round-8 gate).

### Scenario 15 — Garment delete with an active (non-terminal) render (round-13 atomic version)

**Trigger:** User deletes a garment while a render_jobs row for that garment is still in `pending` / `in_progress` status. Same trigger scenarios as pre-round-13 (UI delete, AddGarment duplicate-replace, seed_wardrobe bulk). Difference is how the code handles it.

**Pre:** `garments.render_status='pending'` or `'rendering'`. `render_jobs.status='pending'` or `'in_progress'`. Credit txs: `{reserve}`. `render_credits.reserved >= 1`.

**Action (post-round-13):**

1. Caller invokes `supabase.rpc('delete_garment_with_release_atomic', { p_garment_id, p_user_id })`. No separate DELETE.
2. RPC body (single PG transaction):
   - Auth gate: `auth.uid() = p_user_id` OR caller is service_role. Throws on mismatch.
   - Existence check: if no garment with `(id=p_garment_id, user_id=p_user_id)` exists, return `{ok:true, garment_deleted:false, reason:'garment_not_found'}`. Idempotent for retry.
   - `SELECT FOR UPDATE` on the user's `render_credits` row — serializes concurrent deletes.
   - Loop: for each non-terminal render_jobs row (also held via FOR UPDATE), check for existing release idempotency key → skip if present. Check partial unique index terminal-exists → skip if present. Find reserve source, refund source-specifically (`trial_gift_remaining++` / `topup_balance++` / no source-refund for monthly), write release tx with `idempotency_key = 'release:garment_delete:<job_id>'`.
   - `DELETE FROM garments WHERE id=X AND user_id=Y` — CASCADE wipes render_jobs rows. Ledger already balanced.
   - Return `{ok:true, released_count:N, garment_deleted:true}`.

**Post:** Garment gone. render_jobs rows for that garment gone (cascade). Credit txs for each active job: `{reserve, release}`. `render_credits.reserved` decremented by N. No orphaned reservations. If the DELETE fails (e.g. a constraint violation introduced by a future migration), the entire transaction rolls back — release NOT committed either. Atomicity is what prevents Codex round 13 Bug 2's split-state failure mode.

**Concurrent double-delete (Codex round 13 Bug 1):** two simultaneous callers for the same garment. Caller 1 acquires the render_credits FOR UPDATE lock first. Caller 2 blocks on the lock. Caller 1 runs the terminal check (empty), refunds, writes release tx, deletes garment, commits → lock released. Caller 2 acquires the lock, runs the existence check → `{garment_deleted:false, reason:'garment_not_found'}`. No double-refund, no duplicate release tx. Caller 2's `released_count=0`, `ok:true`.

**Already-terminal tolerance:** if the worker consumed or released during the brief window between the garment-exists check and acquiring the render_credits lock, the post-lock terminal check skips that job. No spurious release, no `already_terminal` error surfaced to the caller. `released_count` reflects only newly-released jobs.

**Admin SQL deletes:** bypass the RPC entirely. Orphaned reservations are the failure mode — the orphan-reservation cleanup cron (ship-within-2-weeks follow-up) is the safety net.

**Invariants:** I1 ✓ (single reserve per job). I2 ✓ (single terminal = release per job, never both release AND consume for the same job). I3 ✓. **I12 ✓** (atomic release + delete, no split state).

### Scenario 14 — Enqueue failure (no render_jobs row ever created)

**Trigger:** User saves a garment with render-enabled source (`add_photo`, `batch_add`, `live_scan`, `manual_enhance`). `buildGarmentIntelligenceFields` sets `garments.render_status='pending'` on the INSERT. `triggerGarmentPostSaveIntelligence` kicks off `startGarmentRenderInBackground`. The `invokeEdgeFunction('enqueue_render_job', ...)` call fails (network blip, 5xx, Supabase Edge Functions temporary outage).

**Pre:** `garments.render_status='pending'`. NO `render_jobs` row. Credit txs: `{}`.

**Action (post-round-11):**

1. First enqueue throws `RenderEnqueueError` with a retryable status (0/undefined for transport failure, or 5xx).
2. Retry fires with same `clientNonce`. Retry also fails.
3. Post-retry catch: `resetGarmentRenderStateOnEnqueueFailure` fires. UPDATE `garments` SET `render_status='none'`.

**Post:** `garments.render_status='none'`. No render_jobs row. No credit tx. User's wardrobe UI now shows the Studio photo button (`showGenerateAction` triggers on `render_status='none'`) so they can re-trigger. No stuck pending state.

**402 sub-scenario (round 14 fix):** enqueue fails with 402 (trial_studio_locked or insufficient credits). Non-retryable per `isRenderEnqueueRetryable` (4xx → false), so the retry branch doesn't fire; the 402 branch explicitly calls `resetGarmentRenderStateOnEnqueueFailure` and returns. UPDATE `garments` SET `render_status='none'`. The user's wardrobe UI shows the Studio photo CTA again; on tap the paywall UI fires (already wired into the re-enqueue path in `SwipeableGarmentCard` / `GarmentConfirmSheet` via their own 402 handling); after upgrade, the retry creates a fresh reserve + render_jobs row and proceeds. No stranded pending state.

**Invariants:** I1 ✓ (no reserve was written because no reserve RPC succeeded). I5 ✓ (status reflects "no render attempted"). **I11 ✓** (garment no longer stuck in pending, including on 402).

**Pre-round-11 counterfactual:** no reset. Garment orphaned at `render_status='pending'` indefinitely. UI shows "Refining..." forever. `resumePendingGarmentRenders` was a no-op under P5, so nothing recovered the garment — only a fresh save-flow (new garment) would retry.

**Round 11→14 counterfactual (402 path):** round 11 reset on transport/5xx failures but explicitly skipped 402, reasoning the upgrade flow would re-trigger enqueue post-purchase. That reasoning was wrong in aggregate with P5: the 402 returns BEFORE any render_jobs row is written, so there is no queued job for the upgraded user's retry to reach — the garment sat at 'pending' forever, and after upgrade the UI still showed "Refining…". Round 14 removed the 402 exclusion so every terminal enqueue-failure path reliably resets to 'none'.

### Scenario 13c — Deferred heal on late-landing consume (edge case)

If the in-flight render was in fact alive and its consume landed between cycle 2's deferral and cycle 3's max-attempts check, the heal branch (Scenario 4 / round 4 heal gate, reused inside the deferred terminal block) catches it: consume_tx exists → `succeeded_healed` with `result_path` recovered from the garment. No release, no garment flip to 'failed'. Preserves I1–I7.

### Scenario 13d — Deferred heal on TOCTOU-landing consume (round-15 fix)

**Trigger:** same setup as 13b / 13c — garment appears stuck in `'rendering'`, deferred loop has run to `attempts >= max_attempts`. Pre-release heal-gate check runs: no consume tx exists yet. Worker proceeds to call `releaseCredit`. In the narrow window between the heal-gate SELECT and `release_credit_atomic`'s own terminal-existence check, a concurrent in-flight render writes its consume tx. `release_credit_atomic` sees the consume, aborts, returns `{ok:false, reason:'already_terminal'}`.

**Pre:** `render_jobs.status='in_progress'`, `attempts >= max_attempts`. Credit txs: `{reserve}` at pre-release check → `{reserve, consume}` by the time `release_credit_atomic` runs. `garments.render_status='ready'`, `rendered_image_path='<something.webp>'` (set by the concurrent render before consume wrote).

**Action (post-round-15):**

1. Deferred branch's pre-release heal gate SELECTs `render_credit_transactions` for consume → no row (TOCTOU: consume hasn't landed yet).
2. Worker calls `releaseCredit`. Inside `release_credit_atomic`: SELECT for existing terminal tx → finds the consume that the concurrent render just wrote → returns `{ok:false, reason:'already_terminal'}`.
3. Worker's new post-release heal branch fires: SELECT `garments.rendered_image_path` for this garment.
4. UPDATE `render_jobs` SET `status='succeeded'`, `result_path=<path>`, `completed_at=now()`, clear locks + error fields.
5. DO NOT touch `garments.render_status` — the concurrent render set it to `'ready'` with the result path.
6. Push telemetry + `results.push({jobId, status:'succeeded_healed_toctou'})`.

**Post:** `render_jobs.status='succeeded'`, `result_path=<path>`. Credit txs: `{reserve, consume}`. `garments.render_status='ready'` (unchanged by the worker). User sees a successful render.

**Pre-round-15 counterfactual:** worker ignored `releaseResult.reason`, fell through to write `render_jobs.status='failed'`, `error_class='stuck_in_flight'`, AND UPDATE `garments.render_status='failed'`, `render_error='Concurrent render did not complete'` — overwriting the `'ready'`+path that the concurrent render had just populated. User saw a failed render in the UI for work that actually succeeded, and the good render_path was lost.

**Invariants:** I1 ✓ (single reserve). I2 ✓ (consume is the single terminal; no release ever wrote). I3 ✓. I5 ✓ (status reflects user-visible outcome). I7 ✓ — the post-release already_terminal check is the round-15 addition that keeps I7 true under this race.

**Why `succeeded_healed_toctou` (separate status string) instead of reusing `succeeded_healed`:** the pre-release heal branch (Scenario 13c / round-8) finds consume BEFORE attempting release — that's an ordinary heal, no release ever fires. The TOCTOU heal path attempts release, observes `already_terminal`, recovers. Distinguishing them in telemetry lets the ops dashboard separate "common heal race" from "hot-path race we'd want to tighten if it ever spiked." Dashboards can roll them up into one bucket if needed; pre-emptively merging the labels loses information.

### Scenario 3c — Terminal-failure TOCTOU heal at max_attempts (round-16 fix, parallel to Scenario 13d)

**Trigger:** structurally identical race to Scenario 13d but on the genuine-failure path, not the deferred-stuck path. The worker claims a job, calls `render_garment_image`, gets a real failure response (Gemini provider error, quality-gate rejection, storage failure, etc.) with `attempts >= max_attempts`. Pre-release consume-tx SELECT runs — no consume exists (the render really did fail this attempt and previous attempts). Worker calls `releaseCredit`. In the narrow TOCTOU window between the pre-release SELECT and `release_credit_atomic`'s own terminal check, a **concurrent in-flight render_garment_image invocation** (e.g. from a duplicate enqueue on the same clientNonce that the UNIQUE reserve_key guard prevented from double-inserting but that still ran to Gemini on a worker slot we didn't know about) writes its consume tx. `release_credit_atomic` sees the consume, aborts, returns `{ok:false, reason:'already_terminal'}`.

In practice this race is more theoretical than 13d's: the worker's job-claim + garment-claim serialization should prevent two concurrent `render_garment_image` invocations for the same job_id. But "should prevent" is not "does prevent" across the entire end-to-end fleet — isolate restarts, network partitions between worker and `render_garment_image`, and the external P4-legacy direct-invoke path can all in principle produce a late consume on the exact job_id the worker is about to terminalize. Round 16's fix closes the window defensively.

**Pre:** `render_jobs.status='in_progress'`, `attempts >= max_attempts`. Credit txs: `{reserve}` at pre-release check → `{reserve, consume}` by the time `release_credit_atomic` runs. `garments.render_status` could be anything — `'ready'`+path (concurrent render succeeded) or the prior-attempt's state (restored by `safeRestoreOrFailRender` during the failed attempts).

**Action (post-round-16):**

1. Pre-release heal gate (round 4) runs. Consume check returns no row.
2. Worker calls `releaseCredit`. `release_credit_atomic` returns `{ok:false, reason:'already_terminal'}` (TOCTOU consume just landed).
3. Round-16 heal branch fires. SELECT `garments.rendered_image_path` for the garment.
4. UPDATE `render_jobs` SET `status='succeeded'`, `result_path=<path from garment>`, `completed_at=now()`, clear error fields + locks.
5. DO NOT touch `garments.render_status`. The concurrent render wrote 'ready'+path; leave it.
6. Push telemetry + `results.push({jobId, status:'succeeded_healed_toctou'})`.

**Post:** `render_jobs.status='succeeded'`, `result_path=<path>`. Credit txs: `{reserve, consume}`. `garments.render_status` = whatever the concurrent render wrote (typically 'ready' with the result path). No release tx. User sees successful render.

**Pre-round-16 counterfactual:** worker logged the `already_terminal` warning but fell through to write `render_jobs.status='failed'`. The garment state degradation depended on Invariant I10: if `garments.render_status='ready'+path` at the moment of terminal failure, the garment flip to 'failed' was skipped (the prior good state was preserved). So in the best case, `render_jobs.status='failed'` was the only corruption — UI/analytics saw "failed" for a render that actually succeeded and the user was charged (consume kept). In the worst case, if the concurrent render hadn't yet written `garments.render_status='ready'` by the time the terminal-failure branch read garment state, the I10 check fell through and the garment flipped to `'failed'` — destroying the concurrent render's result. Round-16 guarantees consistency in both cases.

**Invariants:** I1 ✓. I2 ✓ (consume is the single terminal). I3 ✓. I5 ✓. **I7 ✓** (second TOCTOU-heal branch added; same signal, same response). I10 ✓ still holds as a belt-and-suspenders defense — the heal runs BEFORE the status='failed' write that I10 guards.

### Scenario 16 — Retryable enqueue failure but server-side INSERT succeeded (round-16 Bug 1 fix)

**Trigger:** User saves a garment with a render-enabled source. `startGarmentRenderInBackground` fires the first enqueue. Server-side, `enqueue_render_job` completes `reserveCredit` + `INSERT INTO render_jobs` successfully, then hits a 5xx just before returning (Deno isolate OOM, unexpected throw in the idempotency-response codepath, connection reset by the load balancer). The client sees a 5xx RenderEnqueueError, classifies it retryable, and retries with the same clientNonce. Server-side on the retry: reserveCredit hits replay, the INSERT hits `ON CONFLICT (reserve_key)` and short-circuits, the function again crashes before responding — the same failure mode at the same point. Client sees a 5xx retryErr.

**Pre:** `garments.render_status='pending'` (set by `buildGarmentIntelligenceFields` during the garment INSERT). `render_jobs` has one row (reserve_key containing the clientNonce, status='pending'). Credit txs: `{reserve}`. From the client's point of view: no successful enqueue response ever received.

**Action (post-round-16):**

1. Retry-exhausted catch block runs. Round-14 comments already noted this branch calls `resetGarmentRenderStateOnEnqueueFailure` for non-402 transport failures.
2. **Round-16 addition**: before calling the reset, the client queries `render_jobs` via `(user_id, garment_id, reserve_key LIKE '%<clientNonce>')`.
3. Query returns the row that the server actually INSERTed on one of the two 5xx-producing attempts.
4. Client logs `server-state check: render_jobs row exists despite client retry failure — leaving garment state to worker`, returns without resetting.
5. Worker picks up the pending row on its next cron tick (or fire-and-forget POST if that also made it through), processes normally. Garment transitions to 'rendering' → 'ready' via the worker path per I5.

**Post:** Single `render_jobs` row survives. Single reserve + eventual consume. No double-charge. User sees the correct end-to-end render outcome (success or worker-driven terminal failure, whichever the retry produces).

**Pre-round-16 counterfactual:** reset flipped `garments.render_status='none'`. User saw the Studio photo CTA reappear and tapped it. Fresh enqueue fired with a new clientNonce → new reserve_key → second reserveCredit (minting a second reservation) → second render_jobs row. Two rows for the same intent. Ledger's `reserved` counter increments twice; both rows get worker attention; both eventually consume. User double-charged. Gemini called twice.

**Invariants:** I1 ✓ (single reserve per job; the server's idempotent INSERT path already enforced this, round-16 closes the client's side of the double-enqueue loop). **I13 ✓**. I11 ✓ (the garment doesn't get stuck at 'pending' because the worker drives it forward; the client's state reset is gated on "no server-side row found").

**Non-match condition (counterfactual that DOES reset):** if the server-state check returns no row (or the check itself errors), we fall through to the reset — the path I11 requires. Unit tests cover both branches (`server-state check: DOES NOT reset when row exists` and `DOES reset when no row is found`).

**Query-error handling:** the Bug-1 query uses PostgREST with `.like(reserve_key, '%nonce')`. RLS on `render_jobs` restricts SELECT to the authenticated user's own rows, which matches our query intent. A network error on the lookup would leak through the `try/catch` surrounding the check and fall through to the reset — worse than a correct server-state detection but still a well-defined state: the garment flips to 'none' and either (a) the user re-triggers and the server's reserve-replay + reserve_key idempotency still catches the double-intent without creating a second row, or (b) the orphaned row ticks through the worker normally. The narrow double-charge exposure of pre-round-16 is closed in the expected case; in the check-fails edge case we revert to pre-round-16 behavior, which is still an improvement over no check at all.

---

## Findings from this structural review

Ordered by severity. "Fixed in this round" = a patch was committed during round 7.

### T-1 (HIGH, FIXED this round) — `deferred` response for concurrent in-flight

Reproduced in Scenario 13. Pre-round-7 had no concept of "don't release, retry later" for the `garments.render_status='rendering'` concurrent-render case. Round 7 Track A's new skip branch would have released on this path → I7 violation → free render. Fixed by introducing `{ok:true, deferred:true, reason}` in render_garment_image at two sites (`Already rendering` early return + claimGarmentRender-lost path when `latestGarment.render_status='rendering'`) and a corresponding worker branch that resets to pending without touching credit or garments.

### T-2 (RESOLVED round 10) — Regenerate semantics via `force` plumbing

Scenario 7 pre-round-10 was a silent no-op regenerate: user taps "Regenerate", worker sees no force flag, render_garment_image's line-611 early guard returned `{skipped:true}`, worker terminalized as `succeeded_skipped` with a release tx. User wasn't double-charged (release wrote instead of consume) but got zero new render — the button was broken.

**Resolved** in round 10 by plumbing `force` through every layer: UI (`SwipeableGarmentCard.handleRender` passes `force: hasRenderedImage`) → `enqueueRenderJob` → `enqueue_render_job` edge function → `render_jobs.force` column → `claim_render_job` RETURNS TABLE → worker's invokeRender payload → render_garment_image's existing `body.force` parsing. See Invariant I9.

Scenario 7 in the scenarios section has been rewritten to reflect the post-fix behavior (1 reserve + 1 consume + new rendered_image_path).

### T-3 (MEDIUM, FIXED round 9) — `GarmentConfirmSheet` 60s local timeout double-enqueued on slow renders

Pre-fix: the sheet's inline polling timed out to `'failed'` after
60s. Gemini backoff + worker retries + Gemini P99 latency legitimately
exceeded 60s. The user would tap Retry → `startRender` fires with a
fresh `crypto.randomUUID()` nonce → new reservation → Scenario 7
double-charge path. Codex round 9 argued (correctly) that this is a
P5-caused regression and had to ship in P5, not as a follow-up.

**Fix shipped in round 9:** `GarmentConfirmSheet`'s polling timeout
bumped to `RENDER_POLL_TIMEOUT_MS = 300_000` ms (5 minutes). Exported
so tests can assert the value structurally — unit test at
`src/components/garment/__tests__/GarmentConfirmSheet.test.tsx`.
`SwipeableGarmentCard` doesn't poll at all, so no sibling fix needed.
Switching the sheet to `useRenderJobStatus` remains a quality-of-life
improvement (see T-8) but is no longer load-bearing for this
regression.

### T-4 (LOW, NOT FIXED this round) — `SwipeableGarmentCard` always uses `source='retry'`

`src/components/wardrobe/SwipeableGarmentCard.tsx:107` passes `'retry'` as the source for BOTH first-time-generate AND regenerate taps. Analytics can't distinguish. Does not affect credit ledger or state machine correctness. Fix: branch on `renderStatus === 'none'` → `'add_photo'` else `'retry'`. Trivial change, deferred only because it's outside round-7's declared scope.

### T-5 (LOW, NOT FIXED this round) — Missing telemetry on heal branch

`process_render_jobs` branches a, b, d, e, f, g all emit `logTelemetry`. Branch c (heal-to-succeeded) does not. Observability gap, not a correctness issue.

### T-6 (LOW, INFORMATIONAL) — `max_attempts=3` counts claim attempts, not Gemini attempts

Stale-claim recovery doesn't decrement `attempts`. A render that repeatedly hits stale recovery (worker crashes before completion) exhausts the budget in 3 claim cycles, even if only 1–2 real Gemini calls were fired. Not a bug — product-policy choice. Documented here so no one "fixes" it by adding a decrement (which would enable infinite-claim loops on genuinely broken rows).

### T-7 (LOW, NOT FIXED) — `isRenderEnqueueRetryable(undefined)` path is dead code

`src/lib/garmentIntelligence.ts:70` handles `undefined` status but `RenderEnqueueError.status` is typed `number`. Defensive; harmless. Remove on next cleanup pass.

### T-8 (LOW, INFORMATIONAL) — `useRenderJobStatus` hook defined but unused

`src/hooks/useRenderJobStatus.ts` is fully specified but no reviewed component uses it. `GarmentConfirmSheet` reinvents polling. Consolidation to `useRenderJobStatus` would fix T-3 as a side effect and would be a cleaner architecture. Deferred — refactor scope beyond round-7.

### T-9 (LOW, INFORMATIONAL) — One-time post-deploy step for cron auth

The P5 migration schedules a pg_cron job that needs `vault.secrets.service_role_key` populated. This is a manual post-`db push` step (documented in the migration header, lines 188–203). If skipped, cron silently fails; the only worker pickups are from enqueue's fire-and-forget. Easy to forget; worth a post-merge smoke check.

---

## Cross-function invariant sanity checklist (answer this every PR that touches P5)

Before merging any P5 change, answer each:

- [ ] Does any new code path write a consume without a prior reserve? (violates I4)
- [ ] Does any new code path call `releaseCredit` AFTER a consume could have been written? (violates I3 — the RPC would return `already_terminal`, but the attempt itself is a smell)
- [ ] Does any new path create two reserve txs for the same `render_job_id`? (violates I1)
- [ ] Could any new path leave `garments.render_status` out of sync with `render_jobs.status`? (violates I5 in spirit, even if the ledger is fine)
- [ ] Could any new path release on an in-flight `garments.render_status='rendering'`? (violates I7 — see T-1)
- [ ] **Does any new `releaseCredit` call precede a `render_jobs.status='failed'` write, without checking `releaseResult.reason === 'already_terminal'` and healing to succeeded?** (violates I7 — see rounds 15 + 16. The currently-protected sites are `process_render_jobs/index.ts:~255` (deferred-stuck) and `~591` (terminal failure). Any new terminal-failure-preceding-release site needs the same heal.)
- [ ] **Does any new client-side path reset `garments.render_status` based on an enqueue error without first verifying server-side `render_jobs` state?** (violates I13 — see round 16. Retryable transport failures don't prove enqueue failed server-side.)
- [ ] Does the new path correctly forward `presentation` + `promptVersion` for internal callers? (round-6)
- [ ] Does any new path burn `attempts` on a non-render event? (violates I8)
- [ ] Is the path unreachable? If so, is it guarded by an assert/error-return, or is it a silent fallthrough?
- [ ] Do two branches fire for the same input event? (non-determinism)
- [ ] Does the code match this doc?

## Open questions for product

- **Regenerate semantics (T-2):** fresh clientNonce on an already-ready garment — fresh charge + fresh Gemini (requires `force=true` plumbing), silent replay (requires enqueue to detect prior success and replay), or status-quo (double-charge for same render)?
- **Analytics source values (T-4):** distinguish first-time-generate from retry?
- **`max_attempts` semantics (T-6):** claim-attempts or Gemini-attempts?
- **60s confirm-sheet timeout (T-3):** extend to match server budget, or introduce a "still rendering" terminal UI state instead of failing to the Retry CTA?

When these are answered, update the scenarios and findings above, and close or re-scope the corresponding T-N.

### Documented limitation — crash between garment insert and enqueue

**Known gap:** If the client crashes in the <100ms window between the `garments.render_status='pending'` INSERT (`buildGarmentIntelligenceFields`) and `enqueueRenderJob` firing — OS kill, tab close, power loss, browser crash — the garment is stuck in `'pending'` with no `render_jobs` row. `resumePendingGarmentRenders` is a no-op under P5 by design (the durable queue owns render recovery, and the queue can only recover jobs that were actually enqueued). Nothing else self-heals the garment until either (a) the user deletes + re-adds it, or (b) the P5.1 server-side reconciliation cron lands.

**Tracked in:** [issue #633](https://github.com/borna-z/bursai/issues/633), SLA 14 days post-P5-merge (labels: `post-launch`, `hardening`, `follow-up`, `priority:high`, `sla:2-weeks`).

**Why accepted for P5 launch:** rare window (<100ms between two client-side operations), recoverable by user action (delete + re-add), no credit loss, no data corruption. Estimated <0.5% incidence across long timescales. Fixing properly requires adding new cron infrastructure that deserves its own focused review cycle rather than a rushed P5 amendment. The follow-up approach — hourly pg_cron job that resets `render_status='none'` for garments that have been stuck at `'pending'` with no `render_jobs` row for more than 10 minutes — preserves P5's durability-via-queue architecture (no client-side resume sweep, no re-enqueue logic since the original clientNonce is lost to the crash) and matches the I11 "land stuck garments in a user-retryable state" pattern round-14 established for 402. Behavior converges with existing I11 guarantees once the cron ships; until then, `'pending'` without a `render_jobs` row is a permitted transient state that the next P5.1 PR closes.

---

## Change log

- 2026-04-17 — Initial version. Round 7 Track A fixes (internal release guard + skip terminalization) incorporated. Round 7 Track B fix (deferred response) added. Findings T-1 through T-9 inventoried.
- 2026-04-17 — Round 8. Deferred branch gets a max_attempts terminal gate (Scenario 13b). Invariant I8 revised: deferred-pre-terminal cycles do not decrement attempts, but the branch terminalizes at `attempts >= max_attempts` — checking heal-gate consume first, falling through to release + `status='failed' / error_class='stuck_in_flight' / garment.render_status='failed'` otherwise. Pre-round-8 code returned from the deferred branch early without a terminal gate, letting a stuck 'rendering' garment loop indefinitely. Worker outcome table gets two new rows (deferred-terminal-with-heal / deferred-terminal-stuck). Cron HTTP timeout raised from 50s to 180s in the P5 migration to cover worst-case worker batch runtime (MAX_JOBS_PER_RUN=5 × JOB_CONCURRENCY=2 × invokeRender 45s ≈ 135s, plus headroom).
- 2026-04-17 — Round 9. Bug 1: the T-1 deferred branch added in round 7 was unreachable — the earlier `!force && (render_status === 'ready' || 'rendering' || 'skipped')` guard at `index.ts:611` always returned `skipped:true` first. Fix: branch on `isInternalInvocation` inside that earlier guard (internal+rendering → deferred, else skipped). Removed the duplicate unreachable block with a comment. Bug 2 / T-3 reclassified from follow-up to in-P5-fix: `GarmentConfirmSheet` polling timeout extended from `60_000` ms to `RENDER_POLL_TIMEOUT_MS = 300_000` ms to cover the server's `max_attempts × invokeRender-timeout` budget. Unit test added asserting the constant's value. Verification doc now contains an explicit methodology note: any round that exercises the render_garment_image response contract MUST deploy code containing the real early guard, not a stub that bypasses it — rounds 7/8 did stub-based tests and missed Bug 1 as a result.
- 2026-04-17 — Round 10. Bug 1 / T-2 resolved: `force` flag is now plumbed through every queue layer (UI → enqueue edge function → render_jobs.force column → claim_render_job RETURNS TABLE → worker invokeRender payload → render_garment_image's existing body.force parsing). New migration-in-place adds the `force BOOLEAN NOT NULL DEFAULT false` column to render_jobs. SwipeableGarmentCard's regenerate path passes `force: hasRenderedImage` (true when a prior render exists, false for first-time generation). New Invariant I9 documents the cross-layer preservation rule. Scenario 7 rewritten to reflect post-fix behavior. Bug 2 (T-4 analytics labeling — `source: 'retry'` on first-time generation) deferred to post-launch follow-up, decision recorded in launch-sequence memory.
- 2026-04-18 — Round 13. Codex identified two real design flaws in round 12's two-step release-then-delete pattern: (Bug 1, P1) concurrent deletes could double-refund the balance before either release tx committed; the ON CONFLICT idempotency_key guard fires after the refund, silently dropping the second insert but leaving the balance double-credited. (Bug 2, P2) split client transaction — release committed but DELETE failed left the worker's eventual consume hitting already_terminal, producing a free render. Round 13 replaces the two-step RPC with a single atomic `delete_garment_with_release_atomic(p_garment_id, p_user_id)`. Uses `PERFORM 1 FROM render_credits FOR UPDATE` to serialize concurrent callers + `FOR UPDATE` on render_jobs rows to block worker claim. Entire release + DELETE happens in one PG transaction. Client no longer issues a separate DELETE. Three delete sites (useDeleteGarment, AddGarment onReplace, seed_wardrobe) all updated. Round-12 RPC `release_reservations_for_garment_delete` dropped. Invariant I12 revised to reflect atomicity; Scenario 15 rewritten; five new preview-branch scenarios (happy path, concurrent double-delete, atomicity-on-delete-failure via FK constraint violation, already-terminal tolerance, no-active-reservations case).

- 2026-04-18 — Round 12. Bug 1: legacy garments stuck at `render_status='pending'` without a render_jobs row (pre-P5 in-memory-queue failures that the pre-P5 `resumePendingGarmentRenders` used to recover; post-P5 it's a no-op so those garments don't self-heal). New one-time migration `20260418000000_reset_legacy_pending_garments.sql` resets them to `'none'` so users can retry from the UI. Production check at authoring time: 3 garments affected, all with `rendered_image_path IS NULL` (no prior render lost). Bug 2: garment delete cascaded render_jobs but `render_credit_transactions` has no FK — active `reserve` txs were orphaned, user's `render_credits.reserved` counter stayed elevated forever. New SECURITY DEFINER RPC `release_reservations_for_garment_delete(p_garment_id)` releases non-terminal reservations before cascade. Wired into `useDeleteGarment`, `AddGarment.tsx` duplicate-replace, and `seed_wardrobe` bulk delete. Release failures are logged but don't block the delete (post-launch orphan-reservation cron is the safety net). New Invariant I12 + new Scenario 15 documenting the release-before-delete path. Orphan-reservation cleanup cron reclassified from post-launch nice-to-have to a ship-within-two-weeks safety net (admin SQL deletes still bypass the RPC).

- 2026-04-18 — Round 11. Bug 1 (CRITICAL): terminal-failure branch in `process_render_jobs` unconditionally wrote `garments.render_status='failed'`. On force=true regenerate with a prior good render, `safeRestoreOrFailRender` in render_garment_image had already restored the garment to its prior `ready+good.webp` state on each failed attempt — the worker's terminal overwrite then destroyed that restoration. User with a working render who tapped Regenerate during a Gemini outage would lose their existing good render. Fix: worker reads the current garment state at terminal time and skips the `render_status='failed'` UPDATE when `render_status='ready' && rendered_image_path` is present. `render_jobs.status='failed'` still flips (UI/analytics can distinguish). New Invariant I10 documents the preservation rule. Scenario 3 split into 3a (first-time generate → garment correctly flipped to failed) and 3b (force=true regenerate → prior good render preserved). Bug 2: `startGarmentRenderInBackground` had no recovery path when enqueue failed after retry — garment stayed at `render_status='pending'` forever (no render_jobs row existed, `resumePendingGarmentRenders` is a P5 no-op). Fix: new `resetGarmentRenderStateOnEnqueueFailure` helper sets `render_status='none'` on exhausted-retry path (non-402 only; 402 keeps pending across the user's upgrade flow). New Invariant I11 + new Scenario 14. Three unit tests cover the reset path / 402 non-reset / happy-retry no-reset.

- 2026-04-18 — Round 14. Bug (P1): the round-11 402 branch in `startGarmentRenderInBackground` returned without resetting `render_status`, on the theory that the upgrade flow would re-trigger enqueue and `render_status='pending'` preserved intent across the upgrade UX. Wrong in aggregate with P5: `enqueue_render_job` returns 402 BEFORE writing any `render_jobs` row, `resumePendingGarmentRenders` is a no-op under the durable queue, and nothing else self-heals the garment — it sat at `'pending'` forever, UI showed "Refining…" even after the user upgraded. Fix: the 402 branch now calls `resetGarmentRenderStateOnEnqueueFailure` and returns. Garment flips to `'none'`; the Studio photo CTA reappears in the wardrobe; paywall UI fires on re-tap (already wired in `SwipeableGarmentCard` / `GarmentConfirmSheet` 402 handlers); post-upgrade retry creates a fresh reserve + render_jobs and proceeds. Invariant I11 strengthened to cover 402 as well. Scenario 14's 402 sub-scenario rewritten. The unit test previously asserting "402 does NOT reset" flipped to assert "402 DOES reset to 'none'". Client-side logic only — no schema changes, no RPCs, no edge-function deploys triggered by this fix beyond the production cutover already tracked for P5 merge.

- 2026-04-18 — Round 15. Two findings — both real, both landing inside the existing P5 design rather than triggering an architectural redesign. **Bug 1 (MODERATE):** the deferred-stuck-at-max-attempts branch in `process_render_jobs` ran a pre-release heal-gate SELECT for a consume tx, then called `releaseCredit`, then unconditionally wrote `render_jobs.status='failed'` and flipped `garments.render_status='failed'`. Between the heal-gate SELECT and `release_credit_atomic`'s own terminal-existence check, a concurrent in-flight render's consume tx can land; `release_credit_atomic` returns `{ok:false, reason:'already_terminal'}`; the worker ignored that reason and terminalized to failed, overwriting the `ready`+path the concurrent render had just populated. Fix: post-release heal gate — if `releaseResult.reason === 'already_terminal'`, SELECT the garment's `rendered_image_path`, UPDATE render_jobs to `status='succeeded'` with that path, leave `garments.render_status` untouched, and return `'succeeded_healed_toctou'`. New Scenario 13d documents the race. Invariant I7 strengthened to require the post-release check. **Bug 2 (LOW-MEDIUM):** the P5 migration's pg_cron body hardcoded `https://khvkwojtlkcvxjxztduj.supabase.co/functions/v1/process_render_jobs`. Any non-prod environment applying this migration would POST to production on every tick — its own queue would never get processed; its traffic would cross-contaminate prod. Fix: move the base URL into `vault.secrets` as `functions_base_url`, construct the URL at cron-exec time via `(SELECT decrypted_secret ... WHERE name='functions_base_url') || '/functions/v1/process_render_jobs'`. Same NULL-propagation-on-missing rule as the existing service_role_key pattern — absent secret lands in cron.job_run_details as status='failed' (LOUD signal). Migration comment block documents both post-deploy vault inserts (service_role_key + functions_base_url). CLAUDE.md deploy checklist updated with the new combined INSERT, a new "Endpoint URLs inside migrations — also in vault" subsection, and a P5-specific first-time-deploy vault insert section. No schema change on Bug 2 — the migration file was still Local-only (the P5 merge has not yet reached db push), so the URL change is in-place on the existing migration rather than creating a second file. Both bugs verified on a Supabase preview branch.

- 2026-04-18 — Round 16. Two more findings, both TOCTOU — one a miss on the round-15 pattern, one a different class of "can't infer server state from client-visible transport error". Pre-fix audit performed across all `releaseCredit` / `release_credit_atomic` call sites: four total (render_garment_image:~1365 legacy P4 path, process_render_jobs:~255 deferred-stuck [fixed round 15], process_render_jobs:~399 skip terminalization [precedes status=succeeded, not failed — doesn't match pattern], process_render_jobs:~591 genuine terminal failure [the Bug 2 site]). Confirmed only one missed instance; Codex's finding complete. **Bug 1 (P1):** `startGarmentRenderInBackground`'s retry-exhausted catch block called `resetGarmentRenderStateOnEnqueueFailure` based solely on the client-visible 5xx/transport failure. But the server can complete reserve + render_jobs INSERT and THEN return 5xx (or have its TCP connection drop). Client's reset flipped `garments.render_status='none'`, user saw Studio-photo CTA, tapped it, fresh clientNonce fired → new reserve_key → second reserveCredit + second render_jobs row. Double-charge. Fix: before calling the reset, query `render_jobs` by `(user_id, garment_id, reserve_key LIKE '%clientNonce')`; if a row exists, leave garment state alone (worker owns it). Suffix-match is safe because clientNonce is a UUID (globally unique) — no need to duplicate server-side `presentation`/`RENDER_PROMPT_VERSION` derivation on the client. New Invariant I13. New Scenario 16. Two unit tests cover the two branches (row-found → no reset, no-row → reset per I11). **Bug 2 (P1):** the terminal-failure branch at `process_render_jobs:~591` (parallel code path to the round-15 deferred-stuck branch at `~255`) had the same TOCTOU window: pre-release heal-gate SELECT → releaseCredit → release_credit_atomic returns `already_terminal` because a concurrent consume just landed → pre-round-16 worker fell through to `status='failed'` + (conditionally) `garments.render_status='failed'`. Fix: copy the round-15 heal branch into this code path. New Scenario 3c documents the race on the genuine-failure path (distinct from Scenario 13d which is the deferred-stuck path). Invariant I7 restated to explicitly cover both known call sites AND serve as a code-review gate for future additions — the sanity checklist now includes an explicit "any new releaseCredit-before-failed-status needs the heal" question AND an "any new client-side reset needs server-state check per I13" question. No schema changes. Bug 2 verification reuses the round-15 preview-branch RPC evidence (identical precondition — `release_credit_atomic` returns `already_terminal` when consume pre-exists — validated directly on `gajgassnfolskexdhgid`). Bug 1 verification is unit-test based: the client-side server-state check is a PostgREST query with straightforward behavior on row-exists / row-absent / query-error branches.
