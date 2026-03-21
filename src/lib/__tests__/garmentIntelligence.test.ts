import { describe, expect, it } from 'vitest';
import { getGarmentReviewDecision, standardizeGarmentAiRaw } from '@/lib/garmentIntelligence';

describe('getGarmentReviewDecision', () => {
  it('auto-approves high-confidence garments', () => {
    expect(getGarmentReviewDecision(0.82)).toEqual({
      needsReview: false,
      confidence: 0.82,
      reason: null,
    });
  });

  it('flags low-confidence garments for review', () => {
    expect(getGarmentReviewDecision(0.42)).toEqual({
      needsReview: true,
      confidence: 0.42,
      reason: 'low_confidence',
    });
  });

  it('flags missing confidence for review', () => {
    expect(getGarmentReviewDecision(undefined)).toEqual({
      needsReview: true,
      confidence: null,
      reason: 'missing_confidence',
    });
  });
});

describe('standardizeGarmentAiRaw', () => {
  it('persists review decision into system signals', () => {
    expect(standardizeGarmentAiRaw({
      aiRaw: { foo: 'bar' },
      analysisConfidence: 0.42,
      source: 'batch_add',
      reviewDecision: getGarmentReviewDecision(0.42),
    })).toEqual({
      foo: 'bar',
      system_signals: {
        analysis_confidence: 0.42,
        source: 'batch_add',
        needs_review: true,
        review_reason: 'low_confidence',
      },
    });
  });
});
