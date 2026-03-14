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
function mockChain(data: any = [], error: any = null) {
  const resolved = Promise.resolve({ data, error });
  const chain: any = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') return resolved.then.bind(resolved);
      if (prop === 'catch') return resolved.catch.bind(resolved);
      if (prop === 'finally') return resolved.finally.bind(resolved);
      // single() resolves immediately
      if (prop === 'single') return vi.fn().mockResolvedValue({ data: data[0] || null, error });
      // delete returns a sub-chain
      if (prop === 'delete') return vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error }),
      });
      // Any other method returns self for chaining
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
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);
    const { useOutfits } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfits(), { wrapper });
    expect(result.current.data).toBeUndefined();
  });

  it('fetches outfits with items', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
    const outfits = [{ id: 'o1', occasion: 'casual', outfit_items: [] }];
    mockFrom.mockReturnValue(mockChain(outfits));

    const { useOutfits } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfits(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.occasion).toBe('casual');
  });

  it('useOutfit returns single outfit', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
    const outfit = { id: 'o1', occasion: 'formal', outfit_items: [] };
    mockFrom.mockReturnValue(mockChain([outfit]));

    const { useOutfit } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfit('o1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data?.occasion).toBe('formal');
  });

  it('useDeleteOutfit calls delete', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
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
