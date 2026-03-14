import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { z } from 'zod';

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

const mockUser = { id: 'user-1' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

import { useAuth } from '@/contexts/AuthContext';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function mockChain(data: any = [], error: any = null) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: data[0] || null, error });
  // For array queries, resolve the chain itself
  chain.then = vi.fn((resolve: any) => resolve({ data, error }));
  return chain;
}

describe('useSupabaseQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('skips query when no user and requireAuth is true', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);
    const { useSupabaseQuery } = await import('../useSupabaseQuery');
    const { result } = renderHook(
      () => useSupabaseQuery({ queryKey: ['test'], table: 'garments' }),
      { wrapper }
    );
    // Query should be disabled
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches data for authenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    const data = [{ id: '1', user_id: 'user-1', title: 'Item' }];
    const chain = mockChain(data);
    // Override: when no .single(), the query resolves with array
    chain.eq = vi.fn().mockResolvedValue({ data, error: null });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const { useSupabaseQuery } = await import('../useSupabaseQuery');
    const { result } = renderHook(
      () => useSupabaseQuery({ queryKey: ['test'], table: 'garments' }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('returns single row when single is true', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    const item = { id: '1', user_id: 'user-1', title: 'Shirt' };
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: item, error: null });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const { useSupabaseQuery } = await import('../useSupabaseQuery');
    const { result } = renderHook(
      () => useSupabaseQuery({ queryKey: ['test'], table: 'garments', single: true }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.data).toBeTruthy());
  });

  it('validates with Zod schema', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    const schema = z.object({ id: z.string(), title: z.string() });
    const data = [{ id: '1', title: 'Valid', user_id: 'user-1' }];
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockResolvedValue({ data, error: null });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const { useSupabaseQuery } = await import('../useSupabaseQuery');
    const { result } = renderHook(
      () => useSupabaseQuery({ queryKey: ['test'], table: 'items', schema }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
