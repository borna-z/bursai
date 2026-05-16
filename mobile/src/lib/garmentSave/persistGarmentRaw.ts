import { supabase } from '../supabase';
import { getUploadMaskMetadata } from '../imageUpload';
import type { Garment, GarmentInsert } from '../../types/garment';
import type { AnalysisResult } from '../../hooks/useAnalyzeGarment';
import type { AddGarmentParams, AddGarmentSource } from './types';

const GARMENT_REVIEW_CONFIDENCE_THRESHOLD = 0.55;

interface ReviewDecision {
  needsReview: boolean;
  reason: 'low_confidence' | 'missing_confidence' | 'multiple_garments' | null;
}

function deriveReviewDecision(analysis: AnalysisResult): ReviewDecision {
  if (analysis.image_contains_multiple_garments) {
    return { needsReview: true, reason: 'multiple_garments' };
  }
  const c = analysis.confidence;
  if (typeof c !== 'number' || Number.isNaN(c)) {
    return { needsReview: true, reason: 'missing_confidence' };
  }
  if (c < GARMENT_REVIEW_CONFIDENCE_THRESHOLD) {
    return { needsReview: true, reason: 'low_confidence' };
  }
  return { needsReview: false, reason: null };
}

function buildAiRawWithSystemSignals(
  analysis: AnalysisResult,
  source: AddGarmentSource,
  aiOverridden?: AddGarmentParams['aiOverridden'],
): Record<string, unknown> {
  const review = deriveReviewDecision(analysis);
  const baseRaw =
    analysis.ai_raw && typeof analysis.ai_raw === 'object' && !Array.isArray(analysis.ai_raw)
      ? analysis.ai_raw
      : {};
  const existingSignals =
    baseRaw.system_signals && typeof baseRaw.system_signals === 'object' && !Array.isArray(baseRaw.system_signals)
      ? (baseRaw.system_signals as Record<string, unknown>)
      : {};
  const overriddenKeys = aiOverridden
    ? Object.entries(aiOverridden).filter(([, v]) => v === true).map(([k]) => k)
    : [];
  const aiOverriddenSignal: Record<string, unknown> =
    overriddenKeys.length > 0
      ? { ai_overridden: Object.fromEntries(overriddenKeys.map((k) => [k, true])) }
      : {};
  return {
    ...baseRaw,
    system_signals: {
      ...existingSignals,
      analysis_confidence: typeof analysis.confidence === 'number' ? analysis.confidence : null,
      source,
      needs_review: review.needsReview,
      review_reason: review.reason,
      ...aiOverriddenSignal,
    },
  };
}

export function withUploadMaskMetadata(params: AddGarmentParams): AddGarmentParams {
  if (params.maskedStoragePath || params.maskStatus) return params;
  const metadata = getUploadMaskMetadata(params.storagePath);
  if (!metadata) return params;
  return {
    ...params,
    maskedStoragePath: metadata.maskedStoragePath,
    maskStatus: metadata.maskStatus,
  };
}

export interface PersistGarmentRawResult {
  garment: Garment;
  userId: string;
}

export async function persistGarmentRaw(
  params: AddGarmentParams,
): Promise<PersistGarmentRawResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error('Not authenticated');

  const insert: GarmentInsert = {
    user_id: user.id,
    ...(params.garmentId ? { id: params.garmentId } : {}),
    title: params.title?.trim() || params.analysis.title || 'Untitled',
    category: params.category || params.analysis.category || 'top',
    subcategory:
      params.subcategory !== undefined ? params.subcategory : params.analysis.subcategory,
    color_primary:
      params.color_primary !== undefined ? params.color_primary : params.analysis.color_primary,
    color_secondary:
      params.color_secondary !== undefined ? params.color_secondary : params.analysis.color_secondary,
    material: params.material !== undefined ? params.material : params.analysis.material,
    fit: params.fit !== undefined ? params.fit : params.analysis.fit,
    pattern: params.pattern !== undefined ? params.pattern : params.analysis.pattern,
    season_tags: params.season_tags ?? params.analysis.season_tags,
    original_image_path: params.storagePath,
    image_path: params.maskedStoragePath ?? params.storagePath,
    wear_count: 0,
    in_laundry: false,
    purchase_price: params.price ?? null,
    ai_analyzed_at: new Date().toISOString(),
    ai_provider: params.analysis.ai_provider ?? null,
    ai_raw: buildAiRawWithSystemSignals(
      params.analysis,
      params.source,
      params.aiOverridden,
    ) as GarmentInsert['ai_raw'],
    enrichment_status: 'pending',
    render_status: params.enableStudioQuality ? 'pending' : 'none',
    imported_via: params.source,
  };

  const formalityValue =
    typeof params.formality === 'number'
      ? params.formality
      : typeof params.analysis.formality === 'number'
        ? params.analysis.formality
        : null;
  if (formalityValue !== null) {
    insert.formality = formalityValue;
  }

  if (params.maskStatus) {
    (insert as unknown as Record<string, unknown>).mask_status = params.maskStatus;
  }

  const { data, error } = await supabase
    .from('garments')
    .insert(insert)
    .select()
    .single();
  if (error) throw error;

  return { garment: data as Garment, userId: user.id };
}
