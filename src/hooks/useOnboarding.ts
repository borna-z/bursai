import { useProfile, useUpdateProfile } from './useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { asPreferences } from '@/types/preferences';

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
    if (!profile) return;
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
