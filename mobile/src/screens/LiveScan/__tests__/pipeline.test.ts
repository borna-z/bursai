import { resizeForGarment, uploadGarmentVariant, deleteUpload } from '../../../lib/imageUpload';
import { callEdgeFunction } from '../../../lib/edgeFunctionClient';
import { persistGarmentWithOfflineFallback, OfflineQueuedError } from '../../../lib/garmentSave';
import { removeBackground } from '../../../lib/backgroundRemoval';
import { LiveScanEvents } from '../events';
import { ingestScan } from '../pipeline';

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

describe('ingestScan', () => {
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

  it('emits saved on happy path and calls invalidate', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/1.webp' });
    mockedCall.mockResolvedValue({ title: 'Shirt', category: 'top', confidence: 0.9 } as any);
    mockedPersist.mockResolvedValue({ id: 'garment-123' } as any);

    const events = new LiveScanEvents();
    const seen: string[] = [];
    events.on('stage', (p) => seen.push(`stage:${p.stage}`));
    events.on('saved', (p) => seen.push(`saved:${p.garmentId}`));

    const invalidate = jest.fn();
    await ingestScan('file://photo.jpg', 'session-1', 'user-1', events, invalidate);

    expect(seen).toEqual([
      'stage:compress', 'stage:upload', 'stage:analyze', 'stage:persist', 'saved:garment-123',
    ]);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('emits queued on OfflineQueuedError and calls invalidate', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/1.webp' });
    mockedCall.mockResolvedValue({ title: 'Shirt' } as any);
    mockedPersist.mockRejectedValue(new OfflineQueuedError());

    const events = new LiveScanEvents();
    let queued = false;
    events.on('queued', () => { queued = true; });

    const invalidate = jest.fn();
    await ingestScan('file://photo.jpg', 'session-2', 'user-1', events, invalidate);

    expect(queued).toBe(true);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('emits failed with classified error on analyze 429', async () => {
    const { EdgeFunctionRateLimitError } = require('../../../lib/edgeFunctionClient');
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/1.webp' });
    mockedCall.mockRejectedValue(new EdgeFunctionRateLimitError('analyze_garment', 30));

    const events = new LiveScanEvents();
    let failedClass = '';
    events.on('failed', (p) => { failedClass = p.errorClass; });

    const invalidate = jest.fn();
    await ingestScan('file://photo.jpg', 'session-3', 'user-1', events, invalidate);

    expect(failedClass).toBe('analyze_rate_limit');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('emits failed on compress failure (resizeForGarment throws)', async () => {
    mockedResize.mockRejectedValue(new Error('resize boom'));
    const events = new LiveScanEvents();
    let failedClass = '';
    events.on('failed', (p) => { failedClass = p.errorClass; });

    const invalidate = jest.fn();
    await ingestScan('file://photo.jpg', 'session-4', 'user-1', events, invalidate);

    // Stage was 'compress' when the failure happened (set BEFORE awaiting resizeForGarment).
    // Classification maps stage 'compress' → 'compress_failed'.
    expect(failedClass).toBe('compress_failed');
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedCall).not.toHaveBeenCalled();
    // Nothing was uploaded yet, so no cleanup call.
    expect(mockedDelete).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('emits upload_failed when uploadManipulatedImage throws (not compress_failed)', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockRejectedValue(new Error('network error'));

    const events = new LiveScanEvents();
    let failedClass = '';
    events.on('failed', (p) => { failedClass = p.errorClass; });

    const invalidate = jest.fn();
    await ingestScan('file://photo.jpg', 'session-8', 'user-1', events, invalidate);

    // Stage advanced to 'upload' before uploadManipulatedImage was awaited.
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
    await ingestScan('file://photo.jpg', 'session-5', 'user-1', events, invalidate);

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
    await ingestScan('file://photo.jpg', 'session-6', 'user-1', events, invalidate);

    expect(mockedDelete).toHaveBeenCalledWith('u/orphan2.webp');
  });

  it('does NOT delete upload on OfflineQueuedError (replay reuses path)', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/queued.webp' });
    mockedCall.mockResolvedValue({ title: 'Shirt' } as any);
    mockedPersist.mockRejectedValue(new OfflineQueuedError());

    const events = new LiveScanEvents();
    const invalidate = jest.fn();
    await ingestScan('file://photo.jpg', 'session-7', 'user-1', events, invalidate);

    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('uploads both raw + masked variants and persists with mask_status=masked', async () => {
    const ImageManipulator = require('expo-image-manipulator');
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    // Upload helper is called twice — once for raw, once for masked — both
    // resolve to distinct storage paths.
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
    await ingestScan('file://photo.jpg', 'session-masked', 'user-1', events, invalidate);

    // Two uploads — raw first, then masked.
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
    // Persist receives the full masked-path triple.
    expect(mockedPersist).toHaveBeenCalledWith(expect.objectContaining({
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
    await ingestScan('file://photo.jpg', 'session-transcode-fail', 'user-1', events, invalidate);

    // Only the raw upload runs; masked variant never uploads.
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
    await ingestScan('file://photo.jpg', 'session-cleanup', 'user-1', events, invalidate);

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
      // Mask never resolves — simulates a cold MLKit Play Services download.
      mockedMask.mockReturnValue(new Promise(() => {}) as any);
      mockedCall.mockResolvedValue({ title: 'Shirt', category: 'top', confidence: 0.9 } as any);
      mockedPersist.mockResolvedValue({ id: 'garment-slow-mask' } as any);

      const events = new LiveScanEvents();
      const invalidate = jest.fn();
      const scan = ingestScan('file://photo.jpg', 'session-slow-mask', 'user-1', events, invalidate);
      // Advance past the mask save timeout; the pipeline should proceed.
      await jest.advanceTimersByTimeAsync(900);
      await scan;

      // Only the raw upload runs — no masked variant lands.
      expect(mockedUpload).toHaveBeenCalledTimes(1);
      // Persist gets called with `mask_status='unavailable'` (the timeout
      // fallback shape) so the row doesn't claim a mask that never landed.
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

  it('emits multi_garment failed when analyze flags multiple garments', async () => {
    mockedResize.mockResolvedValue({ uri: 'file://resized.webp', width: 1024, height: 768 } as any);
    mockedUpload.mockResolvedValue({ storagePath: 'u/1.webp' });
    mockedCall.mockResolvedValue({
      title: 'Multiple',
      image_contains_multiple_garments: true,
    } as any);

    const events = new LiveScanEvents();
    let failedClass = '';
    events.on('failed', (p) => { failedClass = p.errorClass; });
    const invalidate = jest.fn();

    await ingestScan('file://photo.jpg', 'session-mg', 'user-1', events, invalidate);

    expect(failedClass).toBe('multi_garment');
    expect(mockedPersist).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(mockedDelete).toHaveBeenCalledTimes(1);
    expect(mockedDelete).toHaveBeenCalledWith('u/1.webp');
  });
});
