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

    const validationData = [
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'jeans' },
      { category: 'shoes', subcategory: 'sneakers' },
    ];
    const garments = [
      { id: 'g1', category: 'top' },
      { id: 'g2', category: 'bottom' },
      { id: 'g3', category: 'shoes' },
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
      if (fromCallCount === 3) {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'outfit-1', occasion: 'casual', style_vibe: null }, error: null }),
            }),
          }),
        };
      }
      // outfit_items insert
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

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

  it('rejects incomplete outfit — bottom + shoes + outerwear (no top)', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'bottom', subcategory: 'pants' },
      { category: 'shoes', subcategory: 'sneakers' },
      { category: 'outerwear', subcategory: 'jacket' },
    ];
    // Need top in wardrobe to pass wardrobe validation
    const wardrobeData = [
      { category: 'top', subcategory: 'shirt' },
      ...validationData,
    ];
    const garments = [
      { id: 'g2', category: 'bottom' },
      { id: 'g3', category: 'shoes' },
      { id: 'g4', category: 'outerwear' },
    ];

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: wardrobeData, error: null }),
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
            single: vi.fn().mockResolvedValue({ data: { id: 'o-bad', occasion: 'casual', style_vibe: null }, error: null }),
          }),
        }),
      };
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {
        items: [
          { slot: 'bottom', garment_id: 'g2' },
          { slot: 'shoes', garment_id: 'g3' },
          { slot: 'outerwear', garment_id: 'g4' },
        ],
        explanation: 'Missing top',
        style_score: null,
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/incomplete/i);
    });
  });

  it('returns multiple persisted stylist candidates when requested', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'jeans' },
      { category: 'shoes', subcategory: 'sneakers' },
      { category: 'top', subcategory: 'knit' },
      { category: 'bottom', subcategory: 'trousers' },
      { category: 'shoes', subcategory: 'boots' },
    ];
    const garments = [
      { id: 'g1', category: 'top', subcategory: 'shirt' },
      { id: 'g2', category: 'bottom', subcategory: 'jeans' },
      { id: 'g3', category: 'shoes', subcategory: 'sneakers' },
      { id: 'g4', category: 'top', subcategory: 'knit' },
      { id: 'g5', category: 'bottom', subcategory: 'trousers' },
      { id: 'g6', category: 'shoes', subcategory: 'boots' },
    ];

    const outfitInsert = vi
      .fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'outfit-a', occasion: 'casual', style_vibe: 'Minimal' }, error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'outfit-b', occasion: 'casual', style_vibe: 'Minimal' }, error: null }),
        }),
      });
    const outfitItemsInsert = vi.fn().mockResolvedValue({ error: null });

    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'garments') {
        fromCallCount++;
        if (fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: validationData, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: garments, error: null }),
          }),
        };
      }
      if (table === 'outfits') {
        return { insert: outfitInsert };
      }
      return { insert: outfitItemsInsert };
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {
        suggestions: [
          {
            garment_ids: ['g1', 'g2', 'g3'],
            explanation: 'Minimal weekend look',
            occasion: 'casual',
            family_label: 'classic',
            confidence_score: 0.82,
            confidence_level: 'high',
          },
          {
            garment_ids: ['g4', 'g5', 'g6'],
            explanation: 'Sharper alternative',
            occasion: 'casual',
            family_label: 'elevated',
            confidence_score: 0.77,
            confidence_level: 'medium',
          },
        ],
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });

    let outfits: GeneratedOutfit[] | undefined;
    await act(async () => {
      outfits = await result.current.generateOutfitCandidates({ ...baseRequest, style: 'Minimal', mode: 'stylist' });
    });

    expect(outfits).toHaveLength(2);
    expect(outfits?.[0].id).toBe('outfit-a');
    expect(outfits?.[1].id).toBe('outfit-b');
    expect(outfits?.[0].items.map((item) => item.slot)).toEqual(['top', 'bottom', 'shoes']);
    expect(outfitItemsInsert).toHaveBeenCalledTimes(2);
    expect(outfitInsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ saved: false, style_vibe: 'Minimal' }),
    ]));
  });

});
