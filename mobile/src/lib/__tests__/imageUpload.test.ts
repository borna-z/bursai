// Wave R-C tests — exercises the defensive paths added in R-C.1 (HEIC
// transcode) and R-C.2 (content:// fallback). The full upload flow isn't
// covered here (it hits supabase storage which is integration territory);
// these tests pin the two new helpers' behaviour against the public surface
// (`resizeForGarment` and `uploadManipulatedImage`).

jest.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ upload: jest.fn().mockResolvedValue({ data: {}, error: null }) }),
    },
  },
}));

const mockManipulateAsync = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { WEBP: 'webp', JPEG: 'jpeg' },
}));

// Hand-rolled mock so we can drive `.bytes()` and `.copy()` outcomes per test.
const mockFileInstances: { uri: string; bytes: jest.Mock; copy: jest.Mock }[] = [];

jest.mock('expo-file-system', () => {
  return {
    File: jest.fn().mockImplementation((...args: unknown[]) => {
      // The new File constructor accepts `(uri)` OR `(directory, name)`.
      // Both shapes flatten to a single string URI for tracking purposes.
      const uri = args.length === 1 && typeof args[0] === 'string'
        ? args[0]
        : args.map((a) => (typeof a === 'string' ? a : '')).join('/');
      const inst = {
        uri,
        bytes: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        copy: jest.fn(),
      };
      mockFileInstances.push(inst);
      return inst;
    }),
    Paths: { cache: 'cache://' },
  };
});

const RESIZED_URI = 'file:///cache/resized.webp';

beforeEach(() => {
  jest.clearAllMocks();
  mockFileInstances.length = 0;
  mockManipulateAsync.mockReset();
  mockManipulateAsync.mockResolvedValue({ uri: RESIZED_URI, width: 1024, height: 1024 });
});

describe('resizeForGarment — Wave R-C.1 HEIC defense', () => {
  it('runs a JPEG transcode pass before the WebP resize for .heic URIs', async () => {
    const { resizeForGarment } = require('../imageUpload') as typeof import('../imageUpload');
    mockManipulateAsync
      .mockResolvedValueOnce({ uri: 'file:///cache/transcoded.jpg', width: 4032, height: 3024 })
      .mockResolvedValueOnce({ uri: RESIZED_URI, width: 1024, height: 768 });

    const out = await resizeForGarment('file:///photos/IMG_1234.HEIC');
    expect(mockManipulateAsync).toHaveBeenCalledTimes(2);
    // First call: HEIC → JPEG transcode, q=0.95
    expect(mockManipulateAsync.mock.calls[0][0]).toBe('file:///photos/IMG_1234.HEIC');
    expect(mockManipulateAsync.mock.calls[0][1]).toEqual([]);
    expect(mockManipulateAsync.mock.calls[0][2]).toMatchObject({ compress: 0.95, format: 'jpeg' });
    // Second call: resize from the transcoded JPEG
    expect(mockManipulateAsync.mock.calls[1][0]).toBe('file:///cache/transcoded.jpg');
    expect(mockManipulateAsync.mock.calls[1][2]).toMatchObject({ format: 'webp' });
    expect(out.uri).toBe(RESIZED_URI);
  });

  it('detects HEIC case-insensitively and across .heif extension', async () => {
    const { resizeForGarment } = require('../imageUpload') as typeof import('../imageUpload');
    mockManipulateAsync
      .mockResolvedValueOnce({ uri: 'file:///x.jpg' })
      .mockResolvedValueOnce({ uri: RESIZED_URI });

    await resizeForGarment('file:///photos/IMG_1234.heif?ts=99');
    expect(mockManipulateAsync).toHaveBeenCalledTimes(2);
    expect(mockManipulateAsync.mock.calls[0][2]).toMatchObject({ format: 'jpeg' });
  });

  it('skips the transcode for non-HEIC inputs (camera JPEG, gallery PNG)', async () => {
    const { resizeForGarment } = require('../imageUpload') as typeof import('../imageUpload');

    await resizeForGarment('file:///cache/photo.jpg');
    expect(mockManipulateAsync).toHaveBeenCalledTimes(1);
    expect(mockManipulateAsync.mock.calls[0][2]).toMatchObject({ format: 'webp' });
  });

  it('falls back to the original URI when the HEIC transcode throws', async () => {
    const { resizeForGarment } = require('../imageUpload') as typeof import('../imageUpload');
    mockManipulateAsync
      .mockRejectedValueOnce(new Error('decode failed'))
      .mockResolvedValueOnce({ uri: RESIZED_URI });

    const out = await resizeForGarment('file:///photos/IMG_1234.heic');
    // The resize step gets the ORIGINAL URI back, not a partial transcode
    expect(mockManipulateAsync.mock.calls[1][0]).toBe('file:///photos/IMG_1234.heic');
    expect(out.uri).toBe(RESIZED_URI);
  });
});

describe('uploadManipulatedImage — Wave R-C.2 content:// fallback', () => {
  it('reads bytes directly when the URI is well-formed', async () => {
    const { uploadManipulatedImage } = require('../imageUpload') as typeof import('../imageUpload');

    const resized = { uri: RESIZED_URI, width: 1, height: 1 } as never;
    const result = await uploadManipulatedImage(resized, 'user-1');
    expect(result.storagePath).toMatch(/^user-1\/\d+-[a-z0-9]+\.webp$/);
    // Exactly one File instance — no fallback copy fired.
    expect(mockFileInstances).toHaveLength(1);
    expect(mockFileInstances[0].bytes).toHaveBeenCalledTimes(1);
  });

  it('copies the source to cache and retries when the initial bytes() rejects', async () => {
    const { uploadManipulatedImage } = require('../imageUpload') as typeof import('../imageUpload');

    // Custom factory: first read rejects; the post-copy retry read resolves.
    // safeReadBytes does:
    //   new File(uri).bytes()         → instance #1, bytes rejects
    //   new File(cache, name)         → instance #2 (dest), bytes resolves on retry
    //   new File(uri).copy(dest)      → instance #3, copy called
    const { File } = require('expo-file-system') as { File: jest.Mock };
    let call = 0;
    File.mockReset();
    File.mockImplementation((...args: unknown[]) => {
      call += 1;
      const uri = args.length === 1 && typeof args[0] === 'string'
        ? (args[0] as string)
        : args.map((a) => (typeof a === 'string' ? a : '')).join('/');
      const inst = {
        uri,
        bytes:
          call === 1
            ? jest.fn().mockRejectedValueOnce(new Error('permission denied'))
            : jest.fn().mockResolvedValue(new Uint8Array([9, 9, 9])),
        copy: jest.fn(),
      };
      mockFileInstances.push(inst);
      return inst;
    });

    const resized = { uri: RESIZED_URI, width: 1, height: 1 } as never;
    const out = await uploadManipulatedImage(resized, 'user-1');
    expect(out.storagePath).toMatch(/^user-1\/\d+-[a-z0-9]+\.webp$/);

    // At least one copy() call across the three File instances.
    const copies = mockFileInstances.reduce(
      (n, f) => n + f.copy.mock.calls.length,
      0,
    );
    expect(copies).toBe(1);
    // The dest (cache) instance's bytes() was the one whose result reached
    // the upload — second instance in construction order.
    expect(mockFileInstances[1].bytes).toHaveBeenCalledTimes(1);
  });

  it('rethrows the ORIGINAL error when both reads fail', async () => {
    const { uploadManipulatedImage } = require('../imageUpload') as typeof import('../imageUpload');

    const { File } = require('expo-file-system') as { File: jest.Mock };
    File.mockReset();
    let call = 0;
    File.mockImplementation((...args: unknown[]) => {
      call += 1;
      const uri = args.length === 1 && typeof args[0] === 'string'
        ? (args[0] as string)
        : args.map((a) => (typeof a === 'string' ? a : '')).join('/');
      const inst = {
        uri,
        bytes:
          call === 1
            ? jest.fn().mockRejectedValueOnce(new Error('first failure'))
            : jest.fn().mockResolvedValue(new Uint8Array([0])),
        copy: jest.fn().mockImplementation(() => {
          throw new Error('copy failed too');
        }),
      };
      mockFileInstances.push(inst);
      return inst;
    });

    const resized = { uri: RESIZED_URI, width: 1, height: 1 } as never;
    await expect(uploadManipulatedImage(resized, 'user-1')).rejects.toThrow('first failure');
  });
});
