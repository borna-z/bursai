import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  triggerIntelligenceMock,
  trackEventMock,
  invokeEdgeFunctionMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  triggerIntelligenceMock: vi.fn(),
  trackEventMock: vi.fn(),
  invokeEdgeFunctionMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/lib/garmentIntelligence', async () => {
  const actual = await vi.importActual<typeof import('@/lib/garmentIntelligence')>(
    '@/lib/garmentIntelligence',
  );
  return {
    ...actual,
    triggerGarmentPostSaveIntelligence: triggerIntelligenceMock,
  };
});

vi.mock('@/lib/analytics', () => ({
  trackEvent: trackEventMock,
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn() },
}));

import { runPostSaveHooks } from '@/lib/postSaveHooks';
import type { GarmentIntakeCandidate } from '@/lib/reviewCandidate';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';

function makeCandidate(
  analysisOverrides: Partial<GarmentAnalysis> = {},
  candidateOverrides: Partial<GarmentIntakeCandidate> = {},
): GarmentIntakeCandidate {
  return {
    blob: new Blob(['']),
    analysis: {
      title: 'Blue Shirt',
      category: 'top',
      subcategory: 'shirt',
      color_primary: 'blue',
      confidence: 0.92,
      ai_provider: 'burs_ai',
      ai_raw: { source: 'test' },
      ...analysisOverrides,
    } as GarmentAnalysis,
    userId: 'user-1',
    source: 'add_photo',
    confidence: 0.92,
    ...candidateOverrides,
  };
}

describe('runPostSaveHooks', () => {
  beforeEach(() => {
    triggerIntelligenceMock.mockReset();
    trackEventMock.mockReset();
    invokeEdgeFunctionMock.mockReset().mockResolvedValue({ data: null, error: null });
    loggerErrorMock.mockReset();
  });

  it('triggers post-save intelligence with skipRender=false when studio quality is enabled', () => {
    runPostSaveHooks('garment-1', 'user-1/garment-1.jpg', makeCandidate());

    expect(triggerIntelligenceMock).toHaveBeenCalledWith({
      garmentId: 'garment-1',
      storagePath: 'user-1/garment-1.jpg',
      source: 'add_photo',
      imageProcessing: { mode: 'skip' },
      skipRender: false,
    });
  });

  it('triggers post-save intelligence with skipRender=true when studio quality is disabled', () => {
    runPostSaveHooks(
      'garment-2',
      'user-1/garment-2.jpg',
      makeCandidate({}, { enableStudioQuality: false }),
    );
    expect(triggerIntelligenceMock).toHaveBeenCalledWith(
      expect.objectContaining({ skipRender: true }),
    );
  });

  it('emits garment_added with needs_review reflecting the review decision', () => {
    runPostSaveHooks(
      'garment-3',
      'user-1/garment-3.jpg',
      makeCandidate({ confidence: 0.2 }, { confidence: 0.2 }),
    );

    const addedCall = trackEventMock.mock.calls.find((c) => c[0] === 'garment_added');
    expect(addedCall).toBeDefined();
    expect(addedCall![1]).toMatchObject({
      source: 'add_photo',
      confidence: 0.2,
      needs_review: true,
    });
  });

  it('emits garment_added with needs_review=false for high-confidence single garments', () => {
    runPostSaveHooks('garment-4', 'user-1/garment-4.jpg', makeCandidate());
    const addedCall = trackEventMock.mock.calls.find((c) => c[0] === 'garment_added');
    expect(addedCall![1]).toMatchObject({ needs_review: false });
  });

  it('emits garment_intake with auto_saved and category context', () => {
    runPostSaveHooks('garment-5', 'user-1/garment-5.jpg', makeCandidate());
    const intakeCall = trackEventMock.mock.calls.find((c) => c[0] === 'garment_intake');
    expect(intakeCall).toBeDefined();
    expect(intakeCall![1]).toMatchObject({
      source: 'add_photo',
      confidence: 0.92,
      category: 'top',
      subcategory: 'shirt',
      needs_review: false,
      auto_saved: true,
      studio_quality: true,
    });
  });

  it('kicks off a duplicate-detection edge function call', async () => {
    runPostSaveHooks('garment-6', 'user-1/garment-6.jpg', makeCandidate());
    await Promise.resolve();

    expect(invokeEdgeFunctionMock).toHaveBeenCalledWith(
      'detect_duplicate_garment',
      expect.objectContaining({
        body: expect.objectContaining({
          image_path: 'user-1/garment-6.jpg',
          category: 'top',
          color_primary: 'blue',
          title: 'Blue Shirt',
          exclude_garment_id: 'garment-6',
        }),
      }),
    );
  });

  it('does not throw when duplicate detection rejects (non-blocking)', async () => {
    invokeEdgeFunctionMock.mockRejectedValue(new Error('edge offline'));
    expect(() => runPostSaveHooks('garment-7', 'user-1/garment-7.jpg', makeCandidate()))
      .not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});
