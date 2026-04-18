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
    // Round-13 atomic delete RPC: returns a structured success payload.
    // Set the mockRpc shape so useDeleteGarment's ok-check passes and
    // onSuccess fires.
    mockRpc.mockClear();
    mockRpc.mockResolvedValue({
      data: { ok: true, released_count: 0, garment_deleted: true },
      error: null,
    });

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

  describe('useDeleteGarment atomic delete-with-release (Codex round 13 redesign)', () => {
    it('calls delete_garment_with_release_atomic RPC with garment id and user id', async () => {
      // Round 13: single atomic RPC replaces round 12's two-step
      // release-then-delete. Client no longer issues a separate DELETE —
      // the RPC handles release + delete in one server-side transaction.
      vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
      mockFrom.mockReturnValue(mockChain());
      mockRpc.mockClear();
      mockRpc.mockResolvedValue({
        data: { ok: true, released_count: 1, garment_deleted: true },
        error: null,
      });

      const { useDeleteGarment } = await import('../useGarments');
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteGarment(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('garment-atomic-id');
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'delete_garment_with_release_atomic',
        { p_garment_id: 'garment-atomic-id', p_user_id: 'user-1' },
      );
    });

    it('does NOT issue a separate DELETE via from("garments").delete() — the RPC owns the delete', async () => {
      // Round-13 atomicity guarantee: the client must NOT call
      // `.from('garments').delete()` anymore, because a split
      // client-side transaction can leave release committed with the
      // DELETE failed (Codex round 13 Bug 2).
      //
      // Note: `.from('ai_response_cache').delete()` from
      // invalidateWardrobeQueries is expected + correct (bust server-side
      // insights cache). The assertion below filters to the 'garments'
      // table specifically.
      vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
      mockFrom.mockClear();
      mockFrom.mockReturnValue(mockChain());
      mockRpc.mockClear();
      mockRpc.mockResolvedValue({
        data: { ok: true, released_count: 0, garment_deleted: true },
        error: null,
      });

      const { useDeleteGarment } = await import('../useGarments');
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteGarment(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('garment-no-split');
      });

      // RPC fired exactly once.
      expect(mockRpc).toHaveBeenCalledTimes(1);
      // The mutation body did NOT call supabase.from('garments') at all —
      // the RPC owns both the release AND the delete. (`from('ai_response_cache')`
      // from invalidateWardrobeQueries onSuccess is unrelated and allowed.)
      const garmentFromCalls = mockFrom.mock.calls.filter((call) => call[0] === 'garments');
      expect(garmentFromCalls).toHaveLength(0);
    });

    it('treats idempotent garment_not_found as success (retry after prior delete)', async () => {
      // RPC returns { ok:true, garment_deleted:false, reason:'garment_not_found' }
      // on retry — the prior call already deleted. Should NOT throw; the
      // onSuccess invalidation should still fire so the client refetches.
      vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
      mockFrom.mockReturnValue(mockChain());
      mockRpc.mockClear();
      mockRpc.mockResolvedValue({
        data: { ok: true, released_count: 0, garment_deleted: false, reason: 'garment_not_found' },
        error: null,
      });

      const { useDeleteGarment } = await import('../useGarments');
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteGarment(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('garment-already-deleted');
      });

      // Did not throw. RPC called once.
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    it('throws when the RPC returns ok:false', async () => {
      // Authorization failure or other server-side rejection must NOT be
      // silently swallowed — the mutation should throw so the React Query
      // retry logic / caller can react.
      vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
      mockFrom.mockReturnValue(mockChain());
      mockRpc.mockClear();
      mockRpc.mockResolvedValue({
        data: { ok: false, reason: 'some_server_error' },
        error: null,
      });

      const { useDeleteGarment } = await import('../useGarments');
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteGarment(), { wrapper });

      let caught: unknown = null;
      await act(async () => {
        try {
          await result.current.mutateAsync('garment-ok-false');
        } catch (e) {
          caught = e;
        }
      });

      expect(caught).toBeInstanceOf(Error);
    });

    it('throws when the RPC itself errors (transport / auth / exception)', async () => {
      vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
      mockFrom.mockReturnValue(mockChain());
      mockRpc.mockClear();
      mockRpc.mockResolvedValue({ data: null, error: { message: 'not authorized' } });

      const { useDeleteGarment } = await import('../useGarments');
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteGarment(), { wrapper });

      let caught: unknown = null;
      await act(async () => {
        try {
          await result.current.mutateAsync('garment-rpc-errored');
        } catch (e) {
          caught = e;
        }
      });

      expect(caught).toBeTruthy();
    });
  });
});
