import type { QueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';

/**
 * Wave 7 P42 RPC wrapper. Forward-only state-machine transition for the
 * `profiles.onboarding_step` column. Returns `{ ok, from?, to?, reason?,
 * current?, target? }` jsonb on success — `ok:false` for no-op or backwards
 * transitions (callers should treat this as non-fatal). Throws for ownership
 * mismatch / invalid step name / network errors.
 *
 * Centralised here so:
 *   - The 4 onboarding-completing surfaces (`useOnboarding.completeOnboarding`,
 *     `Onboarding.tsx` local completion, future PR 2-5 step transitions) share
 *     one implementation.
 *   - The transitional `as any` cast lives in exactly one place. Goes away on
 *     the next `supabase gen types typescript --linked` regen, which adds the
 *     new RPC to the typed Functions union (the regen runs post-merge per
 *     CLAUDE.md hard rule: types.ts is auto-generated, never manual).
 */

export type OnboardingStep =
  | 'not_started'
  | 'language'
  | 'quiz'
  | 'photo_tutorial'
  | 'batch_capture'
  | 'achievement'
  | 'studio_selection'
  | 'coach_tour'
  | 'reveal'
  | 'completed';

export interface AdvanceOnboardingStepResult {
  ok: boolean;
  from?: OnboardingStep;
  to?: OnboardingStep;
  reason?: 'no_op' | 'backwards';
  current?: OnboardingStep;
  target?: OnboardingStep;
}

/**
 * Optional `queryClient` is passed by hook-layer callers (which can resolve
 * `useQueryClient()`) so we can invalidate the React Query `['profile', userId]`
 * cache as a side effect after the RPC succeeds. The `App.tsx` `QueryClient` is
 * a module-local const (not exported), so we accept the instance via param
 * rather than importing a singleton — keeps non-React callers (server-side
 * tests, rare module-scope usage) compiling without a provider.
 */
export async function advanceOnboardingStep(
  userId: string,
  toStep: OnboardingStep,
  queryClient?: QueryClient,
): Promise<AdvanceOnboardingStepResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    'advance_onboarding_step',
    { p_user_id: userId, p_to_step: toStep },
  );
  if (error) throw error;
  // Wave 7 P0 audit fix #4: invalidate profile cache so step changes propagate to ProtectedRoute immediately.
  // Without this, `useProfile`'s 10-min staleTime keeps the old `onboarding_step` value visible to gates
  // (ProtectedRoute, Onboarding.tsx hydration), producing redirect loops for users who just completed a step.
  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: ['profile', userId] });
  }
  return (data ?? { ok: false }) as AdvanceOnboardingStepResult;
}
