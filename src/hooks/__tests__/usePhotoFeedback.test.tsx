import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const {
  useAuthMock,
  invokeEdgeFunctionMock,
  uploadMock,
  fromMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  invokeEdgeFunctionMock: vi.fn(),
  uploadMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    storage: {
      from: vi.fn(() => ({ upload: uploadMock })),
    },
  },
}));

import { useOutfitFeedback, useSubmitPhotoFeedback } from '../usePhotoFeedback';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

describe('usePhotoFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
  });

  describe('useOutfitFeedback', () => {
    it('is disabled when no outfitId', () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useOutfitFeedback(undefined), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('fetches feedback row when both ids present', async () => {
      const row = { id: 'f1', outfit_id: 'o1', user_id: 'user-1', overall_score: 8 };
      fromMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
                }),
              }),
            }),
          }),
        }),
      });
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useOutfitFeedback('o1'), { wrapper });
      await waitFor(() => expect(result.current.data).toBeTruthy());
      expect(result.current.data?.id).toBe('f1');
    });
  });

  describe('useSubmitPhotoFeedback', () => {
    it('uploads selfie and calls edge function', async () => {
      uploadMock.mockResolvedValue({ error: null });
      invokeEdgeFunctionMock.mockResolvedValue({
        data: { id: 'fb1', outfit_id: 'o1', overall_score: 9 },
        error: null,
      });
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSubmitPhotoFeedback(), { wrapper });
      const file = new File(['x'], 'selfie.jpg', { type: 'image/jpeg' });

      await act(async () => {
        await result.current.mutateAsync({ outfitId: 'o1', selfieFile: file });
      });

      expect(uploadMock).toHaveBeenCalledWith(
        'user-1/selfie_o1.jpg',
        file,
        { upsert: true },
      );
      expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('outfit_photo_feedback', expect.any(Object));
    });

    it('throws when not authenticated', async () => {
      useAuthMock.mockReturnValue({ user: null });
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSubmitPhotoFeedback(), { wrapper });
      const file = new File(['x'], 'selfie.jpg', { type: 'image/jpeg' });
      await expect(
        result.current.mutateAsync({ outfitId: 'o1', selfieFile: file }),
      ).rejects.toThrow('Not authenticated');
    });

    it('throws when upload fails', async () => {
      uploadMock.mockResolvedValue({ error: new Error('upload failed') });
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSubmitPhotoFeedback(), { wrapper });
      const file = new File(['x'], 'selfie.jpg', { type: 'image/jpeg' });
      await expect(
        result.current.mutateAsync({ outfitId: 'o1', selfieFile: file }),
      ).rejects.toThrow('upload failed');
    });
  });
});
