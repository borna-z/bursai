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

    // Wave 7 P44: best-effort write to the server-known
    // `profiles.onboarding_step` column. The new ProtectedRoute gate prefers
    // this signal once the migration applies.
    //
    // Failure handling: swallow RPC errors. During the deploy window between
    // Vercel auto-deploy and `npx supabase db push --linked --yes`, the RPC
    // doesn't exist yet on the DB (Postgres `42883 function does not exist`)
    // and a thrown error here would block the legacy preferences write
    // below — leaving the user in a redirect loop because ProtectedRoute's
    // pre-migration fallback only passes users whose legacy flag is already
    // true. Real-world non-deploy-window errors at this call (ownership
    // mismatch, invalid step) are unreachable for a user completing their
    // own onboarding with the hardcoded `'completed'` target. Console
    // warning preserves observability.
    try {
      await advanceOnboardingStep(user.id, 'completed');
    } catch (rpcError) {
      console.warn(
        'advance_onboarding_step RPC failed (expected during deploy window):',
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
