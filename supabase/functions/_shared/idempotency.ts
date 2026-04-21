/**
 * Shared idempotency helpers for Edge Functions.
 *
 * Backed by the `public.request_idempotency` table (see the migration named
 * `..._request_idempotency.sql`). Replaces the previous per-isolate
 * in-memory `Map` which couldn't survive cold starts and leaked across
 * concurrent isolates.
 *
 * Flow — both consumers (`create_checkout_session`, `delete_user_account`)
 * follow this pattern exactly:
 *
 *   const cached = await checkIdempotency(req, supabaseAdmin);
 *   if (cached) return cached;          // duplicate: 409 still-processing OR cached response
 *   ...process the request...
 *   const response = new Response(JSON.stringify(result), { ... });
 *   await storeIdempotencyResult(req, response, supabaseAdmin);
 *   return response;
 *
 * Race handling — this is the reason the module exists:
 *   checkIdempotency does an atomic UPSERT with
 *   `ignoreDuplicates: true` (same pattern as stripe_events). Whichever
 *   isolate's INSERT wins the primary-key race owns the key and returns
 *   `null` so the caller proceeds with the real work. The loser reads back
 *   the existing row:
 *     - status === 0 (still pending): returns 409 + Retry-After so the
 *       client retries in a moment. The pending claim has a short TTL
 *       (CLAIM_TTL_MS) so a crashed isolate doesn't deadlock retries.
 *     - status > 0 (completed): returns the cached response as-is.
 *
 * The service-role client is a required argument — idempotency.ts was a pure
 * helper before P12, so this is a breaking change. Only 2 consumers in-repo;
 * both updated in the same PR.
 */

/** TTL for completed responses — long enough to cover normal client retry windows. */
const DEFAULT_RESULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * TTL for pending claims. Intentionally short: if the claiming isolate
 * crashes before calling storeIdempotencyResult, the claim expires in 60s
 * and retries can proceed. Long enough to cover the slowest expected
 * downstream call (Stripe API round-trips are ~1-3s).
 */
const CLAIM_TTL_MS = 60 * 1000; // 1 minute

/**
 * Extract the idempotency key from the request.
 * Returns `null` when the header is absent (non-idempotent request).
 */
export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get("x-idempotency-key");
}

/**
 * Check whether a response for this idempotency key already exists.
 *
 * - Returns `null` if the caller should proceed with the real work (no
 *   header, or we just claimed the key).
 * - Returns a 409 `Response` with `Retry-After` if another isolate is
 *   currently processing the same key.
 * - Returns the cached `Response` if the request was already processed.
 *
 * Atomic claim implementation: we `upsert` a placeholder row (status = 0)
 * with `ignoreDuplicates: true`. On success, `inserted` is the new row —
 * we own the key. On conflict, `inserted` is null — somebody else owns it,
 * and we look up the stored row to decide what to return.
 */
export async function checkIdempotency(
  req: Request,
  supabaseAdmin: any,
): Promise<Response | null> {
  const key = getIdempotencyKey(req);
  if (!key) return null;

  const nowMs = Date.now();
  const claimExpiresAt = new Date(nowMs + CLAIM_TTL_MS).toISOString();

  // Atomic claim via upsert. `ignoreDuplicates` makes the SELECT return 0
  // rows on conflict — mirrors the stripe_events pattern in
  // `supabase/functions/stripe_webhook/index.ts`.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("request_idempotency")
    .upsert(
      {
        key,
        body: "",
        status: 0, // 0 = pending; real response will overwrite via storeIdempotencyResult
        headers: {},
        expires_at: claimExpiresAt,
      },
      { onConflict: "key", ignoreDuplicates: true },
    )
    .select("key")
    .maybeSingle();

  if (insertError) {
    // DB error — fail open (proceed without idempotency guarantee) so a
    // transient Postgres blip doesn't block user-facing calls entirely.
    console.warn("[idempotency] claim upsert failed:", insertError.message);
    return null;
  }

  if (inserted) {
    // We claimed the key — caller proceeds. storeIdempotencyResult will
    // overwrite the placeholder with the real response.
    return null;
  }

  // Conflict — somebody else owns this key. Read the existing row.
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
    // Row existed during the upsert but disappeared before our SELECT
    // (cleanup cron, or TTL boundary). Caller proceeds without a claim.
    return null;
  }

  if (new Date(existing.expires_at).getTime() <= nowMs) {
    // Stale pending claim (the owning isolate likely crashed). Caller
    // proceeds; storeIdempotencyResult on this run will overwrite via
    // upsert and extend the TTL.
    return null;
  }

  if (existing.status > 0) {
    // Completed — return the cached response.
    const headers = new Headers(existing.headers as Record<string, string>);
    return new Response(existing.body, {
      status: existing.status,
      headers,
    });
  }

  // status === 0 + not expired: another isolate is still processing this
  // key. Return 409 so the client retries shortly.
  return new Response(
    JSON.stringify({
      error: "A request with this idempotency key is currently being processed. Retry shortly.",
    }),
    {
      status: 409,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "2",
      },
    },
  );
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
 * usable by the caller.
 */
export async function storeIdempotencyResult(
  req: Request,
  response: Response,
  supabaseAdmin: any,
  ttlMs: number = DEFAULT_RESULT_TTL_MS,
): Promise<void> {
  const key = getIdempotencyKey(req);
  if (!key) return;

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
