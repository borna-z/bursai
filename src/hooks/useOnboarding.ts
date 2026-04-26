import { useProfile, useUpdateProfile } from './useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { asPreferences } from '@/types/preferences';
import { supabase } from '@/integrations/supabase/client';

/**
 * Simplified onboarding hook — onboarding completes after quiz + tutorial.
 * No garment/outfit/reminder step tracking needed.
 */
export function useOnboarding() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const prefs = asPreferences(profile?.preferences);
  const completed = prefs?.onboarding?.completed === true;

  const completeOnboarding = async () => {
    if (!profile || !user) return;

    // Wave 7 P44: source of truth for onboarding completion is now the
    // server-known `profiles.onboarding_step` column. The new ProtectedRoute
    // gate reads ONLY this column.
    //
    // Rollout bridge: without this RPC call, users who finish the OLD
    // onboarding flow between PR 1 merge and PR 2 (P45) ship would write
    // `preferences.onboarding.completed=true` (legacy flag, ignored by the
    // new gate) AND keep `onboarding_step='not_started'` (column default,
    // gate redirects them to /onboarding indefinitely).
    //
    // The RPC is forward-only: returns `{ok:false}` (does NOT throw) for
    // no-op or backwards transitions, throws only on ownership mismatch or
    // invalid step name. Duplicate calls are safe no-ops.
    //
    // `as any` cast: `src/integrations/supabase/types.ts` is auto-generated
    // and regenerates post-merge per CLAUDE.md hard rule — until then, the
    // new RPC isn't in the typed Functions union. The cast goes away once
    // types.ts is regenerated.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase.rpc as any)(
      'advance_onboarding_step',
      { p_user_id: user.id, p_to_step: 'completed' },
    );
    if (rpcError) throw rpcError;

    // Legacy preferences flag — kept for backward compat with consumers that
    // still read `preferences.onboarding.*` (useFirstRunCoach, etc.). PR 2-5
    // migrate those readers; until then both writes happen in lockstep.
    await updateProfile.mutateAsync({
      preferences: JSON.parse(JSON.stringify({
        ...prefs,
        onboarding: { completed: true },
      })),
    });
  };

  return {
    completed,
    isLoading,
    needsOnboarding: !isLoading && !completed && !!user,
    completeOnboarding,
  };
}
