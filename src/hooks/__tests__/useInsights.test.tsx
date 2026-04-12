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

import { useInsights } from '../useInsights';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
  });

  it('is disabled when not authenticated', () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useInsights(), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('aggregates wear count and usage rate from logs', async () => {
    const garments = [
      { id: 'g1', color_primary: 'blue', category: 'top' },
      { id: 'g2', color_primary: 'red', category: 'bottom' },
      { id: 'g3', color_primary: 'svart', category: 'shoes' },
    ];
    const wearLogs = [
      { garment_id: 'g1', worn_at: '2026-04-01' },
      { garment_id: 'g1', worn_at: '2026-04-02' },
      { garment_id: 'g2', worn_at: '2026-04-03' },
    ];

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'garments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: garments, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: wearLogs, error: null }),
          }),
        }),
      };
    });

    const { result } = renderHook(() => useInsights(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data?.totalGarments).toBe(3);
    expect(result.current.data?.garmentsUsedLast30Days).toBe(2);
    expect(result.current.data?.usageRate).toBe(67);
    expect(result.current.data?.unusedGarments).toHaveLength(1);
    expect(result.current.data?.topFiveWorn[0].id).toBe('g1');
  });

  it('classifies color temperature', async () => {
    const garments = [
      { id: 'g1', color_primary: 'red', category: 'top' },
      { id: 'g2', color_primary: 'orange', category: 'top' },
      { id: 'g3', color_primary: 'svart', category: 'top' },
    ];
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'garments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: garments, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    const { result } = renderHook(() => useInsights(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data?.colorTemperature.dominantPalette).toBe('warm');
    expect(result.current.data?.colorTemperature.warmCount).toBe(2);
    expect(result.current.data?.colorTemperature.neutralCount).toBe(1);
  });

  it('throws when garments query errors', async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'garments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: new Error('boom') }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });
    const { result } = renderHook(() => useInsights(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
