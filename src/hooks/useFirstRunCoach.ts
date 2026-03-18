import { useProfile, useUpdateProfile } from './useProfile';
import { useGarmentCount } from './useGarments';
import { asPreferences } from '@/types/preferences';

export function useFirstRunCoach() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: garmentCount } = useGarmentCount();

  const prefs = asPreferences(profile?.preferences);
  const onboardingDone = prefs?.onboarding?.completed === true;
  const toured = prefs?.onboarding?.toured === true;
  const isActive = onboardingDone && !toured;
  const currentStep = prefs?.onboarding?.tour_step ?? 0;
  const hasEnoughGarments = (garmentCount ?? 0) >= 3;

  const advanceStep = async () => {
    await updateProfile.mutateAsync({
      preferences: {
        ...prefs,
        onboarding: {
          ...prefs?.onboarding,
          tour_step: currentStep + 1,
        },
      },
    });
  };

  const completeTour = async () => {
    await updateProfile.mutateAsync({
      preferences: {
        ...prefs,
        onboarding: {
          ...prefs?.onboarding,
          toured: true,
          tour_step: 99,
        },
      },
    });
  };

  return {
    isActive,
    currentStep,
    hasEnoughGarments,
    advanceStep,
    completeTour,
  };
}
