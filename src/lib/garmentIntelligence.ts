import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { logger } from '@/lib/logger';
import {
  GARMENT_IMAGE_PROCESSING_VERSION,
  GARMENT_ENRICHMENT_RETRY_DELAY_MS,
} from '@/config/constants';

export { GARMENT_IMAGE_PROCESSING_VERSION };

type RenderTriggerSource = 'add_photo' | 'batch_add' | 'live_scan' | 'manual_enhance' | 'retry';

export interface EnqueueRenderJobResult {
  /** Canonical render_jobs.id — stable across enqueue retries thanks to
      reserve's replay flag. */
  jobId: string;
  status: 'pending' | 'in_progress' | 'succeeded' | 'failed';
  source: string;
  /** True when the reserve hit the idempotency short-circuit (repeat
      enqueue with same clientNonce). */
  replay: boolean;
}

export class RenderEnqueueError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'RenderEnqueueError';
  }
}

/**
 * Enqueue a render job via the enqueue_render_job edge function.
 *
 * Replaces the in-memory `queuedRenderKickoffs` queue + direct render_garment_image
 * invocation from P4. Returns as soon as the job row is INSERTed (typically
 * ~200-300ms). The edge function fires an internal POST to process_render_jobs
 * for low-latency worker pickup; pg_cron is the safety net if that POST is lost.
 *
 * Callers should NOT await the underlying render — they should poll
 * garments.render_status (via useRenderJobStatus or by refetching the garment)
 * until it flips to 'ready' or 'failed'.
 *
 * @throws RenderEnqueueError on 4xx/5xx — callers should surface the status
 *   to the UI (402 → upgrade CTA, 503 → "try again later", 5xx → error toast).
 */
export async function enqueueRenderJob(
  garmentId: string,
  source: RenderTriggerSource,
  options: { clientNonce?: string } = {},
): Promise<EnqueueRenderJobResult> {
  // Fresh nonce per logical enqueue intent. Network retries of the SAME
  // enqueue call will be handled at the edge-function-client layer with the
  // same nonce re-sent, so reserve's replay flag deduplicates. Distinct
  // user-intent events (e.g. a manual "Try again" tap) pass a fresh nonce.
  const clientNonce = options.clientNonce ?? crypto.randomUUID();

  const { data, error } = await invokeEdgeFunction<EnqueueRenderJobResult & { error?: string }>(
    'enqueue_render_job',
    {
      body: { garmentId, source, clientNonce },
      retries: 0,
    },
  );

  if (error) {
    throw new RenderEnqueueError(
      error.message || 'render enqueue failed',
      (error as { status?: number }).status ?? 0,
      (error as { code?: string }).code,
    );
  }
  if (!data || !data.jobId) {
    throw new RenderEnqueueError('render enqueue returned no jobId', 0);
  }
  return {
    jobId: data.jobId,
    status: data.status,
    source: data.source,
    replay: data.replay,
  };
}

/**
 * Deprecated under Priority 5.
 *
 * Previously re-enqueued pending renders client-side on app open. With the
 * durable `render_jobs` table + pg_cron safety net, re-execution happens
 * server-side automatically. Client doesn't need to do anything.
 *
 * Kept as a no-op so existing call sites (useGarments.ts) don't need a
 * synchronized change to remove the call. Will be deleted in a follow-up.
 */
export async function resumePendingGarmentRenders(_userId: string): Promise<void> {
  return;
}


export const GARMENT_REVIEW_CONFIDENCE_THRESHOLD = 0.55;

export interface GarmentReviewDecision {
  needsReview: boolean;
  confidence: number | null;
  reason: 'low_confidence' | 'missing_confidence' | 'multiple_garments' | null;
}

interface GarmentReviewContext {
  imageContainsMultipleGarments?: boolean | null;
}

interface StandardizeGarmentAiRawOptions {
  aiRaw: Json | null | undefined;
  analysisConfidence?: number | null;
  source?: string | null;
  reviewDecision?: GarmentReviewDecision | null;
}

export function standardizeGarmentAiRaw({
  aiRaw,
  analysisConfidence,
  source,
  reviewDecision,
}: StandardizeGarmentAiRawOptions): Json | null {
  if (!aiRaw || typeof aiRaw !== 'object' || Array.isArray(aiRaw)) {
    if (analysisConfidence == null && !source && !reviewDecision) return aiRaw ?? null;

    return {
      system_signals: {
        analysis_confidence: analysisConfidence ?? null,
        source: source ?? null,
        needs_review: reviewDecision?.needsReview ?? null,
        review_reason: reviewDecision?.reason ?? null,
      },
    } as Json;
  }

  const record = aiRaw as Record<string, unknown>;
  const existingSignals =
    record.system_signals && typeof record.system_signals === 'object' && !Array.isArray(record.system_signals)
      ? record.system_signals as Record<string, unknown>
      : {};

  return {
    ...record,
    system_signals: {
      ...existingSignals,
      analysis_confidence:
        analysisConfidence ??
        (typeof existingSignals.analysis_confidence === 'number'
          ? existingSignals.analysis_confidence
          : typeof record.confidence === 'number'
            ? record.confidence
            : null),
      source: source ?? (typeof existingSignals.source === 'string' ? existingSignals.source : null),
      needs_review:
        reviewDecision?.needsReview ??
        (typeof existingSignals.needs_review === 'boolean' ? existingSignals.needs_review : null),
      review_reason:
        reviewDecision?.reason ??
        (typeof existingSignals.review_reason === 'string' ? existingSignals.review_reason : null),
    },
  } as Json;
}

export function getGarmentReviewDecision(
  analysisConfidence?: number | null,
  context: GarmentReviewContext = {},
): GarmentReviewDecision {
  if (context.imageContainsMultipleGarments) {
    return {
      needsReview: true,
      confidence: typeof analysisConfidence === 'number' && !Number.isNaN(analysisConfidence)
        ? Math.max(0, Math.min(1, analysisConfidence))
        : null,
      reason: 'multiple_garments',
    };
  }

  if (typeof analysisConfidence !== 'number' || Number.isNaN(analysisConfidence)) {
    return {
      needsReview: true,
      confidence: null,
      reason: 'missing_confidence',
    };
  }

  const confidence = Math.max(0, Math.min(1, analysisConfidence));
  if (confidence < GARMENT_REVIEW_CONFIDENCE_THRESHOLD) {
    return {
      needsReview: true,
      confidence,
      reason: 'low_confidence',
    };
  }

  return {
    needsReview: false,
    confidence,
    reason: null,
  };
}

interface BuildGarmentIntelligenceFieldsOptions {
  storagePath: string;
  /** Set render_status to 'pending' on insert for studio render flows. */
  enableRender?: boolean;
  /** Opt out of image preprocessing for save-first flows. */
  skipImageProcessing?: boolean;
}

interface TriggerGarmentPostSaveIntelligenceOptions {
  garmentId: string;
  storagePath: string;
  source: 'add_photo' | 'batch_add' | 'live_scan' | 'manual_enhance';
  imageProcessing?:
    | { mode: 'edge' }
    | { mode: 'local'; run: () => Promise<void> }
    | { mode: 'skip' }
    | { mode: 'full' };
  /** Skip Gemini render for this garment (default: auto based on source) */
  skipRender?: boolean;
}

export function buildGarmentIntelligenceFields({
  storagePath,
  enableRender = false,
  skipImageProcessing = false,
}: BuildGarmentIntelligenceFieldsOptions): Pick<
  TablesInsert<'garments'>,
  | 'enrichment_status'
  | 'original_image_path'
  | 'processed_image_path'
  | 'image_processing_status'
  | 'image_processing_provider'
  | 'image_processing_version'
  | 'image_processing_confidence'
  | 'image_processing_error'
  | 'image_processed_at'
  | 'render_status'
> {
  return {
    enrichment_status: 'pending',
    original_image_path: storagePath,
    processed_image_path: null,
    image_processing_status: skipImageProcessing ? 'ready' : 'pending',
    image_processing_provider: null,
    image_processing_version: GARMENT_IMAGE_PROCESSING_VERSION,
    image_processing_confidence: null,
    image_processing_error: null,
    image_processed_at: null,
    render_status: enableRender ? 'pending' : 'none',
  };
}

export function triggerGarmentPostSaveIntelligence({
  garmentId,
  storagePath,
  source,
  imageProcessing = { mode: 'skip' as const },
  skipRender,
}: TriggerGarmentPostSaveIntelligenceOptions): void {
  const shouldRender = !skipRender && (
    source === 'add_photo' || source === 'batch_add'
    || source === 'live_scan' || source === 'manual_enhance'
  );

  enrichGarmentInBackground(garmentId, storagePath)
    .then(() => {
      if (shouldRender) {
        startGarmentRenderInBackground(garmentId, source).catch((err) => {
          logger.error(`[${source}] render trigger error (post-enrichment):`, err);
        });
      }
    })
    .catch((err) => {
      logger.error(`[${source}] enrichment error:`, err);
      if (shouldRender) {
        startGarmentRenderInBackground(garmentId, source).catch((err2) => {
          logger.error(`[${source}] render trigger error (post-enrichment-failure):`, err2);
        });
      }
    });

  // imageProcessing stays separate and parallel — it does not affect render prompt content
  if (imageProcessing.mode === 'edge' || imageProcessing.mode === 'full') {
    startGarmentImageProcessingInBackground(garmentId, source).catch((err) => {
      logger.error(`[${source}] garment image processing trigger error (non-blocking):`, err);
    });
  } else if (imageProcessing.mode === 'local') {
    imageProcessing.run().catch((err) => {
      logger.error(`[${source}] local garment image processing error (non-blocking):`, err);
    });
  }
}

async function enrichGarmentInBackground(garmentId: string, storagePath: string): Promise<void> {
  await supabase.from('garments').update({ enrichment_status: 'in_progress' }).eq('id', garmentId);

  const attempt = async (): Promise<boolean> => {
    const { data, error } = await invokeEdgeFunction<{ enrichment?: Record<string, unknown>; error?: string }>('analyze_garment', {
      body: { storagePath, mode: 'enrich' },
    });

    if (error || !data?.enrichment) {
      return false;
    }

    const { data: existing } = await supabase.from('garments').select('ai_raw').eq('id', garmentId).single();
    const currentRaw = (existing?.ai_raw as Record<string, unknown>) || {};
    const mergedRaw = { ...currentRaw, enrichment: data.enrichment };
    const updates: Record<string, unknown> = {
      ai_raw: mergedRaw as Json,
      enrichment_status: 'complete',
    };

    if (data.enrichment.refined_title && typeof data.enrichment.refined_title === 'string') {
      updates.title = data.enrichment.refined_title.substring(0, 50);
    }

    // Extract enrichment fields into dedicated garment columns
    const e = data.enrichment;
    if (typeof e.silhouette === 'string') updates.silhouette = e.silhouette;
    if (typeof e.visual_weight === 'string') {
      const vwMap: Record<string, number> = { light: 1, medium: 2, heavy: 3 };
      updates.visual_weight = vwMap[e.visual_weight] ?? 2;
    }
    if (typeof e.texture_intensity === 'string') {
      const tiMap: Record<string, number> = { smooth: 1, subtle: 2, moderate: 3, pronounced: 4, bold: 5 };
      updates.texture_intensity = tiMap[e.texture_intensity] ?? 3;
    }
    if (typeof e.style_archetype === 'string') updates.style_archetype = e.style_archetype;
    if (Array.isArray(e.occasion_tags)) updates.occasion_tags = e.occasion_tags.filter((t: unknown) => typeof t === 'string');
    if (typeof e.versatility_score === 'number') updates.versatility_score = Math.max(1, Math.min(10, Math.round(e.versatility_score)));

    await supabase.from('garments').update(updates).eq('id', garmentId);
    return true;
  };

  const success = await attempt();
  if (success) return;

  await new Promise((resolve) => setTimeout(resolve, GARMENT_ENRICHMENT_RETRY_DELAY_MS));
  const retrySuccess = await attempt();
  if (!retrySuccess) {
    await supabase.from('garments').update({ enrichment_status: 'failed' }).eq('id', garmentId);
  }
}

async function startGarmentImageProcessingInBackground(garmentId: string, source: string): Promise<void> {
  const { error } = await invokeEdgeFunction<{ ok?: boolean; skipped?: boolean; error?: string }>('process_garment_image', {
    timeout: 1000,
    retries: 0,
    body: { garmentId, source },
  });

  if (error) {
    logger.warn('Garment image processing trigger did not confirm in time', error);
  }
}

async function startGarmentRenderInBackground(garmentId: string, source: string): Promise<void> {
  try {
    await enqueueRenderJob(garmentId, source as RenderTriggerSource);
  } catch (err) {
    if (err instanceof RenderEnqueueError && err.status === 402) {
      // Trial locked or insufficient credit — expected business state, not
      // an error to retry. UI surfaces the upgrade CTA separately.
      logger.info(`[${source}] render enqueue 402: ${err.code ?? err.message}`);
      return;
    }
    logger.warn(`[${source}] render enqueue failed`, err);
  }
}
