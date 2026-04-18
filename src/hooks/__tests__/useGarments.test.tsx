import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

const mockFrom = vi.fn();
const mockRpc = vi.fn().mockResolvedValue({ data: 0, error: null });
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));
vi.mock('@/lib/haptics', () => ({
  hapticSuccess: vi.fn(),
  hapticHeavy: vi.fn(),
}));
vi.mock('@/lib/offlineQueue', () => ({
  enqueue: vi.fn(),
}));

const mockUser = { id: 'user-1' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

import { useAuth } from '@/contexts/AuthContext';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  return { qc, wrapper };
}

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
}

function mockChain(data: unknown[] = [], error: unknown = null): MockChain {
  const chain = {} as MockChain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.contains = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockResolvedValue({ data, error });
  chain.limit = vi.fn().mockResolvedValue({ data, error });
  chain.insert = vi.fn().mockResolvedValue({ error });
  const deleteChain = { eq: vi.fn() };
  deleteChain.eq.mockImplementation(() => {
    const next: Record<string, unknown> & PromiseLike<{ error: unknown }> = {
      eq: vi.fn().mockResolvedValue({ error }),
      then: (resolve: (v: { error: unknown }) => unknown) => Promise.resolve({ error }).then(resolve),
    };
    return next;
  });
  chain.delete = vi.fn().mockReturnValue(deleteChain);
  const updateChain = { eq: vi.fn() };
  updateChain.eq.mockImplementation(() => ({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: (data as Record<string, unknown>[])[0] || null, error }),
      }),
    }),
  }));
  chain.update = vi.fn().mockReturnValue(updateChain);
  chain.single = vi.fn().mockResolvedValue({ data: (data as Record<string, unknown>[])[0] || null, error });
  chain.in = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('useGarments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('returns empty when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    const { useFlatGarments } = await import('../useGarments');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFlatGarments(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
  });

  it('fetches garments for authenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    const garments = [{ id: 'g1', title: 'Shirt', category: 'top', color_primary: 'blue' }];
    mockFrom.mockReturnValue(mockChain(garments));

    const { useFlatGarments } = await import('../useGarments');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFlatGarments(), { wrapper });
    await waitFor(() => expect(result.current.data.length).toBeGreaterThan(0));
    expect(result.current.data[0].title).toBe('Shirt');
  });

  it('applies category filter', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    const chain = mockChain([]);
    mockFrom.mockReturnValue(chain);

    const { useFlatGarments } = await import('../useGarments');
    const { wrapper } = createWrapper();
    renderHook(() => useFlatGarments({ category: 'top' }), { wrapper });
    await waitFor(() => expect(chain.eq).toHaveBeenCalledWith('category', 'top'));
  });

  it('useGarmentSearch queries server-side with ilike', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    const garments = [
      { id: 'g1', title: 'Blue Shirt', category: 'top', color_primary: 'blue' },
    ];
    mockFrom.mockReturnValue(mockChain(garments));

    const { useGarmentSearch } = await import('../useGarments');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGarmentSearch('blue'), { wrapper });
    await waitFor(() => expect(result.current.data?.length).toBe(1));
    expect(result.current.data?.[0].title).toBe('Blue Shirt');
  });

  it('useGarmentCount returns count', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    const chain = {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 5, error: null }) }),
    };
    mockFrom.mockReturnValue(chain);

    const { useGarmentCount } = await import('../useGarments');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGarmentCount(), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(5));
  });

  it('invalidates garment list and garment count after create', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    mockFrom.mockReturnValue(mockChain([{ id: 'g1', title: 'Shirt', category: 'top', color_primary: 'blue' }]));

    const { useCreateGarment } = await import('../useGarments');
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateGarment(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ title: 'Shirt', category: 'top', color_primary: 'blue' } as never);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['garments', 'user-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['garments-count', 'user-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ai-suggestions'] });
  });

  it('preserves the caller garment id for offline create fallback', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    vi.stubGlobal('navigator', { onLine: false });
    mockFrom.mockReturnValue({
      insert: vi.fn(),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ then: vi.fn((cb: () => void) => { cb(); }) }) }),
    });

    const { enqueue } = await import('@/lib/offlineQueue');
    const { useCreateGarment } = await import('../useGarments');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateGarment(), { wrapper });

    let created: Awaited<ReturnType<typeof result.current.mutateAsync>>;
    await act(async () => {
      created = await result.current.mutateAsync({
        id: 'garment-123',
        title: 'Shirt',
        category: 'top',
        color_primary: 'blue',
      } as never);
    });

    expect(created!.id).toBe('garment-123');
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ id: 'garment-123' }),
    }));
  });

  it('invalidates garment list and garment count after delete', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    mockFrom.mockReturnValue(mockChain());

    const { useDeleteGarment } = await import('../useGarments');
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteGarment(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('g1');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['garments', 'user-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['garments-count', 'user-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ai-suggestions'] });
  });

  describe('useDeleteGarment pre-delete release (Codex round 12 Bug 2)', () => {
    it('calls release_reservations_for_garment_delete RPC before the DELETE', async () => {
      vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
      mockFrom.mockReturnValue(mockChain());
      mockRpc.mockClear();
      mockRpc.mockResolvedValue({ data: 1, error: null });

      const { useDeleteGarment } = await import('../useGarments');
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteGarment(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('garment-delete-id');
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'release_reservations_for_garment_delete',
        { p_garment_id: 'garment-delete-id' },
      );
    });

    it('proceeds with DELETE even if the release RPC returns an error', async () => {
      // Defense-in-depth: a transient RPC failure must not block the user's
      // delete. Worst case: we orphan a reservation that the post-launch
      // cleanup cron will eventually release. Same failure mode as before
      // this fix, just applied to a narrow window (RPC error path).
      vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
      const chain = mockChain();
      mockFrom.mockReturnValue(chain);
      mockRpc.mockClear();
      mockRpc.mockResolvedValue({ data: null, error: { message: 'transient DB blip' } });

      const { useDeleteGarment } = await import('../useGarments');
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteGarment(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('garment-rpc-errored');
      });

      // The delete chain still fired.
      expect(chain.delete).toHaveBeenCalled();
      // The RPC was called once despite the error.
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    it('proceeds with DELETE even if the release RPC throws', async () => {
      vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
      const chain = mockChain();
      mockFrom.mockReturnValue(chain);
      mockRpc.mockClear();
      mockRpc.mockRejectedValueOnce(new Error('network down'));

      const { useDeleteGarment } = await import('../useGarments');
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteGarment(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('garment-rpc-threw');
      });

      expect(chain.delete).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });
  });
});
