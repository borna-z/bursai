import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockUseAuth = vi.fn();
const mockUseProfile = vi.fn();
const mockMutateAsync = vi.fn();
const mockRpc = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('../useProfile', () => ({
  useProfile: (...args: unknown[]) => mockUseProfile(...args),
  useUpdateProfile: vi.fn(() => ({ mutateAsync: mockMutateAsync })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

import { useOnboarding } from '../useOnboarding';

describe('useOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockUseProfile.mockReturnValue({ data: null, isLoading: false });
    mockMutateAsync.mockResolvedValue({});
    mockRpc.mockResolvedValue({ data: { ok: true, from: 'not_started', to: 'completed' }, error: null });
  });

  it('returns safe defaults when profile is null', () => {
    mockUseProfile.mockReturnValue({ data: null, isLoading: false });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.completed).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.needsOnboarding).toBe(true);
  });

  it('reports completed=true when prefs.onboarding.completed is true', () => {
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: true } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.completed).toBe(true);
    expect(result.current.needsOnboarding).toBe(false);
  });

  it('needsOnboarding is false while loading', () => {
    mockUseProfile.mockReturnValue({ data: null, isLoading: true });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.needsOnboarding).toBe(false);
  });

  it('needsOnboarding is false when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseProfile.mockReturnValue({ data: null, isLoading: false });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.needsOnboarding).toBe(false);
  });

  it('completeOnboarding no-ops when profile is missing', async () => {
    mockUseProfile.mockReturnValue({ data: null, isLoading: false });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('completeOnboarding no-ops when user is missing', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseProfile.mockReturnValue({
      data: { preferences: { theme: 'dark', onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('completeOnboarding calls advance_onboarding_step RPC with completed (Wave 7 rollout bridge)', async () => {
    mockUseProfile.mockReturnValue({
      data: { preferences: { theme: 'dark', onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('advance_onboarding_step', {
      p_user_id: 'user-1',
      p_to_step: 'completed',
    });
  });

  it('completeOnboarding writes legacy preferences flag after the RPC succeeds', async () => {
    mockUseProfile.mockReturnValue({
      data: { preferences: { theme: 'dark', onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      preferences: {
        theme: 'dark',
        onboarding: { completed: true },
      },
    });
  });

  it('completeOnboarding swallows raw Postgres 42883 ONLY when profile lacks onboarding_step (pre-migration)', async () => {
    // Pre-migration: profile DOES NOT have the `onboarding_step` key. RPC
    // throws raw Postgres SQLSTATE 42883. The legacy write must still
    // happen so ProtectedRoute's pre-migration fallback can pass the user
    // through on next navigation.
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missingFnError = Object.assign(
      new Error('function advance_onboarding_step(uuid, text) does not exist'),
      { code: '42883' },
    );
    mockRpc.mockResolvedValueOnce({ data: null, error: missingFnError });
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('advance_onboarding_step RPC missing'),
      expect.any(Error),
    );
    consoleWarnSpy.mockRestore();
  });

  it('completeOnboarding swallows PostgREST PGRST202 ONLY when profile lacks onboarding_step (pre-migration)', async () => {
    // Pre-migration via the primary PostgREST path: profile lacks the
    // `onboarding_step` key AND the error code is `PGRST202`. Swallow,
    // write legacy flag, log warning.
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const postgrestMissingError = Object.assign(
      new Error('Could not find the function public.advance_onboarding_step in the schema cache'),
      { code: 'PGRST202' },
    );
    mockRpc.mockResolvedValueOnce({ data: null, error: postgrestMissingError });
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('advance_onboarding_step RPC missing'),
      expect.any(Error),
    );
    consoleWarnSpy.mockRestore();
  });

  it('completeOnboarding RETHROWS PGRST202 when profile already has onboarding_step (post-migration stale schema cache)', async () => {
    // Post-migration scenario flagged by Codex: the column EXISTS on the
    // loaded profile but PostgREST's schema cache is stale and returns
    // PGRST202 for the new RPC. Without this guard we'd swallow + write
    // the legacy flag → split-brain (column='not_started', legacy=true) →
    // ProtectedRoute redirects to /onboarding, Onboarding.tsx Navigates to
    // /, redirect loop. Throwing keeps both states aligned (neither set);
    // user retries; PostgREST cache eventually refreshes.
    const postgrestStaleError = Object.assign(
      new Error('Could not find the function public.advance_onboarding_step in the schema cache'),
      { code: 'PGRST202' },
    );
    mockRpc.mockResolvedValueOnce({ data: null, error: postgrestStaleError });
    mockUseProfile.mockReturnValue({
      data: {
        preferences: { onboarding: { completed: false } },
        onboarding_step: 'not_started',
      },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await expect(result.current.completeOnboarding()).rejects.toThrow(
        'Could not find the function',
      );
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('completeOnboarding RETHROWS 42883 when profile already has onboarding_step (post-migration anomaly)', async () => {
    // Equivalent post-migration sanity check via the raw Postgres path:
    // column exists, error is 42883 (extremely unusual but defensive). Same
    // split-brain risk; same throw policy.
    const missingFnError = Object.assign(
      new Error('function advance_onboarding_step(uuid, text) does not exist'),
      { code: '42883' },
    );
    mockRpc.mockResolvedValueOnce({ data: null, error: missingFnError });
    mockUseProfile.mockReturnValue({
      data: {
        preferences: { onboarding: { completed: false } },
        onboarding_step: 'not_started',
      },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await expect(result.current.completeOnboarding()).rejects.toThrow(
        'function advance_onboarding_step',
      );
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('completeOnboarding rethrows non-42883 RPC errors and skips legacy write (post-migration safety)', async () => {
    // Post-migration scenario: transient network failure or ownership
    // mismatch. Swallowing here would create a split-brain (column not
    // updated, legacy flag set) → ProtectedRoute (column-based) keeps
    // redirecting to /onboarding while Onboarding.tsx (preferences-based)
    // bounces back to /. Throwing keeps the two states aligned: neither
    // is set → user retries.
    const transientError = Object.assign(new Error('network timeout'), {
      code: '08006',
    });
    mockRpc.mockResolvedValueOnce({ data: null, error: transientError });
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await expect(result.current.completeOnboarding()).rejects.toThrow(
        'network timeout',
      );
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('completeOnboarding rethrows when RPC error has no code (defensive — not deploy-window)', async () => {
    // Defensive: an error without a `code` field is not the deploy-window
    // signal. Treat as a real failure.
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error('something else broke'),
    });
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await expect(result.current.completeOnboarding()).rejects.toThrow(
        'something else broke',
      );
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('completeOnboarding tolerates ok:false (no-op) RPC response — duplicate completion is safe', async () => {
    // RPC returns {ok:false, reason:'no_op'} when the user is already at
    // step='completed' (forward-only state machine). Not an error, so the
    // legacy preferences write should still happen for consumers that read
    // the legacy flag.
    mockRpc.mockResolvedValueOnce({ data: { ok: false, reason: 'no_op', current: 'completed', target: 'completed' }, error: null });
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('completeOnboarding works when profile has no preferences object yet', async () => {
    mockUseProfile.mockReturnValue({
      data: { preferences: null },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      preferences: { onboarding: { completed: true } },
    });
  });

  it('Wave 7 P0 audit fix #4: invalidates [profile, userId] cache on successful RPC', async () => {
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['profile', 'user-1'],
    });
  });

  it('Wave 7 P0 audit fix #10: legacy write retries on failure and tolerates final failure', async () => {
    // RPC succeeds, legacy write fails the first 2 attempts and succeeds on the
    // 3rd. completeOnboarding should NOT throw.
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: false } } },
      isLoading: false,
    });
    mockMutateAsync
      .mockRejectedValueOnce(new Error('transient 1'))
      .mockRejectedValueOnce(new Error('transient 2'))
      .mockResolvedValueOnce({});
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(3);
    // Succeeded on retry, no warning emitted.
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('Wave 7 P0 audit fix #10: logs warn but does not throw when all 3 legacy-write attempts fail', async () => {
    // RPC succeeds → step='completed' is canonical. Legacy write fails 3
    // times. Should still resolve (no throw); warn logged.
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: false } } },
      isLoading: false,
    });
    mockMutateAsync
      .mockRejectedValueOnce(new Error('persistent 1'))
      .mockRejectedValueOnce(new Error('persistent 2'))
      .mockRejectedValueOnce(new Error('persistent 3'));
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await result.current.completeOnboarding();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(3);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Legacy preferences.onboarding.completed write failed after retries'),
      expect.any(Error),
    );
    consoleWarnSpy.mockRestore();
  });
});
