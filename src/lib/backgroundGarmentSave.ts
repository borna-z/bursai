import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { logger } from '@/lib/logger';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';
import type { Json } from '@/integrations/supabase/types';
import { buildGarmentIntelligenceFields, standardizeGarmentAiRaw, triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';
import { buildOriginalGarmentImagePath } from '@/lib/garmentImagePath';

export interface SaveableResult {
  analysis: GarmentAnalysis;
  thumbnailUrl: string;
  blob: Blob;
}

export interface SavedGarmentRecord {
  garmentId: string;
  storagePath: string;
}

interface BackgroundSaveOptions {
  enableStudioQuality?: boolean;
}

/**
 * Persist a scanned garment, then trigger non-blocking enrichment,
 * duplicate detection, and studio rendering in the background.
 */
export async function saveGarmentInBackground(
  result: SaveableResult,
  userId: string,
  externalGarmentId?: string,
  options: BackgroundSaveOptions = {},
): Promise<SavedGarmentRecord | null> {
  let garmentId = '';
  let storagePath = '';
  const enableStudioQuality = options.enableStudioQuality ?? true;

  try {
    garmentId = externalGarmentId || crypto.randomUUID();
    const isPng = result.blob.type === 'image/png';
    const ext = isPng ? 'png' : 'jpg';
    storagePath = buildOriginalGarmentImagePath(userId, garmentId, ext);

    const { error: uploadError } = await supabase.storage
      .from('garments')
      .upload(storagePath, result.blob, {
        contentType: isPng ? 'image/png' : 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      logger.error('Upload error:', uploadError);
      return null;
    }

    const { error: insertError } = await supabase.from('garments').insert({
      id: garmentId,
      user_id: userId,
      image_path: storagePath,
      title: result.analysis.title,
      category: result.analysis.category,
      subcategory: result.analysis.subcategory || null,
      color_primary: result.analysis.color_primary,
      color_secondary: result.analysis.color_secondary || null,
      pattern: result.analysis.pattern || null,
      material: result.analysis.material || null,
      fit: result.analysis.fit || null,
      season_tags: result.analysis.season_tags || [],
      formality: result.analysis.formality || 3,
      ai_analyzed_at: new Date().toISOString(),
      ai_provider: result.analysis.ai_provider || 'unknown',
      ai_raw: standardizeGarmentAiRaw({
        aiRaw: (result.analysis.ai_raw ?? null) as Json,
        analysisConfidence: result.analysis.confidence,
        source: 'live_scan',
      }),
      imported_via: 'live_scan',
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
        source: 'live_scan',
        imageProcessing: { mode: 'skip' },
      });
    }

    detectDuplicates(result.analysis, garmentId, storagePath).catch((err) => {
      logger.error('Duplicate detection error (non-blocking):', err);
    });

    return { garmentId, storagePath };
  } catch (err) {
    logger.error('Background save error:', err);
    return null;
  } finally {
    URL.revokeObjectURL(result.thumbnailUrl);
  }
}

/**
 * Check for duplicate garments using existing edge function.
 */
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
