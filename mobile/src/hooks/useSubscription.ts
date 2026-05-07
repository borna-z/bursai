// useSubscription — mobile mirror of `src/hooks/useSubscription.ts`.
//
// Reads a single row from `subscriptions` keyed by user_id and derives the
// 3-way state machine the app gates on: `'trialing' | 'premium' | 'locked'`.
// The semantics intentionally match the web's hook so the same gating
// helpers (`canAddGarment`, etc.) ship the same denial reasons cross-platform.
//
// One difference vs. web: M31 introduces RevenueCat as the source of
// `plan` values on iOS/Android (`'monthly'` / `'yearly'`), while web's
// Stripe writer set `plan='premium'`. We accept both — `plan === 'premium'`
// for legacy / web rows and `plan in ('monthly','yearly')` for RevenueCat
// rows. Trial state is unchanged (`status === 'trialing'`).
//
// The webhook (PR B) writes the row asynchronously, so consumers should
// expect a 1–10s lag between a successful purchase and `isPremium === true`.
// `usePurchaseSubscription` handles the polling for the immediate flow.

import { useQuery } from '@tanstack/react-query';

import { useAuth, type Profile } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export type SubscriptionState = 'trialing' | 'premium' | 'locked';

// Defensive shape — we don't import the auto-generated Database type at
// runtime to keep this hook resilient if the column set drifts. The
// parser below validates each field; unknown shapes resolve to `null`.
export type SubscriptionRow = {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
  garments_count: number | null;
};

const PREMIUM_PLAN_VALUES = new Set<string>([
  // Legacy / web Stripe writer.
  'premium',
  // RevenueCat plan identifiers (M31).
  'monthly',
  'yearly',
]);

function parseSubscriptionRow(input: unknown): SubscriptionRow | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  return {
    plan: typeof row.plan === 'string' ? row.plan : null,
    status: typeof row.status === 'string' ? row.status : null,
    current_period_end:
      typeof row.current_period_end === 'string'
        ? row.current_period_end
        : null,
    garments_count:
      typeof row.garments_count === 'number' ? row.garments_count : null,
  };
}

// Mirror web `src/hooks/useSubscription.ts` — backend
// `_shared/scale-guard.ts` grants new signups a 24h boost window where
// AI calls bypass the free-tier rate limit even before `start_trial`
// has written `plan='premium', status='trialing'`. During that window
// the `subscriptions` row can look like a locked free user, so the
// frontend must apply the same bypass or UI will gate while API allows.
//
// 3 conditions (matches `_shared/scale-guard.ts:162-170` exactly):
//   1. profile.onboarding_started_at is set
//   2. profile.onboarding_step !== 'completed'
//   3. Date.now() - startedMs < 24h
const ONBOARDING_BOOST_WINDOW_MS = 24 * 60 * 60 * 1000;

function isInOnboardingBoost(profile: Profile | null | undefined): boolean {
  if (!profile?.onboarding_started_at) return false;
  if (profile.onboarding_step === 'completed') return false;
  const startedMs = new Date(profile.onboarding_started_at).getTime();
  if (!Number.isFinite(startedMs)) return false;
  return Date.now() - startedMs < ONBOARDING_BOOST_WINDOW_MS;
}

function deriveState(row: SubscriptionRow | null): SubscriptionState {
  if (!row) return 'locked';
  if (row.status === 'trialing') {
    // Mirror web: a trialing row whose `current_period_end` is in the
    // past is treated as expired, even if the webhook hasn't transitioned
    // status to `past_due` / `canceled` yet (typical 1–30s lag window).
    // This keeps the UI in lockstep with the backend `enforceSubscription`
    // gate (status 402).
    if (row.current_period_end) {
      const periodEnd = new Date(row.current_period_end).getTime();
      if (Number.isFinite(periodEnd) && periodEnd <= Date.now()) {
        return 'locked';
      }
    }
    return 'trialing';
  }
  if (row.status === 'active' && row.plan && PREMIUM_PLAN_VALUES.has(row.plan)) {
    return 'premium';
  }
  return 'locked';
}

export function useSubscription() {
  const { user, profile } = useAuth();

  const query = useQuery<SubscriptionRow | null>({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end, garments_count')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return parseSubscriptionRow(data);
    },
    enabled: !!user,
    // Wave spec: 60s stale time. Long enough that gating helpers don't
    // hammer the row on every screen mount; short enough that the post-
    // purchase poll (usePurchaseSubscription) sees fresh data quickly.
    staleTime: 60 * 1000,
  });

  const row = query.data ?? null;
  const baseState = deriveState(row);
  // Onboarding-boost bypass — when active, override 'locked' to 'trialing'
  // so gating helpers (and `isPremium`) match backend's permissive stance
  // during the 24h post-signup boost window. Active states ('trialing',
  // 'premium') are left untouched so the user keeps the strongest signal
  // they've actually earned.
  const onboardingBypass =
    baseState === 'locked' && isInOnboardingBoost(profile);
  const state: SubscriptionState = onboardingBypass ? 'trialing' : baseState;
  const plan = row?.plan ?? null;
  const isTrialing = state === 'trialing';
  const isPremium = state === 'premium' || state === 'trialing';
  const isLocked = state === 'locked';
  const garmentLimit = isPremium ? Infinity : 0;

  return {
    plan,
    status: row?.status ?? null,
    state,
    isTrialing,
    isPremium,
    isLocked,
    garmentLimit,
    error: query.error ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
