// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively.
// N10 hygiene marker: tests for the web-only useSubscription hook backed by Stripe webhooks.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Codex P1 round 5 on PR #700 — useSubscription now reads useProfile to
// detect the onboarding-boost bypass window (mirrors backend
// resolveUserPlan). Default mock returns no profile so existing tests
// that pre-date the bypass keep their original derivation. Tests that
// exercise the bypass call mockOnboardingProfile directly.
vi.mock('@/hooks/useProfile', () => ({
  useProfile: vi.fn(),
}));

import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

function mockSupabaseSubscription(data: object | null) {
  const mockSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  });
  vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);
}

function mockAuthUser(id = 'user-1', email = 'test@test.com') {
  vi.mocked(useAuth).mockReturnValue({
    user: { id, email } as any,
    session: {} as any,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
}

function mockAuthGuest() {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
}

function mockOnboardingProfile(opts: {
  startedMsAgo?: number;
  step?: string | null;
} = {}) {
  const startedMsAgo = opts.startedMsAgo ?? 1_000; // 1s ago by default
  const step = opts.step === undefined ? 'language' : opts.step;
  vi.mocked(useProfile).mockReturnValue({
    data: {
      id: 'user-1',
      onboarding_started_at: new Date(Date.now() - startedMsAgo).toISOString(),
      onboarding_step: step,
    },
    isLoading: false,
  } as any);
}

function mockNoProfile() {
  vi.mocked(useProfile).mockReturnValue({ data: null, isLoading: false } as any);
}

const baseSubscription = {
  id: 'sub-1',
  user_id: 'user-1',
  stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_stripe_1',
  stripe_mode: 'live',
  price_id: 'price_1',
  garments_count: 0,
  current_period_end: new Date(Date.now() + 86400000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no profile → no onboarding bypass → existing tests keep
    // their original deriveState behavior.
    mockNoProfile();
  });

  it('exposes only the premium tier in PLAN_LIMITS (free tier dropped in P53)', () => {
    expect(PLAN_LIMITS.premium.maxGarments).toBe(Infinity);
    expect(PLAN_LIMITS.premium.maxOutfitsPerMonth).toBe(Infinity);
    // The `free` key should no longer exist on PLAN_LIMITS.
    expect((PLAN_LIMITS as Record<string, unknown>).free).toBeUndefined();
  });

  it('returns locked state when no user is logged in', () => {
    mockAuthGuest();

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    expect(result.current.subscription).toBeUndefined();
    expect(result.current.state).toBe('locked');
    expect(result.current.isPremium).toBe(false);
    // Both gating helpers deny in locked state.
    expect(result.current.canAddGarment()).toBe(false);
    expect(result.current.canCreateOutfit()).toBe(false);
    expect(result.current.remainingGarments()).toBe(0);
    expect(result.current.remainingOutfits()).toBe(0);
  });

  it('returns locked state when there is no subscription row', async () => {
    mockAuthUser();
    mockSupabaseSubscription(null);

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscription).toBeNull();
    expect(result.current.state).toBe('locked');
    expect(result.current.isPremium).toBe(false);
    expect(result.current.canAddGarment()).toBe(false);
    expect(result.current.canCreateOutfit()).toBe(false);
  });

  it('treats status="trialing" as the trialing state (isPremium=true)', async () => {
    mockAuthUser();
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'premium',
      status: 'trialing',
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.state).toBe('trialing');
    expect(result.current.isPremium).toBe(true);
    expect(result.current.canAddGarment()).toBe(true);
    expect(result.current.canCreateOutfit()).toBe(true);
    expect(result.current.remainingGarments()).toBe(Infinity);
    expect(result.current.remainingOutfits()).toBe(Infinity);
  });

  it('treats status="trialing" with past current_period_end as locked (Codex P2 round 1)', async () => {
    // Mirrors backend `enforceSubscription` behavior: a trialing row whose
    // `current_period_end` is in the past is denied with `reason:'expired'`,
    // even before the Stripe webhook transitions `status` to canceled. Frontend
    // must show 'locked' here so the UI doesn't render unlocked actions while
    // the API returns 402 (the "allowed in UI, blocked by backend" trap that
    // motivated this fix).
    mockAuthUser();
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'premium',
      status: 'trialing',
      // 1 hour in the past — backend would return 402 for this row.
      current_period_end: new Date(Date.now() - 3600_000).toISOString(),
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.state).toBe('locked');
    expect(result.current.isPremium).toBe(false);
    expect(result.current.canAddGarment()).toBe(false);
    expect(result.current.canCreateOutfit()).toBe(false);
  });

  it('treats status="trialing" with null current_period_end as trialing (webhook-lag tolerance)', async () => {
    // Backend `enforceSubscription` allows trialing with null `current_period_end`
    // (the brief window between Stripe trial mint and the first webhook write).
    // Frontend mirrors so the trialing UX isn't broken during that window.
    mockAuthUser();
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'premium',
      status: 'trialing',
      current_period_end: null,
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.state).toBe('trialing');
    expect(result.current.isPremium).toBe(true);
  });

  it('treats status="active" + plan="premium" as the premium state', async () => {
    mockAuthUser();
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'premium',
      status: 'active',
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.state).toBe('premium');
    expect(result.current.isPremium).toBe(true);
    expect(result.current.canAddGarment()).toBe(true);
    expect(result.current.canCreateOutfit()).toBe(true);
    expect(result.current.remainingGarments()).toBe(Infinity);
    expect(result.current.remainingOutfits()).toBe(Infinity);
  });

  it('treats legacy status="active" + plan="free" as locked', async () => {
    mockAuthUser();
    // This is the row shape `handle_new_user` writes server-side for fresh
    // users before `start_trial` upserts to premium. Until P54's backend
    // gates fire, frontend treats this row as locked.
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'free',
      status: 'active',
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.state).toBe('locked');
    expect(result.current.isPremium).toBe(false);
    expect(result.current.canAddGarment()).toBe(false);
    expect(result.current.canCreateOutfit()).toBe(false);
  });

  it('treats status="canceled" + plan="premium" as locked', async () => {
    mockAuthUser();
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'premium',
      status: 'canceled',
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.state).toBe('locked');
    expect(result.current.isPremium).toBe(false);
  });

  it('treats status="past_due" as locked', async () => {
    mockAuthUser();
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'premium',
      status: 'past_due',
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.state).toBe('locked');
    expect(result.current.isPremium).toBe(false);
    expect(result.current.canAddGarment()).toBe(false);
    expect(result.current.canCreateOutfit()).toBe(false);
  });

  it('treats trialing with current_period_end exactly == Date.now() as locked (Codex P2 round 3 boundary fix)', async () => {
    // Backend `enforceSubscription` allows when `periodEndMs > Date.now()`
    // (strictly future). Frontend MUST use `<= Date.now()` to mirror — at
    // the exact-instant tick (periodEnd === Date.now()), backend returns
    // 402 with reason='expired'; frontend must show 'locked' so the UI
    // doesn't claim trialing while every API call fails. Without this fix
    // there's a 1-ms window of "UI allowed, backend blocked" inconsistency.
    const fixedNow = 1740000000000;
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    mockAuthUser();
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'premium',
      status: 'trialing',
      current_period_end: new Date(fixedNow).toISOString(),
    });

    try {
      const { result } = renderHook(() => useSubscription(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

      expect(result.current.state).toBe('locked');
      expect(result.current.paywallReason).toBe('trial_expired');
      expect(result.current.isPremium).toBe(false);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('paywallReason returns "trial_expired" when trialing past current_period_end (Codex P2 round 2)', async () => {
    // Mirrors backend `enforceSubscription` denial reason for expired trials.
    // Used by PaywallModal callers to show "Your trial has ended" copy
    // distinct from generic "Subscribe to continue".
    mockAuthUser();
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'premium',
      status: 'trialing',
      current_period_end: new Date(Date.now() - 3600_000).toISOString(),
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.paywallReason).toBe('trial_expired');
    // State is 'locked' (not 'trialing') because deriveState also detects expiry.
    expect(result.current.state).toBe('locked');
  });

  it('paywallReason returns "subscription_required" for canceled premium', async () => {
    mockAuthUser();
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'premium',
      status: 'canceled',
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.paywallReason).toBe('subscription_required');
    expect(result.current.state).toBe('locked');
  });

  it('paywallReason returns "subscription_required" when no subscription row exists', async () => {
    mockAuthUser();
    mockSupabaseSubscription(null);

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.paywallReason).toBe('subscription_required');
  });

  it('onboarding-boost user with active+free subscription is treated as trialing (Codex P1 round 5)', async () => {
    // The signup race window: handle_new_user trigger creates
    // {plan:'free', status:'active'} BEFORE start_trial upserts to
    // {plan:'premium', status:'trialing'}. Without the onboarding
    // bypass, the frontend would lock these users out (showing paywalls,
    // blocking onboarding actions) while the backend explicitly allows
    // them via resolveUserPlan's 'onboarding' short-circuit.
    mockAuthUser();
    mockOnboardingProfile({ startedMsAgo: 60_000 }); // 1 min ago
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'free',
      status: 'active',
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.state).toBe('trialing');
    expect(result.current.isPremium).toBe(true);
    expect(result.current.canAddGarment()).toBe(true);
    expect(result.current.canCreateOutfit()).toBe(true);
  });

  it('onboarding-boost user with no subscription row is treated as trialing', async () => {
    // Edge: trigger fires AFTER profile is created but BEFORE the
    // subscriptions row insert lands (race within the trigger). Frontend
    // shouldn't lock the user out while they're still in onboarding.
    mockAuthUser();
    mockOnboardingProfile({ startedMsAgo: 5_000 });
    mockSupabaseSubscription(null);

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.state).toBe('trialing');
    expect(result.current.isPremium).toBe(true);
    expect(result.current.canAddGarment()).toBe(true);
  });

  it('completed-onboarding user falls back to subscription-row derivation', async () => {
    // Once onboarding_step === 'completed', the bypass closes and the
    // subscription row alone determines state. Mirrors backend exit from
    // the onboarding plan.
    mockAuthUser();
    mockOnboardingProfile({ startedMsAgo: 60_000, step: 'completed' });
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'free',
      status: 'active',
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.state).toBe('locked');
    expect(result.current.isPremium).toBe(false);
  });

  it('onboarding-boost expires after 24h window (mirrors backend ONBOARDING_BOOST_WINDOW_MS)', async () => {
    // 25h ago — outside the boost window. Bypass should NOT fire even
    // though step is still pre-completion. User falls back to active+free
    // → locked. Mirrors backend `Date.now() - startedMs < 24h` check.
    mockAuthUser();
    mockOnboardingProfile({
      startedMsAgo: 25 * 60 * 60 * 1000,
      step: 'photo_tutorial',
    });
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'free',
      status: 'active',
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    expect(result.current.state).toBe('locked');
    expect(result.current.isPremium).toBe(false);
  });

  it('exposes plan as an alias for state (backward compat)', async () => {
    mockAuthUser();
    mockSupabaseSubscription({
      ...baseSubscription,
      plan: 'premium',
      status: 'active',
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.subscription).not.toBeUndefined());

    // `plan` mirrors `state` so existing `plan === 'premium'` style checks
    // continue to work for premium users; trialing users now see
    // plan === 'trialing' (no longer 'free').
    expect(result.current.plan).toBe('premium');
  });
});
