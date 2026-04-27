import { supabase } from '@/integrations/supabase/client';

/**
 * Wave 7 P47 RPC wrapper. Atomically bumps `profiles.onboarding_garment_count`
 * by 1 and returns the new total. Mirrors the pattern from
 * `advanceOnboardingStep.ts` so the BatchCapture flow has a single typed entry
 * point for counter writes (no inline `supabase.rpc` calls scattered across
 * components).
 *
 * The migration's RPC body throws on ownership mismatch (42501) and on
 * missing-profile (P0002); both surface as supabase-js errors here. Callers
 * should catch + retry-with-toast (transient network) or surface to the user
 * (auth dropped — the same path the rest of the onboarding flow handles).
 *
 * Pre-migration / deploy-window note: P42's migration has been live since
 * 2026-04-26, so the deploy-window swallow that `advanceOnboardingStep`
 * carries (PGRST202 / 42883 fallback) does NOT apply here. P47 ships AFTER
 * the migration is live everywhere, so any RPC failure here is a real
 * runtime error.
 */
export async function incrementOnboardingGarmentCount(
  userId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('increment_onboarding_garment_count', {
    p_user_id: userId,
  });
  if (error) throw error;
  if (typeof data !== 'number') {
    throw new Error('increment_onboarding_garment_count returned a non-numeric payload');
  }
  return data;
}
