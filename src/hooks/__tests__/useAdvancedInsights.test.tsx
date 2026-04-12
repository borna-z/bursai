import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { useAuthMock, supabaseFromMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  supabaseFromMock: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: supabaseFromMock },
}));

import {
  useSpendingData,
  useOutfitRepeats,
  useWearHeatmap,
  useCategoryBalance,
} from '../useAdvancedInsights';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function eqChain(data: unknown[] | null = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data, error: null }),
        gte: vi.fn().mockResolvedValue({ data, error: null }),
        not: vi.fn().mockResolvedValue({ data, error: null }),
        then: (cb: (v: { data: unknown; error: null }) => unknown) =>
          Promise.resolve({ data, error: null }).then(cb),
      }),
    }),
  };
}

describe('useAdvancedInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
  });

  describe('useSpendingData', () => {
    it('returns null when user has no priced garments', async () => {
      supabaseFromMock.mockReturnValue(eqChain([]));
      const { result } = renderHook(() => useSpendingData('en'), { wrapper: wrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it('computes total value and category breakdown', async () => {
      const garments = [
        { id: 'g1', title: 'Shirt', image_path: 'p1', category: 'top', purchase_price: 100, purchase_currency: 'SEK', wear_count: 5 },
        { id: 'g2', title: 'Pants', image_path: 'p2', category: 'bottom', purchase_price: 200, purchase_currency: 'SEK', wear_count: 2 },
      ];
      supabaseFromMock.mockReturnValue(eqChain(garments));
      const { result } = renderHook(() => useSpendingData('sv'), { wrapper: wrapper() });
      await waitFor(() => expect(result.current.data).toBeTruthy());
      expect(result.current.data?.totalValue).toBe(300);
      expect(result.current.data?.currency).toBe('kr');
      expect(result.current.data?.categoryBreakdown.length).toBe(2);
    });

    it('is disabled when no user', () => {
      useAuthMock.mockReturnValue({ user: null });
      const { result } = renderHook(() => useSpendingData(), { wrapper: wrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useOutfitRepeats', () => {
    it('returns null when no saved outfits', async () => {
      supabaseFromMock.mockReturnValue(eqChain([]));
      const { result } = renderHook(() => useOutfitRepeats(), { wrapper: wrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });
  });

  describe('useWearHeatmap', () => {
    it('produces a 90-day heatmap', async () => {
      const wearChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
      supabaseFromMock.mockReturnValue(wearChain);
      const { result } = renderHook(() => useWearHeatmap(), { wrapper: wrapper() });
      await waitFor(() => expect(result.current.data).toBeTruthy());
      expect(result.current.data?.days.length).toBe(90);
      expect(result.current.data?.consistency).toBe(0);
    });
  });

  describe('useCategoryBalance', () => {
    it('computes percentages by category', async () => {
      supabaseFromMock.mockReturnValue(eqChain([{ category: 'top' }, { category: 'top' }, { category: 'bottom' }]));
      const { result } = renderHook(() => useCategoryBalance(), { wrapper: wrapper() });
      await waitFor(() => expect(result.current.data).toBeTruthy());
      expect(result.current.data?.total).toBe(3);
      expect(result.current.data?.categories[0]).toMatchObject({ name: 'top', count: 2 });
    });
  });
});
