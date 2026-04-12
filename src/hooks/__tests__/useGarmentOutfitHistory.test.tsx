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

import { useGarmentOutfitHistory } from '../useGarmentOutfitHistory';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useGarmentOutfitHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
  });

  it('is disabled when garmentId is undefined', () => {
    const { result } = renderHook(() => useGarmentOutfitHistory(undefined), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is disabled when user is null', () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useGarmentOutfitHistory('g1'), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns empty array when no outfit_items found', async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'outfit_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    const { result } = renderHook(() => useGarmentOutfitHistory('g1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('returns outfits when items reference them', async () => {
    const outfits = [{ id: 'o1', occasion: 'casual', outfit_items: [] }];
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'outfit_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ outfit_id: 'o1' }], error: null }),
          }),
        };
      }
      if (table === 'outfits') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: outfits, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const { result } = renderHook(() => useGarmentOutfitHistory('g1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.length).toBe(1));
    expect(result.current.data?.[0]).toMatchObject({ id: 'o1' });
  });

  it('returns empty when outfit_items query errors', async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'outfit_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: new Error('boom') }),
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    const { result } = renderHook(() => useGarmentOutfitHistory('g1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
