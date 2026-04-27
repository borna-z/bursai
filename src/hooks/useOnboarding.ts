import { useQueryClient } from '@tanstack/react-query';

import { useProfile, useUpdateProfile } from './useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { asPreferences } from '@/types/preferences';
import { advanceOnboardingStep } from '@/lib/advanceOnboardingStep';

/**
 * Simplified onboarding hook — onboarding completes after quiz + tutorial.
 * No garment/outfit/reminder step tracking needed.
 */
export function useOnboarding() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();

  const prefs = asPreferences(profile?.preferences);
  const completed = prefs?.onboarding?.completed === true;

  const completeOnboarding = async () => {
    if (!profile || !user) return;

    // Wave 7 P44: write the server-known `profiles.onboarding_step` column.
    // The new ProtectedRoute gate prefers this signal once the migration
    // applies.
    //
    // Failure handling: ONLY swallow when ALL of the following are true:
    //   (1) the loaded profile genuinely lacks the `onboarding_step` column
    //       (pre-migration window — `useProfile`'s `.select('*')` doesn't
    //       return a column that doesn't exist on the row), AND
    //   (2) the RPC error code is `42883` (raw Postgres "function does not
    //       exist") OR `PGRST202` (PostgREST "function absent from schema
    //       cache").
    //
    // The column-existence gate matters because `PGRST202` is ALSO returned
    // when PostgREST's schema cache is stale POST-migration (e.g., right
    // after `db push` applies, before PostgREST notifies/reloads). If we
    // swallow `PGRST202` indiscriminately in that window, we end up with
    // split-brain: column stays `'not_started'`, legacy flag becomes
    // `true`, ProtectedRoute (column-based) redirects to `/onboarding`,
    // Onboarding.tsx (preferences-based) `Navigate to "/"`, redirect loop.
    //
    // Once the column exists on the loaded profile, propagating any RPC
    // error keeps both flags aligned (neither set) — user retries on
    // their own and PostgREST eventually refreshes its cache.
    //
    // All OTHER errors (transient network, ownership mismatch, invalid
    // step name, etc.) propagate per the same rationale.
    const profileLacksOnboardingColumn =
      (profile as { onboarding_step?: string | null } | null)?.onboarding_step ===
      undefined;
    try {
      await advanceOnboardingStep(user.id, 'completed', queryClient);
    } catch (rpcError) {
      const code = (rpcError as { code?: string } | null)?.code;
      const isDeployWindowMissing = code === '42883' || code === 'PGRST202';
      if (!profileLacksOnboardingColumn || !isDeployWindowMissing) {
        throw rpcError;
      }
      console.warn(
        'advance_onboarding_step RPC missing (pre-migration window — falling back to legacy flag):',
        rpcError,
      );
    }

    // Legacy preferences flag — primary signal for ProtectedRoute's
    // pre-migration fallback during the deploy window, secondary signal for
    // legacy consumers (useFirstRunCoach, etc.) post-migration.
    //
    // Wave 7 P0 audit fix #10: retry-on-failure (max 2 attempts, 500ms apart)
    // for the legacy write. If RPC succeeded but legacy write fails, we'd be
    // in a window where ProtectedRoute's column gate sees fresh
    // step='completed' (we just invalidated cache above) but legacy gate
    // still says false. The column gate is the canonical source of truth, so
    // a missed legacy write is recoverable on next refetch — but during the
    // deploy window the legacy gate is the canonical path. Retry closes most
    // of the gap; if both retries fail, log warn but DON'T throw — the
    // server-side step='completed' is already set and the next profile
    // refetch will resolve everything.
    const legacyPayload = {
      preferences: JSON.parse(JSON.stringify({
        ...prefs,
        onboarding: { completed: true },
      })),
    };
    let lastLegacyError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await updateProfile.mutateAsync(legacyPayload);
        lastLegacyError = null;
        break;
      } catch (legacyError) {
        lastLegacyError = legacyError;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
    if (lastLegacyError) {
      console.warn(
        'Legacy preferences.onboarding.completed write failed after retries. ' +
          'Column gate (onboarding_step=completed) is canonical and already set; ' +
          'next profile refetch will resolve any inconsistency:',
        lastLegacyError,
      );
    }
  };

  return {
    completed,
    isLoading,
    needsOnboarding: !isLoading && !completed && !!user,
    completeOnboarding,
  };
}
