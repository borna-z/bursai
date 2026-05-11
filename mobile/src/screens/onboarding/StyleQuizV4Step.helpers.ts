// Pure helpers + constants extracted from StyleQuizV4Step.tsx (N13).
// No React hooks; safe to unit-test directly.

import type {
  AgeRange,
  Budget,
  Build,
  CarePreference,
  Climate,
  FitOverall,
  FitTopVsBottom,
  Gender,
  Layering,
  LifestyleMix,
  PaletteVibe,
  PatternComfort,
  PrimaryGoal,
  ShoppingFrequency,
  ShoppingStyle,
  StyleProfileV4,
  StyleProfileV4Touched,
} from '../../lib/styleProfileV4';

// ─── Per-question option lists (mirror web vocab) ───────────────────────────

export const GENDERS: readonly Gender[] = ['feminine', 'masculine', 'neutral', 'prefer_not'];
export const BUILDS: readonly Build[] = ['slim', 'athletic', 'curvy', 'fuller', 'prefer_not'];
export const AGE_RANGES: readonly AgeRange[] = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
export const CLIMATES: readonly Climate[] = [
  'nordic',
  'temperate',
  'mediterranean',
  'tropical',
  'desert',
  'varies',
];
export const PALETTE_VIBES: readonly PaletteVibe[] = [
  'neutrals',
  'bold',
  'dark',
  'pastels',
  'earth',
  'mixed',
];
export const PATTERN_COMFORTS: readonly PatternComfort[] = ['love', 'some', 'minimal', 'solids_only'];
export const FIT_OVERALLS: readonly FitOverall[] = ['fitted', 'regular', 'relaxed', 'oversized', 'mixed'];
export const FIT_TOP_VS_BOTTOMS: readonly FitTopVsBottom[] = [
  'same',
  'fitted_top_loose_bottom',
  'loose_top_fitted_bottom',
  'mixed',
];
export const LAYERINGS: readonly Layering[] = ['minimal', 'some', 'love'];
export const BODY_FOCUSES = ['shoulders', 'waist', 'legs', 'none'] as const;
export const CARE_PREFS: readonly CarePreference[] = ['easy_care', 'mixed', 'high_maintenance_ok'];
export const SHOPPING_FREQS: readonly ShoppingFrequency[] = ['rare', 'seasonal', 'monthly', 'frequent'];
export const BUDGETS: readonly Budget[] = ['budget', 'mid', 'premium', 'luxury', 'mixed'];
export const SHOPPING_STYLES: readonly ShoppingStyle[] = ['planned', 'impulse', 'mixed'];
export const PRIMARY_GOALS: readonly PrimaryGoal[] = [
  'reduce_decisions',
  'discover_style',
  'curate_capsule',
  'special_events',
  'professional_polish',
  'sustainability',
  'fun_experimenting',
];

export const LIFESTYLE_KEYS: readonly (keyof LifestyleMix)[] = [
  'work',
  'social',
  'casual',
  'sport',
  'evening',
] as const;

export const ARCHETYPE_MIN = 3;
export const ARCHETYPE_MAX = 5;
export const FAVORITE_COLORS_MAX = 3;
export const DISLIKED_COLORS_MAX = 3;
export const FABRIC_PREFERRED_MAX = 3;

// Touched tracks every scalar the user explicitly chose. The required-question
// gate (canAdvance) reads `gender`/`build`/`ageRange`/`goal`/`height_cm`; the
// V3-compat shim at submit time (`migrateV4ToV3Compat`) reads the rest to omit
// untouched scalars from the V3 mirror so default values like
// `paletteVibe: 'mixed'` aren't written as definitive answers.
export interface Touched {
  gender: boolean;
  height_cm: boolean;
  build: boolean;
  ageRange: boolean;
  goal: boolean;
  climate: boolean;
  paletteVibe: boolean;
  patternComfort: boolean;
  fitOverall: boolean;
  fitTopVsBottom: boolean;
  layering: boolean;
  bodyFocus: boolean;
  formality: boolean;
  carePreference: boolean;
  shoppingFrequency: boolean;
  budget: boolean;
  shoppingStyle: boolean;
}

export const TOUCHED_DEFAULT: Touched = {
  gender: false,
  height_cm: false,
  build: false,
  ageRange: false,
  goal: false,
  climate: false,
  paletteVibe: false,
  patternComfort: false,
  fitOverall: false,
  fitTopVsBottom: false,
  layering: false,
  bodyFocus: false,
  formality: false,
  carePreference: false,
  shoppingFrequency: false,
  budget: false,
  shoppingStyle: false,
};

/** Snapshot of mid-quiz state, lifted up to OnboardingScreen so its existing
 * AsyncStorage draft (`burs.onboarding.draft.v1`) covers per-question
 * persistence. */
export interface QuizV4Progress {
  qi: number;
  answers: StyleProfileV4;
  touched: Touched;
}

/** Build a `StyleProfileV4Touched` map (used by `migrateV4ToV3Compat`) from
 * the screen's local `Touched`. Keys with the same name pass through; the
 * shim's optional fields default to undefined when omitted. */
export function touchedToCompatTouched(t: Touched): StyleProfileV4Touched {
  return {
    gender: t.gender,
    height_cm: t.height_cm,
    build: t.build,
    ageRange: t.ageRange,
    climate: t.climate,
    paletteVibe: t.paletteVibe,
    patternComfort: t.patternComfort,
    fitOverall: t.fitOverall,
    fitTopVsBottom: t.fitTopVsBottom,
    layering: t.layering,
    bodyFocus: t.bodyFocus,
    formality: t.formality,
    carePreference: t.carePreference,
    shoppingFrequency: t.shoppingFrequency,
    budget: t.budget,
    shoppingStyle: t.shoppingStyle,
    primaryGoal: t.goal,
  };
}
