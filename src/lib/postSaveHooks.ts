import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { logger } from '@/lib/logger';
import { triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';
import { trackEvent } from '@/lib/analytics';
import {
  logReviewDecision,
  reviewCandidate,
  type GarmentIntakeCandidate,
} from '@/lib/reviewCandidate';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';

export function runPostSaveHooks(
  garmentId: string,
  storagePath: string,
  candidate: GarmentIntakeCandidate,
): void {
  const decision = reviewCandidate(candidate);
  logReviewDecision(candidate, decision);

  const enableStudioQuality = candidate.enableStudioQuality ?? true;
  triggerGarmentPostSaveIntelligence({
    garmentId,
    storagePath,
    source: candidate.source,
    imageProcessing: { mode: 'skip' },
    skipRender: !enableStudioQuality,
  });

  trackEvent('garment_added', {
    source: candidate.source,
    confidence: candidate.confidence ?? null,
    needs_review: decision.needsReview,
  });

  trackEvent('garment_intake', {
    source: candidate.source,
    confidence: candidate.confidence ?? null,
    category: candidate.analysis.category,
    subcategory: candidate.analysis.subcategory ?? null,
    needs_review: decision.needsReview,
    auto_saved: !decision.needsReview,
    studio_quality: candidate.enableStudioQuality ?? true,
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
