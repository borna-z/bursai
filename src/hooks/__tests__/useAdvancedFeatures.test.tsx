import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { invokeEdgeFunctionMock, useAuthMock, supabaseFromMock } = vi.hoisted(() => ({
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
  supabase: { from: supabaseFromMock },
}));

import {
  useAssessCondition,
  useCloneOutfitDNA,
  useSuggestAccessories,
  useWardrobeGapAnalysis,
  useCostPerWear,
  useSustainabilityScore,
  useStyleEvolution,
} from '../useAdvancedFeatures';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useAdvancedFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
  });

  describe('useCostPerWear', () => {
    it('returns null when missing inputs', () => {
      const { result: r1 } = renderHook(() => useCostPerWear(null, 5));
      const { result: r2 } = renderHook(() => useCostPerWear(100, 0));
      expect(r1.current).toBeNull();
      expect(r2.current).toBeNull();
    });

    it('computes rounded cost-per-wear', () => {
      const { result } = renderHook(() => useCostPerWear(100, 3));
      expect(result.current).toBeCloseTo(33.33, 2);
    });
  });

  describe('useAssessCondition', () => {
    it('invokes edge function and returns data on success', async () => {
      invokeEdgeFunctionMock.mockResolvedValue({
        data: { condition_score: 8, notes: 'good', should_replace: false },
        error: null,
      });
      const { result } = renderHook(() => useAssessCondition(), { wrapper: createWrapper() });
      let returned: { condition_score: number } | undefined;
      await act(async () => {
        returned = await result.current.mutateAsync('garment-1');
      });
      expect(invokeEdgeFunctionMock).toHaveBeenCalledWith(
        'assess_garment_condition',
        { body: { garment_id: 'garment-1' } },
      );
      expect(returned?.condition_score).toBe(8);
    });

    it('throws when edge function returns error', async () => {
      invokeEdgeFunctionMock.mockResolvedValue({ data: null, error: new Error('boom') });
      const { result } = renderHook(() => useAssessCondition(), { wrapper: createWrapper() });
      await expect(result.current.mutateAsync('g1')).rejects.toThrow('boom');
    });
  });

  describe('useCloneOutfitDNA / useSuggestAccessories / useWardrobeGapAnalysis', () => {
    it('clone outfit DNA happy path', async () => {
      invokeEdgeFunctionMock.mockResolvedValue({ data: { variations: [] }, error: null });
      const { result } = renderHook(() => useCloneOutfitDNA(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync('o1');
      });
      expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('clone_outfit_dna', { body: { outfit_id: 'o1' } });
    });

    it('suggest accessories surfaces data.error as a thrown Error', async () => {
      invokeEdgeFunctionMock.mockResolvedValue({ data: { error: 'no outfit' }, error: null });
      const { result } = renderHook(() => useSuggestAccessories(), { wrapper: createWrapper() });
      await expect(result.current.mutateAsync('o1')).rejects.toThrow('no outfit');
    });

    it('wardrobe gap analysis defaults locale to en', async () => {
      invokeEdgeFunctionMock.mockResolvedValue({ data: { gaps: [] }, error: null });
      const { result } = renderHook(() => useWardrobeGapAnalysis(), { wrapper: createWrapper() });
      await act(async () => {
        await result.current.mutateAsync(undefined);
      });
      expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('wardrobe_gap_analysis', { body: { locale: 'en' } });
    });
  });

  describe('useSustainabilityScore', () => {
    it('is disabled when not authenticated', () => {
      useAuthMock.mockReturnValue({ user: null });
      const { result } = renderHook(() => useSustainabilityScore(), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('computes a score from garments + wear logs', async () => {
      const garments = [
        { id: 'g1', wear_count: 5, last_worn_at: new Date().toISOString(), created_at: '2025-01-01' },
        { id: 'g2', wear_count: 0, last_worn_at: null, created_at: '2025-01-01' },
      ];
      const wearLogs = [{ garment_id: 'g1', worn_at: new Date().toISOString().split('T')[0] }];

      supabaseFromMock.mockImplementation((table: string) => {
        if (table === 'garments') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: garments, error: null }) }) };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: wearLogs, error: null }),
            }),
          }),
        };
      });

      const { result } = renderHook(() => useSustainabilityScore(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.data).toBeTruthy());
      expect(result.current.data?.totalGarments).toBe(2);
    });
  });

  describe('useStyleEvolution', () => {
    it('returns null when no wear logs', async () => {
      supabaseFromMock.mockImplementation((table: string) => {
        if (table === 'wear_logs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      });

      const { result } = renderHook(() => useStyleEvolution(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });
  });
});
