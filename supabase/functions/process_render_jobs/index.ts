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
  // Codex round 10: force flag is persisted on render_jobs at enqueue and
  // returned by claim_render_job so the worker can forward it to
  // render_garment_image. Without this, internal invocations always ran
  // non-force and the regenerate button silently no-op'd through the
  // product-ready gate. See render-state-machine.md I9.
  force: boolean;
};

type RenderResult =
  | { ok: true; rendered_image_path: string; render_provider?: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: true; deferred: true; reason: string }
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

        if (renderResult.ok && "deferred" in renderResult && renderResult.deferred) {
          // Concurrent in-flight render detected (`garments.render_status`
          // is 'rendering' at the callee). Under normal conditions the
          // concurrent render completes within the attempts budget and a
          // subsequent cycle takes the Already-ready / branch-b path —
          // no release ever fires. The deferred branch EXISTS for the
          // narrow race between the in-flight consume and a premature
          // release on a competing worker cycle.
          //
          // BUT: a garment stuck in 'rendering' indefinitely (isolate
          // crashed mid-render with no cleanup, or a bug in a prior
          // release path) would keep hitting this branch on every claim.
          // Attempts increments each claim via `claim_render_job`, but
          // without a terminal gate here the job re-queues forever,
          // reservation never converges. Codex round 8 caught it.
          //
          // Max-attempts gate: if attempts has reached max_attempts on
          // this claim, treat the 'rendering' state as a ghost (not a
          // live concurrent render) and terminalize — release credit,
          // mark the job 'failed', flip the garment to 'failed' so the
          // user sees a definite outcome. Round-5 heal gate still
          // protects against any consume that landed late (the heal
          // check runs here before the release when isFinal; see the
          // failure-path isFinal branch below).
          if (job.attempts >= job.max_attempts) {
            // Reuse the round-5 heal-gate logic so a late-landing consume
            // from the in-flight render is still recognized.
            const { data: consumeTx } = await supabase
              .from("render_credit_transactions")
              .select("id")
              .eq("render_job_id", job.id)
              .eq("kind", "consume")
              .eq("user_id", job.user_id)
              .maybeSingle();

            if (consumeTx) {
              // In-flight render DID complete and wrote consume — heal.
              const { data: garmentRecord } = await supabase
                .from("garments")
                .select("rendered_image_path")
                .eq("id", job.garment_id)
                .maybeSingle();
              log.warn("deferred terminal — consume tx landed, healing to succeeded", {
                jobId: job.id,
                attempts: job.attempts,
              });
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

            // No consume at the pre-release check — garment appears to be
            // genuinely stuck. Attempt release, then re-check for TOCTOU.
            log.error("deferred terminal — garment stuck in 'rendering' after max_attempts", {
              jobId: job.id,
              garmentId: job.garment_id,
              attempts: job.attempts,
              maxAttempts: job.max_attempts,
            });
            const baseKey = deriveBaseKey(job);
            const releaseResult = await releaseCredit(
              supabase,
              job.user_id,
              job.id,
              `release:${baseKey}`,
            );

            // Round-15 TOCTOU heal gate. The pre-release consume-check above
            // and the release_credit_atomic call are two separate reads of
            // render_credit_transactions with a narrow window between them.
            // If a concurrent in-flight render's consume tx lands inside
            // that window, release_credit_atomic's own terminal-existence
            // check finds it and returns `{ok:false, reason:'already_terminal'}`.
            // Pre-round-15, we fell through to `status='failed'` and
            // `garments.render_status='failed'` — marking a successful
            // render as failed and overwriting the garment state the
            // concurrent render just populated. Heal to succeeded instead,
            // mirroring the pre-release heal branch's terminal shape.
            // Do NOT touch garments.render_status — the concurrent render
            // already set it to 'ready' with its result path.
            if (!releaseResult.ok && releaseResult.reason === "already_terminal") {
              const { data: garmentRecord } = await supabase
                .from("garments")
                .select("rendered_image_path")
                .eq("id", job.garment_id)
                .maybeSingle();
              log.warn(
                "deferred terminal — release returned already_terminal, healing to succeeded (TOCTOU)",
                {
                  jobId: job.id,
                  garmentId: job.garment_id,
                  attempts: job.attempts,
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
              results.push({ jobId: job.id, status: "succeeded_healed_toctou" });
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

            if (!releaseResult.ok && !releaseResult.duplicate) {
              log.warn("releaseCredit non-ok on deferred terminal", {
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
                error: `Deferred to in-flight render that did not complete after ${job.max_attempts} attempts`,
                error_class: "stuck_in_flight",
                locked_until: null,
              })
              .eq("id", job.id);
            // Flip garment so the user sees a definite outcome — an
            // indefinite 'rendering' state masks the failure.
            await supabase
              .from("garments")
              .update({
                render_status: "failed",
                render_error: "Concurrent render did not complete",
              })
              .eq("id", job.garment_id);
            recordError("process_render_jobs");
            results.push({ jobId: job.id, status: "failed_stuck_deferred" });
            logTelemetry(supabase, {
              functionName: "process_render_jobs",
              model_used: "render_garment_image",
              latency_ms: Date.now() - startTime,
              from_cache: false,
              status: "error",
              error_message: "stuck_in_flight",
              user_id: job.user_id,
            });
            return;
          }

          // Pre-terminal defer: reset to pending, let next cycle retry.
          log.info("render deferred — concurrent in-flight render detected", {
            jobId: job.id,
            attempts: job.attempts,
            maxAttempts: job.max_attempts,
            reason: renderResult.reason,
          });

          await supabase
            .from("render_jobs")
            .update({
              status: "pending",
              locked_until: null,
              updated_at: new Date().toISOString(),
              error: null,
              error_class: null,
            })
            .eq("id", job.id);

          results.push({ jobId: job.id, status: "deferred_in_flight" });

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

        if (renderResult.ok && "skipped" in renderResult && renderResult.skipped) {
          // Skip response from render_garment_image (eligibility skip, missing
          // source, quality gate, gemini_no_image, already-ready without
          // force). Terminalize the job as succeeded (from the QUEUE'S
          // perspective — the worker's job is done) and release the reserve
          // because NO render work happened → no consume was written →
          // reserve would otherwise orphan until the cleanup cron sweeps it.
          //
          // Do NOT touch garments.render_status here: the skip means the
          // garment is ALREADY in its correct state (ready, rendering,
          // skipped, or pending if a different flow claimed it). Overwriting
          // would regress prior-attempt success or interrupt a concurrent
          // flow. Codex round 7 Bug 2.
          const baseKey = deriveBaseKey(job);
          const releaseResult = await releaseCredit(
            supabase,
            job.user_id,
            job.id,
            `release:${baseKey}`,
          );
          if (!releaseResult.ok && !releaseResult.duplicate) {
            log.warn("releaseCredit non-ok on skip terminalization", {
              jobId: job.id,
              reason: releaseResult.reason,
            });
          }

          await supabase
            .from("render_jobs")
            .update({
              status: "succeeded",
              result_path: null,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              error: null,
              error_class: null,
              locked_until: null,
            })
            .eq("id", job.id);

          results.push({ jobId: job.id, status: "succeeded_skipped" });

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
          const { data: consumeTx, error: consumeQueryError } = await supabase
            .from("render_credit_transactions")
            .select("id")
            .eq("render_job_id", job.id)
            .eq("kind", "consume")
            .eq("user_id", job.user_id)
            .maybeSingle();

          if (consumeQueryError) {
            // Transient read failure — we can't prove presence OR absence of
            // the consume tx right now. Treating null as "no consume" here
            // would refund a legitimately-consumed credit and mark a
            // successful render as failed. Defer the terminal decision:
            // reset the job so the next worker cycle re-enters the heal
            // gate with a (hopefully healthy) DB. Decrement attempts so a
            // read-layer outage doesn't burn attempt budget reserved for
            // real render failures. Clear stale error fields so a prior
            // retry's context doesn't leak into the final user-visible
            // failure if we do eventually terminalize.
            log.error(
              "consume lookup failed on final-failure path — deferring terminal decision",
              {
                jobId: job.id,
                userId: job.user_id,
                attempts: job.attempts,
                maxAttempts: job.max_attempts,
                error: consumeQueryError.message,
              },
            );

            await supabase
              .from("render_jobs")
              .update({
                status: "pending",
                locked_until: null,
                attempts: Math.max(0, job.attempts - 1),
                error: null,
                error_class: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", job.id);

            recordError("process_render_jobs");
            results.push({ jobId: job.id, status: "deferred_db_error" });
            return;
          }

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

          // Degrade garment state ONLY when no prior good render is present.
          // Rationale (Codex round 11 Bug 1): on force=true regenerate jobs,
          // render_garment_image's safeRestoreOrFailRender has already
          // restored the garment to its prior `render_status='ready' +
          // rendered_image_path=<prior>` state. Unconditionally overwriting
          // to 'failed' here would undo that restoration and destroy the
          // user's existing good render during Gemini outages — worse UX
          // than not having Regenerate at all.
          //
          // Check the CURRENT garment state (not the force flag) because
          // that's the actual question we care about: "does a prior
          // successful render exist on this garment?" It's robust to
          // force=true-with-no-prior (first regenerate after a reset),
          // force=false-with-prior (shouldn't happen in practice but
          // preserves invariant), and any future restoration-path we add.
          const { data: garmentAtFailure } = await supabase
            .from("garments")
            .select("render_status, rendered_image_path")
            .eq("id", job.garment_id)
            .maybeSingle();

          const hasPriorGoodRender =
            garmentAtFailure?.render_status === "ready" &&
            typeof garmentAtFailure?.rendered_image_path === "string" &&
            garmentAtFailure.rendered_image_path.length > 0;

          if (hasPriorGoodRender) {
            log.warn(
              "terminal render failure — garment has prior good render, preserving state",
              {
                jobId: job.id,
                garmentId: job.garment_id,
                priorRenderPath: garmentAtFailure!.rendered_image_path,
                errorClass: renderResult.errorClass,
              },
            );
          } else {
            await supabase
              .from("garments")
              .update({
                render_status: "failed",
                render_error: renderResult.errorMessage.substring(0, 500),
              })
              .eq("id", job.garment_id);
          }

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
        // Forward the QUEUED presentation + prompt_version from render_jobs
        // so render_garment_image derives the base key from the values that
        // were current at enqueue. Without this, if the user changes
        // mannequin_presentation (or RENDER_PROMPT_VERSION ships) between
        // enqueue and worker run, the callee computes a different base key
        // than enqueue_render_job's reserve_key → reserve hits a second
        // reserve_key → two credit reservations for one logical render.
        // Codex round 6 caught this.
        presentation: job.presentation,
        promptVersion: job.prompt_version,
        // Forward the QUEUED force flag. Without this, regenerate-button
        // requests (enqueued with force=true on an already-rendered
        // garment) would be re-invoked as non-force → product-ready gate
        // fires → skipped return → worker marks 'succeeded_skipped' with
        // no new image. Codex round 10 caught this regression.
        force: job.force,
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

    // Deferred: concurrent in-flight render for the same garment. DO NOT
    // terminalize here — another worker attempt is actively running and
    // will write consume on success. Worker should keep the job pending
    // and retry on the next cycle. Codex round 7 structural review.
    //
    // Checked BEFORE skipped so that a response carrying both flags (or
    // a future contract tweak that adds deferred to claim-lost paths)
    // takes the safer "don't release" path.
    if (body?.deferred === true) {
      return {
        ok: true,
        deferred: true,
        reason: typeof body.reason === "string" ? body.reason : "deferred",
      };
    }

    // Skip responses: render_garment_image returns { ok: true, skipped: true,
    // reason } for truly terminal non-render states (already rendered
    // without path, quality gate reject, gemini_no_image, missing source,
    // claim-lost after prior success, etc). The callee already handled
    // any state the skip implies (e.g. healing consume on already-ready).
    // These are NOT 'rendering' in-flight cases — those use `deferred`
    // above. We MUST NOT retry skips — retrying will keep hitting the same
    // skip, waste work, and eventually terminalize as 'failed' with garment
    // state overwritten. Codex round 7 Bug 2. Worker will terminalize as
    // 'succeeded' + release the reservation (since no render work happened).
    if (body?.skipped === true) {
      return {
        ok: true,
        skipped: true,
        reason: typeof body.reason === "string" ? body.reason : "skipped",
      };
    }

    // 200 but no rendered_image_path AND not a skip — shouldn't happen on
    // current render_garment_image code paths. Classify as unknown failure
    // so retry policy can decide. If this fires in prod, it's a genuine
    // contract break between the two functions worth flagging.
    return {
      ok: false,
      status: res.status,
      errorClass: "unknown",
      errorMessage: body?.message || "render returned 200 without rendered_image_path or skipped flag",
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
