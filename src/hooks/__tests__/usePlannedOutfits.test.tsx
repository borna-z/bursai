import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1' } })),
}));

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

/**
 * Builds a fluent supabase chain that resolves to { data, error } when awaited
 * at the end of the chain. Supports the method shapes used by usePlannedOutfits.
 */
function selectChain(data: unknown, error: unknown = null) {
  const resolved = Promise.resolve({ data, error });
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') return resolved.then.bind(resolved);
        if (prop === 'catch') return resolved.catch.bind(resolved);
        if (prop === 'finally') return resolved.finally.bind(resolved);
        if (prop === 'maybeSingle')
          return vi
            .fn()
            .mockResolvedValue({
              data: Array.isArray(data) ? (data as unknown[])[0] ?? null : data,
              error,
            });
        if (prop === 'single')
          return vi
            .fn()
            .mockResolvedValue({
              data: Array.isArray(data) ? (data as unknown[])[0] ?? null : data,
              error,
            });
        return vi.fn().mockReturnValue(chain);
      },
    },
  );
  return chain;
}

function completeOutfit(id: string) {
  return {
    id,
    occasion: 'casual',
    outfit_items: [
      { id: `${id}-i1`, slot: 'top', garment_id: 'g1', garment: { id: 'g1', category: 'top' } },
      { id: `${id}-i2`, slot: 'bottom', garment_id: 'g2', garment: { id: 'g2', category: 'bottom' } },
      { id: `${id}-i3`, slot: 'shoes', garment_id: 'g3', garment: { id: 'g3', category: 'shoes' } },
    ],
  };
}

describe('usePlannedOutfits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' },
    } as ReturnType<typeof useAuth>);
  });

  it('returns empty data when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    const { usePlannedOutfits } = await import('../usePlannedOutfits');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePlannedOutfits(), { wrapper });
    // enabled=false, so query stays disabled with no data
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches planned outfits for the default 7-day window', async () => {
    const planned = [
      {
        id: 'pl1',
        user_id: 'user-1',
        date: '2026-04-12',
        outfit_id: 'o1',
        status: 'planned',
        note: null,
        created_at: '2026-04-10T00:00:00Z',
        outfit: completeOutfit('o1'),
      },
    ];
    mockFrom.mockReturnValue(selectChain(planned));

    const { usePlannedOutfits } = await import('../usePlannedOutfits');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePlannedOutfits(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe('pl1');
    expect(result.current.data?.[0].outfit?.id).toBe('o1');
  });

  it('returns empty array when supabase returns no rows', async () => {
    mockFrom.mockReturnValue(selectChain([]));
    const { usePlannedOutfits } = await import('../usePlannedOutfits');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePlannedOutfits(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('nulls out the outfit when persisted items are incomplete', async () => {
    const planned = [
      {
        id: 'pl-incomplete',
        user_id: 'user-1',
        date: '2026-04-12',
        outfit_id: 'bad',
        status: 'planned',
        note: null,
        created_at: '2026-04-10T00:00:00Z',
        outfit: {
          id: 'bad',
          occasion: 'casual',
          // Only top + shoes — incomplete
          outfit_items: [
            { id: 'bi1', slot: 'top', garment_id: 'g1', garment: { id: 'g1', category: 'top' } },
            { id: 'bi2', slot: 'shoes', garment_id: 'g2', garment: { id: 'g2', category: 'shoes' } },
          ],
        },
      },
    ];
    mockFrom.mockReturnValue(selectChain(planned));

    const { usePlannedOutfits } = await import('../usePlannedOutfits');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePlannedOutfits(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].outfit).toBeNull();
  });

  it('accepts an explicit date range in the query key', async () => {
    mockFrom.mockReturnValue(selectChain([]));
    const { usePlannedOutfits } = await import('../usePlannedOutfits');
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => usePlannedOutfits({ startDate: '2026-05-01', endDate: '2026-05-07' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith('planned_outfits');
  });

  it('usePlannedOutfitsForDate is disabled when date is empty', async () => {
    const { usePlannedOutfitsForDate } = await import('../usePlannedOutfits');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePlannedOutfitsForDate(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useUpsertPlannedOutfit inserts and invalidates planned queries', async () => {
    // Count query returns 0, then insert returns the new row
    mockFrom.mockImplementation(() => {
      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'pl-new', date: '2026-04-12' },
              error: null,
            }),
          }),
        }),
      };
      return chain;
    });

    const { useUpsertPlannedOutfit } = await import('../usePlannedOutfits');
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpsertPlannedOutfit(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        date: '2026-04-12',
        outfitId: 'o1',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['planned-outfits'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['planned-outfits-day'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['planned-outfit'] });
  });

  it('useUpsertPlannedOutfit throws when day is already at max', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
        }),
      }),
    }));

    const { useUpsertPlannedOutfit } = await import('../usePlannedOutfits');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpsertPlannedOutfit(), { wrapper });

    await expect(
      result.current.mutateAsync({ date: '2026-04-12', outfitId: 'o1' }),
    ).rejects.toThrow(/Maximum/);
  });

  it('useDeletePlannedOutfit deletes and invalidates planned queries', async () => {
    const eqSecond = vi.fn().mockResolvedValue({ error: null });
    const eqFirst = vi.fn().mockReturnValue({ eq: eqSecond });
    mockFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqFirst }) });

    const { useDeletePlannedOutfit } = await import('../usePlannedOutfits');
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeletePlannedOutfit(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('pl-1');
    });

    expect(eqFirst).toHaveBeenCalledWith('id', 'pl-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['planned-outfits'] });
  });

  it('useUpdatePlannedOutfitStatus updates and invalidates', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'pl-1', status: 'worn' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    const { useUpdatePlannedOutfitStatus } = await import('../usePlannedOutfits');
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdatePlannedOutfitStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pl-1', status: 'worn' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['planned-outfits'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['planned-outfits-day'] });
  });
});
