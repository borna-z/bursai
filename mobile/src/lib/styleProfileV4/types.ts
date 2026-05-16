// Pure type/enum definitions for StyleProfileV4. No runtime code (other than
// catalog constants whose `as const` shape is the type definition itself).
//
// Mirror of the web's `src/types/styleProfile.ts` literal unions — keep the
// values lined up byte-for-byte so cross-platform JSONB reads agree.

export const STYLE_PROFILE_V4_VERSION = 4 as const;

export type Gender = 'feminine' | 'masculine' | 'neutral' | 'prefer_not';
export type Build = 'slim' | 'athletic' | 'curvy' | 'fuller' | 'prefer_not';
export type AgeRange = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';
export type Climate =
  | 'nordic'
  | 'temperate'
  | 'mediterranean'
  | 'tropical'
  | 'desert'
  | 'varies';
export type PaletteVibe =
  | 'neutrals'
  | 'bold'
  | 'dark'
  | 'pastels'
  | 'earth'
  | 'mixed';
export type PatternComfort = 'love' | 'some' | 'minimal' | 'solids_only';
export type FitOverall = 'fitted' | 'regular' | 'relaxed' | 'oversized' | 'mixed';
export type FitTopVsBottom =
  | 'same'
  | 'fitted_top_loose_bottom'
  | 'loose_top_fitted_bottom'
  | 'mixed';
export type Layering = 'minimal' | 'some' | 'love';
export type BodyFocus = 'shoulders' | 'waist' | 'legs' | 'none';
export type CarePreference = 'easy_care' | 'mixed' | 'high_maintenance_ok';
export type ShoppingFrequency = 'rare' | 'seasonal' | 'monthly' | 'frequent';
export type Budget = 'budget' | 'mid' | 'premium' | 'luxury' | 'mixed';
export type ShoppingStyle = 'planned' | 'impulse' | 'mixed';
export type PrimaryGoal =
  | 'reduce_decisions'
  | 'discover_style'
  | 'curate_capsule'
  | 'special_events'
  | 'professional_polish'
  | 'sustainability'
  | 'fun_experimenting';

export interface LifestyleMix {
  work: number;
  social: number;
  casual: number;
  sport: number;
  evening: number;
}

export const ARCHETYPE_OPTIONS = [
  'minimal',
  'classic',
  'street',
  'preppy',
  'bohemian',
  'sporty',
  'edgy',
  'romantic',
  'scandi',
  'avantgarde',
  'workwear',
  'soft',
] as const;
export type ArchetypeId = (typeof ARCHETYPE_OPTIONS)[number];

/** 18-swatch palette mirrors the web V4 set — IDs stable across platforms. */
export const COLOR_SWATCHES = [
  { id: 'black', hex: '#111111' },
  { id: 'white', hex: '#FAFAFA' },
  { id: 'grey', hex: '#9CA3AF' },
  { id: 'navy', hex: '#1E3A5F' },
  { id: 'blue', hex: '#3B82F6' },
  { id: 'beige', hex: '#D4C5A9' },
  { id: 'camel', hex: '#C19A6B' },
  { id: 'brown', hex: '#78350F' },
  { id: 'olive', hex: '#6B7040' },
  { id: 'green', hex: '#22C55E' },
  { id: 'red', hex: '#EF4444' },
  { id: 'burgundy', hex: '#7F1D1D' },
  { id: 'pink', hex: '#F472B6' },
  { id: 'purple', hex: '#A855F7' },
  { id: 'orange', hex: '#F97316' },
  { id: 'teal', hex: '#14B8A6' },
  { id: 'cream', hex: '#FFF8E7' },
  { id: 'denim', hex: '#4B6C8A' },
] as const;
export type ColorSwatchId = (typeof COLOR_SWATCHES)[number]['id'];

export const FABRIC_OPTIONS = [
  'cotton',
  'wool',
  'linen',
  'silk',
  'cashmere',
  'denim',
  'leather',
  'synthetic',
  'tencel',
  'jersey',
] as const;
export type FabricId = (typeof FABRIC_OPTIONS)[number];

export const FABRIC_SENSITIVITY_OPTIONS = [
  'wool_itchy',
  'synthetic_avoid',
  'linen_wrinkles',
  'leather_avoid',
  'silk_fragile',
  'none',
] as const;
export type FabricSensitivityId = (typeof FABRIC_SENSITIVITY_OPTIONS)[number];

export const OCCASION_OPTIONS = [
  'work',
  'casual',
  'date',
  'party',
  'travel',
  'workout',
  'formal_event',
  'weekend',
] as const;
export type OccasionId = (typeof OCCASION_OPTIONS)[number];

export const HEIGHT_CM_MIN = 100;
export const HEIGHT_CM_MAX = 220;

export type QuizQuestionId =
  | 'identity'
  | 'lifestyle'
  | 'climate'
  | 'archetypes'
  | 'colors'
  | 'fit'
  | 'formality'
  | 'fabric'
  | 'occasions'
  | 'shopping'
  | 'goal'
  | 'cultural';

export interface QuizQuestion {
  id: QuizQuestionId;
  /** Whether the question is optional (Skip writes empty / default). */
  optional: boolean;
}

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  { id: 'identity', optional: false },
  { id: 'lifestyle', optional: true },
  { id: 'climate', optional: true },
  { id: 'archetypes', optional: false },
  { id: 'colors', optional: true },
  { id: 'fit', optional: true },
  { id: 'formality', optional: true },
  { id: 'fabric', optional: true },
  { id: 'occasions', optional: true },
  { id: 'shopping', optional: true },
  { id: 'goal', optional: false },
  { id: 'cultural', optional: true },
] as const;

export const QUIZ_TOTAL = QUIZ_QUESTIONS.length;

export interface StyleProfileV4 {
  version: 4;

  gender: Gender;
  height_cm: number;
  build: Build;
  ageRange: AgeRange;

  lifestyle: LifestyleMix;

  homeCity?: string;
  secondaryCity?: string;
  climate: Climate;

  archetypes: string[];
  styleIcons?: string;

  favoriteColors: string[];
  dislikedColors: string[];
  paletteVibe: PaletteVibe;
  patternComfort: PatternComfort;

  fitOverall: FitOverall;
  fitTopVsBottom: FitTopVsBottom;
  layering: Layering;
  bodyFocus: BodyFocus;

  formalityCeiling: number;
  formalityFloor: number;

  fabricPreferred: string[];
  fabricSensitivities: string[];
  carePreference: CarePreference;

  occasions: string[];

  shoppingFrequency: ShoppingFrequency;
  budget: Budget;
  shoppingStyle: ShoppingStyle;

  primaryGoal: PrimaryGoal;

  cultural?: string;
}

/** Per-question "did the user explicitly tap a scalar choice" flags. Used by
 * the V3-compat shim to omit untouched scalar enums from the V3 mirror so
 * default values (`paletteVibe: 'mixed'`, etc.) aren't written as definitive
 * answers. */
export interface StyleProfileV4Touched {
  gender?: boolean;
  height_cm?: boolean;
  build?: boolean;
  ageRange?: boolean;
  climate?: boolean;
  paletteVibe?: boolean;
  patternComfort?: boolean;
  fitOverall?: boolean;
  fitTopVsBottom?: boolean;
  layering?: boolean;
  bodyFocus?: boolean;
  formality?: boolean;
  carePreference?: boolean;
  shoppingFrequency?: boolean;
  budget?: boolean;
  shoppingStyle?: boolean;
  primaryGoal?: boolean;
}

/** V3-shape mirror keys persisted alongside the canonical V4 record. */
export type V3CompatShape = Record<string, unknown>;
