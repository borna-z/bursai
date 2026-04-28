import {
  getGarmentReviewDecision,
  type GarmentReviewDecision,
} from '@/lib/garmentIntelligence';
import { trackEvent } from '@/lib/analytics';
import type { GarmentIntakeCandidate } from './finalizeCandidate';

export type { GarmentIntakeCandidate };

export function reviewCandidate(candidate: GarmentIntakeCandidate): GarmentReviewDecision {
  // Codex P2 round 5 (PR #696): `candidate.analysis` is now nullable
  // (`GarmentAnalysis | null`) for the BatchCaptureStep refactor. With a
  // null analysis we have no confidence/multi-garment signal — return a
  // permissive review decision (auto-save, no review-needed) using the
  // candidate's outer `confidence` if provided, else null.
  return getGarmentReviewDecision(
    candidate.confidence ?? candidate.analysis?.confidence ?? null,
    {
      imageContainsMultipleGarments:
        candidate.analysis?.image_contains_multiple_garments ?? null,
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
    category: candidate.analysis?.category ?? null,
  });
}
