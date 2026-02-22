import { useProfile, useUpdateProfile } from './useProfile';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Simplified onboarding hook — onboarding completes after quiz + tutorial.
 * No garment/outfit/reminder step tracking needed.
 */
export function useOnboarding() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const prefs = (profile?.preferences as Record<string, unknown>) || {};
  const onboarding = prefs?.onboarding as Record<string, unknown> | undefined;
  const completed = onboarding?.completed === true;

  const completeOnboarding = async () => {
    if (!profile) return;
    await updateProfile.mutateAsync({
      preferences: {
        ...prefs,
        onboarding: { completed: true },
      },
    });
  };

  return {
    completed,
    isLoading,
    needsOnboarding: !isLoading && !completed && !!user,
    completeOnboarding,
  };
}
