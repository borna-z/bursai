import {
  getGarmentReviewDecision,
  type GarmentReviewDecision,
} from '@/lib/garmentIntelligence';
import { trackEvent } from '@/lib/analytics';
import type { GarmentIntakeCandidate } from './finalizeCandidate';

export type { GarmentIntakeCandidate };

export function reviewCandidate(candidate: GarmentIntakeCandidate): GarmentReviewDecision {
  return getGarmentReviewDecision(
    candidate.confidence ?? candidate.analysis.confidence ?? null,
    {
      imageContainsMultipleGarments:
        candidate.analysis.image_contains_multiple_garments ?? null,
    },
  );
}

export function shouldAutoSave(candidate: GarmentIntakeCandidate): boolean {
  return reviewCandidate(candidate).needsReview === false;
}

export function logReviewDecision(
  candidate: GarmentIntakeCandidate,
  decision: GarmentReviewDecision,
): void {
  trackEvent('garment_review_decision', {
    source: candidate.source,
    needs_review: decision.needsReview,
    confidence: decision.confidence,
    reason: decision.reason,
    category: candidate.analysis.category,
  });
}
