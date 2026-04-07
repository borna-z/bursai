import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const {
  invokeEdgeFunctionMock,
  useAuthMock,
  supabaseFromMock,
} = vi.hoisted(() => ({
  invokeEdgeFunctionMock: vi.fn(),
  useAuthMock: vi.fn(),
  supabaseFromMock: vi.fn(),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

import { useInsightsDashboard } from '../useInsightsDashboard';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

function createEqResolvedChain(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  };
}

function createEqGteResolvedChain(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  };
}

function createEqOrderLimitResolvedChain(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  };
}

describe('useInsightsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      user: { id: 'user-1' },
    });
  });

  it('falls back to direct queries and still classifies Swedish colors correctly', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({
      data: null,
      error: new Error('edge down'),
    });

    const garmentsChain = createEqResolvedChain([
      {
        id: 'garment-1',
        title: 'Blue Shirt',
        category: 'top',
        subcategory: null,
        color_primary: 'blå',
        color_secondary: null,
        material: null,
        fit: null,
        formality: 2,
        season_tags: ['spring'],
        wear_count: 3,
        last_worn_at: '2026-03-20',
        created_at: '2026-01-10',
        image_path: null,
        purchase_price: null,
        purchase_currency: null,
      },
      {
        id: 'garment-2',
        title: 'Black Trousers',
        category: 'bottom',
        subcategory: null,
        color_primary: 'svart',
        color_secondary: null,
        material: null,
        fit: null,
        formality: 2,
        season_tags: ['spring'],
        wear_count: 2,
        last_worn_at: '2026-03-18',
        created_at: '2026-01-12',
        image_path: null,
        purchase_price: null,
        purchase_currency: null,
      },
      {
        id: 'garment-3',
        title: 'Grey Blazer',
        category: 'outerwear',
        subcategory: null,
        color_primary: 'grå',
        color_secondary: null,
        material: null,
        fit: null,
        formality: 4,
        season_tags: ['spring'],
        wear_count: 1,
        last_worn_at: '2026-03-15',
        created_at: '2026-01-08',
        image_path: null,
        purchase_price: null,
        purchase_currency: null,
      },
    ]);

    const wearLogsRangeChain = createEqGteResolvedChain([
      {
        garment_id: 'garment-1',
        outfit_id: 'outfit-1',
        worn_at: '2026-03-20',
        occasion: 'casual',
      },
      {
        garment_id: 'garment-2',
        outfit_id: 'outfit-1',
        worn_at: '2026-03-20',
        occasion: 'casual',
      },
      {
        garment_id: 'garment-3',
        outfit_id: 'outfit-1',
        worn_at: '2026-03-20',
        occasion: 'casual',
      },
      {
        garment_id: 'garment-1',
        outfit_id: 'outfit-2',
        worn_at: '2026-03-22',
        occasion: 'casual',
      },
      {
        garment_id: 'garment-2',
        outfit_id: 'outfit-2',
        worn_at: '2026-03-22',
        occasion: 'casual',
      },
    ]);

    const wearLogsRecentChain = createEqOrderLimitResolvedChain([
      {
        garment_id: 'garment-1',
        outfit_id: 'outfit-2',
        worn_at: '2026-03-22',
        occasion: 'casual',
      },
      {
        garment_id: 'garment-2',
        outfit_id: 'outfit-2',
        worn_at: '2026-03-22',
        occasion: 'casual',
      },
      {
        garment_id: 'garment-3',
        outfit_id: 'outfit-1',
        worn_at: '2026-03-20',
        occasion: 'smart',
      },
      {
        garment_id: 'garment-1',
        outfit_id: 'outfit-1',
        worn_at: '2026-03-20',
        occasion: 'smart',
      },
      {
        garment_id: 'garment-2',
        outfit_id: 'outfit-1',
        worn_at: '2026-03-20',
        occasion: 'smart',
      },
    ]);

    const outfitsChain = createEqResolvedChain([
      {
        id: 'outfit-1',
        occasion: 'casual',
        generated_at: '2026-03-20T10:00:00.000Z',
        saved: true,
        worn_at: '2026-03-20',
      },
    ]);

    const plannedOutfitsChain = createEqGteResolvedChain([]);

    let wearLogsCalls = 0;

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'garments') return garmentsChain;
      if (table === 'wear_logs') {
        wearLogsCalls += 1;
        return wearLogsCalls === 1 ? wearLogsRangeChain : wearLogsRecentChain;
      }
      if (table === 'outfits') return outfitsChain;
      if (table === 'planned_outfits') return plannedOutfitsChain;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInsightsDashboard(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeTruthy());

    expect(result.current.data?.wardrobeHealth.colorTemperature).toMatchObject({
      coolCount: 1,
      neutralCount: 2,
      dominantPalette: 'cool',
    });
  });
});
