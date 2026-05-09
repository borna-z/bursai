// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively
// (see mobile/src/hooks/useSubscriptionStatus.ts for the canonical mobile subscription hook).
// N10 hygiene marker: web subscription hook reading the Stripe-mirrored subscriptions table.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, type Profile } from '@/hooks/useProfile';
import type { Database } from '@/integrations/supabase/types';

// Wave 8 P53 — drop the free tier. Subscription state is now a 3-way machine
// derived exclusively from the canonical `subscriptions` table that P52
// (PR #698, start_trial) writes:
//
//   * `'trialing'` — user is in the auto-granted 3-day Stripe trial
//   * `'premium'` — paid + active
//   * `'locked'`  — everything else (no row, canceled, past_due, plan='free' active, …)
//
// `isPremium` is true for both `'trialing'` and `'premium'`. `'locked'` is the
// only state that should gate UI / surface paywalls.
//
// We read directly from `subscriptions` (NOT the legacy `user_subscriptions`).
// `handle_new_user` provisions a row on signup; `start_trial` upserts it to
// `plan='premium', status='trialing'`. There's no need for a client-side
// bootstrap mutation any more — that was a workaround for a missing trigger.
export type SubscriptionState = 'trialing' | 'premium' | 'locked';

// Public alias kept for the small number of consumers that destructure `plan`
// (e.g. `ProfileCard` for badge copy). The semantic source of truth is `state`.
export type SubscriptionPlan = SubscriptionState;

export type Subscription = Database['public']['Tables']['subscriptions']['Row'];

// Plan limits — only premium remains. `free` is gone post-P53; if a consumer
// somehow lands here while locked, the gating helpers return false / 0 so the
// limits object is informational only.
export const PLAN_LIMITS = {
  premium: {
    maxGarments: Infinity,
    maxOutfitsPerMonth: Infinity,
  },
} as const;

// Codex P2 round 2 on PR #700 — derive the paywall reason from the
// underlying subscription row so the UI can surface "Your trial has
// ended" copy distinct from generic "Subscribe to continue". Mirrors
// the backend `enforceSubscription` denial reason: trialing rows whose
// current_period_end is in the past surface as `trial_expired`;
// everything else (no row, canceled, past_due, active+free legacy)
// surfaces as `subscription_required`. Callers should pass this value
// to PaywallModal's `reason` prop instead of the legacy quota-style
// reasons (`'garments'` / `'outfits'`) which mention the dead free tier.
export type PaywallReason = 'subscription_required' | 'trial_expired';

function derivePaywallReason(
  subscription: Subscription | null | undefined,
): PaywallReason {
  if (
    subscription?.status === 'trialing' &&
    subscription.current_period_end
  ) {
    const periodEnd = new Date(subscription.current_period_end).getTime();
    // Codex P2 round 3 on PR #700 — boundary alignment with backend.
    // Backend enforceSubscription denies when periodEnd is NOT strictly future
    // (`periodEndMs > Date.now()` → allowed). Frontend uses `<=` to match,
    // so the exact-instant tick (periodEnd === Date.now()) is locked on both
    // sides. Without this, the UI showed trialing while the API returned 402.
    if (Number.isFinite(periodEnd) && periodEnd <= Date.now()) {
      return 'trial_expired';
    }
  }
  return 'subscription_required';
}

// Codex P1 round 5 on PR #700 — mirror backend `resolveUserPlan`'s
// onboarding-boost window. New signups get a `subscriptions` row with
// `plan='free', status='active'` from `handle_new_user` BEFORE
// `start_trial` upserts to `plan='premium', status='trialing'`. During
// that async window (or if start_trial fails transiently), the row
// looks like every other locked legacy free user. The backend grants
// onboarding users access regardless of subscription row state via
// `resolveUserPlan` short-circuit; the frontend MUST mirror so UI gates
// don't block onboarding actions while backend allows them.
//
// 3 conditions (matches `_shared/scale-guard.ts:162-170` exactly):
//   1. profile.onboarding_started_at is set
//   2. profile.onboarding_step !== 'completed'
//   3. Date.now() - startedMs < 24h boost window
//
// All 3 must hold. Once the user completes onboarding OR 24h elapses,
// the bypass closes and `deriveState` falls back to the subscription row.
const ONBOARDING_BOOST_WINDOW_MS = 24 * 60 * 60 * 1000;

function isInOnboardingBoost(profile: Profile | null | undefined): boolean {
  if (!profile?.onboarding_started_at) return false;
  if (profile.onboarding_step === 'completed') return false;
  const startedMs = new Date(profile.onboarding_started_at).getTime();
  if (!Number.isFinite(startedMs)) return false;
  return Date.now() - startedMs < ONBOARDING_BOOST_WINDOW_MS;
}

function deriveState(subscription: Subscription | null | undefined): SubscriptionState {
  if (!subscription) return 'locked';
  if (subscription.status === 'trialing') {
    // Codex P2 round 1 on PR #700 — mirror backend `enforceSubscription`:
    // a trialing row whose `current_period_end` is in the past is treated
    // as expired (the backend returns 402 with `reason:'expired'` even if
    // the Stripe webhook hasn't transitioned `status` to `past_due`/
    // `canceled` yet — which is the typical 1–30s webhook lag window).
    // If the frontend still reported 'trialing'/`isPremium=true` here,
    // the UI would render unlocked actions (trial badge, AI buttons, etc.)
    // while every API call returns 402 — broken "allowed in UI, blocked
    // by backend" UX. Null `current_period_end` is allowed (matches
    // backend's null-tolerance for the brief window between trial mint
    // and the first webhook write).
    //
    // Codex P2 round 3 on PR #700 — boundary alignment. Backend uses
    // `periodEndMs > Date.now()` → allowed (strictly future). Frontend
    // uses `<= Date.now()` → locked, so the exact-instant tick is locked
    // on both sides. Earlier `<` left a 1-ms window where UI said
    // trialing but API returned 402.
    if (subscription.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end).getTime();
      if (Number.isFinite(periodEnd) && periodEnd <= Date.now()) return 'locked';
    }
    return 'trialing';
  }
  if (subscription.status === 'active' && subscription.plan === 'premium') return 'premium';
  return 'locked';
}

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Codex P1 round 5 on PR #700 — see comment above isInOnboardingBoost.
  // useProfile is already cached project-wide so this is a free read.
  const { data: profile } = useProfile();

  const query = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const subscription = query.data;
  // Onboarding-boost bypass wins over the subscription row. Mirrors
  // backend enforceSubscription's behavior so UI doesn't gate when API
  // allows. Treats onboarding users as 'trialing' for state semantics
  // (effectively pre-paying premium) so isPremium=true and gating helpers
  // (canAddGarment, canCreateOutfit) return true throughout the boost window.
  const onboardingBypass = isInOnboardingBoost(profile);
  const state: SubscriptionState = onboardingBypass
    ? 'trialing'
    : deriveState(subscription);
  const paywallReason: PaywallReason = derivePaywallReason(subscription);
  const isPremium = state !== 'locked';
  // `plan` mirrors `state`. Kept as a separate field for backward-compat with
  // consumers that used `plan === 'premium'` style checks. Both still work.
  const plan: SubscriptionPlan = state;
  const limits = PLAN_LIMITS.premium;

  // Locked users can't add garments. Trialing + premium are effectively
  // unlimited (PLAN_LIMITS.premium.maxGarments === Infinity). While loading
  // we deny to prevent bypass during query hydration.
  const canAddGarment = () => {
    if (query.isLoading) return false;
    return state !== 'locked';
  };

  const canCreateOutfit = () => {
    if (query.isLoading) return false;
    return state !== 'locked';
  };

  const remainingGarments = () => {
    if (state === 'locked') return 0;
    return Infinity;
  };

  const remainingOutfits = () => {
    if (state === 'locked') return 0;
    return Infinity;
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
  };

  return {
    subscription,
    plan,
    state,
    paywallReason,
    isPremium,
    isLoading: query.isLoading,
    canAddGarment,
    canCreateOutfit,
    remainingGarments,
    remainingOutfits,
    limits,
    refresh,
  };
}
