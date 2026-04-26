import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockUseAuth = vi.fn();
const mockUseProfile = vi.fn();
const mockMutateAsync = vi.fn();
const mockRpc = vi.fn();

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

  it('completeOnboarding throws + skips legacy write when RPC errors out', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('rpc failed') });
    mockUseProfile.mockReturnValue({
      data: { preferences: { onboarding: { completed: false } } },
      isLoading: false,
    });
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {
      await expect(result.current.completeOnboarding()).rejects.toThrow('rpc failed');
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
});
