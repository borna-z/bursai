import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { useAuthMock, rpcMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: rpcMock },
}));

import { useIsAdmin } from '../useIsAdmin';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useIsAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled when user is null', () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useIsAdmin(), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns true when rpc returns truthy', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    rpcMock.mockResolvedValue({ data: true, error: null });
    const { result } = renderHook(() => useIsAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBe(true));
    expect(rpcMock).toHaveBeenCalledWith('is_admin', { _user_id: 'user-1' });
  });

  it('returns false when rpc returns false/null', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    rpcMock.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useIsAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(false);
  });
});
