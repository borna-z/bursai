import { supabase } from '../supabase';
import { callEdgeFunction } from '../edgeFunctionClient';
import { triggerGarmentEnrichment } from '../../hooks/useAnalyzeGarment';
import type { Garment } from '../../types/garment';
import type { AddGarmentParams, AddGarmentSource } from './types';
import {
  persistGarmentRaw,
  withUploadMaskMetadata,
} from './persistGarmentRaw';

export interface PersistGarmentWithMetadataOptions {
  onRenderEnqueueFailure?: (err: unknown) => void;
}

function makeClientNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function resetRenderStatusOnEnqueueFailure(
  garmentId: string,
  source: string,
  originalErr: unknown,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('garments')
      .update({ render_status: 'none' })
      .eq('id', garmentId);
    if (error) {
      console.warn(
        `[garmentSave] [${source}] reset-to-none after enqueue failure also failed — garment may strand at 'pending'`,
        {
          garmentId,
          updateError: error.message,
          originalError: originalErr instanceof Error ? originalErr.message : String(originalErr),
        },
      );
    }
  } catch (resetErr) {
    console.warn('[garmentSave] reset render_status threw:', resetErr);
  }
}

async function queueRender(
  garmentId: string,
  source: AddGarmentSource,
  onFailure?: (err: unknown) => void,
): Promise<void> {
  try {
    await callEdgeFunction('enqueue_render_job', {
      body: {
        garmentId,
        source,
        clientNonce: makeClientNonce(),
      },
    });
  } catch (err) {
    console.warn('[garmentSave] enqueue_render_job failed:', err);
    await resetRenderStatusOnEnqueueFailure(garmentId, source, err);
    if (onFailure) {
      onFailure(err);
    }
  }
}

export async function persistGarmentWithMetadata(
  params: AddGarmentParams,
  options?: PersistGarmentWithMetadataOptions,
): Promise<Garment> {
  const resolvedParams = withUploadMaskMetadata(params);
  const { garment, userId } = await persistGarmentRaw(resolvedParams);

  if (resolvedParams.enableStudioQuality) {
    void queueRender(garment.id, resolvedParams.source, options?.onRenderEnqueueFailure);
  }
  void triggerGarmentEnrichment(resolvedParams.storagePath, garment.id, userId).catch(() => {});

  return garment;
}
