const mockUpload = jest.fn();
const mockRemoveBackground = jest.fn();
const mockManipulate = jest.fn();
const mockRemoveStorage = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: mockUpload,
        remove: mockRemoveStorage,
      })),
    },
  },
}));

jest.mock('../backgroundRemoval', () => ({
  removeBackground: mockRemoveBackground,
  MASK_SAVE_TIMEOUT_MS: 50,
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: mockManipulate,
  SaveFormat: { WEBP: 'webp' },
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    bytes: jest.fn(async () => new Uint8Array([uri.length])),
  })),
}));

describe('imageUpload background removal sidecar', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockRemoveStorage.mockResolvedValue({ error: null });
    mockRemoveBackground.mockResolvedValue({
      uri: 'file://mask.png',
      status: 'masked',
      confidence: 0.92,
      durationMs: 120,
    });
    mockManipulate.mockResolvedValue({
      uri: 'file://mask.webp',
      width: 512,
      height: 512,
    });
  });

  it('uploads a masked sidecar for a successful segmented AddPiece upload', async () => {
    const { uploadManipulatedImage, getUploadMaskMetadata } = require('../imageUpload');

    const result = await uploadManipulatedImage(
      { uri: 'file://raw.webp', width: 1024, height: 768 },
      'user-1',
    );

    expect(result.storagePath).toMatch(/^user-1\/\d+-[a-z0-9]+\.webp$/);
    expect(result.maskedStoragePath).toBe(
      result.storagePath.replace(/\.webp$/, '.masked.webp'),
    );
    expect(result.maskStatus).toBe('masked');
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockUpload.mock.calls[1][0]).toBe(result.maskedStoragePath);
    expect(getUploadMaskMetadata(result.storagePath)).toEqual({
      maskedStoragePath: result.maskedStoragePath,
      maskStatus: 'masked',
    });
  });

  it('deletes the registered masked sidecar when the raw upload is cleaned up', async () => {
    const { deleteUpload, uploadManipulatedImage } = require('../imageUpload');
    const result = await uploadManipulatedImage(
      { uri: 'file://raw.webp', width: 1024, height: 768 },
      'user-1',
    );

    await deleteUpload(result.storagePath);

    expect(mockRemoveStorage).toHaveBeenCalledWith([
      result.storagePath,
      result.maskedStoragePath,
    ]);
  });

  it('removes the masked sidecar even after the in-memory metadata has been consumed (cold-start orphan)', async () => {
    const { deleteUpload, getUploadMaskMetadata, uploadManipulatedImage } =
      require('../imageUpload');
    const result = await uploadManipulatedImage(
      { uri: 'file://raw.webp', width: 1024, height: 768 },
      'user-1',
    );

    // Simulate `persistGarment` having already drained the metadata, or a
    // cold-start `deleteUpload` where the in-memory map is empty.
    expect(getUploadMaskMetadata(result.storagePath)).not.toBeNull();
    expect(getUploadMaskMetadata(result.storagePath)).toBeNull();

    await deleteUpload(result.storagePath);

    const expectedSidecar = result.storagePath.replace(/\.webp$/, '.masked.webp');
    expect(mockRemoveStorage).toHaveBeenCalledWith([
      result.storagePath,
      expectedSidecar,
    ]);
  });

  it('falls through to the raw upload (no sidecar) when the mask never resolves before MASK_SAVE_TIMEOUT_MS', async () => {
    mockRemoveBackground.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    const { uploadManipulatedImage } = require('../imageUpload');

    const result = await uploadManipulatedImage(
      { uri: 'file://raw.webp', width: 1024, height: 768 },
      'user-1',
    );

    expect(result.maskedStoragePath).toBeUndefined();
    expect(result.maskStatus).toBe('unavailable');
    // Exactly one upload — raw only. The masked sidecar branch never ran.
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('uploads native masked bytes directly without re-encoding through ImageManipulator', async () => {
    const { uploadManipulatedImage } = require('../imageUpload');

    await uploadManipulatedImage(
      { uri: 'file://raw.webp', width: 1024, height: 768 },
      'user-1',
    );

    // The native module already emits a WebP; the prior double-transcode
    // path called `manipulateAsync(maskRes.uri, ...)` here. Verify we don't
    // pay that cost any more.
    expect(mockManipulate).not.toHaveBeenCalled();
  });
});
