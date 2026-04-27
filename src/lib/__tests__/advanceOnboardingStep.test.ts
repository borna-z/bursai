import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { advanceOnboardingStep } from '../advanceOnboardingStep';

describe('advanceOnboardingStep (Wave 7 P42 RPC wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls supabase.rpc with the correct function name and arg shape', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, from: 'quiz', to: 'photo_tutorial' },
      error: null,
    });
    await advanceOnboardingStep('user-1', 'photo_tutorial');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('advance_onboarding_step', {
      p_user_id: 'user-1',
      p_to_step: 'photo_tutorial',
    });
  });

  it('returns the parsed jsonb result on a successful forward transition', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, from: 'not_started', to: 'completed' },
      error: null,
    });
    const result = await advanceOnboardingStep('user-1', 'completed');
    expect(result).toEqual({ ok: true, from: 'not_started', to: 'completed' });
  });

  it('returns ok:false on a no-op transition without throwing', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: false, reason: 'no_op', current: 'completed', target: 'completed' },
      error: null,
    });
    const result = await advanceOnboardingStep('user-1', 'completed');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_op');
  });

  it('returns ok:false on a backwards transition without throwing', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: false, reason: 'backwards', current: 'photo_tutorial', target: 'quiz' },
      error: null,
    });
    const result = await advanceOnboardingStep('user-1', 'quiz');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('backwards');
  });

  it('throws when the RPC returns an error (Postgres exception, network failure)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error('insufficient_privilege'),
    });
    await expect(advanceOnboardingStep('user-1', 'completed')).rejects.toThrow(
      'insufficient_privilege',
    );
  });

  it('returns a safe ok:false default when RPC returns null data without error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const result = await advanceOnboardingStep('user-1', 'completed');
    expect(result).toEqual({ ok: false });
  });

  it('Wave 7 P0 audit fix #4: invalidates the [profile, userId] cache on RPC success', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, from: 'not_started', to: 'language' },
      error: null,
    });
    const invalidateQueries = vi.fn();
    // Minimal QueryClient stub — only invalidateQueries is exercised by the wrapper.
    const queryClient = { invalidateQueries } as unknown as Parameters<
      typeof advanceOnboardingStep
    >[2];
    await advanceOnboardingStep('user-1', 'language', queryClient);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile', 'user-1'] });
  });

  it('Wave 7 P0 audit fix #4: does NOT invalidate cache when RPC throws (error path stays clean)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error('boom'),
    });
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as Parameters<
      typeof advanceOnboardingStep
    >[2];
    await expect(advanceOnboardingStep('user-1', 'language', queryClient)).rejects.toThrow(
      'boom',
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('Wave 7 P0 audit fix #4: skips invalidation when no queryClient is passed (back-compat)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, from: 'not_started', to: 'language' },
      error: null,
    });
    // Should not throw — back-compat for callers that haven't been updated yet.
    await expect(advanceOnboardingStep('user-1', 'language')).resolves.toBeDefined();
  });
});
