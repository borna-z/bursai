import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { trackEvent } from '@/lib/analytics';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';
import { buildGarmentInsert } from './buildGarmentInsert';
import { runPostSaveHooks } from './postSaveHooks';

export interface GarmentIntakeCandidate {
  blob: Blob;
  analysis: GarmentAnalysis;
  userId: string;
  source: 'live_scan' | 'add_photo' | 'batch_add';
  enableStudioQuality?: boolean;
  confidence?: number | null;
  existingGarmentId?: string;
  existingStoragePath?: string;
  fieldOverrides?: Partial<{
    title: string;
    category: string;
    subcategory: string | null;
    color_primary: string;
    color_secondary: string | null;
    pattern: string | null;
    material: string | null;
    fit: string | null;
    season_tags: string[];
    formality: number;
    in_laundry: boolean;
  }>;
}

export async function finalizeCandidate(
  candidate: GarmentIntakeCandidate,
): Promise<{ garmentId: string; storagePath: string } | null> {
  try {
    const insertPayload = buildGarmentInsert(candidate, candidate.existingStoragePath);
    const garmentId = insertPayload.id as string;
    const storagePath = insertPayload.image_path;

    if (!candidate.existingStoragePath) {
      const isPng = candidate.blob.type === 'image/png';
      const { error: uploadError } = await supabase.storage
        .from('garments')
        .upload(storagePath, candidate.blob, {
          contentType: isPng ? 'image/png' : 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        logger.error('Upload error:', uploadError);
        trackEvent('garment_intake_failed', { source: candidate.source, stage: 'upload' });
        return null;
      }
    }

    const { error: insertError } = await supabase.from('garments').insert(insertPayload);

    if (insertError) {
      logger.error('Insert error:', insertError);
      trackEvent('garment_intake_failed', { source: candidate.source, stage: 'insert' });
      return null;
    }

    runPostSaveHooks(garmentId, storagePath, candidate);

    return { garmentId, storagePath };
  } catch (err) {
    logger.error('finalizeCandidate error:', err);
    return null;
  }
}
