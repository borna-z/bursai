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

export async function advanceOnboardingStep(
  userId: string,
  toStep: OnboardingStep,
): Promise<AdvanceOnboardingStepResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    'advance_onboarding_step',
    { p_user_id: userId, p_to_step: toStep },
  );
  if (error) throw error;
  return (data ?? { ok: false }) as AdvanceOnboardingStepResult;
}
