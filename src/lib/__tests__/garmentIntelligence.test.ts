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
          single: vi.fn().mockResolvedValue({ data: { ai_raw: null }, error: null }),
        };
        return query;
      }),
    })),
  },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: vi.fn().mockImplementation((functionName: string) => {
    if (functionName === 'analyze_garment') {
      return Promise.resolve({ data: { enrichment: { refined_title: 'Test garment' } }, error: null });
    }
    return Promise.resolve({ data: {}, error: null });
  }),
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
  it('marks save-first render records as ready for original-photo display until studio render finishes', () => {
    expect(buildGarmentIntelligenceFields({
      storagePath: 'user-1/photo.jpg',
      enableRender: true,
      skipImageProcessing: true,
    })).toEqual(expect.objectContaining({
      original_image_path: 'user-1/photo.jpg',
      image_processing_status: 'ready',
      image_processing_error: null,
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
        body: expect.objectContaining({ garmentId: 'garment-1', source: 'add_photo', clientNonce: expect.any(String) }),
      }));
    });

    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalledWith('process_garment_image', expect.anything());
  });

  it('allows batch add to skip image processing and still trigger render', async () => {
    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-2',
      storagePath: 'user-1/photo.jpg',
      source: 'batch_add',
      imageProcessing: { mode: 'skip' },
    });

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'garment-2', source: 'batch_add', clientNonce: expect.any(String) }),
      }));
    });

    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalledWith('process_garment_image', expect.anything());
  });

  it('triggers studio rendering for live scan without waiting for completion', async () => {
    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-live',
      storagePath: 'user-1/photo-live.jpg',
      source: 'live_scan',
      imageProcessing: { mode: 'skip' },
    });

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('analyze_garment', {
        body: { storagePath: 'user-1/photo-live.jpg', mode: 'enrich' },
      });
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'garment-live', source: 'live_scan', clientNonce: expect.any(String) }),
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
        body: expect.objectContaining({ garmentId: 'garment-live', source: 'live_scan', clientNonce: expect.any(String) }),
      }));
    });
  });

  it('triggers render only after enrichment resolves, not in parallel', async () => {
    let resolveEnrich!: (value: { data: unknown; error: null }) => void;
    vi.mocked(invokeEdgeFunction).mockImplementation((functionName) => {
      if (functionName === 'analyze_garment') {
        return new Promise((resolve) => { resolveEnrich = resolve; });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-chain',
      storagePath: 'user-1/photo-chain.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    });

    // Yield to event loop — enrichment is blocked awaiting analyze_garment
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalledWith('render_garment_image', expect.anything());

    // Resolve enrichment — render must fire in the .then() chain
    resolveEnrich({ data: { enrichment: { refined_title: 'Chain test' } }, error: null });

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'garment-chain', source: 'add_photo', clientNonce: expect.any(String) }),
      }));
    });
  });

  it('still triggers render when enrichment fails (fallback path)', async () => {
    vi.useFakeTimers();
    vi.mocked(invokeEdgeFunction).mockImplementation((functionName) => {
      if (functionName === 'analyze_garment') {
        return Promise.resolve({ data: null, error: 'enrichment_failed' });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-fail',
      storagePath: 'user-1/photo-fail.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    });

    // Flush all pending promises and the retry delay timer
    await vi.advanceTimersByTimeAsync(5000);

    expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
      body: expect.objectContaining({ garmentId: 'garment-fail', source: 'add_photo', clientNonce: expect.any(String) }),
    }));

    vi.useRealTimers();
  });

  it('triggers render for manual_enhance source', async () => {
    vi.mocked(invokeEdgeFunction).mockImplementation((functionName: string) => {
      if (functionName === 'analyze_garment') {
        return Promise.resolve({ data: { enrichment: { refined_title: 'Test garment' } }, error: null });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-enhance',
      storagePath: 'user-1/photo-enhance.jpg',
      source: 'manual_enhance',
      imageProcessing: { mode: 'skip' },
    });

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('analyze_garment', {
        body: { storagePath: 'user-1/photo-enhance.jpg', mode: 'enrich' },
      });
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'garment-enhance', source: 'manual_enhance', clientNonce: expect.any(String) }),
      }));
    });

    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalledWith('process_garment_image', expect.anything());
  });

  it('bounds render kickoff concurrency and deduplicates repeated garment requests', async () => {
    let resolveFirstRender: (() => void) | null = null;
    let resolveSecondRender: (() => void) | null = null;
    let resolveThirdRender: (() => void) | null = null;

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

          if (!resolveThirdRender) {
            resolveThirdRender = () => resolve({ data: {}, error: null });
            return;
          }

          resolve({ data: {}, error: null });
        });
      }

      if (functionName === 'analyze_garment') {
        return Promise.resolve({ data: { enrichment: { refined_title: 'Test' } }, error: null });
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
      ['render_garment_image', expect.objectContaining({ body: expect.objectContaining({ garmentId: 'garment-a', source: 'batch_add', clientNonce: expect.any(String) }) })],
      ['render_garment_image', expect.objectContaining({ body: expect.objectContaining({ garmentId: 'garment-b', source: 'batch_add', clientNonce: expect.any(String) }) })],
      ['render_garment_image', expect.objectContaining({ body: expect.objectContaining({ garmentId: 'garment-c', source: 'batch_add', clientNonce: expect.any(String) }) })],
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
      expect.objectContaining({ body: expect.objectContaining({ garmentId: 'garment-d', source: 'batch_add', clientNonce: expect.any(String) }) }),
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
        body: expect.objectContaining({ garmentId: 'pending-batch', source: 'batch_add', clientNonce: expect.any(String) }),
      }));
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'pending-add-photo', source: 'add_photo', clientNonce: expect.any(String) }),
      }));
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('render_garment_image', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'pending-live-scan', source: 'live_scan', clientNonce: expect.any(String) }),
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
