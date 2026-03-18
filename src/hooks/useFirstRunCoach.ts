import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useProfile, useUpdateProfile } from './useProfile';
import { useGarmentCount } from './useGarments';
import { asPreferences } from '@/types/preferences';

const COACH_STEP_ROUTES: Record<number, (pathname: string) => boolean> = {
  0: (pathname: string) => !pathname.startsWith('/wardrobe'),
  1: (pathname: string) => pathname.startsWith('/wardrobe') && !pathname.startsWith('/wardrobe/scan'),
  2: (pathname: string) => pathname.startsWith('/wardrobe/scan'),
  3: (pathname: string) => pathname === '/',
};

export function useFirstRunCoach() {
  const location = useLocation();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: garmentCount } = useGarmentCount();

  const prefs = asPreferences(profile?.preferences);
  const onboardingDone = prefs?.onboarding?.completed === true;
  const profileToured = prefs?.onboarding?.toured === true;
  const profileStep = prefs?.onboarding?.tour_step ?? 0;
  const [optimisticStep, setOptimisticStep] = useState(profileStep);
  const [optimisticToured, setOptimisticToured] = useState(profileToured);
  const hasEnoughGarments = (garmentCount ?? 0) >= 3;

  useEffect(() => {
    setOptimisticStep(profileStep);
  }, [profileStep]);

  useEffect(() => {
    setOptimisticToured(profileToured);
  }, [profileToured]);

  const isEligibleForCoach = !onboardingDone && !optimisticToured && !hasEnoughGarments;
  const currentStep = optimisticStep;

  const isStepActive = useMemo(() => {
    return (step: number) => {
      if (!isEligibleForCoach || currentStep !== step) return false;

      const routeMatcher = COACH_STEP_ROUTES[step];
      return routeMatcher ? routeMatcher(location.pathname) : true;
    };
  }, [currentStep, isEligibleForCoach, location.pathname]);

  const advanceStep = async () => {
    const nextStep = currentStep + 1;
    setOptimisticStep(nextStep);

    await updateProfile.mutateAsync({
      preferences: {
        ...prefs,
        onboarding: {
          ...prefs?.onboarding,
          tour_step: nextStep,
        },
      },
    }).catch((error) => {
      setOptimisticStep(profileStep);
      throw error;
    });
  };

  const completeTour = async () => {
    setOptimisticToured(true);
    setOptimisticStep(99);

    await updateProfile.mutateAsync({
      preferences: {
        ...prefs,
        onboarding: {
          ...prefs?.onboarding,
          toured: true,
          tour_step: 99,
        },
      },
    }).catch((error) => {
      setOptimisticToured(profileToured);
      setOptimisticStep(profileStep);
      throw error;
    });
  };

  return {
    isActive: isEligibleForCoach,
    currentStep,
    hasEnoughGarments,
    isStepActive,
    advanceStep,
    completeTour,
  };
}
