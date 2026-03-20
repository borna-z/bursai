import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';
import type { Json } from '@/integrations/supabase/types';
import { buildGarmentIntelligenceFields, GARMENT_IMAGE_PROCESSING_VERSION, standardizeGarmentAiRaw, triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';

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
      ai_raw: standardizeGarmentAiRaw({
        aiRaw: (result.analysis.ai_raw ?? null) as Json,
        analysisConfidence: result.analysis.confidence,
        source: 'live_scan',
      }),
      imported_via: 'live_scan',
      ...buildGarmentIntelligenceFields({ storagePath }),
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return;
    }

    triggerGarmentPostSaveIntelligence({
      garmentId,
      storagePath,
      source: 'live_scan',
      imageProcessing: {
        mode: 'local',
        run: () => removeBackgroundAsync(garmentId, userId, result.blob, storagePath),
      },
    });

    // Duplicate detection in background (never blocks)
    detectDuplicates(result.analysis, garmentId, storagePath).catch((err) => {
      console.error('Duplicate detection error (non-blocking):', err);
    });
  } catch (err) {
    console.error('Background save error:', err);
  } finally {
    URL.revokeObjectURL(result.thumbnailUrl);
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
  originalStoragePath: string,
): Promise<void> {
  await supabase.from('garments').update({
    image_processing_status: 'processing',
    image_processing_provider: 'local-remove-background',
    image_processing_version: GARMENT_IMAGE_PROCESSING_VERSION,
    image_processing_error: null,
  }).eq('id', garmentId);

  const { removeBackground } = await import('@/lib/removeBackground');
  const processedBlob = await removeBackground(originalBlob);
  if (processedBlob === originalBlob) {
    await supabase.from('garments').update({
      image_path: originalStoragePath,
      original_image_path: originalStoragePath,
      processed_image_path: null,
      image_processing_status: 'failed',
      image_processing_provider: 'local-remove-background',
      image_processing_version: GARMENT_IMAGE_PROCESSING_VERSION,
      image_processing_confidence: null,
      image_processing_error: 'Original photo kept after local background removal fallback.',
      image_processed_at: null,
    }).eq('id', garmentId);
    return;
  }
  const isPng = processedBlob.type === 'image/png';
  const ext = isPng ? 'png' : 'jpg';
  const storagePath = `${userId}/${garmentId}.${ext}`;
  await supabase.storage.from('garments').update(storagePath, processedBlob, {
    contentType: isPng ? 'image/png' : 'image/jpeg',
    upsert: true,
  });
  await supabase
    .from('garments')
    .update({
      image_path: storagePath,
      original_image_path: originalStoragePath,
      processed_image_path: storagePath,
      image_processing_status: 'ready',
      image_processing_provider: 'local-remove-background',
      image_processing_version: GARMENT_IMAGE_PROCESSING_VERSION,
      image_processing_confidence: 0.7,
      image_processing_error: null,
      image_processed_at: new Date().toISOString(),
    })
    .eq('id', garmentId);
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
  // Result is logged server-side; no UI action needed
}
