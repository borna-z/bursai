/**
 * Typed interfaces for profile preferences and related JSON fields.
 * Step 23: Type Safety Hardening — replaces Record<string, any> casts.
 */

export interface OnboardingPreferences {
  completed?: boolean;
  quiz?: StyleQuizAnswers;
}

export interface StyleQuizAnswers {
  style?: string;
  colors?: string[];
  occasions?: string[];
  bodyType?: string;
  budget?: string;
  [key: string]: unknown;
}

export interface NotificationPreferences {
  daily_reminder?: boolean;
  weekly_summary?: boolean;
  outfit_suggestions?: boolean;
  push_enabled?: boolean;
}

export interface ProfilePreferences {
  onboarding?: OnboardingPreferences;
  accent_color?: string;
  language?: string;
  style_profile?: StyleProfile;
  notifications?: NotificationPreferences;
  [key: string]: unknown;
}

export interface StyleProfile {
  vibe?: string;
  formality_range?: [number, number];
  favorite_colors?: string[];
  avoid_colors?: string[];
  preferred_categories?: string[];
  [key: string]: unknown;
}

export interface StyleScore {
  overall?: number;
  color_harmony?: number;
  occasion_match?: number;
  versatility?: number;
}

export interface WeatherInfo {
  temp?: number;
  feels_like?: number;
  condition?: string;
  icon?: string;
  humidity?: number;
  wind_speed?: number;
}

/** Outfit generation state machine */
export type OutfitGenerationState =
  | { status: 'idle' }
  | { status: 'selecting'; occasion: string }
  | { status: 'generating'; occasion: string; weather?: WeatherInfo }
  | { status: 'success'; outfitId: string }
  | { status: 'error'; message: string; retryable: boolean };

/** Helper to safely cast JSON preferences from Supabase */
export function asPreferences(raw: unknown): ProfilePreferences {
  if (!raw || typeof raw !== 'object') return {};
  return raw as ProfilePreferences;
}

/** Helper to safely cast style score JSON */
export function asStyleScore(raw: unknown): StyleScore {
  if (!raw || typeof raw !== 'object') return {};
  return raw as StyleScore;
}

/** Helper to safely cast weather JSON */
export function asWeather(raw: unknown): WeatherInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as WeatherInfo;
}
