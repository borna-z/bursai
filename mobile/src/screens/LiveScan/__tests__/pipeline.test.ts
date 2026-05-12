import { resizeForGarment, uploadManipulatedImage, deleteUpload } from '../../../lib/imageUpload';
import { callEdgeFunction } from '../../../lib/edgeFunctionClient';
import { persistGarmentWithOfflineFallback, OfflineQueuedError } from '../../../lib/garmentSave';
import { LiveScanEvents } from '../events';
import { ingestScan } from '../pipeline';

jest.mock('../../../lib/imageUpload', () => ({
  resizeForGarment: jest.fn(),
  uploadManipulatedImage: jest.fn(),
  deleteUpload: jest.fn().mockResolvedValue(undefined),
  GARMENT_IMAGE_MIME: 'image/webp',
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

const mockedResize = resizeForGarment as jest.MockedFunction<typeof resizeForGarment>;
const mockedUpload = uploadManipulatedImage as jest.MockedFunction<typeof uploadManipulatedImage>;
const mockedCall = callEdgeFunction as jest.MockedFunction<typeof callEdgeFunction>;
const mockedPersist = persistGarmentWithOfflineFallback as jest.MockedFunction<typeof persistGarmentWithOfflineFallback>;
const mockedDelete = deleteUpload as jest.MockedFunction<typeof deleteUpload>;

describe('ingestScan', () => {
  beforeEach(() => jest.clearAllMocks());

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
