/**
 * enqueue_render_job
 *
 * User-JWT-facing edge function that:
 *   1. Authenticates the caller (user JWT)
 *   2. Validates garment ownership + resolves presentation/prompt version
 *   3. Pre-generates render_jobs.id so reserve_credit_atomic can record it
 *   4. Atomically reserves one render credit (idempotent on reserve_key)
 *   5. INSERTs a render_jobs row (idempotent via UNIQUE reserve_key)
 *   6. Fires a non-blocking POST to process_render_jobs { jobId } for
 *      the low-latency client-initiated path. Cron safety net (every
 *      60s) picks up the row if this POST is lost.
 *
 * Design notes:
 *   * render_jobs.id is pre-generated here (not via DEFAULT gen_random_uuid)
 *     so reserve_credit_atomic records the canonical UUID as
 *     render_credit_transactions.render_job_id. Later consume/release calls
 *     (from inside render_garment_image or from process_render_jobs) resolve
 *     the reserve transaction by this ID.
 *   * reserveCredit is idempotent on the colon-prefixed reserve_key — if the
 *     client retries the enqueue (network flake), reserve hits the replay
 *     path and returns replay:true without minting. The INSERT then hits its
 *     ON CONFLICT (reserve_key) DO NOTHING guard so no duplicate row.
 *   * 402 (trial_studio_locked / insufficient) is returned synchronously so
 *     the UI can show the upgrade CTA without waiting on the worker.
 */
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
  checkOverload,
  overloadResponse,
  recordError,
} from "../_shared/scale-guard.ts";
import { reserveCredit } from "../_shared/render-credits.ts";
import { normalizeMannequinPresentation } from "../_shared/mannequin-presentation.ts";
import { logger } from "../_shared/logger.ts";

const log = logger("enqueue_render_job");

/**
 * Bump when the prompt or Gemini parameters change materially. Must stay in
 * sync with render_garment_image's RENDER_PROMPT_VERSION — both fold this
 * into the idempotency-key baseKey, so a mismatch would cause reserve
 * short-circuit misses.
 */
const RENDER_PROMPT_VERSION = "v1";

const VALID_SOURCES = new Set([
  "add_photo",
  "batch_add",
  "live_scan",
  "manual_enhance",
  "retry",
]);

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (checkOverload("enqueue_render_job")) {
    return overloadResponse(CORS_HEADERS);
  }

  let garmentId: string;
  let source: string;
  let clientNonce: string;

  // Nested try: isolates malformed-input errors from the overload counter
  // (same pattern as P4 bug 10 — authenticated users must not be able to
  // trip the circuit breaker via malformed JSON).
  try {
    const body = await req.json();
    garmentId = body?.garmentId;
    source = body?.source;
    clientNonce = body?.clientNonce;

    if (!isUuid(garmentId)) {
      return jsonResponse({ error: "garmentId must be a UUID" }, 400);
    }
    if (typeof source !== "string" || !VALID_SOURCES.has(source)) {
      return jsonResponse({ error: "source missing or invalid" }, 400);
    }
    if (typeof clientNonce !== "string" || clientNonce.length < 8) {
      return jsonResponse({ error: "clientNonce required" }, 400);
    }
  } catch (_e) {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "missing auth" }, 401);
    }
    const token = authHeader.slice("Bearer ".length);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "auth failed" }, 401);
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      await enforceRateLimit(serviceClient, user.id, "enqueue_render_job");
    } catch (e) {
      if (e instanceof RateLimitError) {
        return rateLimitResponse(e, CORS_HEADERS);
      }
      throw e;
    }

    // ─── Garment ownership + presentation ──────────────────
    const { data: garment, error: garmentError } = await serviceClient
      .from("garments")
      .select("id, user_id, title")
      .eq("id", garmentId)
      .single();

    if (garmentError || !garment) {
      return jsonResponse({ error: "garment not found" }, 404);
    }
    if (garment.user_id !== user.id) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    // Resolve presentation from the profile (falls back to mixed).
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("mannequin_presentation")
      .eq("id", user.id)
      .maybeSingle();
    const presentation = normalizeMannequinPresentation(profile?.mannequin_presentation);

    // ─── Pre-generate canonical render_job_id ──────────────
    const jobId = crypto.randomUUID();
    const baseKey = `${user.id}_${garmentId}_${presentation}_${RENDER_PROMPT_VERSION}_${clientNonce}`;
    const reserveKey = `reserve:${baseKey}`;

    // ─── Reserve credit (idempotent on replay flag) ────────
    const reserveResult = await reserveCredit(serviceClient, user.id, jobId, reserveKey);

    if (!reserveResult.ok) {
      // Business denial → 402 so the client can show the right CTA.
      // reason=insufficient is expected when monthly_allowance=0 (trial locked)
      // or when all three balances are drained.
      if (reserveResult.reason === "insufficient" || reserveResult.reason === "no_credit_row") {
        // Distinguish trial_studio_locked from insufficient by looking at allowance.
        const { data: credits } = await serviceClient
          .from("render_credits")
          .select("monthly_allowance")
          .eq("user_id", user.id)
          .maybeSingle();
        const trialLocked = !credits || credits.monthly_allowance === 0;
        return jsonResponse({
          error: trialLocked ? "trial_studio_locked" : "insufficient_credits",
        }, 402);
      }
      // Transport-level failure — trip the circuit breaker.
      if (reserveResult.reason === "rpc_error") {
        recordError("enqueue_render_job");
        return jsonResponse({ error: "rpc_error", detail: reserveResult.error ?? "" }, 503);
      }
      return jsonResponse({ error: reserveResult.reason }, 500);
    }

    // ─── INSERT render_jobs row ────────────────────────────
    // ON CONFLICT on reserve_key: retried enqueue with same clientNonce
    // gets the already-existing row back rather than erroring. Combined
    // with reserve's replay flag, this is race-safe.
    const { data: insertedRow, error: insertError } = await serviceClient
      .from("render_jobs")
      .upsert(
        {
          id: jobId,
          user_id: user.id,
          garment_id: garmentId,
          client_nonce: clientNonce,
          status: "pending",
          source,
          presentation,
          prompt_version: RENDER_PROMPT_VERSION,
          reserve_key: reserveKey,
        },
        { onConflict: "reserve_key", ignoreDuplicates: false },
      )
      .select("id, status")
      .single();

    if (insertError || !insertedRow) {
      // INSERT failed after reserve succeeded. Reservation remains claimed
      // against jobId; orphan-reservation cleanup cron (post-launch
      // follow-up) will release it. For now, return a retryable error so
      // the client can try again — reserve's replay flag makes the retry
      // safe (no double-charge).
      recordError("enqueue_render_job");
      log.error("render_jobs INSERT failed after reserve succeeded", {
        jobId,
        user_id: user.id,
        error: insertError?.message,
      });
      return jsonResponse({ error: "insert_failed", retryable: true }, 500);
    }

    // Mark garment as rendering-pending so the UI can show the shimmer
    // state without waiting for the worker to claim. On success this gets
    // overwritten with rendered_image_path; on failure it flips to 'failed'.
    // Separate UPDATE so a concurrent Gemini render of a previous attempt
    // doesn't race the INSERT.
    const { error: garmentUpdateError } = await serviceClient
      .from("garments")
      .update({
        render_status: "pending",
        render_provider: "gemini-image",
        render_error: null,
      })
      .eq("id", garmentId);

    if (garmentUpdateError) {
      log.warn("garment render_status update failed (non-fatal)", {
        garmentId,
        error: garmentUpdateError.message,
      });
    }

    // ─── Low-latency path: POST process_render_jobs ────────
    // Fire-and-forget. Does NOT await — worst case, pg_cron catches the
    // job within 60s. Service-role auth because the worker is locked
    // down to service-role only.
    const processorUrl = `${SUPABASE_URL}/functions/v1/process_render_jobs`;
    fetch(processorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ jobId }),
    }).catch((err) => {
      // Non-fatal: cron will pick it up.
      log.warn("process_render_jobs kickoff failed (cron will retry)", {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return jsonResponse({
      jobId,
      status: insertedRow.status,
      source: reserveResult.source,
      replay: reserveResult.replay,
    }, 200);
  } catch (e) {
    log.exception("enqueue_render_job error", e);
    recordError("enqueue_render_job");
    return jsonResponse(
      { error: e instanceof Error ? e.message : "internal error" },
      500,
    );
  }
});
