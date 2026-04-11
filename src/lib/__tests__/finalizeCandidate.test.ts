import { describe, it, expect, vi, beforeEach } from 'vitest';

const { uploadMock, insertMock, runPostSaveHooksMock, loggerErrorMock, trackEventMock } =
  vi.hoisted(() => ({
    uploadMock: vi.fn(),
    insertMock: vi.fn(),
    runPostSaveHooksMock: vi.fn(),
    loggerErrorMock: vi.fn(),
    trackEventMock: vi.fn(),
  }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({ upload: uploadMock })),
    },
    from: vi.fn(() => ({ insert: insertMock })),
  },
}));

vi.mock('@/lib/postSaveHooks', () => ({
  runPostSaveHooks: runPostSaveHooksMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: trackEventMock,
}));

import { finalizeCandidate, type GarmentIntakeCandidate } from '@/lib/finalizeCandidate';
import type { GarmentAnalysis } from '@/hooks/useAnalyzeGarment';

function makeCandidate(overrides: Partial<GarmentIntakeCandidate> = {}): GarmentIntakeCandidate {
  return {
    blob: new Blob(['image-bytes'], { type: 'image/jpeg' }),
    analysis: {
      title: 'Blue Shirt',
      category: 'top',
      subcategory: 'shirt',
      color_primary: 'blue',
      season_tags: ['spring'],
      formality: 3,
      confidence: 0.9,
      ai_provider: 'burs_ai',
      ai_raw: { source: 'test' },
    } as GarmentAnalysis,
    userId: 'user-9',
    source: 'add_photo',
    ...overrides,
  };
}

describe('finalizeCandidate', () => {
  beforeEach(() => {
    uploadMock.mockReset().mockResolvedValue({ error: null });
    insertMock.mockReset().mockResolvedValue({ error: null });
    runPostSaveHooksMock.mockReset();
    loggerErrorMock.mockReset();
    trackEventMock.mockReset();
  });

  it('uploads the blob, inserts the row, and fires post-save hooks on success', async () => {
    const candidate = makeCandidate();
    const result = await finalizeCandidate(candidate);

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [path, blob, options] = uploadMock.mock.calls[0];
    expect(path).toMatch(/^user-9\//);
    expect(blob).toBe(candidate.blob);
    expect(options).toMatchObject({ contentType: 'image/jpeg', upsert: false });

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(runPostSaveHooksMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      garmentId: expect.any(String),
      storagePath: expect.stringMatching(/^user-9\//),
    });
  });

  it('reuses the existing storage path and skips the upload', async () => {
    const candidate = makeCandidate({
      existingStoragePath: 'user-9/existing-id/original.webp',
      existingGarmentId: 'existing-id',
    });
    const result = await finalizeCandidate(candidate);

    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      garmentId: 'existing-id',
      storagePath: 'user-9/existing-id/original.webp',
    });
    expect(runPostSaveHooksMock).toHaveBeenCalledWith(
      'existing-id',
      'user-9/existing-id/original.webp',
      candidate,
    );
  });

  it('returns null and tracks failure when the upload errors', async () => {
    uploadMock.mockResolvedValue({ error: new Error('storage down') });
    const result = await finalizeCandidate(makeCandidate());

    expect(result).toBeNull();
    expect(insertMock).not.toHaveBeenCalled();
    expect(runPostSaveHooksMock).not.toHaveBeenCalled();
    expect(trackEventMock).toHaveBeenCalledWith(
      'garment_intake_failed',
      expect.objectContaining({ source: 'add_photo', stage: 'upload' }),
    );
  });

  it('returns null and tracks failure when the insert errors', async () => {
    insertMock.mockResolvedValue({ error: new Error('constraint violation') });
    const result = await finalizeCandidate(makeCandidate());

    expect(result).toBeNull();
    expect(runPostSaveHooksMock).not.toHaveBeenCalled();
    expect(trackEventMock).toHaveBeenCalledWith(
      'garment_intake_failed',
      expect.objectContaining({ source: 'add_photo', stage: 'insert' }),
    );
  });

  it('uploads png content type when the blob is image/png', async () => {
    const candidate = makeCandidate({
      blob: new Blob(['png-bytes'], { type: 'image/png' }),
    });
    await finalizeCandidate(candidate);

    const [, , options] = uploadMock.mock.calls[0];
    expect(options).toMatchObject({ contentType: 'image/png' });
  });

  it('swallows unexpected throws and returns null', async () => {
    insertMock.mockImplementation(() => {
      throw new Error('boom');
    });
    const result = await finalizeCandidate(makeCandidate());
    expect(result).toBeNull();
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});
