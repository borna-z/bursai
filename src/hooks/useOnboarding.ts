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

  const prefs = asPreferences(profile?.preferences);
  const completed = prefs?.onboarding?.completed === true;

  const completeOnboarding = async () => {
    if (!profile || !user) return;

    // Wave 7 P44: write the server-known `profiles.onboarding_step` column.
    // The new ProtectedRoute gate prefers this signal once the migration
    // applies.
    //
    // Failure handling: swallow ONLY Postgres `42883 function does not exist`,
    // which is the deploy-window scenario between Vercel auto-deploy and
    // `npx supabase db push --linked --yes`. ProtectedRoute's pre-migration
    // fallback then trusts the legacy flag we write below.
    //
    // All OTHER errors (transient network, ownership mismatch, invalid step,
    // etc.) propagate. Swallowing them post-migration would create split-
    // brain: legacy flag set, column still 'not_started' → ProtectedRoute
    // (column-based) keeps redirecting to /onboarding while Onboarding.tsx
    // sees `preferences.onboarding.completed=true` and bounces back to /.
    try {
      await advanceOnboardingStep(user.id, 'completed');
    } catch (rpcError) {
      const code = (rpcError as { code?: string } | null)?.code;
      if (code !== '42883') throw rpcError;
      console.warn(
        'advance_onboarding_step RPC missing (deploy window — falling back to legacy flag):',
        rpcError,
      );
    }

    // Legacy preferences flag — primary signal for ProtectedRoute's
    // pre-migration fallback during the deploy window, secondary signal for
    // legacy consumers (useFirstRunCoach, etc.) post-migration. Always
    // written; this is the failure-resistant path.
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
