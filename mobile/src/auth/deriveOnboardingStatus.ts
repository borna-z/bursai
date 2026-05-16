import type { Profile } from './types';

export function deriveIsOnboarded(profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.onboarding_step === 'completed') return true;
  return Boolean(profile.preferences?.onboarding?.completed);
}
