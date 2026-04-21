/**
 * Shared idempotency helpers for Edge Functions.
 *
 * Backed by the `public.request_idempotency` table (see the migration named
 * `..._request_idempotency.sql`). Replaces the previous per-isolate
 * in-memory `Map` which couldn't survive cold starts and leaked across
 * concurrent isolates.
 *
 * Flow — both consumers (`create_checkout_session`, `delete_user_account`)
 * follow this pattern, with the idempotency check placed AFTER auth so the
 * resolved user.id is available for scoping:
 *
 *   const user = ...auth resolves user...
 *   const scope = { functionName: "create_checkout_session", userId: user.id };
 *   const cached = await checkIdempotency(req, supabaseAdmin, scope);
 *   if (cached) return cached;
 *   ...process the request...
 *   const response = new Response(JSON.stringify(result), { ... });
 *   await storeIdempotencyResult(req, response, supabaseAdmin, scope);
 *   return response;
 *
 * Scope discriminator (Codex P1 on PR #658, round 2):
 *   The raw `x-idempotency-key` header is a client-opaque identifier, but
 *   the DB key is scoped by `${functionName}:${userId}:${rawKey}` so that:
 *     1. A client reusing the same key across endpoints gets independent
 *        idempotency guarantees per endpoint (never a cross-endpoint
 *        replay).
 *     2. Two different users sending the same raw key never see each
 *        other's cached responses or 409s.
 *   This also forces the check/store calls to happen AFTER auth, which
 *   closes the earlier ordering issue where pre-auth idempotency lookups
 *   could replay another user's payload on key collision.
 *
 * Race handling — the reason the module exists:
 *   Three serialized claim attempts, each using a database-level atomic
 *   operation. Only one isolate can "own" the scoped key at a time.
 *
 *   1. Fresh-key claim: UPSERT with ignoreDuplicates (INSERT ... ON CONFLICT
 *      DO NOTHING). Winner inserts the pending row; losers see no row
 *      returned and fall through. Same pattern as stripe_events.
 *
 *   2. Expired-row reclaim: conditional UPDATE with `.lt("expires_at", now)`
 *      WHERE-clause. If the row is still expired at write-time, the update
 *      overwrites it with a fresh pending claim. Postgres serializes this
 *      against concurrent updaters at the row-lock level; exactly one
 *      isolate wins. Losers re-read state.
 *
 *   3. Current state read: plain SELECT to decide what to return.
 *      - status > 0, not expired  -> cached response
 *      - status = 0, not expired  -> 409 Retry-After (another isolate
 *                                    is still processing; its claim will
 *                                    expire in ≤60s if it crashed)
 *
 *   Codex P1 round 1 on PR #658 surfaced the bug that motivated the
 *   reclaim step: returning `null` on expired rows without acquiring the
 *   key meant two concurrent retries both saw `expired`, both fell
 *   through, and both executed side effects until storeIdempotencyResult
 *   clobbered (last write wins). The conditional-UPDATE reclaim closes
 *   that window.
 */

import { CORS_HEADERS } from "./cors.ts";

/** TTL for completed responses — covers typical client retry windows. */
const DEFAULT_RESULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * TTL for pending claims. Intentionally short: if the claiming isolate
 * crashes before calling storeIdempotencyResult, the claim expires in 60s
 * and retries can proceed. Long enough to cover the slowest expected
 * downstream call (Stripe API round-trips are ~1-3s, delete-user cascades
 * ~10-20s worst case).
 */
const CLAIM_TTL_MS = 60 * 1000; // 1 minute

/**
 * Scope discriminator for idempotency keys. Both components are required so
 * raw client keys never collide across endpoints or users.
 *
 *   functionName: the edge function identifier (e.g. "create_checkout_session").
 *                 Matches the `functionName` already threaded through other
 *                 shared helpers like scale-guard's enforceRateLimit.
 *   userId:       the authenticated user's id. Must come from a verified
 *                 auth.getUser() call — do NOT derive from the request body
 *                 or query string, or a malicious caller could impersonate
 *                 another user's idempotency namespace.
 */
export interface IdempotencyScope {
  functionName: string;
  userId: string;
}

/**
 * Extract the raw idempotency key from the request. Returns `null` when the
 * header is absent (non-idempotent request). The returned string is the raw
 * client-supplied value; callers use it only through the helpers below,
 * which internally build the scoped DB key.
 */
export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get("x-idempotency-key");
}

/**
 * Build the DB key from the raw client key + scope. The DB table's PK is the
 * concatenation; this is what isolates keys per endpoint and per user.
 *
 * Delimiter: colon. Neither `functionName` (snake_case ascii, set in code)
 * nor `userId` (UUID) can legitimately contain colons, and the raw client
 * key is treated as opaque trailing data — no parsing of the composite key
 * happens anywhere.
 */
function buildScopedKey(rawKey: string, scope: IdempotencyScope): string {
  return `${scope.functionName}:${scope.userId}:${rawKey}`;
}

/**
 * Build the 409 "another isolate is still processing" response. Shared
 * helper so both the in-flight and post-reclaim-race branches return
 * identical shapes — and crucially both include CORS_HEADERS so browser
 * clients can actually read the status + Retry-After hint. Codex P2 on
 * PR #658 caught that the earlier version was missing CORS.
 */
function concurrentResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "A request with this idempotency key is currently being processed. Retry shortly.",
    }),
    {
      status: 409,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Retry-After": "2",
      },
    },
  );
}

/**
 * Check whether a response for this idempotency key already exists.
 *
 * - Returns `null` if the caller should proceed with the real work (no
 *   header, or we just claimed/reclaimed the key).
 * - Returns a 409 `Response` with `Retry-After` if another isolate is
 *   currently processing the same scoped key.
 * - Returns the cached `Response` if the request was already processed.
 *
 * The `scope` argument is required so the DB key is namespaced per endpoint
 * and per user. Callers must have completed auth before invoking this.
 */
export async function checkIdempotency(
  req: Request,
  supabaseAdmin: any,
  scope: IdempotencyScope,
): Promise<Response | null> {
  const rawKey = getIdempotencyKey(req);
  if (!rawKey) return null;

  const key = buildScopedKey(rawKey, scope);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const claimExpiresAt = new Date(nowMs + CLAIM_TTL_MS).toISOString();

  // ── Attempt 1: fresh-key claim (no row exists yet) ────────────────
  // Atomic INSERT-if-absent. Winner gets `inserted=<row>`, losers see
  // `inserted=null` because `ignoreDuplicates: true` suppresses the
  // conflict into a zero-row result. Mirrors stripe_events at
  // `stripe_webhook/index.ts:79-91`.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("request_idempotency")
    .upsert(
      {
        key,
        body: "",
        status: 0,
        headers: {},
        expires_at: claimExpiresAt,
      },
      { onConflict: "key", ignoreDuplicates: true },
    )
    .select("key")
    .maybeSingle();

  if (insertError) {
    // DB error — fail open so a transient Postgres blip doesn't block
    // user-facing calls entirely. The consumer will proceed without
    // idempotency, and storeIdempotencyResult will attempt to persist
    // the result for future retries.
    console.warn("[idempotency] claim upsert failed:", insertError.message);
    return null;
  }

  if (inserted) {
    // Fresh key — we claimed it. Caller proceeds.
    return null;
  }

  // Row exists. Read current state.
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("request_idempotency")
    .select("body, status, headers, expires_at")
    .eq("key", key)
    .maybeSingle();

  if (selectError) {
    console.warn("[idempotency] lookup after conflict failed:", selectError.message);
    return null;
  }

  if (!existing) {
    // Disappeared between our upsert-ignoring-conflict and the select
    // (cleanup cron, or explicit DELETE). Caller proceeds.
    return null;
  }

  const expiresAtMs = new Date(existing.expires_at).getTime();

  if (expiresAtMs > nowMs) {
    // Fresh row — either completed (return cached) or still-processing (409).
    if (existing.status > 0) {
      const headers = new Headers(existing.headers as Record<string, string>);
      return new Response(existing.body, {
        status: existing.status,
        headers,
      });
    }
    return concurrentResponse();
  }

  // ── Attempt 2: expired-row reclaim ────────────────────────────────
  // Row exists but its TTL has passed. Previously we fell through with
  // `return null` and let the caller proceed, but that left the stale
  // row in place until the hourly cleanup cron — so multiple concurrent
  // retries all took the same branch, all proceeded, and all executed
  // side effects (the Codex P1 finding on PR #658).
  //
  // Fix: conditional UPDATE with `.lt("expires_at", nowIso)` as the
  // WHERE clause. Postgres serializes concurrent updaters at the row
  // level — exactly one isolate's UPDATE affects the row. Losers see
  // `reclaimed=null` and re-read the current state.
  const { data: reclaimed, error: reclaimError } = await supabaseAdmin
    .from("request_idempotency")
    .update({
      body: "",
      status: 0,
      headers: {},
      expires_at: claimExpiresAt,
    })
    .eq("key", key)
    .lt("expires_at", nowIso)
    .select("key")
    .maybeSingle();

  if (reclaimError) {
    console.warn("[idempotency] reclaim update failed:", reclaimError.message);
    return null;
  }

  if (reclaimed) {
    // We reclaimed the expired row. Caller proceeds.
    return null;
  }

  // Lost the reclaim race — another isolate moved the row out of the
  // expired state. Re-read and decide.
  const { data: current, error: currentError } = await supabaseAdmin
    .from("request_idempotency")
    .select("body, status, headers, expires_at")
    .eq("key", key)
    .maybeSingle();

  if (currentError || !current) {
    // Row gone or error. Caller proceeds without a claim.
    return null;
  }

  if (new Date(current.expires_at).getTime() <= nowMs) {
    // Still expired (cleanup cron, or another race). Caller proceeds;
    // storeIdempotencyResult will upsert and refresh the TTL.
    return null;
  }

  if (current.status > 0) {
    const headers = new Headers(current.headers as Record<string, string>);
    return new Response(current.body, {
      status: current.status,
      headers,
    });
  }

  // status === 0 and not expired — the winner of the reclaim race is
  // actively processing. Return 409 so the client retries shortly.
  return concurrentResponse();
}

/**
 * Store the response for a given idempotency key so that subsequent retries
 * receive the same answer without re-executing side-effects.
 *
 * Only stores if the request carried an idempotency key header. Uses the
 * full 5-minute TTL (DEFAULT_RESULT_TTL_MS) which overwrites any shorter
 * pending-claim TTL set by checkIdempotency.
 *
 * The response body is consumed via `.clone()` so the original remains
 * usable by the caller. The `scope` must match what was passed to
 * `checkIdempotency` — otherwise we'd store under a different DB key than
 * we claimed against and subsequent retries would miss the cache.
 */
export async function storeIdempotencyResult(
  req: Request,
  response: Response,
  supabaseAdmin: any,
  scope: IdempotencyScope,
  ttlMs: number = DEFAULT_RESULT_TTL_MS,
): Promise<void> {
  const rawKey = getIdempotencyKey(req);
  if (!rawKey) return;

  const key = buildScopedKey(rawKey, scope);

  const clone = response.clone();
  const body = await clone.text();

  const headers: Record<string, string> = {};
  clone.headers.forEach((value, name) => {
    headers[name] = value;
  });

  const { error } = await supabaseAdmin
    .from("request_idempotency")
    .upsert(
      {
        key,
        body,
        status: clone.status,
        headers,
        expires_at: new Date(Date.now() + ttlMs).toISOString(),
      },
      { onConflict: "key" },
    );

  if (error) {
    // Non-fatal: the real response has already been sent to the client;
    // we just failed to persist it for future retries. Log and move on.
    console.warn("[idempotency] result upsert failed:", error.message);
  }
}
