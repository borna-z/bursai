import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { supabaseFromMock } = vi.hoisted(() => ({
  supabaseFromMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: supabaseFromMock },
}));

import { useGarmentsByIds } from '../useGarmentsByIds';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useGarmentsByIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled when ids array is empty', () => {
    const { result } = renderHook(() => useGarmentsByIds([]), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it('fetches garments when ids provided', async () => {
    const garments = [
      { id: 'g1', title: 'Shirt', category: 'top', color_primary: 'blue', image_path: 'p1' },
    ];
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: garments, error: null }),
      }),
    });
    const { result } = renderHook(() => useGarmentsByIds(['g1']), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.length).toBe(1));
    expect(result.current.data?.[0].title).toBe('Shirt');
  });

  it('rejects with error when query fails', async () => {
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: null, error: new Error('boom') }),
      }),
    });
    const { result } = renderHook(() => useGarmentsByIds(['g1']), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('cache key is stable regardless of input order', async () => {
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const w = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result: r1 } = renderHook(() => useGarmentsByIds(['b', 'a']), { wrapper: w });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));
    const { result: r2 } = renderHook(() => useGarmentsByIds(['a', 'b']), { wrapper: w });
    expect(r2.current.data).toBeDefined();
  });
});
