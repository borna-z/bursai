import { useEffect } from 'react';
import { toast } from 'sonner';
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

  // Auto-complete when enough garments added
  useEffect(() => {
    if (hasEnoughGarments && isActive) {
      completeTour();
      toast('You\'re ready — generate your first outfit', { duration: 4000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEnoughGarments]);

  // Skip tour for users who already have garments when they finish onboarding
  useEffect(() => {
    if (isActive && garmentCount !== undefined && garmentCount > 0) {
      completeTour();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, garmentCount]);

  return {
    isActive,
    currentStep,
    hasEnoughGarments,
    advanceStep,
    completeTour,
  };
}
