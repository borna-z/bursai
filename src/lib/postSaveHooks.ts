import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { logger } from '@/lib/logger';
import { triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';
import type { GarmentIntakeCandidate } from '@/lib/reviewCandidate';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';

export function runPostSaveHooks(
  garmentId: string,
  storagePath: string,
  candidate: GarmentIntakeCandidate,
): void {
  const enableStudioQuality = candidate.enableStudioQuality ?? true;
  triggerGarmentPostSaveIntelligence({
    garmentId,
    storagePath,
    source: candidate.source,
    imageProcessing: { mode: 'skip' },
    skipRender: !enableStudioQuality,
  });

  detectDuplicates(candidate.analysis, garmentId, storagePath).catch((err) => {
    logger.error('Duplicate detection error (non-blocking):', err);
  });
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
