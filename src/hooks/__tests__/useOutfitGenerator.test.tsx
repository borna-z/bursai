import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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
import type { GeneratedOutfit } from '../useOutfitGenerator';

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
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow();
    });
  });

  it('validates wardrobe — fails when neither path exists (only tops)', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn() }) }),
    };
    // First call (validation) returns only a sweater — no bottom/shoes/dress
    let selectCallCount = 0;
    chain.eq.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return Promise.resolve({ data: [{ category: 'top', subcategory: 'sweater' }], error: null });
      }
      return chain;
    });
    mockFrom.mockReturnValue(chain);

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/garments/i);
    });
  });

  it('validates wardrobe — passes for top + bottom + shoes', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [{ category: 'top', subcategory: null }, { category: 'bottom', subcategory: null }, { category: 'shoes', subcategory: null }];
    const garments = [
      { id: 'g1', category: 'top' },
      { id: 'g2', category: 'bottom' },
      { id: 'g3', category: 'shoes' },
    ];

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // validation query: .select('category, subcategory').eq('user_id', ...)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: validationData, error: null }),
          }),
        };
      }
      if (fromCallCount === 2) {
        // garment fetch by ids
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: garments, error: null }),
          }),
        };
      }
      // outfit insert
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'o-1', occasion: 'casual', style_vibe: null }, error: null }),
          }),
        }),
      };
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {
        items: [
          { slot: 'top', garment_id: 'g1' },
          { slot: 'bottom', garment_id: 'g2' },
          { slot: 'shoes', garment_id: 'g3' },
        ],
        explanation: 'Nice',
        style_score: null,
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    let outfit: GeneratedOutfit | undefined;
    await act(async () => {
      outfit = await result.current.generateOutfit(baseRequest);
    });
    expect(outfit!.id).toBe('o-1');
  });

  it('validates wardrobe — passes for dress + shoes', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [{ category: 'dress', subcategory: null }, { category: 'shoes', subcategory: 'sneakers' }];
    const garments = [
      { id: 'g-d', category: 'dress' },
      { id: 'g-s', category: 'shoes' },
    ];

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: validationData, error: null }),
          }),
        };
      }
      if (fromCallCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: garments, error: null }),
          }),
        };
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'o-2', occasion: 'casual', style_vibe: null }, error: null }),
          }),
        }),
      };
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {
        items: [
          { slot: 'dress', garment_id: 'g-d' },
          { slot: 'shoes', garment_id: 'g-s' },
        ],
        explanation: 'Dress look',
        style_score: null,
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    let outfit: GeneratedOutfit | undefined;
    await act(async () => {
      outfit = await result.current.generateOutfit(baseRequest);
    });
    expect(outfit!.id).toBe('o-2');
    expect(outfit!.items.length).toBe(2);
  });

  it('returns generated outfit on success', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const garments = [
      { id: 'g1', category: 'top' },
      { id: 'g2', category: 'bottom' },
      { id: 'g3', category: 'shoes' },
    ];

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockImplementation((_col: string, vals: string[]) => {
        if (vals.includes('top')) {
          return Promise.resolve({ data: garments.map(g => ({ category: g.category })), error: null });
        }
        return Promise.resolve({ data: garments, error: null });
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'outfit-1', occasion: 'casual', style_vibe: null }, error: null }),
        }),
      }),
    };
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

    let outfit: GeneratedOutfit | undefined;
    await act(async () => {
      outfit = await result.current.generateOutfit(baseRequest);
    });
    expect(outfit!.id).toBe('outfit-1');
    expect(outfit!.items.length).toBe(3);
  });
});
