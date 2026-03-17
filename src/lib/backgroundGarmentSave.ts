import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';
import type { Json } from '@/integrations/supabase/types';

export interface SaveableResult {
  analysis: GarmentAnalysis;
  thumbnailUrl: string;
  blob: Blob;
}

/**
 * Upload a garment image to storage, insert the garment record,
 * then trigger Stage 2 enrichment + duplicate detection in background.
 */
export async function saveGarmentInBackground(
  result: SaveableResult,
  userId: string
): Promise<void> {
  let garmentId = '';
  let storagePath = '';

  try {
    garmentId = crypto.randomUUID();
    const isPng = result.blob.type === 'image/png';
    const ext = isPng ? 'png' : 'jpg';
    storagePath = `${userId}/${garmentId}.${ext}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('garments')
      .upload(storagePath, result.blob, {
        contentType: isPng ? 'image/png' : 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return;
    }

    // Save garment record
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
      ai_raw: (result.analysis.ai_raw ?? null) as Json,
      imported_via: 'live_scan',
      enrichment_status: 'pending',
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return;
    }

    // Background removal — async, never blocks, updates image in storage
    removeBackgroundAsync(garmentId, userId, result.blob).catch(() => {});

    // Stage 2: Fire enrichment in background (never blocks)
    enrichGarment(garmentId, userId, storagePath).catch((err) => {
      console.error('Enrichment error (non-blocking):', err);
    });

    // Duplicate detection in background (never blocks)
    detectDuplicates(result.analysis, garmentId).catch((err) => {
      console.error('Duplicate detection error (non-blocking):', err);
    });
  } catch (err) {
    console.error('Background save error:', err);
  } finally {
    URL.revokeObjectURL(result.thumbnailUrl);
  }
}

/**
 * Stage 2 enrichment: call analyze_garment with mode='enrich',
 * then merge enrichment data into the garment's ai_raw field.
 * Retries once automatically on failure before marking as 'failed'.
 */
async function enrichGarment(
  garmentId: string,
  userId: string,
  storagePath: string
): Promise<void> {
  // Mark as in_progress
  await supabase.from('garments').update({ enrichment_status: 'in_progress' }).eq('id', garmentId);

  const attempt = async (): Promise<boolean> => {
    const { data, error } = await invokeEdgeFunction<{ enrichment?: Record<string, unknown>; error?: string }>('analyze_garment', {
      body: { storagePath, mode: 'enrich' },
    });

    if (error || !data?.enrichment) {
      console.error('Enrichment failed:', error?.message || data?.error);
      return false;
    }

    // Merge enrichment into ai_raw
    const { data: existing } = await supabase
      .from('garments')
      .select('ai_raw')
      .eq('id', garmentId)
      .single();

    const currentRaw = (existing?.ai_raw as Record<string, unknown>) || {};
    const mergedRaw = { ...currentRaw, enrichment: data.enrichment };

    const updates: Record<string, unknown> = {
      ai_raw: mergedRaw as Json,
      enrichment_status: 'complete',
    };

    if (data.enrichment.refined_title && typeof data.enrichment.refined_title === 'string') {
      updates.title = (data.enrichment.refined_title as string).substring(0, 50);
    }

    await supabase
      .from('garments')
      .update(updates)
      .eq('id', garmentId);

    return true;
  };

  // First attempt
  const success = await attempt();
  if (success) return;

  // Auto-retry after 3s
  await new Promise(r => setTimeout(r, 3000));
  const retrySuccess = await attempt();
  if (!retrySuccess) {
    await supabase.from('garments').update({ enrichment_status: 'failed' }).eq('id', garmentId);
  }
}

/**
 * Remove background from the garment image async after save.
 * Updates the stored image in-place. Never throws — failures are silently logged.
 */
async function removeBackgroundAsync(
  garmentId: string,
  userId: string,
  originalBlob: Blob,
): Promise<void> {
  const { removeBackground } = await import('@/lib/removeBackground');
  const processedBlob = await removeBackground(originalBlob);
  if (processedBlob === originalBlob) return; // No change, WASM unavailable
  const isPng = processedBlob.type === 'image/png';
  const ext = isPng ? 'png' : 'jpg';
  const storagePath = `${userId}/${garmentId}.${ext}`;
  await supabase.storage.from('garments').update(storagePath, processedBlob, {
    contentType: isPng ? 'image/png' : 'image/jpeg',
    upsert: true,
  });
  await supabase
    .from('garments')
    .update({ image_path: storagePath })
    .eq('id', garmentId);
}

/**
 * Check for duplicate garments using existing edge function.
 */
async function detectDuplicates(
  analysis: GarmentAnalysis,
  excludeGarmentId: string
): Promise<void> {
  await invokeEdgeFunction('detect_duplicate_garment', {
    body: {
      category: analysis.category,
      color_primary: analysis.color_primary,
      title: analysis.title,
      subcategory: analysis.subcategory,
      material: analysis.material,
      exclude_garment_id: excludeGarmentId,
    },
  });
  // Result is logged server-side; no UI action needed
}
