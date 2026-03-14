import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));
vi.mock('@/lib/haptics', () => ({
  hapticSuccess: vi.fn(),
  hapticHeavy: vi.fn(),
}));

const mockUser = { id: 'user-1' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

import { useAuth } from '@/contexts/AuthContext';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function mockChain(data: any = [], error: any = null) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue({ data, error });
  chain.insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'o1', ...data[0] }, error }) }) });
  chain.delete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error }) });
  chain.update = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: data[0], error }) }) }) });
  chain.single = vi.fn().mockResolvedValue({ data: data[0] || null, error });
  chain.in = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'wl1' }], error: null }) });
  return chain;
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
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    const outfits = [{ id: 'o1', occasion: 'casual', outfit_items: [] }];
    mockFrom.mockReturnValue(mockChain(outfits));

    const { useOutfits } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfits(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data?.[0]?.occasion).toBe('casual');
  });

  it('useOutfit returns single outfit', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    const outfit = { id: 'o1', occasion: 'formal', outfit_items: [] };
    const chain = mockChain([outfit]);
    chain.single.mockResolvedValue({ data: outfit, error: null });
    mockFrom.mockReturnValue(chain);

    const { useOutfit } = await import('../useOutfits');
    const { result } = renderHook(() => useOutfit('o1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data?.occasion).toBe('formal');
  });

  it('useDeleteOutfit calls delete', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    const chain = mockChain([]);
    mockFrom.mockReturnValue(chain);

    const { useDeleteOutfit } = await import('../useOutfits');
    const { result } = renderHook(() => useDeleteOutfit(), { wrapper });
    await result.current.mutateAsync('o1');
    expect(chain.delete).toHaveBeenCalled();
  });
});
