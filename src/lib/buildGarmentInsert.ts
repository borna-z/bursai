import type { Json, TablesInsert } from '@/integrations/supabase/types';
import {
  buildGarmentIntelligenceFields,
  standardizeGarmentAiRaw,
} from '@/lib/garmentIntelligence';
import type { GarmentIntakeCandidate } from '@/lib/reviewCandidate';

function pick<T>(override: T | undefined, fallback: T): T {
  return override !== undefined ? override : fallback;
}

export function buildGarmentInsert(
  candidate: GarmentIntakeCandidate,
  storagePath?: string,
): TablesInsert<'garments'> {
  const enableStudioQuality = candidate.enableStudioQuality ?? true;
  const garmentId = candidate.existingGarmentId ?? crypto.randomUUID();
  const isPng = candidate.blob.type === 'image/png';
  const ext = isPng ? 'png' : 'jpg';
  const resolvedStoragePath = storagePath ?? `${candidate.userId}/${garmentId}.${ext}`;
  const overrides = candidate.fieldOverrides ?? {};

  const payload: TablesInsert<'garments'> = {
    id: garmentId,
    user_id: candidate.userId,
    image_path: resolvedStoragePath,
    title: pick(overrides.title, candidate.analysis.title),
    category: pick(overrides.category, candidate.analysis.category),
    subcategory: pick(overrides.subcategory, candidate.analysis.subcategory || null),
    color_primary: pick(overrides.color_primary, candidate.analysis.color_primary),
    color_secondary: pick(overrides.color_secondary, candidate.analysis.color_secondary || null),
    pattern: pick(overrides.pattern, candidate.analysis.pattern || null),
    material: pick(overrides.material, candidate.analysis.material || null),
    fit: pick(overrides.fit, candidate.analysis.fit || null),
    season_tags: pick(overrides.season_tags, candidate.analysis.season_tags || []),
    formality: pick(overrides.formality, candidate.analysis.formality || 3),
    ai_analyzed_at: new Date().toISOString(),
    ai_provider: candidate.analysis.ai_provider || 'unknown',
    ai_raw: standardizeGarmentAiRaw({
      aiRaw: (candidate.analysis.ai_raw ?? null) as Json,
      analysisConfidence: candidate.confidence ?? candidate.analysis.confidence,
      source: candidate.source,
    }),
    imported_via: candidate.source,
    ...buildGarmentIntelligenceFields({
      storagePath: resolvedStoragePath,
      enableRender: enableStudioQuality,
      skipImageProcessing: true,
    }),
  };

  if (overrides.in_laundry !== undefined) {
    payload.in_laundry = overrides.in_laundry;
  }

  return payload;
}
