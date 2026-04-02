import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStorage } from '@/hooks/useStorage';

const uploadMock = vi.fn();
const createSignedUrlMock = vi.fn();
const removeMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        createSignedUrl: createSignedUrlMock,
        remove: removeMock,
      })),
    },
  },
}));

describe('useStorage', () => {
  beforeEach(() => {
    uploadMock.mockReset().mockResolvedValue({ error: null });
    createSignedUrlMock.mockReset();
    removeMock.mockReset();
  });

  it('derives the upload path from blob mime type when no file name exists', async () => {
    const { result } = renderHook(() => useStorage());
    const blob = new Blob(['image-bytes'], { type: 'image/png' });

    const path = await result.current.uploadGarmentImage(blob, 'garment-1');

    expect(path).toBe('user-1/garment-1/original.png');
    expect(uploadMock).toHaveBeenCalledWith(
      'user-1/garment-1/original.png',
      blob,
      expect.objectContaining({
        upsert: true,
        contentType: 'image/png',
      }),
    );
  });

  it('respects an explicit extension override for processed uploads', async () => {
    const { result } = renderHook(() => useStorage());
    const blob = new Blob(['image-bytes'], { type: 'image/png' });

    const path = await result.current.uploadGarmentImage(blob, 'garment-2', { extension: 'jpg' });

    expect(path).toBe('user-1/garment-2/original.jpg');
    expect(uploadMock).toHaveBeenCalledWith(
      'user-1/garment-2/original.jpg',
      blob,
      expect.objectContaining({
        upsert: true,
        contentType: 'image/png',
      }),
    );
  });
});
