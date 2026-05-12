import { resizeAndUpload, deleteUpload } from '../../../lib/imageUpload';
import { callEdgeFunction } from '../../../lib/edgeFunctionClient';
import { persistGarmentWithOfflineFallback, OfflineQueuedError } from '../../../lib/garmentSave';
import { LiveScanEvents } from '../events';
import { ingestScan } from '../pipeline';

jest.mock('../../../lib/imageUpload', () => ({
  resizeAndUpload: jest.fn(),
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

const mockedResize = resizeAndUpload as jest.MockedFunction<typeof resizeAndUpload>;
const mockedCall = callEdgeFunction as jest.MockedFunction<typeof callEdgeFunction>;
const mockedPersist = persistGarmentWithOfflineFallback as jest.MockedFunction<typeof persistGarmentWithOfflineFallback>;
const mockedDelete = deleteUpload as jest.MockedFunction<typeof deleteUpload>;

describe('ingestScan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('emits saved on happy path', async () => {
    mockedResize.mockResolvedValue({ storagePath: 'u/1.webp', publicUrl: null } as any);
    mockedCall.mockResolvedValue({ title: 'Shirt', category: 'top', confidence: 0.9 } as any);
    mockedPersist.mockResolvedValue({ id: 'garment-123' } as any);

    const events = new LiveScanEvents();
    const seen: string[] = [];
    events.on('stage', (p) => seen.push(`stage:${p.stage}`));
    events.on('saved', (p) => seen.push(`saved:${p.garmentId}`));

    await ingestScan('file://photo.jpg', 'session-1', 'user-1', events);

    expect(seen).toEqual([
      'stage:compress', 'stage:upload', 'stage:analyze', 'stage:persist', 'saved:garment-123',
    ]);
  });

  it('emits queued on OfflineQueuedError', async () => {
    mockedResize.mockResolvedValue({ storagePath: 'u/1.webp', publicUrl: null } as any);
    mockedCall.mockResolvedValue({ title: 'Shirt' } as any);
    mockedPersist.mockRejectedValue(new OfflineQueuedError());

    const events = new LiveScanEvents();
    let queued = false;
    events.on('queued', () => { queued = true; });

    await ingestScan('file://photo.jpg', 'session-2', 'user-1', events);

    expect(queued).toBe(true);
  });

  it('emits failed with classified error on analyze 429', async () => {
    const { EdgeFunctionRateLimitError } = require('../../../lib/edgeFunctionClient');
    mockedResize.mockResolvedValue({ storagePath: 'u/1.webp', publicUrl: null } as any);
    mockedCall.mockRejectedValue(new EdgeFunctionRateLimitError('analyze_garment', 30));

    const events = new LiveScanEvents();
    let failedClass = '';
    events.on('failed', (p) => { failedClass = p.errorClass; });

    await ingestScan('file://photo.jpg', 'session-3', 'user-1', events);

    expect(failedClass).toBe('analyze_rate_limit');
  });

  it('emits failed on resize failure before analyze', async () => {
    mockedResize.mockRejectedValue(new Error('resize boom'));
    const events = new LiveScanEvents();
    let failedClass = '';
    events.on('failed', (p) => { failedClass = p.errorClass; });

    await ingestScan('file://photo.jpg', 'session-4', 'user-1', events);

    // Stage was 'compress' when the failure happened (set BEFORE awaiting resizeAndUpload).
    // Classification maps stage 'compress' → 'compress_failed'.
    expect(failedClass).toBe('compress_failed');
    expect(mockedCall).not.toHaveBeenCalled();
    // Nothing was uploaded yet, so no cleanup call.
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('cleans up orphaned upload when analyze fails', async () => {
    const { EdgeFunctionRateLimitError } = require('../../../lib/edgeFunctionClient');
    mockedResize.mockResolvedValue({ storagePath: 'u/orphan.webp', publicUrl: null } as any);
    mockedCall.mockRejectedValue(new EdgeFunctionRateLimitError('analyze_garment', 30));

    const events = new LiveScanEvents();
    await ingestScan('file://photo.jpg', 'session-5', 'user-1', events);

    expect(mockedDelete).toHaveBeenCalledTimes(1);
    expect(mockedDelete).toHaveBeenCalledWith('u/orphan.webp');
  });

  it('cleans up orphaned upload when persist fails (non-offline)', async () => {
    mockedResize.mockResolvedValue({ storagePath: 'u/orphan2.webp', publicUrl: null } as any);
    mockedCall.mockResolvedValue({ title: 'Shirt' } as any);
    mockedPersist.mockRejectedValue(new Error('persist boom'));

    const events = new LiveScanEvents();
    await ingestScan('file://photo.jpg', 'session-6', 'user-1', events);

    expect(mockedDelete).toHaveBeenCalledWith('u/orphan2.webp');
  });

  it('does NOT delete upload on OfflineQueuedError (replay reuses path)', async () => {
    mockedResize.mockResolvedValue({ storagePath: 'u/queued.webp', publicUrl: null } as any);
    mockedCall.mockResolvedValue({ title: 'Shirt' } as any);
    mockedPersist.mockRejectedValue(new OfflineQueuedError());

    const events = new LiveScanEvents();
    await ingestScan('file://photo.jpg', 'session-7', 'user-1', events);

    expect(mockedDelete).not.toHaveBeenCalled();
  });
});
