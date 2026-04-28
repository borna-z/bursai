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

  // Codex P2 round 5 (PR #696): `candidate.analysis` was widened to
  // `GarmentAnalysis | null` for the BatchCaptureStep refactor. The
  // analytics + dedup paths below dereferenced `.category` / `.subcategory`
  // / etc. directly, which would TypeError on `null` and bubble into
  // `finalizeCandidate`'s caller as a post-insert failure (the row is
  // already persisted at this point — the failure is misleading). Null-
  // safe accessors below; `detectDuplicates` early-returns when the
  // candidate has no analysis (it can't dedup against unknown features).
  trackEvent('garment_intake', {
    source: candidate.source,
    confidence: candidate.confidence ?? null,
    category: candidate.analysis?.category ?? null,
    subcategory: candidate.analysis?.subcategory ?? null,
    needs_review: decision.needsReview,
    auto_saved: !decision.needsReview,
    studio_quality: candidate.enableStudioQuality ?? true,
  });

  if (candidate.analysis) {
    detectDuplicates(candidate.analysis, garmentId, storagePath).catch((err) => {
      logger.error('Duplicate detection error (non-blocking):', err);
    });
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
