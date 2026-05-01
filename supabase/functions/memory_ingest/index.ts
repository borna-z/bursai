/**
 * Wave 8.5 P85 — memory_ingest edge function.
 *
 * Canonical entry point for every Style Memory write. Per Wave 8.5 D3
 * (atomic triple-write architecture), this function:
 *
 *   1. Verifies the caller's JWT (anon client + getUser).
 *   2. Validates the body shape (event_type required; arrays + scalars
 *      coerced safely from JSON).
 *   3. Normalizes legacy or canonical event_type via the P83 helper. Drops
 *      unknown / dead-enum signals with HTTP 400. For lossy reaction
 *      legacy aliases (`like` / `dislike` / `thumbs_down` → `quick_reaction`),
 *      auto-fills `value` from the raw alias when the caller didn't
 *      supply one — preserves polarity through normalization.
 *   4. Dedupes via the standard request_idempotency helper (P12) BEFORE
 *      gating on rate limit / subscription. Retries of a logical write
 *      (same idempotency key) short-circuit to the cached response without
 *      burning rate-limit quota or paying for a fresh subscription
 *      lookup. Idempotency scoped on
 *      `(memory_ingest, userId, raw x-idempotency-key OR sha256(body))`.
 *   5. Gates on rate limit (memory_ingest tier in scale-guard.ts:
 *      200/hr, 30/min) — tight enough to bound runaway useEffect storms
 *      from client bugs, loose enough that active users tapping save/wear/
 *      rate dozens of times per session aren't throttled.
 *   6. Gates on subscription state (Wave 8 P54 paywall). Memory writes are
 *      a paid-tier feature; trialing + premium users pass. Onboarding
 *      bypasses (Wave 7 P43 — first 24h post-onboarding-start).
 *   7. Calls the `ingest_memory_event` Postgres RPC, which atomically
 *      INSERTs feedback_signals + UPSERTs garment_pair_memory + marks
 *      user_style_summaries dirty in ONE transaction.
 *
 * Body contract:
 *   {
 *     event_type: string,           // legacy or canonical; normalized server-side
 *     outfit_id?: string,           // outfit-level signals
 *     garment_ids?: string[],       // event-specific semantics
 *     removed_garment_ids?: string[], // swap_garment
 *     added_garment_ids?: string[],   // swap_garment
 *     rating?: number,              // rate_outfit (1-5)
 *     feedback_text?: string,       // optional explanation
 *     value?: string,               // quick_reaction direction (like|dislike)
 *     metadata?: Record<string, unknown>,
 *     source?: string,              // analytics tag (e.g. 'OutfitDetail')
 *   }
 *
 * Response shape:
 *   200 { ok: true, signal_id: string, event_type: <canonical>, pair_delta: number }
 *   400 { error: 'unknown_signal_type', signal_type: <orig> }
 *   400 { error: 'event_type required' }
 *   400 { error: 'invalid body' }
 *   401 { error: 'Missing authorization header' | 'Unauthorized' }
 *   402 { error: 'subscription_required', reason: 'locked' | 'expired' }
 *   405 { error: 'Method not allowed' }
 *   429 { error, retryAfter, ... }
 *   500 { error: 'rpc_failed' }
 *   503 { error: 'overloaded' } (transient — caller backs off)
 *
 * Auth pattern: user-facing function (matches grant_trial_gift / start_trial /
 * delete_user_account). Anon client + getUser() to verify the JWT, then the
 * service-role client for the RPC.
 *
 * D5 lazy materialization: this function does NOT trigger summary rebuild
 * inline. The RPC marks user_style_summaries dirty; the engine readers
 * (P88/P89) trigger rebuild on next access via the deterministic builder
 * (P87 — built in parallel by another agent).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { CORS_HEADERS } from "../_shared/cors.ts";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
  enforceSubscription,
  subscriptionLockedResponse,
  checkOverload,
  overloadResponse,
  recordError,
} from "../_shared/scale-guard.ts";
import {
  checkIdempotency,
  storeIdempotencyResult,
} from "../_shared/idempotency.ts";
import { normalizeStyleMemorySignal } from "../_shared/style-memory-signals.ts";

/**
 * Strict array-of-strings coercion. Returns the original array when every
 * element is a string; otherwise returns null so the validator rejects the
 * payload. Plain `Array.isArray` checks would let `[1, 2, 3]` slip through
 * and the RPC would reject downstream — surfacing the failure as a vague
 * 500 instead of an actionable 400.
 */
function coerceStringArray(input: unknown): string[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return null;
  for (const v of input) {
    if (typeof v !== "string") return null;
  }
  return input as string[];
}

/**
 * Coerce an optional string field. Returns the string when present, null
 * when absent, the special `undefined` sentinel when the key is set to a
 * non-string.
 */
function coerceOptionalString(
  input: unknown,
): string | null | undefined {
  if (input === undefined || input === null) return null;
  if (typeof input !== "string") return undefined;
  return input;
}

/** Coerce optional rating: integer 1-5 or null/undefined. */
function coerceOptionalRating(input: unknown): number | null | undefined {
  if (input === undefined || input === null) return null;
  if (typeof input !== "number" || !Number.isFinite(input)) return undefined;
  return input;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  if (checkOverload("memory_ingest")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── 1. Auth ────────────────────────────────────────────────────────
    // JWT verification before anything else. user.id comes from the
    // verified token — never trust client-supplied user_id.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await userClient.auth
      .getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── 2. Parse body ─────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      const raw = await req.text();
      body = raw.length > 0 ? JSON.parse(raw) : {};
    } catch (parseErr) {
      console.warn(
        "[memory_ingest] body parse failed:",
        parseErr instanceof Error ? parseErr.message : String(parseErr),
      );
      return new Response(
        JSON.stringify({ error: "invalid body" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // ── 3. Validate event_type + normalize ─────────────────────────────
    const rawEventType = body.event_type;
    if (typeof rawEventType !== "string" || rawEventType.length === 0) {
      return new Response(
        JSON.stringify({ error: "event_type required" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const canonical = normalizeStyleMemorySignal(rawEventType);
    if (!canonical) {
      // Unknown signal name OR dead enum (`garment_edit`). Reject with 400
      // so client-side bugs are observable, not silently swallowed.
      console.warn(
        "[memory_ingest] dropping unknown signal_type:",
        rawEventType,
      );
      return new Response(
        JSON.stringify({
          error: "unknown_signal_type",
          signal_type: rawEventType,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // ── 4. Validate scalars + arrays ───────────────────────────────────
    const outfitId = coerceOptionalString(body.outfit_id);
    if (outfitId === undefined) {
      return new Response(
        JSON.stringify({ error: "outfit_id must be a string" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const garmentIds = coerceStringArray(body.garment_ids);
    const removedGarmentIds = coerceStringArray(body.removed_garment_ids);
    const addedGarmentIds = coerceStringArray(body.added_garment_ids);
    if (
      garmentIds === null ||
      removedGarmentIds === null ||
      addedGarmentIds === null
    ) {
      return new Response(
        JSON.stringify({
          error: "garment_ids / removed_garment_ids / added_garment_ids must be string arrays",
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const rating = coerceOptionalRating(body.rating);
    if (rating === undefined) {
      return new Response(
        JSON.stringify({ error: "rating must be a finite number" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const feedbackText = coerceOptionalString(body.feedback_text);
    let value = coerceOptionalString(body.value);
    const source = coerceOptionalString(body.source);
    if (
      feedbackText === undefined ||
      value === undefined ||
      source === undefined
    ) {
      return new Response(
        JSON.stringify({
          error: "feedback_text / value / source must be strings",
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    let metadata: Record<string, unknown> = {};
    if (
      body.metadata !== undefined &&
      body.metadata !== null
    ) {
      if (
        typeof body.metadata !== "object" ||
        Array.isArray(body.metadata)
      ) {
        return new Response(
          JSON.stringify({ error: "metadata must be an object" }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          },
        );
      }
      metadata = body.metadata as Record<string, unknown>;
    }

    // ── 4b. Preserve polarity through lossy reaction normalization ─────
    // Legacy reaction aliases (`like`, `dislike`, `thumbs_down`) collapse
    // to the canonical `quick_reaction` and lose their direction in the
    // process. The `ingest_memory_event` RPC derives pair-memory direction
    // exclusively from `p_value` (or `p_metadata.value`), so a normalized
    // `quick_reaction` event with no explicit `value` would be directionless
    // and skip the pair-memory write entirely. Auto-fill `value` from the
    // raw alias when (a) canonical is `quick_reaction`, (b) caller did NOT
    // supply `value`, and (c) the raw alias encodes polarity. The RPC
    // accepts these alias strings directly (`p_value IN ('like','dislike',
    // 'thumbs_down','positive','negative','thumbs_up')` per the SQL body).
    if (canonical === "quick_reaction" && value === "") {
      if (rawEventType === "like") {
        value = "like";
      } else if (
        rawEventType === "dislike" ||
        rawEventType === "thumbs_down"
      ) {
        value = rawEventType;
      }
    }

    // ── 5. Idempotency (run BEFORE rate-limit / subscription gates) ────
    // Standard request_idempotency helper. Scope is (memory_ingest, userId,
    // x-idempotency-key). Re-fires within the 5-min window collapse to a
    // cached response. Auto-injected userId scope prevents cross-user replay.
    //
    // Order matters: idempotency BEFORE the gates so duplicate retries of a
    // logical write (same key) short-circuit to the cached response without
    // burning rate-limit quota. memory_ingest is a high-frequency endpoint
    // — clients tap save/wear/rate dozens of times per session and may
    // retry on transient network errors. Gating-first would let a retry
    // storm starve the legitimate next event under the per-minute cap even
    // though the duplicate's side effects are already prevented.
    const idempotencyScope = {
      functionName: "memory_ingest",
      userId,
    };
    const cached = await checkIdempotency(req, adminClient, idempotencyScope);
    if (cached) {
      return cached;
    }

    // ── 6. Rate limit ──────────────────────────────────────────────────
    // Gate on memory_ingest tier (200/hr, 30/min). Onboarding multiplier
    // (3x) applies — new users explore heavily and we want every tap.
    await enforceRateLimit(adminClient, userId, "memory_ingest");

    // ── 7. Subscription gate ───────────────────────────────────────────
    // Memory writes are a paid-tier feature. Onboarding bypasses (Wave 7
    // P43 — first 24h post-onboarding-start). Trialing + active+premium
    // pass. Everything else 402.
    const subResult = await enforceSubscription(adminClient, userId);
    if (!subResult.allowed) {
      return subscriptionLockedResponse(subResult.reason, CORS_HEADERS);
    }

    // ── 8. Call the RPC ────────────────────────────────────────────────
    // Atomic triple-write. The RPC returns
    // { ok, signal_id, event_type, pair_delta } as jsonb. On error, log
    // + tip the overload guard (transient infrastructure signal) + 500.
    const { data, error: rpcError } = await adminClient.rpc(
      "ingest_memory_event",
      {
        p_user_id: userId,
        p_event_type: canonical,
        p_outfit_id: outfitId,
        p_garment_ids: garmentIds,
        p_removed_garment_ids: removedGarmentIds,
        p_added_garment_ids: addedGarmentIds,
        p_rating: rating,
        p_feedback_text: feedbackText,
        p_value: value,
        p_metadata: metadata,
        p_source: source,
      },
    );

    if (rpcError) {
      console.error("[memory_ingest] ingest_memory_event RPC error:", {
        userId,
        event_type: canonical,
        message: rpcError.message,
      });
      recordError("memory_ingest");
      return new Response(
        JSON.stringify({ error: "rpc_failed" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // RPC return is jsonb. Defensive coercion — the RPC currently always
    // returns an object with the four keys, but treating it as `unknown`
    // shields us from any future signature drift.
    const rpcResult = data as
      | {
          ok?: unknown;
          signal_id?: unknown;
          event_type?: unknown;
          pair_delta?: unknown;
        }
      | null
      | undefined;

    if (!rpcResult || rpcResult.ok !== true) {
      console.error("[memory_ingest] RPC returned non-ok:", {
        userId,
        event_type: canonical,
        result: rpcResult,
      });
      recordError("memory_ingest");
      return new Response(
        JSON.stringify({ error: "rpc_failed" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const signalId =
      typeof rpcResult.signal_id === "string" ? rpcResult.signal_id : "";
    const pairDelta =
      typeof rpcResult.pair_delta === "number" ? rpcResult.pair_delta : 0;

    // ── 9. Observability log line ──────────────────────────────────────
    // One line per successful ingest. Used by post-launch dashboards to
    // track signal volume per user / event_type and detect runaway client
    // loops before they trip the rate limit.
    console.log(
      JSON.stringify({
        fn: "memory_ingest",
        user_id: userId,
        event_type: canonical,
        signal_id: signalId,
        pair_delta: pairDelta,
      }),
    );

    // ── 10. Build response + cache for idempotency ─────────────────────
    const response = new Response(
      JSON.stringify({
        ok: true,
        signal_id: signalId,
        event_type: canonical,
        pair_delta: pairDelta,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
    await storeIdempotencyResult(req, response, adminClient, idempotencyScope);
    return response;
  } catch (err) {
    if (err instanceof RateLimitError) {
      return rateLimitResponse(err, CORS_HEADERS);
    }
    // Unknown errors trip the overload guard so a transport-level storm
    // (eg, RPC timing out, getUser() outage) eventually short-circuits to
    // 503 instead of hammering the upstream.
    recordError("memory_ingest");
    console.error(
      "[memory_ingest] unexpected error:",
      err instanceof Error ? err.message : String(err),
    );
    return new Response(
      JSON.stringify({
        error: "internal_error",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});
