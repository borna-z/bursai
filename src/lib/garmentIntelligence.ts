import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';

export const GARMENT_IMAGE_PROCESSING_VERSION = 'background-removal-v1';

interface BuildGarmentIntelligenceFieldsOptions {
  storagePath: string;
}

interface TriggerGarmentPostSaveIntelligenceOptions {
  garmentId: string;
  storagePath: string;
  source: 'add_photo' | 'batch_add' | 'live_scan';
  imageProcessing?:
    | { mode: 'edge' }
    | { mode: 'local'; run: () => Promise<void> }
    | { mode: 'skip' };
}

export function buildGarmentIntelligenceFields({
  storagePath,
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
> {
  return {
    enrichment_status: 'pending',
    original_image_path: storagePath,
    processed_image_path: null,
    image_processing_status: 'pending',
    image_processing_provider: null,
    image_processing_version: GARMENT_IMAGE_PROCESSING_VERSION,
    image_processing_confidence: null,
    image_processing_error: null,
    image_processed_at: null,
  };
}

export function triggerGarmentPostSaveIntelligence({
  garmentId,
  storagePath,
  source,
  imageProcessing = { mode: 'edge' },
}: TriggerGarmentPostSaveIntelligenceOptions): void {
  enrichGarmentInBackground(garmentId, storagePath).catch((err) => {
    console.error(`[${source}] garment enrichment error (non-blocking):`, err);
  });

  if (imageProcessing.mode === 'edge') {
    startGarmentImageProcessingInBackground(garmentId, source).catch((err) => {
      console.error(`[${source}] garment image processing trigger error (non-blocking):`, err);
    });
    return;
  }

  if (imageProcessing.mode === 'local') {
    imageProcessing.run().catch((err) => {
      console.error(`[${source}] local garment image processing error (non-blocking):`, err);
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
