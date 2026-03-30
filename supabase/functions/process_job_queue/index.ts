/**
 * Job Queue Worker — processes async heavy work from the job_queue table.
 *
 * Designed to be invoked via cron (e.g., every 1 minute) or manually.
 * Claims and processes pending jobs with concurrency control.
 *
 * Supported job types:
 * - image_processing: background removal / render for garment images
 * - garment_enrichment: deep AI enrichment of garment metadata
 * - batch_analysis: bulk wardrobe analysis jobs
 *
 * Each job type has its own handler. New types can be added by
 * registering a handler in JOB_HANDLERS.
 */
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
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
 * Image processing handler: background removal for garment photos.
 * Delegates to the existing garment-image-processing provider.
 */
async function handleImageProcessing(
  supabase: any,
  payload: Record<string, unknown>,
  userId: string | null,
): Promise<Record<string, unknown>> {
  const garmentId = payload.garment_id as string;
  if (!garmentId) throw new Error("Missing garment_id in payload");

  // Fetch garment
  const { data: garment, error } = await supabase
    .from("garments")
    .select("id, image_path, category, subcategory, title, image_processing_status")
    .eq("id", garmentId)
    .single();

  if (error || !garment) throw new Error(`Garment not found: ${garmentId}`);
  if (!garment.image_path) throw new Error("No image_path for garment");

  // Mark as processing
  await supabase
    .from("garments")
    .update({ image_processing_status: "processing" })
    .eq("id", garmentId);

  try {
    // Import and use the provider
    const { garmentImageProvider, getGarmentEligibility } = await import(
      "../_shared/garment-image-processing/provider.ts"
    );

    const eligibility = getGarmentEligibility(garment.category, garment.subcategory, garment.title);
    if (!eligibility.eligible) {
      await supabase
        .from("garments")
        .update({ image_processing_status: "ineligible" })
        .eq("id", garmentId);
      return { status: "ineligible", reason: eligibility.reason };
    }

    // Get signed URL for original image
    const { data: signedData } = await supabase.storage
      .from("garments")
      .createSignedUrl(garment.image_path, 600);

    if (!signedData?.signedUrl) throw new Error("Could not get signed URL");

    const result = await garmentImageProvider.process({
      imageUrl: signedData.signedUrl,
      category: garment.category,
      subcategory: garment.subcategory,
    });

    if (result.success && result.processedImageUrl) {
      // Upload processed image
      const processedPath = garment.image_path.replace(/\.[^.]+$/, "_processed.png");
      const response = await fetch(result.processedImageUrl);
      const blob = await response.arrayBuffer();

      await supabase.storage
        .from("garments")
        .upload(processedPath, new Uint8Array(blob), {
          contentType: "image/png",
          upsert: true,
        });

      await supabase
        .from("garments")
        .update({
          image_processing_status: "completed",
          image_processing_confidence: result.confidence ?? null,
        })
        .eq("id", garmentId);

      return { status: "completed", processedPath };
    }

    throw new Error(result.error || "Processing failed");
  } catch (err) {
    await supabase
      .from("garments")
      .update({ image_processing_status: "failed" })
      .eq("id", garmentId);
    throw err;
  }
}

/**
 * Garment enrichment handler: deep AI analysis of garment images.
 * Calls analyze_garment in enrich mode asynchronously.
 */
async function handleGarmentEnrichment(
  supabase: any,
  payload: Record<string, unknown>,
  _userId: string | null,
): Promise<Record<string, unknown>> {
  const garmentId = payload.garment_id as string;
  const locale = (payload.locale as string) || "en";
  if (!garmentId) throw new Error("Missing garment_id in payload");

  const { data: garment, error } = await supabase
    .from("garments")
    .select("id, image_path, enrichment_status")
    .eq("id", garmentId)
    .single();

  if (error || !garment) throw new Error(`Garment not found: ${garmentId}`);
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
