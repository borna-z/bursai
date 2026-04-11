import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { invokeEdgeFunctionMock } = vi.hoisted(() => ({
  invokeEdgeFunctionMock: vi.fn(),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

import { useGenerateFlatlay } from '@/hooks/useFlatlay';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('useGenerateFlatlay', () => {
  beforeEach(() => {
    invokeEdgeFunctionMock.mockReset();
  });

  it('generates flatlay and returns data on happy path', async () => {
    const payload = { success: true, flatlay_image_path: 'user-1/outfit-1.png' };
    invokeEdgeFunctionMock.mockResolvedValue({ data: payload, error: null });

    const { result } = renderHook(() => useGenerateFlatlay(), { wrapper: createWrapper() });

    let out;
    await act(async () => {
      out = await result.current.generateFlatlay('outfit-1');
    });

    expect(out).toEqual(payload);
    expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('generate_flatlay', {
      timeout: 45000,
      body: { outfit_id: 'outfit-1' },
    });
  });

  it('throws when edge function returns an error', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: null, error: new Error('edge fail') });

    const { result } = renderHook(() => useGenerateFlatlay(), { wrapper: createWrapper() });

    await expect(
      act(async () => {
        await result.current.generateFlatlay('outfit-1');
      }),
    ).rejects.toThrow('edge fail');
  });

  it('throws when data contains an error field', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({
      data: { success: false, flatlay_image_path: '', error: 'no outfit' },
      error: null,
    });

    const { result } = renderHook(() => useGenerateFlatlay(), { wrapper: createWrapper() });

    await expect(
      act(async () => {
        await result.current.generateFlatlay('outfit-1');
      }),
    ).rejects.toThrow('no outfit');
  });

  it('starts with isGenerating false', () => {
    const { result } = renderHook(() => useGenerateFlatlay(), { wrapper: createWrapper() });
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('exposes mutation error after failure', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: null, error: new Error('boom') });

    const { result } = renderHook(() => useGenerateFlatlay(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.generateFlatlay('outfit-1');
      } catch {
        /* expected */
      }
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });
});
