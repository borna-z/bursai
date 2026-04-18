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

// Default mock: analyze_garment returns enrichment payload; enqueue_render_job
// returns a successful render_jobs row shape; anything else returns the
// previous empty-success shape.
vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: vi.fn().mockImplementation((functionName: string) => {
    if (functionName === 'analyze_garment') {
      return Promise.resolve({ data: { enrichment: { refined_title: 'Test garment' } }, error: null });
    }
    if (functionName === 'enqueue_render_job') {
      return Promise.resolve({
        data: { jobId: 'mock-job-id', status: 'pending', source: 'monthly', replay: false },
        error: null,
      });
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
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('enqueue_render_job', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'garment-1', source: 'add_photo', clientNonce: expect.any(String) }),
      }));
    });

    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalledWith('process_garment_image', expect.anything());
  });

  it('allows batch add to skip image processing and still trigger render', async () => {
    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-batch',
      storagePath: 'user-1/photo-batch.jpg',
      source: 'batch_add',
      imageProcessing: { mode: 'skip' },
    });

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('enqueue_render_job', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'garment-batch', source: 'batch_add', clientNonce: expect.any(String) }),
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
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('enqueue_render_job', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'garment-live', source: 'live_scan', clientNonce: expect.any(String) }),
      }));
    });
  });

  it('triggers render only after enrichment resolves, not in parallel', async () => {
    let resolveEnrichment: ((value: { data: { enrichment: Record<string, unknown> }; error: null }) => void) | null = null;

    vi.mocked(invokeEdgeFunction).mockImplementation((functionName: string) => {
      if (functionName === 'analyze_garment') {
        return new Promise((resolve) => {
          resolveEnrichment = resolve;
        });
      }
      if (functionName === 'enqueue_render_job') {
        return Promise.resolve({
          data: { jobId: 'mock-job-id', status: 'pending', source: 'monthly', replay: false },
          error: null,
        });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-order',
      storagePath: 'user-1/photo-order.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    });

    // Render must NOT be called before enrichment resolves.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalledWith('enqueue_render_job', expect.anything());

    resolveEnrichment?.({ data: { enrichment: { refined_title: 'Ordered' } }, error: null });

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('enqueue_render_job', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'garment-order', source: 'add_photo', clientNonce: expect.any(String) }),
      }));
    });
  });

  it('still triggers render when enrichment fails (fallback path)', async () => {
    vi.mocked(invokeEdgeFunction).mockImplementation((functionName: string) => {
      if (functionName === 'analyze_garment') {
        return Promise.reject(new Error('enrichment failed'));
      }
      if (functionName === 'enqueue_render_job') {
        return Promise.resolve({
          data: { jobId: 'mock-job-id', status: 'pending', source: 'monthly', replay: false },
          error: null,
        });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    triggerGarmentPostSaveIntelligence({
      garmentId: 'garment-fallback',
      storagePath: 'user-1/photo-fallback.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
    });

    await vi.waitFor(() => {
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('enqueue_render_job', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'garment-fallback', source: 'add_photo', clientNonce: expect.any(String) }),
      }));
    });
  });

  it('triggers render for manual_enhance when skipRender is not set', async () => {
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
      expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledWith('enqueue_render_job', expect.objectContaining({
        body: expect.objectContaining({ garmentId: 'garment-enhance', source: 'manual_enhance', clientNonce: expect.any(String) }),
      }));
    });

    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalledWith('process_garment_image', expect.anything());
  });

  // Priority 5 note: the pre-P5 "bounds render kickoff concurrency and
  // deduplicates repeated garment requests" test was removed. Concurrency
  // and deduplication are now enforced server-side:
  //   * enqueue_render_job's UNIQUE constraint on render_jobs.reserve_key
  //     dedupes retries of the same clientNonce
  //   * process_render_jobs + claim_render_job's SELECT FOR UPDATE
  //     SKIP LOCKED bounds worker concurrency to JOB_CONCURRENCY=2
  // The preview-branch verification in this PR covers that behavior at
  // the SQL level.
});

describe('resumePendingGarmentRenders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingGarmentRows = [];
  });

  // Priority 5: resumePendingGarmentRenders is now a no-op. Re-execution
  // of pending renders happens server-side via pg_cron + process_render_jobs.
  // Kept as an exported function only so useGarments.ts doesn't need a
  // synchronized change. Tests verify no side-effects.
  it('does not invoke any edge function (no-op under P5)', async () => {
    pendingGarmentRows = [
      { id: 'pending-1', ai_raw: { system_signals: { source: 'batch_add' } } },
      { id: 'pending-2', ai_raw: { system_signals: { source: 'add_photo' } } },
    ];

    await resumePendingGarmentRenders('user-1');

    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalled();
  });

  it('accepts empty userId without throwing', async () => {
    await expect(resumePendingGarmentRenders('')).resolves.toBeUndefined();
    expect(vi.mocked(invokeEdgeFunction)).not.toHaveBeenCalled();
  });
});
