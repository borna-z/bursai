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

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
}

function mockChain(data: unknown[] = [], error: unknown = null): MockChain {
  const chain = {} as MockChain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: (data as Record<string, unknown>[])[0] || null, error });
  chain.then = vi.fn((resolve: (val: { data: unknown[]; error: unknown }) => void) => resolve({ data, error }));
  return chain;
}

describe('useSupabaseQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('skips query when no user and requireAuth is true', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    const { useSupabaseQuery } = await import('../useSupabaseQuery');
    const { result } = renderHook(
      () => useSupabaseQuery({ queryKey: ['test'], table: 'garments' }),
      { wrapper }
    );
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches data for authenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    const data = [{ id: '1', user_id: 'user-1', title: 'Item' }];
    const chain = mockChain(data);
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
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    const item = { id: '1', user_id: 'user-1', title: 'Shirt' };
    const chain: MockChain = {} as MockChain;
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
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as ReturnType<typeof useAuth>);
    const schema = z.object({ id: z.string(), title: z.string() });
    const data = [{ id: '1', title: 'Valid', user_id: 'user-1' }];
    const chain: MockChain = {} as MockChain;
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
