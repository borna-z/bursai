import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSingle = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      insert: mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
      update: mockUpdate.mockReturnValue({
        eq: mockEq.mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) }),
      }),
    })),
    auth: { signOut: mockSignOut },
  },
}));

// Mock auth
const mockUser = { id: 'user-1', email: 'test@test.com', user_metadata: { display_name: 'Test' } };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser, loading: false })),
}));

import { useAuth } from '@/contexts/AuthContext';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when user is not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as any);
    const { useProfile } = await import('../useProfile');
    const { result } = renderHook(() => useProfile(), { wrapper });
    // Query should be disabled, data stays undefined
    expect(result.current.data).toBeUndefined();
  });

  it('fetches profile for authenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, loading: false } as any);
    const profileData = { id: 'user-1', display_name: 'Test', preferences: { onboarding: { completed: true } } };
    mockMaybeSingle.mockResolvedValue({ data: profileData, error: null });

    const { useProfile } = await import('../useProfile');
    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeTruthy();
    expect(result.current.data?.id).toBe('user-1');
  });

  it('auto-creates profile when none exists', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, loading: false } as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const newProfile = { id: 'user-1', display_name: 'Test', preferences: { onboarding: { completed: false } } };
    mockSingle.mockResolvedValue({ data: newProfile, error: null });

    const { useProfile } = await import('../useProfile');
    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInsert).toHaveBeenCalled();
  });

  it('handles ghost session (FK error) by signing out', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, loading: false } as any);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({ data: null, error: { code: '23503', message: 'FK violation' } });
    mockSignOut.mockResolvedValue({});

    const { useProfile } = await import('../useProfile');
    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
