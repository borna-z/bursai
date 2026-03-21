import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';

export const GARMENT_IMAGE_PROCESSING_VERSION = 'background-removal-v1';


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
  /** Set render_status to 'pending' on insert (pilot: Add Photo only) */
  enableRender?: boolean;
  /** Opt out of background-removal pipeline initialization for render-only flows. */
  skipImageProcessing?: boolean;
}

interface TriggerGarmentPostSaveIntelligenceOptions {
  garmentId: string;
  storagePath: string;
  source: 'add_photo' | 'batch_add' | 'live_scan';
  imageProcessing?:
    | { mode: 'edge' }
    | { mode: 'local'; run: () => Promise<void> }
    | { mode: 'skip' };
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
    image_processing_status: skipImageProcessing ? 'failed' : 'pending',
    image_processing_provider: null,
    image_processing_version: GARMENT_IMAGE_PROCESSING_VERSION,
    image_processing_confidence: null,
    image_processing_error: skipImageProcessing
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
    console.error(`[${source}] garment enrichment error (non-blocking):`, err);
  });

  if (imageProcessing.mode === 'edge') {
    startGarmentImageProcessingInBackground(garmentId, source).catch((err) => {
      console.error(`[${source}] garment image processing trigger error (non-blocking):`, err);
    });
  } else if (imageProcessing.mode === 'local') {
    imageProcessing.run().catch((err) => {
      console.error(`[${source}] local garment image processing error (non-blocking):`, err);
    });
  }

  // Gemini render pipeline — pilot: Add Photo only
  const shouldRender = !skipRender && source === 'add_photo';
  if (shouldRender) {
    startGarmentRenderInBackground(garmentId, source).catch((err) => {
      console.error(`[${source}] garment render trigger error (non-blocking):`, err);
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

    await supabase.from('garments').update(updates).eq('id', garmentId);
    return true;
  };

  const success = await attempt();
  if (success) return;

  await new Promise((resolve) => setTimeout(resolve, 3000));
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
    console.warn('Garment image processing trigger did not confirm in time', error);
  }
}

async function startGarmentRenderInBackground(garmentId: string, source: string): Promise<void> {
  const { error } = await invokeEdgeFunction<{ ok?: boolean; skipped?: boolean; error?: string }>('render_garment_image', {
    timeout: 1000,
    retries: 0,
    body: { garmentId, source },
  });

  if (error) {
    console.warn('Garment render trigger did not confirm in time (non-blocking)', error);
  }
}
