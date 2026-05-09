// useSubscription smoke tests — N4.
//
// Covers the matrix the hook gates on:
//   * locked   — no subscription row
//   * trialing — status:'trialing' + future period_end
//   * premium  — status:'active' + plan:'monthly'
//   * boost    — locked row + onboarding_started_at within 24h → trialing
//
// Boundary: the hook reads supabase.from('subscriptions').select(...).eq(user_id).maybeSingle().
// We seed rows via the supabase mock helper and provide useAuth from
// AuthContext via jest.mock.

import { renderHook, waitFor } from '@testing-library/react-native';

import { __resetSupabaseMock, __seedTable } from '../../__mocks__/supabase';
import { makeWrapper } from './testUtils';

jest.mock('../../contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(),
}));

 
const { useAuth } = require('../../contexts/AuthContext') as {
  useAuth: jest.Mock;
};

beforeEach(() => {
  __resetSupabaseMock();
  useAuth.mockReset();
});

describe('useSubscription', () => {
  it('returns locked state when no subscription row exists', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, profile: null });
    const { useSubscription } = require('../useSubscription');
    const { result } = renderHook(() => useSubscription(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state).toBe('locked');
    expect(result.current.isPremium).toBe(false);
  });

  it('returns trialing for an active trial row', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, profile: null });
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    __seedTable('subscriptions', [
      { user_id: 'user-1', plan: 'premium', status: 'trialing', current_period_end: future, garments_count: 5 },
    ]);
    const { useSubscription } = require('../useSubscription');
    const { result } = renderHook(() => useSubscription(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state).toBe('trialing');
    expect(result.current.isTrialing).toBe(true);
    expect(result.current.isPremium).toBe(true);
  });

  it('returns premium for an active monthly RC row', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, profile: null });
    __seedTable('subscriptions', [
      { user_id: 'user-1', plan: 'monthly', status: 'active', current_period_end: null, garments_count: 10 },
    ]);
    const { useSubscription } = require('../useSubscription');
    const { result } = renderHook(() => useSubscription(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state).toBe('premium');
    expect(result.current.isPremium).toBe(true);
    expect(result.current.plan).toBe('monthly');
  });

  it('applies the 24h onboarding-boost bypass over a locked row (edge case)', async () => {
    const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    useAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { onboarding_started_at: startedAt, onboarding_step: 'studio' } as any,
    });
    // No row → would be locked, but boost should override to trialing.
    const { useSubscription } = require('../useSubscription');
    const { result } = renderHook(() => useSubscription(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state).toBe('trialing');
    expect(result.current.isPremium).toBe(true);
  });
});
