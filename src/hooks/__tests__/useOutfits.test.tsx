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

describe('useOutfits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty array when not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);
    const { useOutfits } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfits(), { wrapper });
    expect(result.current.data).toBeUndefined();
  });

  it('fetches outfits with items', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
    const outfits = [{ id: 'o1', occasion: 'casual', outfit_items: [] }];
    
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue({ data: outfits, error: null });
    mockFrom.mockReturnValue(chain);

    const { useOutfits } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfits(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.occasion).toBe('casual');
  });

  it('useOutfit returns single outfit', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
    const outfit = { id: 'o1', occasion: 'formal', outfit_items: [] };
    
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: outfit, error: null });
    mockFrom.mockReturnValue(chain);

    const { useOutfit } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfit('o1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data?.occasion).toBe('formal');
  });

  it('useDeleteOutfit calls delete', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
    
    const chain: any = {};
    chain.delete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const { useDeleteOutfit } = await import('../useOutfits');
    const { result } = renderHook(() => useDeleteOutfit(), { wrapper });
    await result.current.mutateAsync('o1');
    expect(chain.delete).toHaveBeenCalled();
  });
});
