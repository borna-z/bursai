import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useProfile, useUpdateProfile } from './useProfile';
import { useGarmentCount } from './useGarments';
import { asPreferences } from '@/types/preferences';

const COACH_STEP_ROUTES: Record<number, (pathname: string) => boolean> = {
  0: (pathname: string) => !pathname.startsWith('/wardrobe'),
  1: (pathname: string) => pathname.startsWith('/wardrobe') && !pathname.startsWith('/wardrobe/scan'),
  2: (pathname: string) => pathname.startsWith('/wardrobe/scan'),
  3: (pathname: string) => pathname.startsWith('/outfits/generate'),
  4: (pathname: string) => pathname.startsWith('/plan'),
};

export function useFirstRunCoach() {
  const location = useLocation();
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: garmentCount, isLoading: isGarmentCountLoading } = useGarmentCount();

  const prefs = asPreferences(profile?.preferences);
  const onboardingDone = prefs?.onboarding?.completed === true;
  const profileToured = prefs?.onboarding?.toured === true;
  const profileStep = prefs?.onboarding?.tour_step ?? 0;
  const profileReopened = prefs?.onboarding?.coach_reopened === true;
  const [optimisticStep, setOptimisticStep] = useState(profileStep);
  const [optimisticToured, setOptimisticToured] = useState(profileToured);
  const [optimisticReopened, setOptimisticReopened] = useState(profileReopened);
  const hasEnoughGarments = (garmentCount ?? 0) >= 3;
  const isSupportedCoachStep = Object.prototype.hasOwnProperty.call(COACH_STEP_ROUTES, optimisticStep);
  const isCoachResolved = !isProfileLoading && !isGarmentCountLoading && garmentCount !== undefined;

  useEffect(() => {
    setOptimisticStep(profileStep);
  }, [profileStep]);

  useEffect(() => {
    setOptimisticToured(profileToured);
  }, [profileToured]);

  useEffect(() => {
    setOptimisticReopened(profileReopened);
  }, [profileReopened]);

  const shouldShowCoach = optimisticReopened || (!onboardingDone && !hasEnoughGarments);
  const isEligibleForCoach = isCoachResolved && isSupportedCoachStep && !optimisticToured && shouldShowCoach;
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
          coach_reopened: optimisticReopened,
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
    setOptimisticReopened(false);

    await updateProfile.mutateAsync({
      preferences: {
        ...prefs,
        onboarding: {
          ...prefs?.onboarding,
          toured: true,
          coach_reopened: false,
          tour_step: 99,
        },
      },
    }).catch((error) => {
      setOptimisticToured(profileToured);
      setOptimisticStep(profileStep);
      setOptimisticReopened(profileReopened);
      throw error;
    });
  };

  const restartCoach = async () => {
    setOptimisticToured(false);
    setOptimisticStep(0);
    setOptimisticReopened(true);

    await updateProfile.mutateAsync({
      preferences: {
        ...prefs,
        onboarding: {
          ...prefs?.onboarding,
          toured: false,
          coach_reopened: true,
          tour_step: 0,
        },
      },
    }).catch((error) => {
      setOptimisticToured(profileToured);
      setOptimisticStep(profileStep);
      setOptimisticReopened(profileReopened);
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
    restartCoach,
  };
}
