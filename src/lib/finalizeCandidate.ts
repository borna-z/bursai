import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { logger } from '@/lib/logger';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';
import { triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';
import { buildGarmentInsert } from './buildGarmentInsert';

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
    const insertPayload = buildGarmentInsert(candidate);
    const garmentId = insertPayload.id as string;
    const storagePath = insertPayload.image_path;
    const isPng = candidate.blob.type === 'image/png';

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

    const { error: insertError } = await supabase.from('garments').insert(insertPayload);

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
