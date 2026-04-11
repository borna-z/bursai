import { describe, it, expect, vi } from 'vitest';
import {
  reviewCandidate,
  shouldAutoSave,
  logReviewDecision,
  type GarmentIntakeCandidate,
} from '@/lib/reviewCandidate';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';

const trackEventMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics', () => ({
  trackEvent: trackEventMock,
}));

function makeCandidate(
  analysisOverrides: Partial<GarmentAnalysis> = {},
  candidateOverrides: Partial<GarmentIntakeCandidate> = {},
): GarmentIntakeCandidate {
  return {
    blob: new Blob(['']),
    analysis: {
      title: 't',
      category: 'top',
      color_primary: 'blue',
      confidence: 0.9,
      ai_provider: 'burs_ai',
      ai_raw: { source: 'test' },
      ...analysisOverrides,
    } as GarmentAnalysis,
    userId: 'user-1',
    source: 'add_photo',
    ...candidateOverrides,
  };
}

describe('reviewCandidate', () => {
  it('approves high-confidence single garments automatically', () => {
    const decision = reviewCandidate(makeCandidate({ confidence: 0.9 }));
    expect(decision.needsReview).toBe(false);
    expect(decision.reason).toBeNull();
    expect(decision.confidence).toBe(0.9);
  });

  it('flags confidence below the 0.55 threshold as low_confidence', () => {
    const decision = reviewCandidate(makeCandidate({ confidence: 0.42 }));
    expect(decision.needsReview).toBe(true);
    expect(decision.reason).toBe('low_confidence');
  });

  it('flags missing confidence as missing_confidence', () => {
    const decision = reviewCandidate(makeCandidate({ confidence: undefined }));
    expect(decision.needsReview).toBe(true);
    expect(decision.reason).toBe('missing_confidence');
    expect(decision.confidence).toBeNull();
  });

  it('flags multi-garment photos even when confidence is high', () => {
    const decision = reviewCandidate(
      makeCandidate({ confidence: 0.99, image_contains_multiple_garments: true }),
    );
    expect(decision.needsReview).toBe(true);
    expect(decision.reason).toBe('multiple_garments');
  });

  it('prefers candidate.confidence over analysis.confidence', () => {
    const decision = reviewCandidate(
      makeCandidate({ confidence: 0.99 }, { confidence: 0.2 }),
    );
    expect(decision.needsReview).toBe(true);
    expect(decision.reason).toBe('low_confidence');
    expect(decision.confidence).toBe(0.2);
  });
});

describe('shouldAutoSave', () => {
  it('returns true only when the candidate does not need review', () => {
    expect(shouldAutoSave(makeCandidate({ confidence: 0.9 }))).toBe(true);
    expect(shouldAutoSave(makeCandidate({ confidence: 0.2 }))).toBe(false);
    expect(shouldAutoSave(makeCandidate({ confidence: undefined }))).toBe(false);
  });
});

describe('logReviewDecision', () => {
  it('emits a garment_review_decision event with the candidate context', () => {
    trackEventMock.mockClear();
    const candidate = makeCandidate({ confidence: 0.9, category: 'top' });
    logReviewDecision(candidate, reviewCandidate(candidate));
    expect(trackEventMock).toHaveBeenCalledWith('garment_review_decision', {
      source: 'add_photo',
      needs_review: false,
      confidence: 0.9,
      reason: null,
      category: 'top',
    });
  });
});
