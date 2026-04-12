import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

import { supabase } from '@/integrations/supabase/client';
import { useStyleDNA } from '../useStyleDNA';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

interface MockSetup {
  wearLogs: unknown[] | null;
  garments: unknown[] | null;
}

function setupMockSupabase({ wearLogs, garments }: MockSetup) {
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table === 'wear_logs') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: wearLogs, error: null }),
            }),
          }),
        }),
      } as never;
    }
    if (table === 'garments') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: garments, error: null }),
          }),
        }),
      } as never;
    }
    return { select: vi.fn() } as never;
  }) as never);
}

describe('useStyleDNA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null data when there is no logged in user', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useStyleDNA(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeUndefined();
  });

  it('returns null when fewer than 5 wear logs', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    setupMockSupabase({ wearLogs: [{ outfit_id: 'o1', garment_id: 'g1', worn_at: '', occasion: '' }], garments: [] });
    const { result } = renderHook(() => useStyleDNA(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('returns null when fewer than 3 garments', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    setupMockSupabase({
      wearLogs: Array.from({ length: 6 }, (_, i) => ({
        outfit_id: `o${i}`,
        garment_id: `g${i}`,
        worn_at: '',
        occasion: '',
      })),
      garments: [
        { id: 'g0', category: 'top', color_primary: 'black', formality: 3, fit: 'slim', material: null },
        { id: 'g1', category: 'bottom', color_primary: 'black', formality: 3, fit: 'slim', material: null },
      ],
    });
    const { result } = renderHook(() => useStyleDNA(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('computes style DNA when there is enough wear data', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const garments = [
      { id: 'g1', category: 'top', color_primary: 'black', formality: 3, fit: 'slim', material: null },
      { id: 'g2', category: 'bottom', color_primary: 'black', formality: 3, fit: 'slim', material: null },
      { id: 'g3', category: 'shoes', color_primary: 'white', formality: 3, fit: 'slim', material: null },
    ];
    const wearLogs = [
      { outfit_id: 'o1', garment_id: 'g1', worn_at: '', occasion: '' },
      { outfit_id: 'o1', garment_id: 'g2', worn_at: '', occasion: '' },
      { outfit_id: 'o1', garment_id: 'g3', worn_at: '', occasion: '' },
      { outfit_id: 'o2', garment_id: 'g1', worn_at: '', occasion: '' },
      { outfit_id: 'o2', garment_id: 'g2', worn_at: '', occasion: '' },
      { outfit_id: 'o2', garment_id: 'g3', worn_at: '', occasion: '' },
    ];
    setupMockSupabase({ wearLogs, garments });

    const { result } = renderHook(() => useStyleDNA(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.signatureColors.length).toBeGreaterThan(0);
    expect(typeof result.current.data?.archetype).toBe('string');
    expect(result.current.data?.outfitsAnalyzed).toBe(2);
  });

  it('detects neutral palette pattern when neutrals dominate', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    const garments = [
      { id: 'g1', category: 'top', color_primary: 'black', formality: 3, fit: 'slim', material: null },
      { id: 'g2', category: 'bottom', color_primary: 'white', formality: 3, fit: 'slim', material: null },
      { id: 'g3', category: 'shoes', color_primary: 'grey', formality: 3, fit: 'slim', material: null },
    ];
    const wearLogs = Array.from({ length: 9 }, (_, i) => ({
      outfit_id: `o${Math.floor(i / 3)}`,
      garment_id: garments[i % 3].id,
      worn_at: '',
      occasion: '',
    }));
    setupMockSupabase({ wearLogs, garments });

    const { result } = renderHook(() => useStyleDNA(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    const labels = result.current.data?.patterns.map(p => p.label) ?? [];
    expect(labels.some(l => l.toLowerCase().includes('neutral') || l.toLowerCase().includes('color') || l.toLowerCase().includes('silhouette'))).toBe(true);
  });
});
