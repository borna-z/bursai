/**
 * Job Queue Worker — processes async heavy work from the job_queue table.
 *
 * Designed to be invoked via cron (e.g., every 1 minute) or manually.
 * Claims and processes pending jobs with concurrency control.
 *
 * Supported job types:
 * - image_processing: legacy garment image-processing jobs
 * - garment_enrichment: deep AI enrichment of garment metadata
 * - batch_analysis: bulk wardrobe analysis jobs
 *
 * Each job type has its own handler. New types can be added by
 * registering a handler in JOB_HANDLERS.
 */
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import {
  claimJob,
  completeJob,
  failJob,
  withConcurrencyLimit,
  logTelemetry,
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
  image_processing: handleImageProcessing,
  garment_enrichment: handleGarmentEnrichment,
  batch_analysis: handleBatchAnalysis,
};

// ── Max jobs to process per invocation ───────────────────────────
const MAX_JOBS_PER_RUN = 10;
const JOB_CONCURRENCY = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Auth: cron-only endpoint — reject anything that isn't the service role (P1) ──
    // This function runs global queue processing; any authenticated user hitting it
    // would trigger service-role-escalated work against jobs they don't own (DoS vector).
    // Use timing-safe comparison to avoid byte-by-byte key extraction.
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";
    if (!token || !SUPABASE_SERVICE_ROLE_KEY || !timingSafeEqual(token, SUPABASE_SERVICE_ROLE_KEY)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
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

    for (const jobType of jobTypes) {
      if (totalProcessed >= MAX_JOBS_PER_RUN) break;

      const handler = JOB_HANDLERS[jobType];
      if (!handler) {
        log.warn("Unknown job type", { jobType });
        continue;
      }

      // Claim and process jobs for this type
      const jobs: Array<{ id: string; payload: Record<string, unknown>; user_id: string | null; attempts: number; max_attempts: number }> = [];

      for (let i = 0; i < MAX_JOBS_PER_RUN - totalProcessed; i++) {
        const job = await claimJob(supabase, jobType);
        if (!job) break;
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
      supabase.rpc("cleanup_old_jobs").catch(() => {});
    }

    return new Response(
      JSON.stringify({ processed: totalProcessed, results }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    log.exception("Worker error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Worker error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});


// ── Job Handlers ─────────────────────────────────────────────────

/**
 * Image processing handler: marks legacy jobs as skipped.
 */
async function handleImageProcessing(
  supabase: any,
  payload: Record<string, unknown>,
  userId: string | null,
): Promise<Record<string, unknown>> {
  const garmentId = payload.garment_id as string;
  if (!garmentId) throw new Error("Missing garment_id in payload");
  if (!userId) throw new Error("Missing user_id on job");

  // Ownership guard — job.user_id must match the garment's owner.
  // Prevents a poisoned job row from executing service-role work against
  // a garment that belongs to another user.
  const { data: garment, error } = await supabase
    .from("garments")
    .select("id, image_path")
    .eq("id", garmentId)
    .eq("user_id", userId)
    .single();

  if (error || !garment) throw new Error(`Garment not found or not owned: ${garmentId}`);
  if (!garment.image_path) throw new Error("No image_path for garment");

  await supabase
    .from("garments")
    .update({
      image_processing_status: "ready",
      processed_image_path: null,
      image_processing_provider: "disabled",
      image_processing_confidence: null,
      image_processing_error: null,
      image_processed_at: new Date().toISOString(),
    })
    .eq("id", garmentId);

  return { status: "skipped", garmentId, userId };
}

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
