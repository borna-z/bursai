import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { signOut: vi.fn() },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1', email: 'test@test.com', user_metadata: { display_name: 'Test' } }, loading: false })),
}));

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
const mockSignOut = supabase.auth.signOut as ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when user is not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as any);
    const { useProfile } = await import('../useProfile');
    const { result } = renderHook(() => useProfile(), { wrapper });
    expect(result.current.data).toBeUndefined();
  });

  it('fetches profile for authenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1', email: 'test@test.com', user_metadata: {} }, loading: false } as any);
    const profileData = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      display_name: 'Test',
      preferences: { onboarding: { completed: true, toured: false, tour_step: 2 } },
    };
    
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: profileData, error: null }),
        }),
      }),
    });

    const { useProfile } = await import('../useProfile');
    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect((result.current.data?.preferences as any)?.onboarding?.tour_step).toBe(2);
    expect((result.current.data?.preferences as any)?.onboarding?.toured).toBe(false);
  });

  it('auto-creates profile when none exists', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1', email: 'test@test.com', user_metadata: {} }, loading: false } as any);
    const newProfile = { id: 'user-1', display_name: 'test', preferences: { onboarding: { completed: false } } };

    const insertSingle = vi.fn().mockResolvedValue({ data: newProfile, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: insertSingle,
        }),
      }),
    });

    const { useProfile } = await import('../useProfile');
    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(insertSingle).toHaveBeenCalled();
  });

  it('handles ghost session (FK error) by signing out', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1', email: 'test@test.com', user_metadata: {} }, loading: false } as any);
    mockSignOut.mockResolvedValue({});

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: '23503', message: 'FK violation' } }),
        }),
      }),
    });

    const { useProfile } = await import('../useProfile');
    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
