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


  it('validates wardrobe — fails for top + bottom without shoes', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ category: 'top', subcategory: null }, { category: 'bottom', subcategory: null }],
          error: null,
        }),
      }),
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/shoes/i);
    });
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
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


  it('rejects top + shoes without bottom before persistence', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: null },
      { category: 'bottom', subcategory: null },
      { category: 'shoes', subcategory: null },
    ];
    const garments = [
      { id: 'g1', category: 'top' },
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
      return {
        insert: vi.fn(() => {
          throw new Error('persist should not be called');
        }),
      };
    });

    vi.mocked(invokeEdgeFunction)
      .mockResolvedValueOnce({
        data: {
          items: [
            { slot: 'top', garment_id: 'g1' },
            { slot: 'shoes', garment_id: 'g3' },
          ],
          explanation: 'invalid',
          style_score: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          error: 'Could not create a complete outfit with your wardrobe',
        },
        error: null,
      });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/complete outfit/i);
    });
  });

  it('rejects bottom + shoes without top before persistence', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: null },
      { category: 'bottom', subcategory: null },
      { category: 'shoes', subcategory: null },
    ];
    const garments = [
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
      return {
        insert: vi.fn(() => {
          throw new Error('persist should not be called');
        }),
      };
    });

    vi.mocked(invokeEdgeFunction)
      .mockResolvedValueOnce({
        data: {
          items: [
            { slot: 'bottom', garment_id: 'g2' },
            { slot: 'shoes', garment_id: 'g3' },
          ],
          explanation: 'invalid',
          style_score: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          error: 'Could not create a complete outfit with your wardrobe',
        },
        error: null,
      });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/complete outfit/i);
    });
  });

  it('returns recovery error when hydrated engine payload is incomplete', async () => {
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

    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/complete outfit/i);
    });
  });

  it('rejects incomplete burs_style_engine single look without legacy fallback', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'jeans' },
      { category: 'shoes', subcategory: 'sneakers' },
    ];
    const garments = [
      { id: 'g1', category: 'top', subcategory: 'shirt' },
      { id: 'g2', category: 'bottom', subcategory: 'jeans' },
      { id: 'g3', category: 'shoes', subcategory: 'sneakers' },
    ];

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
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValueOnce({
      data: {
        items: [
          { slot: 'top', garment_id: 'g1' },
          { slot: 'bottom', garment_id: 'g2' },
        ],
        explanation: 'Engine missed shoes',
        style_score: null,
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });

    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/complete outfit/i);
    });

    expect(mockFrom).not.toHaveBeenCalledWith('outfits');
    expect(vi.mocked(invokeEdgeFunction).mock.calls[0]?.[0]).toBe('burs_style_engine');
    expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledTimes(1);
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

    vi.mocked(invokeEdgeFunction)
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        data: {
          error: 'Could not create a complete outfit with your wardrobe',
        },
        error: null,
      });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/complete outfit/i);
    });
  });


  it('rejects incomplete outfit — top + shoes + outerwear (no bottom)', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const wardrobeData = [
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'pants' },
      { category: 'shoes', subcategory: 'sneakers' },
      { category: 'outerwear', subcategory: 'jacket' },
    ];
    const garments = [
      { id: 'g1', category: 'top', subcategory: 'shirt' },
      { id: 'g3', category: 'shoes', subcategory: 'sneakers' },
      { id: 'g4', category: 'outerwear', subcategory: 'jacket' },
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
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    vi.mocked(invokeEdgeFunction)
      .mockResolvedValueOnce({
        data: {
          items: [
            { slot: 'top', garment_id: 'g1' },
            { slot: 'shoes', garment_id: 'g3' },
            { slot: 'outerwear', garment_id: 'g4' },
          ],
          explanation: 'Fake layered outfit',
          style_score: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          error: 'Could not create a complete outfit with your wardrobe',
        },
        error: null,
      });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/complete outfit/i);
    });
  });

  it('rejects layered outfit with only mid-layer tops and no real base', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const wardrobeData = [
      { category: 'top', subcategory: 'cardigan' },
      { category: 'top', subcategory: 'hoodie' },
      { category: 'bottom', subcategory: 'pants' },
      { category: 'shoes', subcategory: 'boots' },
    ];
    const garments = [
      { id: 'g1', category: 'top', subcategory: 'cardigan' },
      { id: 'g2', category: 'top', subcategory: 'hoodie' },
      { id: 'g3', category: 'bottom', subcategory: 'pants' },
      { id: 'g4', category: 'shoes', subcategory: 'boots' },
    ];

    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'garments') {
        fromCallCount++;
        if (fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: wardrobeData, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: garments, error: null }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    vi.mocked(invokeEdgeFunction)
      .mockResolvedValueOnce({
        data: {
          items: [
            { slot: 'top', garment_id: 'g1' },
            { slot: 'top', garment_id: 'g2' },
            { slot: 'bottom', garment_id: 'g3' },
            { slot: 'shoes', garment_id: 'g4' },
          ],
          explanation: 'No real base layer',
          style_score: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          error: 'Could not create a complete outfit with your wardrobe',
        },
        error: null,
      });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/complete outfit/i);
    });
  });

  it('rejects layered payloads when unified completeness guard fails', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: 't-shirt' },
      { category: 'top', subcategory: 'cardigan' },
      { category: 'bottom', subcategory: 'trousers' },
      { category: 'shoes', subcategory: 'boots' },
      { category: 'outerwear', subcategory: 'coat' },
      { category: 'accessory', subcategory: 'scarf' },
    ];
    const garments = [
      { id: 'g1', category: 'top', subcategory: 't-shirt' },
      { id: 'g2', category: 'top', subcategory: 'cardigan' },
      { id: 'g3', category: 'bottom', subcategory: 'trousers' },
      { id: 'g4', category: 'shoes', subcategory: 'boots' },
      { id: 'g5', category: 'outerwear', subcategory: 'coat' },
      { id: 'g6', category: 'accessory', subcategory: 'scarf' },
    ];

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
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'o-6', occasion: 'casual', style_vibe: null }, error: null }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {
        items: [
          { slot: 'top', garment_id: 'g1' },
          { slot: 'top', garment_id: 'g2' },
          { slot: 'bottom', garment_id: 'g3' },
          { slot: 'shoes', garment_id: 'g4' },
          { slot: 'outerwear', garment_id: 'g5' },
          { slot: 'accessory', garment_id: 'g6' },
        ],
        explanation: 'Layered winter look',
        style_score: null,
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });

    await act(async () => {
      await expect(result.current.generateOutfit(baseRequest)).rejects.toThrow(/complete outfit/i);
    });
  });

  it('returns recovery error when no stylist candidate survives strict completeness filtering', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'jeans' },
      { category: 'shoes', subcategory: 'sneakers' },
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'trousers' },
      { category: 'shoes', subcategory: 'boots' },
    ];
    const garments = [
      { id: 'g1', category: 'top', subcategory: 'shirt' },
      { id: 'g2', category: 'bottom', subcategory: 'jeans' },
      { id: 'g3', category: 'shoes', subcategory: 'sneakers' },
      { id: 'g4', category: 'top', subcategory: 'shirt' },
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

    await act(async () => {
      await expect(result.current.generateOutfitCandidates({ ...baseRequest, style: 'Minimal', mode: 'stylist' })).rejects.toThrow(/complete outfit/i);
    });
    expect(outfitItemsInsert).toHaveBeenCalledTimes(0);
  });

  it('raises recovery error when all stylist suggestions are filtered as incomplete', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'jeans' },
      { category: 'shoes', subcategory: 'sneakers' },
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'trousers' },
      { category: 'shoes', subcategory: 'boots' },
    ];
    const garments = [
      { id: 'g1', category: 'top', subcategory: 'shirt' },
      { id: 'g2', category: 'bottom', subcategory: 'jeans' },
      { id: 'g3', category: 'shoes', subcategory: 'sneakers' },
      { id: 'g4', category: 'top', subcategory: 'shirt' },
      { id: 'g5', category: 'bottom', subcategory: 'trousers' },
      { id: 'g6', category: 'shoes', subcategory: 'boots' },
    ];

    const outfitInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'outfit-complete', occasion: 'casual', style_vibe: 'Minimal' }, error: null }),
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
            garment_ids: ['g1', 'g2'],
            explanation: 'Incomplete option',
            occasion: 'casual',
            family_label: 'classic',
          },
          {
            garment_ids: ['g4', 'g5', 'g6'],
            explanation: 'Complete option',
            occasion: 'casual',
            family_label: 'elevated',
          },
        ],
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });

    await act(async () => {
      await expect(result.current.generateOutfitCandidates({ ...baseRequest, style: 'Minimal', mode: 'stylist' })).rejects.toThrow(/complete outfit/i);
    });
    expect(outfitInsert).not.toHaveBeenCalled();
  });


  it('forwards generator mode to burs_style_engine', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: null },
      { category: 'bottom', subcategory: null },
      { category: 'shoes', subcategory: null },
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
              single: vi.fn().mockResolvedValue({ data: { id: 'mode-outfit', occasion: 'casual', style_vibe: null }, error: null }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {
        items: [
          { slot: 'top', garment_id: 'g1' },
          { slot: 'bottom', garment_id: 'g2' },
          { slot: 'shoes', garment_id: 'g3' },
        ],
        explanation: 'Mode aware complete outfit',
        style_score: null,
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });
    await act(async () => {
      await result.current.generateOutfit({ ...baseRequest, mode: 'stylist' });
    });

    expect(invokeEdgeFunction).toHaveBeenCalledWith('burs_style_engine', expect.objectContaining({
      body: expect.objectContaining({
        mode: 'generate',
        generator_mode: 'stylist',
      }),
    }));
  });

  it('falls back to resilient single generation when stylist suggestions hard-fail on insufficiency', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: null },
      { category: 'bottom', subcategory: null },
      { category: 'shoes', subcategory: null },
    ];
    const garments = [
      { id: 'g1', category: 'top' },
      { id: 'g2', category: 'bottom' },
      { id: 'g3', category: 'shoes' },
    ];

    let garmentFetchCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'garments') {
        garmentFetchCount++;
        if (garmentFetchCount === 1) {
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
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'fallback-single', occasion: 'casual', style_vibe: 'Minimal' }, error: null }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    vi.mocked(invokeEdgeFunction)
      .mockResolvedValueOnce({ data: null, error: { message: 'Not enough matching garments' } })
      .mockResolvedValueOnce({
        data: {
          items: [
            { slot: 'top', garment_id: 'g1' },
            { slot: 'bottom', garment_id: 'g2' },
            { slot: 'shoes', garment_id: 'g3' },
          ],
          explanation: 'Fallback complete outfit',
          style_score: null,
        },
        error: null,
      });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });

    let outfits: GeneratedOutfit[] | undefined;
    await act(async () => {
      outfits = await result.current.generateOutfitCandidates({ ...baseRequest, style: 'Minimal', mode: 'stylist' });
    });

    expect(outfits).toHaveLength(1);
    expect(outfits?.[0].id).toBe('fallback-single');
    expect(outfits?.[0].items.map((item) => item.slot)).toEqual(['top', 'bottom', 'shoes']);
    expect(vi.mocked(invokeEdgeFunction).mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      body: expect.objectContaining({ mode: 'suggest', generator_mode: 'stylist' }),
    }));
    expect(vi.mocked(invokeEdgeFunction).mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      body: expect.objectContaining({ mode: 'generate', generator_mode: 'stylist' }),
    }));
  });

  it('forwards prefer_garment_ids to burs_style_engine', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: null },
      { category: 'bottom', subcategory: null },
      { category: 'shoes', subcategory: null },
    ];
    const garments = [
      { id: 'preferred-top', category: 'top' },
      { id: 'g2', category: 'bottom' },
      { id: 'g3', category: 'shoes' },
    ];

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
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'preferred-outfit', occasion: 'casual', style_vibe: null }, error: null }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {
        items: [
          { slot: 'top', garment_id: 'preferred-top' },
          { slot: 'bottom', garment_id: 'g2' },
          { slot: 'shoes', garment_id: 'g3' },
        ],
        explanation: 'Anchored complete outfit',
        style_score: null,
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });

    await act(async () => {
      await result.current.generateOutfit({ ...baseRequest, prefer_garment_ids: ['preferred-top'] });
    });

    expect(invokeEdgeFunction).toHaveBeenCalledWith('burs_style_engine', expect.objectContaining({
      body: expect.objectContaining({
        prefer_garment_ids: ['preferred-top'],
      }),
    }));
  });

  it('does not fall back to generate_outfit when an anchored engine result ignores the preferred garment', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'jeans' },
      { category: 'shoes', subcategory: 'sneakers' },
    ];
    const garments = [
      { id: 'other-top', category: 'top', subcategory: 'shirt' },
      { id: 'g2', category: 'bottom', subcategory: 'jeans' },
      { id: 'g3', category: 'shoes', subcategory: 'sneakers' },
    ];

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
      return {
        insert: vi.fn(() => {
          throw new Error('persist should not be called');
        }),
      };
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {
        items: [
          { slot: 'top', garment_id: 'other-top' },
          { slot: 'bottom', garment_id: 'g2' },
          { slot: 'shoes', garment_id: 'g3' },
        ],
        explanation: 'Complete but unanchored outfit',
        style_score: null,
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });

    await act(async () => {
      await expect(result.current.generateOutfit({
        ...baseRequest,
        prefer_garment_ids: ['preferred-top'],
      })).rejects.toThrow(/selected garment/i);
    });

    expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(invokeEdgeFunction).mock.calls[0]?.[0]).toBe('burs_style_engine');
  });

  it('does not fall back to generate_outfit when an anchored engine result is incomplete', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);

    const validationData = [
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'jeans' },
      { category: 'shoes', subcategory: 'sneakers' },
    ];
    const garments = [
      { id: 'preferred-top', category: 'top', subcategory: 'shirt' },
      { id: 'g2', category: 'bottom', subcategory: 'jeans' },
    ];

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
      return {
        insert: vi.fn(() => {
          throw new Error('persist should not be called');
        }),
      };
    });

    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: {
        items: [
          { slot: 'top', garment_id: 'preferred-top' },
          { slot: 'bottom', garment_id: 'g2' },
        ],
        explanation: 'Incomplete anchored outfit',
        style_score: null,
      },
      error: null,
    });

    const { useOutfitGenerator } = await import('../useOutfitGenerator');
    const { result } = renderHook(() => useOutfitGenerator(), { wrapper });

    await act(async () => {
      await expect(result.current.generateOutfit({
        ...baseRequest,
        prefer_garment_ids: ['preferred-top'],
      })).rejects.toThrow(/selected garment/i);
    });

    expect(vi.mocked(invokeEdgeFunction)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(invokeEdgeFunction).mock.calls[0]?.[0]).toBe('burs_style_engine');
  });

});
