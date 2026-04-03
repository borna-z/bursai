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
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('week-outfit-1');
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

  it('rolls back the saved outfit when persistence fails after the parent outfit insert', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        days: [
          {
            date: '2026-03-27',
            occasion: 'work',
            items: [
              { slot: 'top', garment_id: 'top-1' },
              { slot: 'bottom', garment_id: 'bottom-1' },
              { slot: 'shoes', garment_id: 'shoes-1' },
            ],
            explanation: 'Valid look',
          },
        ],
      },
      error: null,
    });

    const insertOutfitMock = vi.fn().mockResolvedValue({ error: null });
    const deleteOutfitEqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteOutfitMock = vi.fn(() => ({ eq: deleteOutfitEqMock }));
    const insertOutfitItemsMock = vi.fn().mockResolvedValue({ error: null });
    const deleteOutfitItemsEqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteOutfitItemsMock = vi.fn(() => ({ eq: deleteOutfitItemsEqMock }));
    const insertPlannedMock = vi.fn().mockResolvedValue({ error: { message: 'planned save failed' } });
    const deletePlannedEqMock = vi.fn().mockResolvedValue({ error: null });
    const deletePlannedMock = vi.fn(() => ({ eq: deletePlannedEqMock }));

    mockFrom.mockImplementation((table: string) => {
      if (table === 'garments') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'top-1', category: 'top', subcategory: 'shirt' },
                { id: 'bottom-1', category: 'bottom', subcategory: 'trousers' },
                { id: 'shoes-1', category: 'shoes', subcategory: 'boots' },
              ],
              error: null,
            }),
          })),
        };
      }

      if (table === 'outfits') {
        return { insert: insertOutfitMock, delete: deleteOutfitMock };
      }

      if (table === 'outfit_items') {
        return { insert: insertOutfitItemsMock, delete: deleteOutfitItemsMock };
      }

      if (table === 'planned_outfits') {
        return { insert: insertPlannedMock, delete: deletePlannedMock };
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

    expect(response?.days[0].error).toBe('Failed to save');
    expect(insertOutfitMock).toHaveBeenCalled();
    expect(insertOutfitItemsMock).toHaveBeenCalled();
    expect(insertPlannedMock).toHaveBeenCalled();
    expect(deletePlannedEqMock).toHaveBeenCalledWith('outfit_id', 'week-outfit-1');
    expect(deleteOutfitItemsEqMock).toHaveBeenCalledWith('outfit_id', 'week-outfit-1');
    expect(deleteOutfitEqMock).toHaveBeenCalledWith('id', 'week-outfit-1');
  });
});
