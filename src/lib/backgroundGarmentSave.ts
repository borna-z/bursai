import { supabase } from '@/integrations/supabase/client';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';
import type { Json } from '@/integrations/supabase/types';

export interface SaveableResult {
  analysis: GarmentAnalysis;
  thumbnailUrl: string;
  blob: Blob;
}

/**
 * Upload a garment image to storage and insert the garment record.
 * Designed to run in the background after a scan is accepted.
 */
export async function saveGarmentInBackground(
  result: SaveableResult,
  userId: string
): Promise<void> {
  try {
    const garmentId = crypto.randomUUID();
    const ext = 'jpg';
    const storagePath = `${userId}/${garmentId}.${ext}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('garments')
      .upload(storagePath, result.blob, {
        contentType: 'image/jpeg',
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
    });

    if (insertError) {
      console.error('Insert error:', insertError);
    }
  } catch (err) {
    console.error('Background save error:', err);
  } finally {
    URL.revokeObjectURL(result.thumbnailUrl);
  }
}
