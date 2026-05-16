import { deriveIsOnboarded } from '../deriveOnboardingStatus';
import type { Profile } from '../types';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u-1',
    display_name: null,
    preferences: null,
    mannequin_presentation: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('deriveIsOnboarded', () => {
  it('returns false for null profile', () => {
    expect(deriveIsOnboarded(null)).toBe(false);
  });

  it('returns true when onboarding_step is completed', () => {
    expect(deriveIsOnboarded(makeProfile({ onboarding_step: 'completed' }))).toBe(true);
  });

  it('falls back to preferences.onboarding.completed when step is not completed', () => {
    expect(
      deriveIsOnboarded(
        makeProfile({ preferences: { onboarding: { completed: true } } }),
      ),
    ).toBe(true);
  });

  it('returns false when neither signal is set', () => {
    expect(deriveIsOnboarded(makeProfile())).toBe(false);
  });
});
