// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively.
// N10 hygiene marker: tests AuthContext including the start_trial Stripe auto-mint flow.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock supabase — declare mocks before vi.mock so hoisting works
vi.mock('@/integrations/supabase/client', () => {
  const mockOnAuthStateChange = vi.fn();
  const mockGetSession = vi.fn();
  const mockSignUp = vi.fn();
  const mockSignInWithPassword = vi.fn();
  const mockSignOut = vi.fn();
  return {
    supabase: {
      auth: {
        onAuthStateChange: mockOnAuthStateChange,
        getSession: mockGetSession,
        signUp: mockSignUp,
        signInWithPassword: mockSignInWithPassword,
        signOut: mockSignOut,
      },
    },
  };
});

import { supabase } from '@/integrations/supabase/client';
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as ReturnType<typeof vi.fn>;
const mockGetSession = supabase.auth.getSession as ReturnType<typeof vi.fn>;
const mockSignUp = supabase.auth.signUp as ReturnType<typeof vi.fn>;
const mockSignInWithPassword = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>;
const mockSignOut = supabase.auth.signOut as ReturnType<typeof vi.fn>;

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Wave 8 P52 — AuthProvider now uses useQueryClient (to invalidate the
// subscription cache after start_trial succeeds), so the test wrapper
// must include a QueryClientProvider.
const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};
const wrapper = makeWrapper();

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });
  });

  it('starts with loading true and no user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('sets user from existing session', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    const mockSession = { user: mockUser };

    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.loading).toBe(false);
    });
  });

  it('throws when useAuth is used outside provider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('signIn calls supabase signInWithPassword', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const res = await result.current.signIn('test@test.com', 'password123');
      expect(res.error).toBeNull();
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password123',
    });
  });

  it('signOut calls supabase signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('signUp passes display name in metadata', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signUp('test@test.com', 'pass123', 'Test User');
    });

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@test.com',
        password: 'pass123',
        options: expect.objectContaining({
          // Wave 8 P52 — display_name preserved + trial_pending: true
          // signal added for the start_trial auto-mint flow.
          data: { display_name: 'Test User', trial_pending: true },
        }),
      })
    );
  });

  it('signOut clears local state even when server returns an error', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    const mockSession = { user: mockUser };

    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockSignOut.mockResolvedValue({ error: new Error('Session not found') });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    await act(async () => {
      await result.current.signOut();
    });

    // User and session should be cleared even though server errored
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it('signUp without display name does not include data in options', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signUp('test@test.com', 'pass123');
    });

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          // Wave 8 P52 — even without a display name, trial_pending: true
          // is set so the start_trial auto-mint flow knows this is a fresh
          // signup.
          data: { trial_pending: true },
        }),
      })
    );
  });

  it('keeps an existing session even when remember_me is false and sessionStorage is empty', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    const mockSession = { user: mockUser };

    localStorage.setItem('remember_me', 'false');
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.loading).toBe(false);
    });

    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
