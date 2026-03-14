import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: vi.fn(),
}));

const mockUser = { id: 'user-1' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const baseRequest = {
  occasion: 'casual',
  weather: { precipitation: 'none', wind: 'light' },
};

describe('useOutfitGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('throws when user is not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);
    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow();
  });

  it('validates wardrobe has required categories', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    // Only tops, no bottoms/shoes
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [{ category: 'top' }], error: null }),
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn() }) }),
    };
    mockFrom.mockReturnValue(chain);

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/garments/i);
    });
  });

  it('returns generated outfit on success', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);

    const garments = [
      { id: 'g1', category: 'top' },
      { id: 'g2', category: 'bottom' },
      { id: 'g3', category: 'shoes' },
    ];

    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockImplementation((_col: string, vals: string[]) => {
      // Validation query returns categories
      if (vals.includes('top')) {
        return Promise.resolve({ data: garments.map(g => ({ category: g.category })), error: null });
      }
      // Garment fetch query
      return Promise.resolve({ data: garments, error: null });
    });
    chain.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'outfit-1', occasion: 'casual', style_vibe: null }, error: null }),
      }),
    });
    mockFrom.mockReturnValue(chain);

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {
        items: [
          { slot: 'top', garment_id: 'g1' },
          { slot: 'bottom', garment_id: 'g2' },
          { slot: 'shoes', garment_id: 'g3' },
        ],
        explanation: 'Great casual look',
        style_score: { overall: 85 },
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });

    let outfit: any;
    await act(async () => {
      outfit = await result.current.generateOutfit(baseRequest);
    });
    expect(outfit.id).toBe('outfit-1');
    expect(outfit.items.length).toBe(3);
  });
});
