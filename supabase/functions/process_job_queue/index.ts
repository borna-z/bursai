/**
 * Job Queue Worker — processes async heavy work from the job_queue table.
 *
 * Designed to be invoked via cron (e.g., every 1 minute) or manually.
 * Claims and processes pending jobs with concurrency control.
 *
 * Supported job types:
 * - garment_enrichment: deep AI enrichment of garment metadata
 * - batch_analysis: bulk wardrobe analysis jobs
 *
 * Each job type has its own handler. New types can be added by
 * registering a handler in JOB_HANDLERS.
 *
 * P15 (2026-04-21): `image_processing` job type removed along with the
 * `process_garment_image` edge function. Any residual image_processing
 * rows in job_queue will be left unhandled — claimJob only queries
 * job_type IN the JOB_HANDLERS keys, so they're effectively frozen. A
 * future schema-cleanup PR can DELETE them outright.
 */
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import {
  claimJob,
  completeJob,
  failJob,
  withConcurrencyLimit,
  logTelemetry,
  checkOverload,
  overloadResponse,
} from "../_shared/scale-guard.ts";
import { logger } from "../_shared/logger.ts";

const log = logger("process_job_queue");

// ── Job type registry ────────────────────────────────────────────
type JobHandler = (
  supabase: any,
  payload: Record<string, unknown>,
  userId: string | null,
) => Promise<Record<string, unknown>>;

const JOB_HANDLERS: Record<string, JobHandler> = {
  garment_enrichment: handleGarmentEnrichment,
  batch_analysis: handleBatchAnalysis,
};

// ── Max jobs to process per invocation ───────────────────────────
const MAX_JOBS_PER_RUN = 10;
const JOB_CONCURRENCY = 3;

// Wave S-A.4 (2026-05-15): per-user per-run cap. Without this, a user
// can churn render-job rows (create → delete-refund → repeat) and burn
// the entire MAX_JOBS_PER_RUN budget within one cron tick, starving
// other users and draining the attacker's own monthly image-gen quota
// faster than the cost ceiling can react. 3 jobs per cron tick × N
// ticks/hour is still ample for any legitimate batch, but caps the
// abusive case at FIFO fairness.
const MAX_JOBS_PER_USER_PER_RUN = 3;

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Cron-only endpoint — no per-user rate limit (service role only).
  // Overload guard still applies to short-circuit if the worker is unhealthy.
  if (checkOverload("process_job_queue")) {
    return overloadResponse(corsHeaders);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Decoupled inter-function/cron bearer. See
    // supabase/functions/process_render_jobs/index.ts for the rotation
    // procedure and the rationale (SUPABASE_SERVICE_ROLE_KEY is a deploy-
    // time snapshot that drifts when the platform rotates the signing
    // secret). The corresponding cron command MUST send
    //   Authorization: Bearer <vault.decrypted_secrets WHERE name='render_worker_bearer'>
    const RENDER_WORKER_BEARER = Deno.env.get("RENDER_WORKER_BEARER") ?? "";

    // ── Auth: cron-only endpoint — reject anything that isn't the worker bearer (P1) ──
    // This function runs global queue processing; any authenticated user hitting it
    // would trigger service-role-escalated work against jobs they don't own (DoS vector).
    // Use timing-safe comparison to avoid byte-by-byte key extraction.
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";
    if (!RENDER_WORKER_BEARER || RENDER_WORKER_BEARER.length < 32) {
      return new Response(
        JSON.stringify({ error: "worker bearer not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!token || !timingSafeEqual(token, RENDER_WORKER_BEARER)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Optional: accept specific job_type filter
    let targetJobType: string | null = null;
    try {
      const body = await req.json();
      targetJobType = body?.job_type || null;
    } catch {
      // No body = process all types
    }

    const jobTypes = targetJobType
      ? [targetJobType]
      : Object.keys(JOB_HANDLERS);

    const results: Array<{ id: string; type: string; status: string; error?: string }> = [];
    let totalProcessed = 0;

    // Wave S-A.4: per-user counter for this run. Spans all job_types so a
    // single user can't dodge the cap by spraying across job types.
    const perUserCount = new Map<string, number>();

    for (const jobType of jobTypes) {
      if (totalProcessed >= MAX_JOBS_PER_RUN) break;

      const handler = JOB_HANDLERS[jobType];
      if (!handler) {
        log.warn("Unknown job type", { jobType });
        continue;
      }

      // Claim and process jobs for this type
      const jobs: Array<{ id: string; payload: Record<string, unknown>; user_id: string | null; attempts: number; max_attempts: number }> = [];

      // Cap how many claimJob attempts we make per type so an over-quota
      // user can't force us to spin through every pending row. Walks the
      // FIFO order; jobs released here roll naturally into the next cron
      // tick when the user's per-run counter resets.
      const MAX_CLAIM_ATTEMPTS = (MAX_JOBS_PER_RUN - totalProcessed) * 4;
      for (let i = 0; i < MAX_CLAIM_ATTEMPTS && jobs.length < (MAX_JOBS_PER_RUN - totalProcessed); i++) {
        const job = await claimJob(supabase, jobType);
        if (!job) break;
        const userKey = job.user_id ?? "__no_user__";
        const currentCount = perUserCount.get(userKey) ?? 0;
        if (job.user_id && currentCount >= MAX_JOBS_PER_USER_PER_RUN) {
          // Over-cap for this user this run. Reset the row to `pending`
          // with a near-future `locked_until` (30s). `claimJob`'s eligibility
          // filter requires `locked_until IS NULL OR locked_until < now`,
          // so the row is invisible to subsequent claims within THIS run.
          // The stuck-job sweep at the bottom of this function also
          // ignores it (it gates on `locked_until < now`).
          //
          // The next cron tick (typically ≥ 60s later) sees the lock as
          // expired and re-claims naturally, preserving FIFO position
          // without letting the current run loop on the same row.
          // `claimJob` already incremented `attempts`. Roll it back here so a
          // deferral never burns a retry — otherwise users with > 3 queued
          // items would drain `attempts` toward `max_attempts` across cron
          // ticks without any handler ever running (Codex P2 on #849).
          const deferUntil = new Date(Date.now() + 30_000).toISOString();
          const rolledBackAttempts = Math.max(0, (job.attempts ?? 1) - 1);
          await supabase
            .from("job_queue")
            .update({
              status: "pending",
              locked_until: deferUntil,
              attempts: rolledBackAttempts,
            })
            .eq("id", job.id);
          log.info("Per-user cap reached, deferring job", {
            jobType,
            userId: job.user_id,
            cap: MAX_JOBS_PER_USER_PER_RUN,
            deferUntil,
          });
          continue;
        }
        perUserCount.set(userKey, currentCount + 1);
        jobs.push(job);
      }

      if (jobs.length === 0) continue;

      log.info(`Processing ${jobs.length} ${jobType} jobs`);

      await withConcurrencyLimit(jobs, JOB_CONCURRENCY, async (job) => {
        const startTime = Date.now();
        try {
          const result = await handler(supabase, job.payload, job.user_id);
          await completeJob(supabase, job.id, result);

          logTelemetry(supabase, {
            functionName: "process_job_queue",
            model_used: jobType,
            latency_ms: Date.now() - startTime,
            from_cache: false,
            status: "ok",
            user_id: job.user_id || undefined,
          });

          results.push({ id: job.id, type: jobType, status: "completed" });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          await failJob(supabase, job.id, errorMsg, job.max_attempts, job.attempts);

          logTelemetry(supabase, {
            functionName: "process_job_queue",
            model_used: jobType,
            latency_ms: Date.now() - startTime,
            from_cache: false,
            status: "error",
            error_message: errorMsg,
            user_id: job.user_id || undefined,
          });

          log.error(`Job ${job.id} failed`, { jobType, error: errorMsg, attempt: job.attempts });
          results.push({ id: job.id, type: jobType, status: "failed", error: errorMsg });
        }
        totalProcessed++;
      });
    }

    // Recover stuck jobs — reset "processing" jobs with expired locks back to "pending"
    // This handles cases where a worker crashed mid-processing.
    const now = new Date().toISOString();
    await supabase
      .from("job_queue")
      .update({ status: "pending", locked_until: null, updated_at: now })
      .eq("status", "processing")
      .lt("locked_until", now)
      .then(({ error: stuckErr }) => {
        if (!stuckErr) return;
        log.warn("Stuck job recovery failed", { error: stuckErr.message });
      });

    // Periodic cleanup (10% chance per invocation)
    if (Math.random() < 0.1) {
      // `.then(_, _)` instead of `.catch` — newer supabase-js typings model
      // the rpc builder as a thenable, not a full Promise, so `.catch` is
      // missing on the type. Fire-and-forget: ignore both resolution paths.
      supabase.rpc("cleanup_old_jobs").then(() => {}, () => {});
    }

    return new Response(
      JSON.stringify({ processed: totalProcessed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    log.exception("Worker error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Worker error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


// ── Job Handlers ─────────────────────────────────────────────────

/**
 * Garment enrichment handler: deep AI analysis of garment images.
 * Calls analyze_garment in enrich mode asynchronously.
 */
async function handleGarmentEnrichment(
  supabase: any,
  payload: Record<string, unknown>,
  userId: string | null,
): Promise<Record<string, unknown>> {
  const garmentId = payload.garment_id as string;
  const locale = (payload.locale as string) || "en";
  if (!garmentId) throw new Error("Missing garment_id in payload");
  if (!userId) throw new Error("Missing user_id on job");

  // Ownership guard — job.user_id must match the garment's owner.
  // Prevents a poisoned job row from executing service-role AI enrichment
  // against a garment that belongs to another user (and overwriting their ai_raw).
  const { data: garment, error } = await supabase
    .from("garments")
    .select("id, image_path, enrichment_status")
    .eq("id", garmentId)
    .eq("user_id", userId)
    .single();

  if (error || !garment) throw new Error(`Garment not found or not owned: ${garmentId}`);
  if (!garment.image_path) throw new Error("No image for enrichment");

  await supabase
    .from("garments")
    .update({ enrichment_status: "processing" })
    .eq("id", garmentId);

  try {
    const { data: signedData } = await supabase.storage
      .from("garments")
      .createSignedUrl(garment.image_path, 600);

    if (!signedData?.signedUrl) throw new Error("Could not get signed URL");

    const { callBursAI } = await import("../_shared/burs-ai.ts");

    const { data } = await callBursAI({
      complexity: "standard",
      max_tokens: 800,
      timeout: 20000,
      functionName: "garment_enrichment_job",
      messages: [
        {
          role: "system",
          content: `You are an elite fashion stylist analyzing a garment image for deep intelligence. Return ONLY valid JSON with fields: neckline, sleeve_length, garment_length, silhouette, visual_weight, texture_intensity, style_archetype, style_tags, occasion_tags, layering_role, versatility_score, color_harmony_notes, stylist_note, confidence.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Provide deep garment intelligence. JSON only." },
            { type: "image_url", image_url: { url: signedData.signedUrl } },
          ],
        },
      ],
    }, supabase);

    let enrichment: Record<string, unknown>;
    if (typeof data === "string") {
      const cleaned = data.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      enrichment = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } else {
      enrichment = data;
    }

    await supabase
      .from("garments")
      .update({
        enrichment_status: "completed",
        ai_raw: enrichment,
      })
      .eq("id", garmentId);

    return { status: "completed", garmentId };
  } catch (err) {
    await supabase
      .from("garments")
      .update({ enrichment_status: "failed" })
      .eq("id", garmentId);
    throw err;
  }
}

/**
 * Batch analysis handler: placeholder for bulk wardrobe operations.
 */
async function handleBatchAnalysis(
  supabase: any,
  payload: Record<string, unknown>,
  userId: string | null,
): Promise<Record<string, unknown>> {
  const analysisType = payload.analysis_type as string;
  if (!analysisType) throw new Error("Missing analysis_type");

  // This is a foundation — specific analysis types will be added
  // as the system grows. For now, log and return.
  log.info("Batch analysis requested", { analysisType, userId });

  return { status: "completed", analysisType, message: "Batch analysis foundation ready" };
}
