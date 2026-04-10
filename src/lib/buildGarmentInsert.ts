import type { Json, TablesInsert } from '@/integrations/supabase/types';
import {
  buildGarmentIntelligenceFields,
  standardizeGarmentAiRaw,
} from '@/lib/garmentIntelligence';
import type { GarmentIntakeCandidate } from '@/lib/reviewCandidate';

export function buildGarmentInsert(
  candidate: GarmentIntakeCandidate,
): TablesInsert<'garments'> {
  const enableStudioQuality = candidate.enableStudioQuality ?? true;
  const garmentId = crypto.randomUUID();
  const isPng = candidate.blob.type === 'image/png';
  const ext = isPng ? 'png' : 'jpg';
  const storagePath = `${candidate.userId}/${garmentId}.${ext}`;

  return {
    id: garmentId,
    user_id: candidate.userId,
    image_path: storagePath,
    title: candidate.analysis.title,
    category: candidate.analysis.category,
    subcategory: candidate.analysis.subcategory || null,
    color_primary: candidate.analysis.color_primary,
    color_secondary: candidate.analysis.color_secondary || null,
    pattern: candidate.analysis.pattern || null,
    material: candidate.analysis.material || null,
    fit: candidate.analysis.fit || null,
    season_tags: candidate.analysis.season_tags || [],
    formality: candidate.analysis.formality || 3,
    ai_analyzed_at: new Date().toISOString(),
    ai_provider: candidate.analysis.ai_provider || 'unknown',
    ai_raw: standardizeGarmentAiRaw({
      aiRaw: (candidate.analysis.ai_raw ?? null) as Json,
      analysisConfidence: candidate.confidence ?? candidate.analysis.confidence,
      source: candidate.source,
    }),
    imported_via: candidate.source,
    ...buildGarmentIntelligenceFields({
      storagePath,
      enableRender: enableStudioQuality,
      skipImageProcessing: true,
    }),
  };
}
