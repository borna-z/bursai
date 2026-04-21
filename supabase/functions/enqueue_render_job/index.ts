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
import { deriveRenderJobId } from "../_shared/render-job-id.ts";
import { logger } from "../_shared/logger.ts";

const log = logger("enqueue_render_job");

/**
 * Bump when the prompt or Gemini parameters change materially. Must stay in
 * sync with render_garment_image's RENDER_PROMPT_VERSION — both fold this
 * into the idempotency-key baseKey, so a mismatch would cause reserve
 * short-circuit misses.
 *
 * v1 → v2 (Wave 3-B fix 10, Codex P1 round 7, 2026-04-21):
 * render_garment_image was bumped to v2 earlier in the wave but this file
 * was missed. That left the two sides drifted: enqueue reserved v1 keys
 * while render_garment_image's local-constant fallback (for internal
 * invocations missing the forwarded promptVersion) computed v2 keys. For
 * in-flight jobs in that fallback path, consume/release would miss their
 * v1 reserve → `no_reservation` → user either double-charged (on a
 * subsequent retry that mints a fresh v2 reservation) or orphaned reserve
 * persists until cleanup cron. The two sides are now back in lockstep.
 * For pre-deploy in-flight v1 jobs: the render_jobs row carries
 * `prompt_version='v1'`, the worker forwards that value, and
 * render_garment_image uses the forwarded value via `internalPromptVersion`
 * — so completions land on the v1 reserve as expected.
 */
const RENDER_PROMPT_VERSION = "v2";

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
  let force: boolean;

  // Nested try: isolates malformed-input errors from the overload counter
  // (same pattern as P4 bug 10 — authenticated users must not be able to
  // trip the circuit breaker via malformed JSON).
  try {
    const body = await req.json();
    garmentId = body?.garmentId;
    source = body?.source;
    clientNonce = body?.clientNonce;
    // Force: optional boolean. User-initiated regenerate passes true so
    // render_garment_image bypasses the product-ready eligibility gate AND
    // the "already ready/rendering/skipped" early-return. Default false
    // keeps first-time generations respecting the gates. Codex round 10
    // caught that P5 was dropping this flag — the regenerate button was
    // silently broken post-P5 until this plumbing landed.
    force = body?.force === true;

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
    // Single query filters on id AND user_id — collapses the "exists but
    // not yours" vs "doesn't exist" branches into one 404. A user
    // iterating UUIDs can't distinguish the two cases, closing the
    // wardrobe-enumeration oracle.
    const { data: garment, error: garmentError } = await serviceClient
      .from("garments")
      .select("id, title")
      .eq("id", garmentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (garmentError || !garment) {
      return jsonResponse({ error: "garment not found" }, 404);
    }

    // Resolve presentation from the profile (falls back to mixed).
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("mannequin_presentation")
      .eq("id", user.id)
      .maybeSingle();
    const presentation = normalizeMannequinPresentation(profile?.mannequin_presentation);

    // ─── Derive canonical render_job_id deterministically ──
    // CRITICAL: derived from baseKey (SHA-256 → UUID) NOT random. If we
    // generated a fresh UUID here, an enqueue retry with the same
    // clientNonce after a transport/INSERT failure would produce a
    // different jobId on the retry. The reserve_credit_atomic tx from
    // the first attempt is stored with render_job_id = firstJobId, but
    // the retry's INSERT would land with id = secondJobId. Downstream
    // consume/release (which look up the reserve by render_job_id) would
    // miss → `no_reservation` → silent consume failure → user gets a
    // free render while the original reservation leaks forever.
    //
    // Deterministic derivation means every retry with the same baseKey
    // produces the same ID. Reserve's replay, INSERT's ON CONFLICT, and
    // consume/release's render_job_id lookup all resolve to the single
    // canonical ID. Matches P4 render_garment_image's existing pattern.
    const baseKey = `${user.id}_${garmentId}_${presentation}_${RENDER_PROMPT_VERSION}_${clientNonce}`;
    const jobId = await deriveRenderJobId(baseKey);
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
    // Plain INSERT (no merge-upsert) to preserve row-level idempotency. If
    // a row already exists with this reserve_key (retried enqueue with the
    // same clientNonce, or a concurrent double-request), the UNIQUE
    // constraint raises 23505 and we SELECT the existing row to recover
    // its canonical `id`.
    //
    // IMPORTANT: we return the EXISTING row's id, NOT the newly-generated
    // jobId. The reserve transaction was written against the existing
    // row's id (that's what reserveCredit's replay flag caught); downstream
    // consume/release must reference the same id to resolve the reserve
    // transaction via render_job_id. A merge-upsert here would rewrite
    // render_jobs.id to the fresh jobId and strand the reservation.
    let canonicalJobId = jobId;
    let canonicalStatus: "pending" | "in_progress" | "succeeded" | "failed" = "pending";
    let rowAlreadyExisted = false;

    const { data: insertedRow, error: insertError } = await serviceClient
      .from("render_jobs")
      .insert({
        id: jobId,
        user_id: user.id,
        garment_id: garmentId,
        client_nonce: clientNonce,
        status: "pending",
        source,
        presentation,
        prompt_version: RENDER_PROMPT_VERSION,
        reserve_key: reserveKey,
        force,
      })
      .select("id, status")
      .single();

    if (insertError) {
      // 23505 = unique_violation. UNIQUE constraint is on reserve_key; if
      // we hit it, a row already exists from a prior enqueue attempt with
      // the same clientNonce. Fetch and return that row.
      if ((insertError as { code?: string }).code === "23505") {
        const { data: existingRow, error: selectError } = await serviceClient
          .from("render_jobs")
          .select("id, status")
          .eq("reserve_key", reserveKey)
          .maybeSingle();

        if (selectError || !existingRow) {
          // Very unusual: UNIQUE fired but the row isn't there. Could be a
          // concurrent delete (test harness) or an inconsistent cache. Surface
          // as a retryable 500; reserve's replay keeps the second attempt safe.
          recordError("enqueue_render_job");
          log.error("unique violation with no recoverable row", {
            reserveKey,
            selectError: selectError?.message,
          });
          return jsonResponse({ error: "enqueue_inconsistent_state", retryable: true }, 500);
        }

        canonicalJobId = existingRow.id;
        canonicalStatus = existingRow.status as typeof canonicalStatus;
        rowAlreadyExisted = true;
      } else {
        // Non-23505 insert failure (e.g. DB transport error). Reservation
        // remains claimed against jobId; the orphan-reservation cleanup
        // cron (post-launch follow-up) will release it if the client never
        // retries. For the client-retry case, reserve's replay flag makes
        // the retry a no-op against the ledger.
        //
        // CRITICAL: the caller MUST retry with the SAME clientNonce so the
        // replay path fires. A fresh nonce creates a new reserve_key and a
        // new reservation, orphaning the original. See garmentIntelligence.ts.
        recordError("enqueue_render_job");
        log.error("render_jobs INSERT failed after reserve succeeded", {
          jobId,
          user_id: user.id,
          error: insertError.message,
        });
        return jsonResponse({ error: "insert_failed", retryable: true }, 500);
      }
    } else if (insertedRow) {
      canonicalJobId = insertedRow.id;
      canonicalStatus = insertedRow.status as typeof canonicalStatus;
    }

    // Mark garment as rendering-pending so the UI can show the shimmer
    // state without waiting for the worker to claim. On success this gets
    // overwritten with rendered_image_path; on failure it flips to 'failed'.
    //
    // For retry-hits-existing-row (23505 path), the decision is nuanced:
    //   * canonicalStatus 'succeeded' / 'failed' → existing job is
    //     TERMINAL. Skip the garment update; the garment's current state
    //     already reflects the correct terminal outcome (ready / failed),
    //     and forcing it back to 'pending' would make the UI shimmer over
    //     an already-rendered image until the worker short-circuits.
    //   * canonicalStatus 'pending' / 'in_progress' → existing job is
    //     STILL IN FLIGHT. DO update the garment to 'pending'. Rationale:
    //     the original enqueue attempt might have succeeded the INSERT
    //     but failed the garment UPDATE (narrow transient), leaving the
    //     garment in a stale state. This retry is the chance to correct
    //     it. Without this, the worker could later see render_status='ready'
    //     (from a truly-stale-since-P4 row) and short-circuit without
    //     running Gemini, consume-failing, and leaving the reservation
    //     stranded.
    const shouldUpdateGarment =
      !rowAlreadyExisted ||
      canonicalStatus === "pending" ||
      canonicalStatus === "in_progress";

    if (shouldUpdateGarment) {
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
    }

    // ─── Low-latency path: POST process_render_jobs ────────
    // Fire-and-forget. Does NOT await — worst case, pg_cron catches the
    // job within 60s. Service-role auth because the worker is locked
    // down to service-role only. Uses canonicalJobId so retried-enqueue
    // responses target the original row, not a ghost of this attempt.
    const processorUrl = `${SUPABASE_URL}/functions/v1/process_render_jobs`;
    fetch(processorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ jobId: canonicalJobId }),
    }).catch((err) => {
      // Non-fatal: cron will pick it up.
      log.warn("process_render_jobs kickoff failed (cron will retry)", {
        jobId: canonicalJobId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return jsonResponse({
      jobId: canonicalJobId,
      status: canonicalStatus,
      source: reserveResult.source,
      // replay:true iff either the ledger hit replay OR the render_jobs
      // row already existed. Clients treat replay as "your retry hit the
      // idempotency short-circuit, the canonical job is unchanged."
      replay: reserveResult.replay || rowAlreadyExisted,
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
