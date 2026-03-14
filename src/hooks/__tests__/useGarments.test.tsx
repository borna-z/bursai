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
vi.mock('@/lib/offlineQueue', () => ({
  enqueue: vi.fn(),
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
  chain.contains = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockResolvedValue({ data, error });
  chain.insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: data[0] || {}, error }) }) });
  chain.delete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error }) });
  chain.update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error }) });
  chain.single = vi.fn().mockResolvedValue({ data: data[0] || null, error });
  chain.in = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('useGarments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);
    const { useFlatGarments } = await import('../useGarments');
    const { result } = renderHook(() => useFlatGarments(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
  });

  it('fetches garments for authenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    const garments = [{ id: 'g1', title: 'Shirt', category: 'top', color_primary: 'blue' }];
    mockFrom.mockReturnValue(mockChain(garments));

    const { useFlatGarments } = await import('../useGarments');
    const { result } = renderHook(() => useFlatGarments(), { wrapper });
    await waitFor(() => expect(result.current.data.length).toBeGreaterThan(0));
    expect(result.current.data[0].title).toBe('Shirt');
  });

  it('applies category filter', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    const chain = mockChain([]);
    mockFrom.mockReturnValue(chain);

    const { useFlatGarments } = await import('../useGarments');
    renderHook(() => useFlatGarments({ category: 'top' }), { wrapper });
    await waitFor(() => expect(chain.eq).toHaveBeenCalledWith('category', 'top'));
  });

  it('applies client-side search filter', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    const garments = [
      { id: 'g1', title: 'Blue Shirt', category: 'top', color_primary: 'blue' },
      { id: 'g2', title: 'Red Pants', category: 'bottom', color_primary: 'red' },
    ];
    mockFrom.mockReturnValue(mockChain(garments));

    const { useFlatGarments } = await import('../useGarments');
    const { result } = renderHook(() => useFlatGarments({ search: 'blue' }), { wrapper });
    await waitFor(() => expect(result.current.data.length).toBe(1));
    expect(result.current.data[0].title).toBe('Blue Shirt');
  });

  it('useGarmentCount returns count', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 5, error: null }) });
    mockFrom.mockReturnValue(chain);

    const { useGarmentCount } = await import('../useGarments');
    const { result } = renderHook(() => useGarmentCount(), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(5));
  });
});
