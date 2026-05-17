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

import { authenticate } from "../_shared/auth.ts";
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
 * RFC 4122 UUID format check (8-4-4-4-12 hex, case-insensitive). The RPC
 * declares `outfit_id uuid` and `garment_ids uuid[]` parameters, so any
 * non-UUID value would fail Postgres type coercion with a generic
 * `invalid input syntax for type uuid` error and be reported back as
 * HTTP 500 `rpc_failed`. Repeated malformed calls would also tip the
 * overload guard, masking actual infrastructure issues. Validate at the
 * boundary so malformed payloads return a client-actionable HTTP 400.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(input: string): boolean {
  return UUID_REGEX.test(input);
}

/** All elements must be RFC 4122 UUIDs. Empty array OK. */
function isUuidArray(arr: readonly string[]): boolean {
  for (const v of arr) {
    if (!isUuid(v)) return false;
  }
  return true;
}

/**
 * Synthesize a deterministic idempotency key from the raw request body.
 *
 * `checkIdempotency` is a no-op when `x-idempotency-key` is absent. Per
 * the documented contract (`raw x-idempotency-key OR sha256(body)`), we
 * fall back to a stable hash of the raw JSON text when the client omits
 * the header. Identical bodies within the 5-min cache window collapse
 * to one row; semantically distinct events get distinct keys.
 *
 * The "auto:" prefix is purely for telemetry / debugging — it makes
 * synthetic keys visually distinguishable from client-supplied UUIDs in
 * `request_idempotency.key`. The shared helper treats the raw key as
 * opaque; the prefix has no semantic effect.
 */
async function synthesizeBodyHashKey(rawBody: string): Promise<string> {
  const text = rawBody.length > 0 ? rawBody : "{}";
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "auto:" + hex;
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

/**
 * Coerce optional rating: integer 1-5, null/undefined for omitted, or
 * `undefined` (sentinel for "rejected by validator").
 *
 * The RPC's `rate_outfit` branch derives pair-memory direction directly
 * from the rating value (`>= 4` → positive, `<= 2` → negative), so a
 * malformed payload like `rating: 0`, `rating: 10`, or `rating: 3.5`
 * would silently write incorrect feedback signals. Reject with HTTP 400
 * (caller maps `undefined` return to that response) for any value
 * outside the documented 1-5 integer contract.
 */
function coerceOptionalRating(input: unknown): number | null | undefined {
  if (input === undefined || input === null) return null;
  if (typeof input !== "number" || !Number.isFinite(input)) return undefined;
  if (!Number.isInteger(input)) return undefined;
  if (input < 1 || input > 5) return undefined;
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
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
  }

  if (checkOverload("memory_ingest")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── 1. Auth ────────────────────────────────────────────────────────
    // JWT verification before anything else. user.id comes from the
    // verified token — never trust client-supplied user_id.
    //
    // N21: migrated to shared `authenticate` helper (#879). Same 401
    // envelopes (`Missing authorization header` / `Unauthorized`), same
    // `Cache-Control: no-store` on failures (helper sets it for every
    // function automatically, removing the per-function duplication).
    const authResult = await authenticate(req, CORS_HEADERS);
    if (!authResult.success) return authResult.response;
    const { user } = authResult.auth;
    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── 2. Parse body ─────────────────────────────────────────────────
    // Accept only plain JSON objects. JSON.parse happily returns null /
    // arrays / bare primitives for valid-but-non-object inputs (e.g.,
    // `null`, `42`, `[]`, `"hello"`); without an explicit shape check the
    // subsequent `body.event_type` access would throw and surface as
    // an opaque 500 internal_error from the outer catch — masking a
    // client bug as an infrastructure failure and tipping the overload
    // guard. Reject with the documented 400 invalid-body envelope instead.
    let body: Record<string, unknown>;
    let rawBodyText = "";
    try {
      rawBodyText = await req.text();
      const parsed = rawBodyText.length > 0 ? JSON.parse(rawBodyText) : {};
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return new Response(
          JSON.stringify({ error: "invalid body" }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      }
      body = parsed as Record<string, unknown>;
    } catch (parseErr) {
      console.warn(
        "[memory_ingest] body parse failed:",
        parseErr instanceof Error ? parseErr.message : String(parseErr),
      );
      return new Response(
        JSON.stringify({ error: "invalid body" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
        },
      );
    }

    // ── 3. Validate signal_type + normalize ────────────────────────────
    // Canonical body field is `signal_type` (matches RecordMemoryEventInput +
    // feedback_signals.signal_type column). Older PR A drafts read
    // `event_type` for parity with the RPC's p_event_type — accept that as a
    // fallback for back-compat in case any caller still uses it. Surfaced
    // as a CI smoke-test failure on commit 2e4288d4 (round 5+6 audit).
    const rawEventType =
      typeof body.signal_type === "string" && body.signal_type.length > 0
        ? body.signal_type
        : body.event_type;
    if (typeof rawEventType !== "string" || rawEventType.length === 0) {
      return new Response(
        JSON.stringify({ error: "signal_type required" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
        },
      );
    }
    // outfit_id, when present, must be a UUID. The RPC parameter is `uuid`
    // and a non-UUID would crash Postgres type coercion → HTTP 500. Reject
    // at the boundary with a client-actionable 400 instead.
    if (outfitId !== null && !isUuid(outfitId)) {
      return new Response(
        JSON.stringify({ error: "outfit_id must be a UUID" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
        },
      );
    }
    // Each element must be a UUID — RPC parameters are `uuid[]`. Same
    // rationale as outfit_id: client-actionable 400 instead of opaque 500.
    if (
      !isUuidArray(garmentIds) ||
      !isUuidArray(removedGarmentIds) ||
      !isUuidArray(addedGarmentIds)
    ) {
      return new Response(
        JSON.stringify({
          error:
            "garment_ids / removed_garment_ids / added_garment_ids must contain only UUIDs",
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
        },
      );
    }

    const rating = coerceOptionalRating(body.rating);
    if (rating === undefined) {
      return new Response(
        JSON.stringify({ error: "rating must be a finite number" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
            headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
    //
    // "Not supplied" includes BOTH the literal `null` (`coerceOptionalString`
    // returns `null` for `undefined`/`null` input) AND the empty string (the
    // explicit "" pass-through that some clients emit). Any non-empty
    // value the caller supplies is preserved verbatim.
    if (
      canonical === "quick_reaction" &&
      (value === null || value === "")
    ) {
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
    //
    // Body-hash fallback: `checkIdempotency` is a no-op when no
    // `x-idempotency-key` header is supplied. Without a fallback, normal
    // browser/network retries would silently double-write feedback_signals
    // and pair-memory weights (cumulative, ranking-driving), skewing user
    // preferences. Synthesize a stable key from sha256(rawBody) when the
    // client omits the header. Identical logical writes in the 5-min
    // window collapse to one row; semantically distinct events (different
    // body) get distinct keys.
    const clientIdempotencyKey = req.headers.get("x-idempotency-key");
    const effectiveIdempotencyKey = clientIdempotencyKey ??
      (await synthesizeBodyHashKey(rawBodyText));
    // Build a minimal Request that exposes the effective key. The
    // shared helper only reads `x-idempotency-key`; method/body/url
    // are irrelevant here.
    const idempotencyReq = new Request(req.url, {
      method: "POST",
      headers: { "x-idempotency-key": effectiveIdempotencyKey },
    });
    const idempotencyScope = {
      functionName: "memory_ingest",
      userId,
    };
    const cached = await checkIdempotency(
      idempotencyReq,
      adminClient,
      idempotencyScope,
    );
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
      // Round 6 R6-1: ownership-validation failures inside the RPC raise
      // SQLSTATE 42501 (insufficient_privilege). Translate to HTTP 403 so
      // the client can see "this is your fault, don't retry" rather than
      // the generic 500 that would otherwise enqueue forever in the
      // offline queue. Also covers cross-user write blocked + unauthorized
      // caller paths from the existing PR A authorization check.
      const pgCode = (rpcError as { code?: string }).code ?? "";
      const errMsg = rpcError.message ?? "";
      const isOwnership =
        pgCode === "42501" ||
        /not owned by user|cross-user write blocked|unauthorized caller/i.test(errMsg);
      const isValidation =
        pgCode === "22023" ||
        /event_type.*(?:is required|is not canonical)/i.test(errMsg);

      console.error("[memory_ingest] ingest_memory_event RPC error:", {
        userId,
        event_type: canonical,
        code: pgCode,
        message: errMsg,
      });

      if (isOwnership) {
        // Don't tip the overload guard — this is a client bug, not a
        // transport-level storm.
        return new Response(
          JSON.stringify({ error: "ownership_denied" }),
          {
            status: 403,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      }
      if (isValidation) {
        return new Response(
          JSON.stringify({ error: "invalid_event" }),
          {
            status: 400,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      }

      recordError("memory_ingest");
      return new Response(
        JSON.stringify({ error: "rpc_failed" }),
        {
          status: 500,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
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
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
    // Store the cached result against the SAME synthetic key the check
    // used; otherwise a body-hash fallback check would never land in the
    // cache (because the original `req` has no x-idempotency-key header)
    // and retries would still re-run the RPC.
    await storeIdempotencyResult(
      idempotencyReq,
      response,
      adminClient,
      idempotencyScope,
    );
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
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
  }
});
