import { beforeEach, describe, expect, it, vi } from 'vitest';

let pendingGarmentRows: Array<{ id: string; ai_raw: unknown }> = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      select: vi.fn(() => {
        const query = {
          eq: vi.fn(() => query),
          limit: vi.fn(() => query),
          order: vi.fn().mockResolvedValue({ data: pendingGarmentRows, error: null }),
        };
        return query;
      }),
    })),
  },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import {
  buildGarmentIntelligenceFields,
  getGarmentReviewDecision,
  resumePendingGarmentRenders,
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
    pendingGarmentRows = [];
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

  it('triggers studio rendering for live scan without waiting for completion', async () => {
    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-live',
      storagePath: 'user-1/photo-live.jpg',
      source: 'live_scan',
      imageProcessing: { mode: 'local', run: vi.fn().mockResolvedValue(undefined) },
    });

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('analyze_garment', {
        body: { storagePath: 'user-1/photo-live.jpg', mode: 'enrich' },
      });
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: { garmentId: 'garment-live', source: 'live_scan' },
      }));
    });
  });

  it('bounds render kickoff concurrency and deduplicates repeated garment requests', async () => {
    let resolveFirstRender: (() => void) | null = null;
    let resolveSecondRender: (() => void) | null = null;

    vi.mocked(invokeEdgeFunction).mockImplementation((functionName) => {
      if (functionName === 'render_garment_image') {
        return new Promise((resolve) => {
          if (!resolveFirstRender) {
            resolveFirstRender = () => resolve({ data: {}, error: null });
            return;
          }

          if (!resolveSecondRender) {
            resolveSecondRender = () => resolve({ data: {}, error: null });
            return;
          }

          resolve({ data: {}, error: null });
        });
      }

      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-a',
      storagePath: 'user-1/photo-a.jpg',
      source: 'batch_add',
      imageProcessing: { mode: 'skip' },
    });
    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-a',
      storagePath: 'user-1/photo-a.jpg',
      source: 'batch_add',
      imageProcessing: { mode: 'skip' },
    });
    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-b',
      storagePath: 'user-1/photo-b.jpg',
      source: 'batch_add',
      imageProcessing: { mode: 'skip' },
    });
    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-c',
      storagePath: 'user-1/photo-c.jpg',
      source: 'batch_add',
      imageProcessing: { mode: 'skip' },
    });
    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-d',
      storagePath: 'user-1/photo-d.jpg',
      source: 'batch_add',
      imageProcessing: { mode: 'skip' },
    });

    await vi.waitFor(() => {
      expect(
        vi.mocked(invokeEdgeFunction).mock.calls.filter(([name]) => name === 'render_garment_image')
      ).toHaveLength(3);
    });

    expect(
      vi.mocked(invokeEdgeFunction).mock.calls.filter(([name]) => name === 'render_garment_image')
    ).toEqual([
      ['render_garment_image', expect.objectContaining({ body: { garmentId: 'garment-a', source: 'batch_add' } })],
      ['render_garment_image', expect.objectContaining({ body: { garmentId: 'garment-b', source: 'batch_add' } })],
      ['render_garment_image', expect.objectContaining({ body: { garmentId: 'garment-c', source: 'batch_add' } })],
    ]);

    resolveFirstRender?.();
    await vi.waitFor(() => {
      expect(
        vi.mocked(invokeEdgeFunction).mock.calls.filter(([name]) => name === 'render_garment_image')
      ).toHaveLength(4);
    });

    expect(
      vi.mocked(invokeEdgeFunction).mock.calls.filter(([name]) => name === 'render_garment_image')[3]
    ).toEqual([
      'render_garment_image',
      expect.objectContaining({ body: { garmentId: 'garment-d', source: 'batch_add' } }),
    ]);

    resolveSecondRender?.();
  });
});

describe('resumePendingGarmentRenders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingGarmentRows = [];
  });

  it('re-enqueues persisted pending renders and restores their saved source', async () => {
    pendingGarmentRows = [
      {
        id: 'pending-batch',
        ai_raw: { system_signals: { source: 'batch_add' } },
      },
      {
        id: 'pending-add-photo',
        ai_raw: { system_signals: { source: 'add_photo' } },
      },
      {
        id: 'pending-live-scan',
        ai_raw: { system_signals: { source: 'live_scan' } },
      },
    ];

    await resumePendingGarmentRenders('user-1');

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: { garmentId: 'pending-batch', source: 'batch_add' },
      }));
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: { garmentId: 'pending-add-photo', source: 'add_photo' },
      }));
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: { garmentId: 'pending-live-scan', source: 'live_scan' },
      }));
    });
  });

  it('throttles repeat pending-render sweeps for the same user', async () => {
    pendingGarmentRows = [
      {
        id: 'pending-1',
        ai_raw: { system_signals: { source: 'batch_add' } },
      },
    ];

    await resumePendingGarmentRenders('user-2');
    await resumePendingGarmentRenders('user-2');

    expect(
      vi.mocked(invokeEdgeFunction).mock.calls.filter(([name]) => name === 'render_garment_image')
    ).toHaveLength(1);
  });
});
