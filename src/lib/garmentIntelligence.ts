import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { logger } from '@/lib/logger';
import {
  GARMENT_IMAGE_PROCESSING_VERSION,
  RENDER_KICKOFF_CONCURRENCY,
  RENDER_RESUME_SWEEP_LIMIT,
  RENDER_RESUME_SWEEP_COOLDOWN_MS,
  RENDER_QUEUE_MAX_SIZE,
  GARMENT_ENRICHMENT_RETRY_DELAY_MS,
} from '@/config/constants';

export { GARMENT_IMAGE_PROCESSING_VERSION };

type RenderTriggerSource = 'add_photo' | 'batch_add' | 'live_scan';

const queuedRenderKickoffs: Array<{ garmentId: string; source: string }> = [];
const queuedRenderGarmentIds = new Set<string>();
const lastRenderResumeSweepByUser = new Map<string, number>();
const inFlightRenderResumeSweeps = new Map<string, Promise<void>>();
let activeRenderKickoffs = 0;

function pumpRenderKickoffQueue(): void {
  while (activeRenderKickoffs < RENDER_KICKOFF_CONCURRENCY && queuedRenderKickoffs.length > 0) {
    const next = queuedRenderKickoffs.shift();
    if (!next) return;

    activeRenderKickoffs += 1;

    void invokeEdgeFunction<{ ok?: boolean; skipped?: boolean; error?: string }>('render_garment_image', {
      timeout: 1000,
      retries: 0,
      body: { garmentId: next.garmentId, source: next.source },
    })
      .then(({ error }) => {
        if (error) {
          logger.warn('Garment render trigger did not confirm in time (non-blocking)', error);
        }
      })
      .finally(() => {
        activeRenderKickoffs = Math.max(0, activeRenderKickoffs - 1);
        queuedRenderGarmentIds.delete(next.garmentId);
        pumpRenderKickoffQueue();
      });
  }
}

function enqueueGarmentRenderKickoff(garmentId: string, source: string): void {
  if (queuedRenderGarmentIds.has(garmentId)) {
    return;
  }

  // Guard against unbounded queue growth (e.g. after bulk imports)
  if (queuedRenderKickoffs.length >= RENDER_QUEUE_MAX_SIZE) {
    logger.warn(`Render queue full (>${RENDER_QUEUE_MAX_SIZE}); dropping kickoff for ${garmentId}`);
    return;
  }

  queuedRenderGarmentIds.add(garmentId);
  queuedRenderKickoffs.push({ garmentId, source });
  pumpRenderKickoffQueue();
}

function getResumeRenderSource(aiRaw: Json | null | undefined): RenderTriggerSource {
  if (!aiRaw || typeof aiRaw !== 'object' || Array.isArray(aiRaw)) {
    return 'batch_add';
  }

  const systemSignals = (aiRaw as Record<string, unknown>).system_signals;
  if (!systemSignals || typeof systemSignals !== 'object' || Array.isArray(systemSignals)) {
    return 'batch_add';
  }

  const source = (systemSignals as Record<string, unknown>).source;
  if (source === 'add_photo' || source === 'live_scan') {
    return source;
  }

  return 'batch_add';
}

export async function resumePendingGarmentRenders(userId: string): Promise<void> {
  if (!userId) {
    return;
  }

  const now = Date.now();
  const lastSweepAt = lastRenderResumeSweepByUser.get(userId) ?? 0;
  if (now - lastSweepAt < RENDER_RESUME_SWEEP_COOLDOWN_MS) {
    return;
  }

  const inFlight = inFlightRenderResumeSweeps.get(userId);
  if (inFlight) {
    return inFlight;
  }

  const sweepPromise = (async () => {
    lastRenderResumeSweepByUser.set(userId, now);

    const { data, error } = await supabase
      .from('garments')
      .select('id, ai_raw')
      .eq('user_id', userId)
      .eq('render_status', 'pending')
      .limit(RENDER_RESUME_SWEEP_LIMIT)
      .order('created_at', { ascending: false });

    if (error) {
      logger.warn('Pending garment render resume sweep failed', error);
      return;
    }

    for (const garment of data ?? []) {
      enqueueGarmentRenderKickoff(garment.id, getResumeRenderSource(garment.ai_raw as Json | null | undefined));
    }
  })().finally(() => {
    inFlightRenderResumeSweeps.delete(userId);
  });

  inFlightRenderResumeSweeps.set(userId, sweepPromise);
  return sweepPromise;
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
  /** Opt out of background-removal pipeline initialization for render-only flows. */
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
  const imageProcessingSkippedForRender = skipImageProcessing && enableRender;
  const imageProcessingSkippedForOriginalOnly = skipImageProcessing && !enableRender;

  return {
    enrichment_status: 'pending',
    original_image_path: storagePath,
    processed_image_path: null,
    image_processing_status: imageProcessingSkippedForOriginalOnly ? 'ready' : skipImageProcessing ? 'failed' : 'pending',
    image_processing_provider: null,
    image_processing_version: GARMENT_IMAGE_PROCESSING_VERSION,
    image_processing_confidence: null,
    image_processing_error: imageProcessingSkippedForRender
      ? 'Background removal skipped for Gemini render pilot; original photo remains until render succeeds.'
      : null,
    image_processed_at: null,
    render_status: enableRender ? 'pending' : 'none',
  };
}

export function triggerGarmentPostSaveIntelligence({
  garmentId,
  storagePath,
  source,
  imageProcessing = { mode: 'edge' },
  skipRender,
}: TriggerGarmentPostSaveIntelligenceOptions): void {
  enrichGarmentInBackground(garmentId, storagePath).catch((err) => {
    logger.error(`[${source}] garment enrichment error (non-blocking):`, err);
  });

  if (imageProcessing.mode === 'edge' || imageProcessing.mode === 'full') {
    startGarmentImageProcessingInBackground(garmentId, source).catch((err) => {
      logger.error(`[${source}] garment image processing trigger error (non-blocking):`, err);
    });
  } else if (imageProcessing.mode === 'local') {
    imageProcessing.run().catch((err) => {
      logger.error(`[${source}] local garment image processing error (non-blocking):`, err);
    });
  }

  // Gemini render pipeline
  const shouldRender = !skipRender && (
    source === 'add_photo'
    || source === 'batch_add'
    || source === 'live_scan'
    || source === 'manual_enhance'
  );
  if (shouldRender) {
    startGarmentRenderInBackground(garmentId, source).catch((err) => {
      logger.error(`[${source}] garment render trigger error (non-blocking):`, err);
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
  enqueueGarmentRenderKickoff(garmentId, source);
}
