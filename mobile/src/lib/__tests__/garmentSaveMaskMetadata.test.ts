import { __getTable, __resetSupabaseMock } from '../../__mocks__/supabase';

const mockGetUploadMaskMetadata = jest.fn();
const mockCallEdgeFunction = jest.fn();
const mockTriggerGarmentEnrichment = jest.fn();

jest.mock('../imageUpload', () => ({
  getUploadMaskMetadata: mockGetUploadMaskMetadata,
}));

jest.mock('../edgeFunctionClient', () => ({
  callEdgeFunction: mockCallEdgeFunction,
  EdgeFunctionHttpError: class EdgeFunctionHttpError extends Error {
    status: number;
    constructor(_fn: string, status: number) {
      super('edge error');
      this.status = status;
    }
  },
  EdgeFunctionRateLimitError: class EdgeFunctionRateLimitError extends Error {
    retryAfter: number;
    constructor(_fn: string, retryAfter: number) {
      super('rate limit');
      this.retryAfter = retryAfter;
    }
  },
  EdgeFunctionSubscriptionLockedError: class EdgeFunctionSubscriptionLockedError extends Error {},
}));

jest.mock('../../hooks/useAnalyzeGarment', () => ({
  triggerGarmentEnrichment: mockTriggerGarmentEnrichment,
}));

describe('garmentSave upload mask metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetSupabaseMock();
    mockCallEdgeFunction.mockResolvedValue({ ok: true });
    mockTriggerGarmentEnrichment.mockResolvedValue(undefined);
  });

  it('persists the registered masked sidecar when AddPiece only passes the raw storage path', async () => {
    mockGetUploadMaskMetadata.mockReturnValue({
      maskedStoragePath: 'user-1/raw.masked.webp',
      maskStatus: 'masked',
    });
    const { persistGarment } = require('../garmentSave');

    await persistGarment({
      storagePath: 'user-1/raw.webp',
      analysis: {
        title: 'Blue shirt',
        category: 'top',
        confidence: 0.91,
      },
      source: 'add_photo',
      enableStudioQuality: false,
    });

    const row = __getTable('garments')[0];
    expect(mockGetUploadMaskMetadata).toHaveBeenCalledWith('user-1/raw.webp');
    expect(row.original_image_path).toBe('user-1/raw.webp');
    expect(row.image_path).toBe('user-1/raw.masked.webp');
    expect(row.mask_status).toBe('masked');
  });
});
