import {
  getGarmentReviewDecision,
  type GarmentReviewDecision,
} from '@/lib/garmentIntelligence';
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
