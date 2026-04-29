import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
    if (subscription.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end).getTime();
      if (Number.isFinite(periodEnd) && periodEnd < Date.now()) return 'locked';
    }
    return 'trialing';
  }
  if (subscription.status === 'active' && subscription.plan === 'premium') return 'premium';
  return 'locked';
}

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
  const state: SubscriptionState = deriveState(subscription);
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
