/**
 * process_render_jobs — worker for the render queue
 *
 * Service-role only. Invoked by:
 *   1. pg_cron every 60s (safety net, discovers orphaned rows)
 *   2. enqueue_render_job via internal POST (low-latency path, passes
 *      the specific { jobId } it just inserted)
 *
 * Per invocation:
 *   1. Call recover_stale_render_jobs — reset any in_progress rows
 *      whose 5-min locked_until window has expired
 *   2. If body has { jobId } (client-initiated path), claim that row
 *      specifically first
 *   3. Loop claim_render_job() up to MAX_JOBS_PER_RUN, concurrency
 *      JOB_CONCURRENCY
 *   4. For each claimed row: invoke render_garment_image internally,
 *      update render_jobs + garments on result, release credit if
 *      final failure
 *
 * Terminal state handling:
 *   * success → status='succeeded', garments.render_status='ready'
 *     (render_garment_image itself writes rendered_image_path and
 *     calls consume_credit_atomic)
 *   * failure with attempts < max_attempts → status='pending',
 *     locked_until=NULL, error recorded. Credit stays reserved per
 *     Interpretation A.
 *   * failure with attempts >= max_attempts → status='failed',
 *     releaseCredit, garments.render_status='failed'
 *
 * Concurrency: claim RPC uses SELECT FOR UPDATE SKIP LOCKED so two
 * concurrent worker invocations never claim the same row.
 */
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { checkOverload, overloadResponse, recordError, withConcurrencyLimit, logTelemetry } from "../_shared/scale-guard.ts";
import { releaseCredit } from "../_shared/render-credits.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { logger } from "../_shared/logger.ts";

const log = logger("process_render_jobs");

const MAX_JOBS_PER_RUN = 5;
const JOB_CONCURRENCY = 2;

type ClaimedJob = {
  id: string;
  user_id: string;
  garment_id: string;
  client_nonce: string;
  source: string;
  presentation: string;
  prompt_version: string;
  reserve_key: string;
  attempts: number;
  max_attempts: number;
};

type RenderResult =
  | { ok: true; rendered_image_path: string; render_provider?: string }
  | { ok: false; status: number; errorClass: string; errorMessage: string };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function classifyRenderError(status: number, body: any): string {
  if (status === 429) return "rate_limit";
  if (status === 503) return "rpc";
  if (typeof body?.error === "string") {
    if (body.error.includes("gemini_no_image")) return "provider";
    if (body.error.includes("rate_limit")) return "rate_limit";
  }
  return "unknown";
}

/** Derive the baseKey identically to enqueue_render_job and render_garment_image. */
function deriveBaseKey(job: ClaimedJob): string {
  return `${job.user_id}_${job.garment_id}_${job.presentation}_${job.prompt_version}_${job.client_nonce}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (checkOverload("process_render_jobs")) {
    return overloadResponse(CORS_HEADERS);
  }

  // ─── Auth: service-role only ───────────────────────────
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Sanity: a misconfigured empty key + authHeader='Bearer ' would both
  // pass a naive equality. Refuse to serve before timing-comparing
  // against nothing.
  if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 32) {
    return jsonResponse({ error: "service role key not configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  // Constant-time comparison — see _shared/timing-safe.ts for why.
  if (!timingSafeEqual(authHeader, expected)) {
    return jsonResponse({ error: "service role required" }, 401);
  }

  // Optional body.jobId hint from the low-latency client-initiated path.
  let preferredJobId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.jobId === "string") preferredJobId = body.jobId;
  } catch {
    // Empty / malformed body is fine (cron case).
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ─── Stale-claim recovery ─────────────────────────────
    const { data: recoveredCount, error: recoverError } = await supabase
      .rpc("recover_stale_render_jobs");
    if (recoverError) {
      log.warn("recover_stale_render_jobs failed (non-fatal)", { error: recoverError.message });
    } else if ((recoveredCount as number) > 0) {
      log.info("recovered stale render jobs", { count: recoveredCount });
    }

    // ─── Claim loop ───────────────────────────────────────
    const jobs: ClaimedJob[] = [];

    // Prefer the specific jobId from the client-initiated path.
    if (preferredJobId) {
      const { data, error } = await supabase.rpc("claim_render_job", { p_job_id: preferredJobId });
      if (!error && Array.isArray(data) && data.length > 0) {
        jobs.push(data[0] as ClaimedJob);
      }
    }

    // Fill the batch with unlocked pending rows.
    while (jobs.length < MAX_JOBS_PER_RUN) {
      const { data, error } = await supabase.rpc("claim_render_job", { p_job_id: null });
      if (error) {
        log.warn("claim_render_job failed (stopping loop)", { error: error.message });
        break;
      }
      if (!Array.isArray(data) || data.length === 0) break;
      jobs.push(data[0] as ClaimedJob);
    }

    if (jobs.length === 0) {
      return jsonResponse({ processed: 0, recovered: recoveredCount ?? 0, results: [] });
    }

    log.info(`processing ${jobs.length} render job(s)`);

    const results: Array<{ jobId: string; status: string; error?: string }> = [];

    await withConcurrencyLimit(jobs, JOB_CONCURRENCY, async (job) => {
      const startTime = Date.now();
      try {
        const renderResult = await invokeRender(supabase, job, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        if (renderResult.ok) {
          // render_garment_image itself already:
          //   * called consume_credit_atomic with the canonical jobId
          //   * wrote garments.rendered_image_path / render_status='ready'
          //   * so we only flip render_jobs here.
          await supabase
            .from("render_jobs")
            .update({
              status: "succeeded",
              result_path: renderResult.rendered_image_path,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              error: null,
              error_class: null,
            })
            .eq("id", job.id);

          results.push({ jobId: job.id, status: "succeeded" });

          logTelemetry(supabase, {
            functionName: "process_render_jobs",
            model_used: "render_garment_image",
            latency_ms: Date.now() - startTime,
            from_cache: false,
            status: "ok",
            user_id: job.user_id,
          });
          return;
        }

        // Failure path.
        const isFinal = job.attempts >= job.max_attempts;

        if (isFinal) {
          // Before releasing + marking failed: check the credit ledger for
          // definitive evidence that THIS specific job_id already succeeded
          // (i.e., a consume tx exists with render_job_id = job.id).
          //
          // PRIOR ATTEMPT at the heal check used `garments.rendered_image_path
          // IS NOT NULL` as the heal gate — but on a regenerate flow, the
          // garment carries a stale path from an older successful render.
          // If THIS attempt genuinely failed, the rendered_image_path
          // heuristic would falsely say "this job succeeded," skip the
          // release, and charge the user for a failure. Codex round 4
          // caught it.
          //
          // The consume-tx check is tight: consumeCredit is only called
          // from render_garment_image AFTER Gemini successfully produced
          // the image AND storage upload succeeded. If a consume row
          // exists for job.id, this attempt genuinely ran end-to-end and
          // the worker just missed the success-path UPDATE (e.g. crashed
          // between render_garment_image's 200 and process_render_jobs's
          // DB write). Heal to 'succeeded' with no release.
          const { data: consumeTx } = await supabase
            .from("render_credit_transactions")
            .select("id")
            .eq("render_job_id", job.id)
            .eq("kind", "consume")
            .eq("user_id", job.user_id)
            .maybeSingle();

          if (consumeTx) {
            // Consume exists for this job → Gemini ran, credit was
            // charged. Recover the rendered_image_path (safe now because
            // we've established THIS job succeeded).
            const { data: garmentRecord } = await supabase
              .from("garments")
              .select("rendered_image_path")
              .eq("id", job.garment_id)
              .maybeSingle();

            log.warn(
              "final-failure path detected consume tx for this job — healing to succeeded",
              {
                jobId: job.id,
                garmentId: job.garment_id,
                attempts: job.attempts,
                lastErrorClass: renderResult.errorClass,
                consumeTxId: consumeTx.id,
                resultPath: garmentRecord?.rendered_image_path ?? null,
              },
            );
            await supabase
              .from("render_jobs")
              .update({
                status: "succeeded",
                result_path: garmentRecord?.rendered_image_path ?? null,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                error: null,
                error_class: null,
                locked_until: null,
              })
              .eq("id", job.id);
            results.push({ jobId: job.id, status: "succeeded_healed" });
            // Don't release credit — consume tx exists. Releasing would
            // try to write a second terminal tx against the same job_id
            // and hit `already_terminal`, but log noise aside it's wrong
            // intent: the user legitimately paid for a delivered render.
            logTelemetry(supabase, {
              functionName: "process_render_jobs",
              model_used: "render_garment_image",
              latency_ms: Date.now() - startTime,
              from_cache: false,
              status: "ok",
              user_id: job.user_id,
            });
            return;
          }

          // Genuine terminal failure: release credit + flip to failed.
          // Idempotent on release_key; ledger's terminal-uniqueness guard
          // ensures no double-release if a prior consume snuck through.
          const baseKey = deriveBaseKey(job);
          const releaseResult = await releaseCredit(
            supabase,
            job.user_id,
            job.id,
            `release:${baseKey}`,
          );
          if (!releaseResult.ok) {
            log.warn("releaseCredit returned non-ok on final failure", {
              jobId: job.id,
              reason: releaseResult.reason,
            });
          }

          await supabase
            .from("render_jobs")
            .update({
              status: "failed",
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              error: renderResult.errorMessage.substring(0, 500),
              error_class: renderResult.errorClass,
              locked_until: null,
            })
            .eq("id", job.id);

          await supabase
            .from("garments")
            .update({
              render_status: "failed",
              render_error: renderResult.errorMessage.substring(0, 500),
            })
            .eq("id", job.garment_id);

          results.push({ jobId: job.id, status: "failed", error: renderResult.errorMessage });
        } else {
          // Retryable: reset to pending. Credit stays reserved per Interp A.
          await supabase
            .from("render_jobs")
            .update({
              status: "pending",
              locked_until: null,
              updated_at: new Date().toISOString(),
              error: renderResult.errorMessage.substring(0, 500),
              error_class: renderResult.errorClass,
            })
            .eq("id", job.id);

          results.push({ jobId: job.id, status: "retry", error: renderResult.errorMessage });
        }

        if (renderResult.errorClass === "rpc" || renderResult.errorClass === "provider") {
          recordError("process_render_jobs");
        }

        logTelemetry(supabase, {
          functionName: "process_render_jobs",
          model_used: "render_garment_image",
          latency_ms: Date.now() - startTime,
          from_cache: false,
          status: "error",
          error_message: renderResult.errorMessage,
          user_id: job.user_id,
        });
      } catch (e) {
        // Hard worker crash: let stale-claim recovery reset the row on next run.
        log.exception(`worker error for job ${job.id}`, e);
        recordError("process_render_jobs");
        results.push({
          jobId: job.id,
          status: "worker_error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });

    return jsonResponse({
      processed: results.length,
      recovered: recoveredCount ?? 0,
      results,
    });
  } catch (e) {
    log.exception("worker error", e);
    recordError("process_render_jobs");
    return jsonResponse(
      { error: e instanceof Error ? e.message : "worker error" },
      500,
    );
  }
});

/**
 * Invoke render_garment_image internally with the claimed job's context.
 * Uses service-role auth + `internal: true` flag; render_garment_image's
 * P5 patch accepts this in place of a user JWT and skips its own reserve
 * step (reserve already happened at enqueue).
 */
async function invokeRender(
  _supabase: any,
  job: ClaimedJob,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<RenderResult> {
  const url = `${supabaseUrl}/functions/v1/render_garment_image`;
  const controller = new AbortController();
  // Gemini image generation typical latency: 8-25s. 45s ceiling leaves
  // margin for network + any retries inside render_garment_image itself.
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        internal: true,
        jobId: job.id,
        userId: job.user_id,
        garmentId: job.garment_id,
        source: job.source,
        clientNonce: job.client_nonce,
      }),
      signal: controller.signal,
    });

    let body: any = null;
    try { body = await res.json(); } catch { /* non-JSON */ }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        errorClass: classifyRenderError(res.status, body),
        errorMessage: body?.error || body?.detail || `render_garment_image ${res.status}`,
      };
    }

    // render_garment_image's success shape is { ok, rendered, renderedImagePath }
    // (camelCase). Accept both that and the snake_case form for forward compat.
    const renderedPath =
      (typeof body?.renderedImagePath === "string" && body.renderedImagePath) ||
      (typeof body?.rendered_image_path === "string" && body.rendered_image_path) ||
      null;

    if (renderedPath) {
      return {
        ok: true,
        rendered_image_path: renderedPath,
        render_provider: body.render_provider,
      };
    }

    // 200 but no rendered_image_path (e.g. skipped, 202-style response).
    // Treat as unknown non-success — let retry policy decide.
    return {
      ok: false,
      status: res.status,
      errorClass: "unknown",
      errorMessage: body?.message || "render returned 200 without rendered_image_path",
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, status: 0, errorClass: "rpc", errorMessage: "render timeout" };
    }
    return {
      ok: false,
      status: 0,
      errorClass: "rpc",
      errorMessage: e instanceof Error ? e.message : "internal render invoke error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
