import type { Session, User } from '@supabase/supabase-js';

export type OnboardingPrefs = {
  completed?: boolean;
  step?: number;
  language?: string;
  [key: string]: unknown;
};

export type ProfilePreferences = {
  onboarding?: OnboardingPrefs;
  [key: string]: unknown;
} | null;

export type Profile = {
  id: string;
  display_name: string | null;
  preferences: ProfilePreferences;
  mannequin_presentation: string | null;
  created_at: string;
  onboarding_step?: string | null;
  onboarding_completed_at?: string | null;
  onboarding_started_at?: string | null;
};

export type SignResult = { error: Error | null };

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  signIn: (email: string, password: string) => Promise<SignResult>;
  signUp: (email: string, password: string, displayName: string) => Promise<SignResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};
