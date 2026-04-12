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
import { useSimilarGarments } from '../useSimilarGarments';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

function mockGarmentsResult(data: unknown[] | null, error: unknown = null) {
  const limit = vi.fn().mockResolvedValue({ data, error });
  const neq = vi.fn().mockReturnValue({ limit });
  const eqCat = vi.fn().mockReturnValue({ neq });
  const eqUser = vi.fn().mockReturnValue({ eq: eqCat });
  const select = vi.fn().mockReturnValue({ eq: eqUser });
  vi.mocked(supabase.from).mockReturnValue({ select } as never);
  return { select, limit };
}

const baseGarment = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'g-current',
  user_id: 'u1',
  category: 'top',
  color_primary: 'black',
  ...over,
});

describe('useSimilarGarments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
  });

  it('returns no data when garment is null', async () => {
    const { result } = renderHook(() => useSimilarGarments(null), { wrapper: createWrapper() });
    // Query is disabled, so it should not fetch.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeUndefined();
  });

  it('returns no data when there is no user', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(
      () => useSimilarGarments(baseGarment() as never),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeUndefined();
  });

  it('fetches and returns up to 4 similar garments', async () => {
    mockGarmentsResult([
      { id: 'a', category: 'top', color_primary: 'red' },
      { id: 'b', category: 'top', color_primary: 'black' },
      { id: 'c', category: 'top', color_primary: 'black' },
      { id: 'd', category: 'top', color_primary: 'green' },
    ]);

    const { result } = renderHook(
      () => useSimilarGarments(baseGarment() as never),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.length).toBe(4);
  });

  it('sorts color matches first', async () => {
    mockGarmentsResult([
      { id: 'red', category: 'top', color_primary: 'red' },
      { id: 'black', category: 'top', color_primary: 'black' },
    ]);

    const { result } = renderHook(
      () => useSimilarGarments(baseGarment() as never),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.[0].id).toBe('black');
  });

  it('returns an empty array when supabase returns null data', async () => {
    mockGarmentsResult(null);
    const { result } = renderHook(
      () => useSimilarGarments(baseGarment() as never),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([]);
  });

  it('surfaces query errors', async () => {
    mockGarmentsResult(null, { message: 'boom' });
    const { result } = renderHook(
      () => useSimilarGarments(baseGarment() as never),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
