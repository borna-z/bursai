import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
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
}

export async function finalizeCandidate(
  candidate: GarmentIntakeCandidate,
): Promise<{ garmentId: string; storagePath: string } | null> {
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

    runPostSaveHooks(garmentId, storagePath, candidate);

    return { garmentId, storagePath };
  } catch (err) {
    logger.error('finalizeCandidate error:', err);
    return null;
  }
}
