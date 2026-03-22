import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));
vi.mock('@/lib/haptics', () => ({
  hapticSuccess: vi.fn(),
  hapticHeavy: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1' } })),
}));

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/** Creates a fluent chain that resolves to { data, error } when awaited */
function mockChain(data: unknown[] = [], error: unknown = null) {
  const resolved = Promise.resolve({ data, error });
  const chain: Record<string, unknown> = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'then') return resolved.then.bind(resolved);
      if (prop === 'catch') return resolved.catch.bind(resolved);
      if (prop === 'finally') return resolved.finally.bind(resolved);
      if (prop === 'single') return vi.fn().mockResolvedValue({ data: (data as Record<string, unknown>[])[0] || null, error });
      if (prop === 'delete') return vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error }),
      });
      return vi.fn().mockReturnValue(chain);
    },
  });
  return chain;
}

describe('useOutfits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns undefined when not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    const { useOutfits } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfits(), { wrapper });
    expect(result.current.data).toBeUndefined();
  });

  it('fetches outfits with items', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuth>);
    const outfits = [{ id: 'o1', occasion: 'casual', outfit_items: [{ id: 'oi1', slot: 'top', garment_id: 'g1', garment: { id: 'g1', category: 'top' } }, { id: 'oi2', slot: 'bottom', garment_id: 'g2', garment: { id: 'g2', category: 'bottom' } }, { id: 'oi3', slot: 'shoes', garment_id: 'g3', garment: { id: 'g3', category: 'shoes' } }] }];
    mockFrom.mockReturnValue(mockChain(outfits));

    const { useOutfits } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfits(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.occasion).toBe('casual');
  });

  it('useOutfit returns single outfit', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuth>);
    const outfit = { id: 'o1', occasion: 'formal', outfit_items: [{ id: 'oi1', slot: 'dress', garment_id: 'g1', garment: { id: 'g1', category: 'dress' } }, { id: 'oi2', slot: 'shoes', garment_id: 'g2', garment: { id: 'g2', category: 'shoes' } }] };
    mockFrom.mockReturnValue(mockChain([outfit]));

    const { useOutfit } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfit('o1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data?.occasion).toBe('formal');
  });


  it('filters legacy invalid persisted outfits from collections', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuth>);
    const outfits = [
      {
        id: 'bad',
        occasion: 'casual',
        outfit_items: [
          { id: 'oi-1', slot: 'top', garment_id: 'g1', garment: { id: 'g1', category: 'top' } },
          { id: 'oi-2', slot: 'shoes', garment_id: 'g2', garment: { id: 'g2', category: 'shoes' } },
        ],
      },
      {
        id: 'good',
        occasion: 'casual',
        outfit_items: [
          { id: 'oi-3', slot: 'top', garment_id: 'g3', garment: { id: 'g3', category: 'top' } },
          { id: 'oi-4', slot: 'bottom', garment_id: 'g4', garment: { id: 'g4', category: 'bottom' } },
          { id: 'oi-5', slot: 'shoes', garment_id: 'g5', garment: { id: 'g5', category: 'shoes' } },
        ],
      },
    ];
    mockFrom.mockReturnValue(mockChain(outfits));

    const { useOutfits } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfits(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((outfit) => outfit.id)).toEqual(['good']);
  });

  it('returns null for a legacy invalid persisted outfit detail', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuth>);
    const outfit = {
      id: 'bad',
      occasion: 'formal',
      outfit_items: [
        { id: 'oi-1', slot: 'bottom', garment_id: 'g1', garment: { id: 'g1', category: 'bottom' } },
        { id: 'oi-2', slot: 'shoes', garment_id: 'g2', garment: { id: 'g2', category: 'shoes' } },
      ],
    };
    mockFrom.mockReturnValue(mockChain([outfit]));

    const { useOutfit } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfit('bad'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('useDeleteOutfit calls delete', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuth>);
    const deleteFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue({ delete: deleteFn });

    const { useDeleteOutfit } = await import('../useOutfits');
    const { result } = renderHook(() => useDeleteOutfit(), { wrapper });
    await result.current.mutateAsync('o1');
    expect(deleteFn).toHaveBeenCalled();
  });
});
