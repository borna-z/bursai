import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { logger } from '@/lib/logger';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';
import type { Json } from '@/integrations/supabase/types';
import {
  buildGarmentIntelligenceFields,
  standardizeGarmentAiRaw,
  triggerGarmentPostSaveIntelligence,
} from '@/lib/garmentIntelligence';

export interface GarmentIntakeCandidate {
  blob: Blob;
  analysis: GarmentAnalysis;
  userId: string;
  source: 'live_scan' | 'add_photo' | 'batch_add';
  enableStudioQuality?: boolean;
  confidence?: number | null;
}

export async function finalizeCandidate(
  candidate: GarmentIntakeCandidate,
): Promise<{ garmentId: string; storagePath: string } | null> {
  const enableStudioQuality = candidate.enableStudioQuality ?? true;

  try {
    const garmentId = crypto.randomUUID();
    const isPng = candidate.blob.type === 'image/png';
    const ext = isPng ? 'png' : 'jpg';
    const storagePath = `${candidate.userId}/${garmentId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('garments')
      .upload(storagePath, candidate.blob, {
        contentType: isPng ? 'image/png' : 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      logger.error('Upload error:', uploadError);
      return null;
    }

    const { error: insertError } = await supabase.from('garments').insert({
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
    });

    if (insertError) {
      logger.error('Insert error:', insertError);
      return null;
    }

    if (enableStudioQuality) {
      triggerGarmentPostSaveIntelligence({
        garmentId,
        storagePath,
        source: candidate.source,
        imageProcessing: { mode: 'skip' },
      });
    }

    detectDuplicates(candidate.analysis, garmentId, storagePath).catch((err) => {
      logger.error('Duplicate detection error (non-blocking):', err);
    });

    return { garmentId, storagePath };
  } catch (err) {
    logger.error('finalizeCandidate error:', err);
    return null;
  }
}

async function detectDuplicates(
  analysis: GarmentAnalysis,
  excludeGarmentId: string,
  imagePath: string,
): Promise<void> {
  await invokeEdgeFunction('detect_duplicate_garment', {
    body: {
      image_path: imagePath,
      category: analysis.category,
      color_primary: analysis.color_primary,
      title: analysis.title,
      subcategory: analysis.subcategory,
      material: analysis.material,
      exclude_garment_id: excludeGarmentId,
    },
  });
}
