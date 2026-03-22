import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) })),
  },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import {
  buildGarmentIntelligenceFields,
  getGarmentReviewDecision,
  standardizeGarmentAiRaw,
  triggerGarmentPostSaveIntelligence,
} from '@/lib/garmentIntelligence';

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

  it('flags multi-garment photos for review even when confidence is high', () => {
    expect(getGarmentReviewDecision(0.91, { imageContainsMultipleGarments: true })).toEqual({
      needsReview: true,
      confidence: 0.91,
      reason: 'multiple_garments',
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


describe('buildGarmentIntelligenceFields', () => {
  it('marks render-only add photo records as skipped for background removal', () => {
    expect(buildGarmentIntelligenceFields({
      storagePath: 'user-1/photo.jpg',
      enableRender: true,
      skipImageProcessing: true,
    })).toEqual(expect.objectContaining({
      original_image_path: 'user-1/photo.jpg',
      image_processing_status: 'failed',
      image_processing_error: 'Background removal skipped for Gemini render pilot; original photo remains until render succeeds.',
      render_status: 'pending',
    }));
  });
});

describe('triggerGarmentPostSaveIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips background removal for add photo when imageProcessing mode is skip', async () => {
    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-1',
      storagePath: 'user-1/photo.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    });

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('analyze_garment', {
        body: { storagePath: 'user-1/photo.jpg', mode: 'enrich' },
      });
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: { garmentId: 'garment-1', source: 'add_photo' },
      }));
    });

    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalledWith('process_garment_image', expect.anything());
  });

  it('keeps background removal enabled for batch add and also triggers render', async () => {
    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-2',
      storagePath: 'user-1/photo.jpg',
      source: 'batch_add',
      imageProcessing: { mode: 'edge' },
    });

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('process_garment_image', expect.objectContaining({
        body: { garmentId: 'garment-2', source: 'batch_add' },
      }));
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: { garmentId: 'garment-2', source: 'batch_add' },
      }));
    });
  });
});
