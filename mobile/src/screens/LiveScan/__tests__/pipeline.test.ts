import { resizeForGarment, uploadGarmentVariant, deleteUpload } from '../../../lib/imageUpload';
import { callEdgeFunction } from '../../../lib/edgeFunctionClient';
import { persistGarmentWithOfflineFallback, OfflineQueuedError } from '../../../lib/garmentSave';
import { removeBackground } from '../../../lib/backgroundRemoval';
import { LiveScanEvents, type AnalyzedScan } from '../events';
import {
  analyzeFromCapture,
  persistAnalyzedScan,
  discardAnalyzedScan,
} from '../pipeline';

jest.mock('../../../lib/imageUpload', () => ({
  resizeForGarment: jest.fn(),
  uploadGarmentVariant: jest.fn(),
  deleteUpload: jest.fn().mockResolvedValue(undefined),
  GARMENT_IMAGE_MIME: 'image/webp',
}));
// Wave R-B — on-device segmentation. Default mock returns 'unavailable' so
// every existing test sees the same single-upload (raw only) path as before
// R-B. Tests that specifically exercise the masked branch override per-case.
jest.mock('../../../lib/backgroundRemoval', () => ({
  removeBackground: jest.fn(),
  prepare: jest.fn().mockResolvedValue(undefined),
  MASK_CONFIDENCE_THRESHOLD: 0.5,
  MASK_SAVE_TIMEOUT_MS: 800,
}));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { WEBP: 'webp', JPEG: 'jpeg', PNG: 'png' },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'garment-uuid-fixed',
}));
jest.mock('../../../lib/edgeFunctionClient', () => ({
  callEdgeFunction: jest.fn(),
  EdgeFunctionHttpError: class MockEdgeFunctionHttpError extends Error {
    fn: string; status: number; bodyText: string;
    constructor(fn: string, status: number, bodyText: string) {
      super(`${fn} ${status}`);
      this.fn = fn; this.status = status; this.bodyText = bodyText;
    }
  },
  EdgeFunctionRateLimitError: class MockEdgeFunctionRateLimitError extends Error {
    fn: string; retryAfter: number;
    constructor(fn: string, retryAfter: number) {
      super(fn);
      this.fn = fn; this.retryAfter = retryAfter;
    }
  },
  EdgeFunctionSubscriptionLockedError: class MockEdgeFunctionSubscriptionLockedError extends Error {
    fn: string;
    constructor(fn: string) {
      super(fn);
      this.fn = fn;
    }
  },
}));
jest.mock('../../../lib/garmentSave', () => ({
  persistGarmentWithOfflineFallback: jest.fn(),
  OfflineQueuedError: class extends Error {},
}));
jest.mock('../../../lib/i18n', () => ({
  getLocale: () => 'en',
}));

const mockedResize = resizeForGarment as jest.MockedFunction<typeof resizeForGarment>;
const mockedUpload = uploadGarmentVariant as jest.MockedFunction<typeof uploadGarmentVariant>;
const mockedCall = callEdgeFunction as jest.MockedFunction<typeof callEdgeFunction>;
const mockedPersist = persistGarmentWithOfflineFallback as jest.MockedFunction<typeof persistGarmentWithOfflineFallback>;
const mockedDelete = deleteUpload as jest.MockedFunction<typeof deleteUpload>;
const mockedMask = removeBackground as jest.MockedFunction<typeof removeBackground>;

/**
 * Test helper — runs the two-phase pipeline as a single call by chaining
 * analyzeFromCapture → persistAnalyzedScan. Mirrors the legacy `ingestScan`
 * one-shot behavior so the existing test cases stay readable.
 */
async function runFullPipeline(
  uri: string,
  sessionId: string,
  userId: string,
  events: LiveScanEvents,
  invalidate: () => void,
  enableStudioQuality = true,
): Promise<AnalyzedScan | null> {
  let analyzed: AnalyzedScan | null = null;
  const off = events.on('analyzed', (p) => {
    analyzed = p;
  });
  try {
    await analyzeFromCapture(uri, sessionId as never, userId, events);
  } finally {
    off();
  }
  if (analyzed) {
    await persistAnalyzedScan(analyzed, enableStudioQuality, events, invalidate);
  }
  return analyzed;
}

describe('LiveScan pipeline — two-phase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default R-B masking: 'unavailable' — keeps tests focused on the
    // single-upload (raw only) path. Masked-branch tests override.
    mockedMask.mockResolvedValue({
      uri: 'file://resized.webp',
      status: 'unavailable',
      confidence: 0,
      durationMs: 0,
    });
  });

  it('emits stage transitions through compress → upload → analyze → analyzed', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/g/raw.webp' });
    mockedCall.mockResolvedValue({ title: 'Shirt', category: 'top', confidence: 0.9 } as any);

    const events = new LiveScanEvents();
    const seen: string[] = [];
    events.on('stage', (p) => seen.push(`stage:${p.stage}`));
    events.on('analyzed', (p) => seen.push(`analyzed:${p.garmentId}`));

    await analyzeFromCapture('file://photo.jpg', 'session-1' as never, 'user-1', events);

    expect(seen).toEqual([
      'stage:compress',
      'stage:upload',
      'stage:analyze',
      'analyzed:garment-uuid-fixed',
    ]);
    // Pipeline does NOT auto-persist — that's the screen's job after the
    // user picks Save Original / Save Studio on the review card.
    expect(mockedPersist).not.toHaveBeenCalled();
  });

  it('analyzed payload carries raw path, masked path, mask_status, and analysis', async () => {
    const ImageManipulator = require('expo-image-manipulator');
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload
      .mockResolvedValueOnce({ storagePath: 'u/g/raw.webp' })
      .mockResolvedValueOnce({ storagePath: 'u/g/masked.webp' });
    mockedMask.mockResolvedValue({
      uri: 'file://native-masked.png',
      status: 'masked',
      confidence: 0.78,
      durationMs: 120,
    });
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://transcoded.webp',
      width: 1024,
      height: 768,
    });
    mockedCall.mockResolvedValue({ title: 'Shirt', category: 'top', confidence: 0.9 } as any);

    const events = new LiveScanEvents();
    let payload: AnalyzedScan | null = null;
    events.on('analyzed', (p) => { payload = p; });

    await analyzeFromCapture('file://photo.jpg', 'session-payload' as never, 'user-1', events);

    expect(payload).not.toBeNull();
    expect(payload!).toMatchObject({
      sessionId: 'session-payload',
      garmentId: 'garment-uuid-fixed',
      userId: 'user-1',
      photoUri: 'file://photo.jpg',
      rawStoragePath: 'u/g/raw.webp',
      maskedStoragePath: 'u/g/masked.webp',
      maskStatus: 'masked',
    });
    expect(payload!.analysis.title).toBe('Shirt');
  });

  it('happy path — analyze + persist with enableStudioQuality=true emits saved + invalidate', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/g/raw.webp' });
    mockedCall.mockResolvedValue({ title: 'Shirt', category: 'top', confidence: 0.9 } as any);
    mockedPersist.mockResolvedValue({ id: 'garment-123' } as any);

    const events = new LiveScanEvents();
    let savedId = '';
    events.on('saved', (p) => { savedId = p.garmentId; });
    const invalidate = jest.fn();

    await runFullPipeline('file://photo.jpg', 'session-happy', 'user-1', events, invalidate, true);

    expect(savedId).toBe('garment-123');
    expect(mockedPersist).toHaveBeenCalledWith(
      expect.objectContaining({ enableStudioQuality: true, source: 'live_scan' }),
    );
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('persistAnalyzedScan with enableStudioQuality=false saves Original (no studio render queued)', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/g/raw.webp' });
    mockedCall.mockResolvedValue({ title: 'Shirt', category: 'top', confidence: 0.9 } as any);
    mockedPersist.mockResolvedValue({ id: 'garment-orig' } as any);

    const events = new LiveScanEvents();
    const invalidate = jest.fn();

    await runFullPipeline('file://photo.jpg', 'session-orig', 'user-1', events, invalidate, false);

    expect(mockedPersist).toHaveBeenCalledWith(
      expect.objectContaining({ enableStudioQuality: false }),
    );
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('emits queued on OfflineQueuedError and calls invalidate', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/g/raw.webp' });
    mockedCall.mockResolvedValue({ title: 'Shirt' } as any);
    mockedPersist.mockRejectedValue(new OfflineQueuedError());

    const events = new LiveScanEvents();
    let queued = false;
    events.on('queued', () => { queued = true; });
    const invalidate = jest.fn();

    await runFullPipeline('file://photo.jpg', 'session-2', 'user-1', events, invalidate);

    expect(queued).toBe(true);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('emits failed with classified error on analyze 429', async () => {
    const { EdgeFunctionRateLimitError } = require('../../../lib/edgeFunctionClient');
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/g/raw.webp' });
    mockedCall.mockRejectedValue(new EdgeFunctionRateLimitError('analyze_garment', 30));

    const events = new LiveScanEvents();
    let failedClass = '';
    events.on('failed', (p) => { failedClass = p.errorClass; });
    const invalidate = jest.fn();

    await runFullPipeline('file://photo.jpg', 'session-3', 'user-1', events, invalidate);

    expect(failedClass).toBe('analyze_rate_limit');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('emits failed on compress failure (resizeForGarment throws)', async () => {
    mockedResize.mockRejectedValue(new Error('resize boom'));
    const events = new LiveScanEvents();
    let failedClass = '';
    events.on('failed', (p) => { failedClass = p.errorClass; });
    const invalidate = jest.fn();

    await runFullPipeline('file://photo.jpg', 'session-4', 'user-1', events, invalidate);

    expect(failedClass).toBe('compress_failed');
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedCall).not.toHaveBeenCalled();
    expect(mockedDelete).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('emits upload_failed when uploadGarmentVariant throws (not compress_failed)', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockRejectedValue(new Error('network error'));

    const events = new LiveScanEvents();
    let failedClass = '';
    events.on('failed', (p) => { failedClass = p.errorClass; });
    const invalidate = jest.fn();

    await runFullPipeline('file://photo.jpg', 'session-8', 'user-1', events, invalidate);

    expect(failedClass).toBe('upload_failed');
    expect(mockedCall).not.toHaveBeenCalled();
    expect(mockedDelete).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('cleans up orphaned upload when analyze fails', async () => {
    const { EdgeFunctionRateLimitError } = require('../../../lib/edgeFunctionClient');
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/orphan.webp' });
    mockedCall.mockRejectedValue(new EdgeFunctionRateLimitError('analyze_garment', 30));

    const events = new LiveScanEvents();
    const invalidate = jest.fn();
    await runFullPipeline('file://photo.jpg', 'session-5', 'user-1', events, invalidate);

    expect(mockedDelete).toHaveBeenCalledTimes(1);
    expect(mockedDelete).toHaveBeenCalledWith('u/orphan.webp');
  });

  it('cleans up orphaned upload when persist fails (non-offline)', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/orphan2.webp' });
    mockedCall.mockResolvedValue({ title: 'Shirt' } as any);
    mockedPersist.mockRejectedValue(new Error('persist boom'));

    const events = new LiveScanEvents();
    const invalidate = jest.fn();
    await runFullPipeline('file://photo.jpg', 'session-6', 'user-1', events, invalidate);

    expect(mockedDelete).toHaveBeenCalledWith('u/orphan2.webp');
  });

  it('does NOT delete upload on OfflineQueuedError (replay reuses path)', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/queued.webp' });
    mockedCall.mockResolvedValue({ title: 'Shirt' } as any);
    mockedPersist.mockRejectedValue(new OfflineQueuedError());

    const events = new LiveScanEvents();
    const invalidate = jest.fn();
    await runFullPipeline('file://photo.jpg', 'session-7', 'user-1', events, invalidate);

    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('uploads both raw + masked variants and persists with mask_status=masked', async () => {
    const ImageManipulator = require('expo-image-manipulator');
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload
      .mockResolvedValueOnce({ storagePath: 'u/g/raw.webp' })
      .mockResolvedValueOnce({ storagePath: 'u/g/masked.webp' });
    mockedMask.mockResolvedValue({
      uri: 'file://native-masked.png',
      status: 'masked',
      confidence: 0.78,
      durationMs: 120,
    });
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://transcoded.webp',
      width: 1024,
      height: 768,
    });
    mockedCall.mockResolvedValue({ title: 'Shirt', category: 'top', confidence: 0.9 } as any);
    mockedPersist.mockResolvedValue({ id: 'garment-masked' } as any);

    const events = new LiveScanEvents();
    const invalidate = jest.fn();
    await runFullPipeline('file://photo.jpg', 'session-masked', 'user-1', events, invalidate);

    expect(mockedUpload).toHaveBeenCalledTimes(2);
    expect(mockedUpload).toHaveBeenNthCalledWith(
      1,
      { uri: 'file://resized.webp', width: 1024, height: 768 },
      'user-1',
      'garment-uuid-fixed',
      'raw',
    );
    expect(mockedUpload).toHaveBeenNthCalledWith(
      2,
      { uri: 'file://transcoded.webp', width: 1024, height: 768 },
      'user-1',
      'garment-uuid-fixed',
      'masked',
    );
    expect(mockedPersist).toHaveBeenCalledWith(expect.objectContaining({
      garmentId: 'garment-uuid-fixed',
      storagePath: 'u/g/raw.webp',
      maskedStoragePath: 'u/g/masked.webp',
      maskStatus: 'masked',
    }));
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('falls back to raw when masked transcode fails (mask_status=failed)', async () => {
    const ImageManipulator = require('expo-image-manipulator');
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValueOnce({ storagePath: 'u/g/raw.webp' });
    mockedMask.mockResolvedValue({
      uri: 'file://native-masked.png',
      status: 'masked',
      confidence: 0.78,
      durationMs: 120,
    });
    (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(new Error('transcode boom'));
    mockedCall.mockResolvedValue({ title: 'Shirt', category: 'top', confidence: 0.9 } as any);
    mockedPersist.mockResolvedValue({ id: 'garment-masked' } as any);

    const events = new LiveScanEvents();
    const invalidate = jest.fn();
    await runFullPipeline('file://photo.jpg', 'session-transcode-fail', 'user-1', events, invalidate);

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    expect(mockedPersist).toHaveBeenCalledWith(expect.objectContaining({
      storagePath: 'u/g/raw.webp',
      maskedStoragePath: undefined,
      maskStatus: 'failed',
    }));
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('cleans up BOTH raw + masked orphans on later-stage failure', async () => {
    const ImageManipulator = require('expo-image-manipulator');
    const { EdgeFunctionRateLimitError } = require('../../../lib/edgeFunctionClient');
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload
      .mockResolvedValueOnce({ storagePath: 'u/g/raw.webp' })
      .mockResolvedValueOnce({ storagePath: 'u/g/masked.webp' });
    mockedMask.mockResolvedValue({
      uri: 'file://native-masked.png',
      status: 'masked',
      confidence: 0.78,
      durationMs: 120,
    });
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://transcoded.webp',
    });
    mockedCall.mockRejectedValue(new EdgeFunctionRateLimitError('analyze_garment', 30));

    const events = new LiveScanEvents();
    const invalidate = jest.fn();
    await runFullPipeline('file://photo.jpg', 'session-cleanup', 'user-1', events, invalidate);

    expect(mockedDelete).toHaveBeenCalledTimes(2);
    expect(mockedDelete).toHaveBeenCalledWith('u/g/raw.webp');
    expect(mockedDelete).toHaveBeenCalledWith('u/g/masked.webp');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('does NOT block save when segmenter is slower than MASK_SAVE_TIMEOUT_MS', async () => {
    jest.useFakeTimers();
    try {
      mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
      mockedUpload.mockResolvedValueOnce({ storagePath: 'u/g/raw.webp' });
      mockedMask.mockReturnValue(new Promise(() => {}) as any);
      mockedCall.mockResolvedValue({ title: 'Shirt', category: 'top', confidence: 0.9 } as any);
      mockedPersist.mockResolvedValue({ id: 'garment-slow-mask' } as any);

      const events = new LiveScanEvents();
      const invalidate = jest.fn();
      const scan = runFullPipeline('file://photo.jpg', 'session-slow-mask', 'user-1', events, invalidate);
      await jest.advanceTimersByTimeAsync(900);
      await scan;

      expect(mockedUpload).toHaveBeenCalledTimes(1);
      expect(mockedPersist).toHaveBeenCalledWith(expect.objectContaining({
        storagePath: 'u/g/raw.webp',
        maskedStoragePath: undefined,
        maskStatus: 'unavailable',
      }));
      expect(invalidate).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('emits multi_garment failed when analyze flags multiple garments — no review card surfaced', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/1.webp' });
    mockedCall.mockResolvedValue({
      title: 'Multiple',
      image_contains_multiple_garments: true,
    } as any);

    const events = new LiveScanEvents();
    let failedClass = '';
    let analyzed = false;
    events.on('failed', (p) => { failedClass = p.errorClass; });
    events.on('analyzed', () => { analyzed = true; });
    const invalidate = jest.fn();

    await analyzeFromCapture('file://photo.jpg', 'session-mg' as never, 'user-1', events);

    expect(failedClass).toBe('multi_garment');
    // Multi-garment must NOT emit 'analyzed' — the screen would otherwise
    // surface a review card for a photo we already decided not to save.
    expect(analyzed).toBe(false);
    expect(mockedPersist).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(mockedDelete).toHaveBeenCalledTimes(1);
    expect(mockedDelete).toHaveBeenCalledWith('u/1.webp');
  });

  it('discardAnalyzedScan deletes raw + masked and emits discard', async () => {
    const events = new LiveScanEvents();
    let discardedSession = '';
    events.on('discard', (p) => { discardedSession = p.sessionId; });

    await discardAnalyzedScan(
      {
        sessionId: 'session-skip' as never,
        garmentId: 'garment-uuid-fixed',
        userId: 'user-1',
        photoUri: 'file://photo.jpg',
        rawStoragePath: 'u/g/raw.webp',
        maskedStoragePath: 'u/g/masked.webp',
        maskStatus: 'masked',
        analysis: { title: 'Shirt', category: 'top', confidence: 0.9 } as any,
      },
      events,
    );

    expect(discardedSession).toBe('session-skip');
    // Both raw + masked sidecars deleted; orphan-free.
    expect(mockedDelete).toHaveBeenCalledWith('u/g/raw.webp');
    expect(mockedDelete).toHaveBeenCalledWith('u/g/masked.webp');
  });

  it('discardAnalyzedScan handles maskedStoragePath=null (segmentation unavailable)', async () => {
    const events = new LiveScanEvents();
    await discardAnalyzedScan(
      {
        sessionId: 'session-skip-no-mask' as never,
        garmentId: 'garment-uuid-fixed',
        userId: 'user-1',
        photoUri: 'file://photo.jpg',
        rawStoragePath: 'u/g/raw.webp',
        maskedStoragePath: null,
        maskStatus: 'unavailable',
        analysis: { title: 'Shirt', category: 'top', confidence: 0.9 } as any,
      },
      events,
    );

    // Only the raw upload is deleted — masked sidecar never existed.
    expect(mockedDelete).toHaveBeenCalledTimes(1);
    expect(mockedDelete).toHaveBeenCalledWith('u/g/raw.webp');
  });
});
