import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockUser = { id: 'user-1', email: 'test@test.com' };
const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

async function importHook() {
  const mod = await import('../useWeekGenerator');
  return mod;
}

describe('useWeekGenerator', () => {
  it('does not persist incomplete planned outfits returned by the engine', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        days: [
          {
            date: '2026-03-27',
            occasion: 'work',
            items: [
              { slot: 'top', garment_id: 'top-1' },
              { slot: 'bottom', garment_id: 'bottom-1' },
            ],
            explanation: 'Missing shoes',
          },
        ],
      },
      error: null,
    });

    const insertOutfitMock = vi.fn();
    const insertOutfitItemsMock = vi.fn();
    const insertPlannedMock = vi.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'garments') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'top-1', category: 'top', subcategory: 'shirt' },
                { id: 'bottom-1', category: 'bottom', subcategory: 'trousers' },
              ],
              error: null,
            }),
          })),
        };
      }

      if (table === 'outfits') {
        return { insert: insertOutfitMock };
      }

      if (table === 'outfit_items') {
        return { insert: insertOutfitItemsMock };
      }

      if (table === 'planned_outfits') {
        return { insert: insertPlannedMock };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { useWeekGenerator } = await importHook();
    const { result } = renderHook(() => useWeekGenerator(), { wrapper: createWrapper() });

    let response: Awaited<ReturnType<typeof result.current.generateWeek>> = null;
    await act(async () => {
      response = await result.current.generateWeek([
        {
          date: '2026-03-27',
          occasion: 'work',
          weather: { temperature: 14, precipitation: 'none', wind: 'low' },
        },
      ]);
    });

    expect(response?.days[0].error).toMatch(/incomplete outfit/i);
    expect(insertOutfitMock).not.toHaveBeenCalled();
    expect(insertOutfitItemsMock).not.toHaveBeenCalled();
    expect(insertPlannedMock).not.toHaveBeenCalled();
  });
});
