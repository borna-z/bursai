// styleProfileV4 — mobile port of the web's StyleProfileV4 schema
// (`src/types/styleProfile.ts`). The on-disk shape MUST match web byte-for-byte
// where field names appear, so a future cross-platform read on
// `profiles.preferences.style_profile_v4_jsonb` is consistent: enum string
// literals, array vocab IDs, and numeric ranges all line up.
//
// Mobile is v4-native (M25 wave directive) — there are no v3→v4 translators
// here. The defensive parser drops malformed fields rather than throwing so
// a corrupted JSONB cell renders as the empty profile instead of crashing
// onboarding.
//
// Type aliasing the web's union literals via `import type` is safe (zero
// runtime impact, see `mobile/CLAUDE.md` "Web type imports allowed"); we
// keep them duplicated locally so a future web `src/` deletion doesn't
// break this file.

export const STYLE_PROFILE_V4_VERSION = 4 as const;

// ─── Enums (string unions) — kept in lockstep with src/types/styleProfile.ts ─

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

// ─── Catalog constants ─────────────────────────────────────────────────────

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

// ─── Realistic adult human bounds (web parity, src/types/styleProfile.ts) ──

export const HEIGHT_CM_MIN = 100;
export const HEIGHT_CM_MAX = 220;

// ─── Question definitions ──────────────────────────────────────────────────
//
// `QUIZ_QUESTIONS` powers the paginated screen — one entry per page, each with
// a stable id (used as the i18n key fragment) + answer kind. The screen reads
// this list rather than a switch statement so a future re-order or insertion
// flows from a single source of truth.

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

// ─── Core schema ────────────────────────────────────────────────────────────

export interface StyleProfileV4 {
  version: 4;

  // Q1 Identity & body
  gender: Gender;
  height_cm: number;
  build: Build;
  ageRange: AgeRange;

  // Q2 Lifestyle mix (each 0-100; totals ~100 but accept any user mix)
  lifestyle: LifestyleMix;

  // Q3 Climate & location
  homeCity?: string;
  secondaryCity?: string;
  climate: Climate;

  // Q4 Style identity
  archetypes: string[]; // 3-5 from ARCHETYPE_OPTIONS
  styleIcons?: string;

  // Q5 Color DNA
  favoriteColors: string[]; // up to 3 from COLOR_SWATCHES
  dislikedColors: string[]; // up to 3 from COLOR_SWATCHES
  paletteVibe: PaletteVibe;
  patternComfort: PatternComfort;

  // Q6 Fit & silhouette
  fitOverall: FitOverall;
  fitTopVsBottom: FitTopVsBottom;
  layering: Layering;
  bodyFocus: BodyFocus;

  // Q7 Formality
  formalityCeiling: number; // 0-100
  formalityFloor: number; // 0-100

  // Q8 Fabric & feel
  fabricPreferred: string[]; // up to 3 from FABRIC_OPTIONS
  fabricSensitivities: string[]; // multi-select
  carePreference: CarePreference;

  // Q9 Occasions
  occasions: string[]; // multi-select

  // Q10 Shopping
  shoppingFrequency: ShoppingFrequency;
  budget: Budget;
  shoppingStyle: ShoppingStyle;

  // Q11 Goal
  primaryGoal: PrimaryGoal;

  // Q12 Cultural / accessibility
  cultural?: string;
}

// ─── Defaults / factory ────────────────────────────────────────────────────

export function defaultStyleProfileV4(): StyleProfileV4 {
  return {
    version: 4,
    gender: 'prefer_not',
    height_cm: 0,
    build: 'prefer_not',
    ageRange: '25-34',
    lifestyle: { work: 20, social: 20, casual: 20, sport: 20, evening: 20 },
    homeCity: '',
    secondaryCity: '',
    climate: 'temperate',
    archetypes: [],
    styleIcons: '',
    favoriteColors: [],
    dislikedColors: [],
    paletteVibe: 'mixed',
    patternComfort: 'some',
    fitOverall: 'regular',
    fitTopVsBottom: 'same',
    layering: 'some',
    bodyFocus: 'none',
    formalityCeiling: 60,
    formalityFloor: 30,
    fabricPreferred: [],
    fabricSensitivities: [],
    carePreference: 'mixed',
    occasions: [],
    shoppingFrequency: 'seasonal',
    budget: 'mid',
    shoppingStyle: 'mixed',
    primaryGoal: 'reduce_decisions',
    cultural: '',
  };
}

// ─── Defensive parser ──────────────────────────────────────────────────────
//
// Anything malformed downgrades to the matching default rather than throwing.
// Strict allowlists per enum so a corrupt token (legacy V3 string, hand-edited
// JSONB) cannot poison downstream prompt builders.

const GENDERS: readonly Gender[] = ['feminine', 'masculine', 'neutral', 'prefer_not'];
const BUILDS: readonly Build[] = ['slim', 'athletic', 'curvy', 'fuller', 'prefer_not'];
const AGE_RANGES: readonly AgeRange[] = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const CLIMATES: readonly Climate[] = [
  'nordic',
  'temperate',
  'mediterranean',
  'tropical',
  'desert',
  'varies',
];
const PALETTE_VIBES: readonly PaletteVibe[] = [
  'neutrals',
  'bold',
  'dark',
  'pastels',
  'earth',
  'mixed',
];
const PATTERN_COMFORTS: readonly PatternComfort[] = ['love', 'some', 'minimal', 'solids_only'];
const FIT_OVERALLS: readonly FitOverall[] = ['fitted', 'regular', 'relaxed', 'oversized', 'mixed'];
const FIT_TOP_VS_BOTTOMS: readonly FitTopVsBottom[] = [
  'same',
  'fitted_top_loose_bottom',
  'loose_top_fitted_bottom',
  'mixed',
];
const LAYERINGS: readonly Layering[] = ['minimal', 'some', 'love'];
const BODY_FOCUSES: readonly BodyFocus[] = ['shoulders', 'waist', 'legs', 'none'];
const CARE_PREFS: readonly CarePreference[] = ['easy_care', 'mixed', 'high_maintenance_ok'];
const SHOPPING_FREQS: readonly ShoppingFrequency[] = ['rare', 'seasonal', 'monthly', 'frequent'];
const BUDGETS: readonly Budget[] = ['budget', 'mid', 'premium', 'luxury', 'mixed'];
const SHOPPING_STYLES: readonly ShoppingStyle[] = ['planned', 'impulse', 'mixed'];
const PRIMARY_GOALS: readonly PrimaryGoal[] = [
  'reduce_decisions',
  'discover_style',
  'curate_capsule',
  'special_events',
  'professional_polish',
  'sustainability',
  'fun_experimenting',
];

function parseEnum<T extends string>(value: unknown, allow: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allow as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function clampPercent(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseLifestyle(value: unknown): LifestyleMix {
  const fallback = defaultStyleProfileV4().lifestyle;
  if (!value || typeof value !== 'object') return fallback;
  const obj = value as Record<string, unknown>;
  return {
    work: clampPercent(obj.work ?? fallback.work),
    social: clampPercent(obj.social ?? fallback.social),
    casual: clampPercent(obj.casual ?? fallback.casual),
    sport: clampPercent(obj.sport ?? fallback.sport),
    evening: clampPercent(obj.evening ?? fallback.evening),
  };
}

function parseStringArray(value: unknown, allow: readonly string[], max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    if (!allow.includes(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

function parseOptionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseHeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const n = Math.round(value);
  if (n < HEIGHT_CM_MIN || n > HEIGHT_CM_MAX) return 0;
  return n;
}

const ARCHETYPE_ALLOW = ARCHETYPE_OPTIONS as readonly string[];
const FABRIC_ALLOW = FABRIC_OPTIONS as readonly string[];
const FABRIC_SENS_ALLOW = FABRIC_SENSITIVITY_OPTIONS as readonly string[];
const OCCASION_ALLOW = OCCASION_OPTIONS as readonly string[];
const COLOR_ALLOW: readonly string[] = COLOR_SWATCHES.map((c) => c.id);

/**
 * Parse a raw `preferences.style_profile_v4_jsonb` value into a strictly-typed
 * `StyleProfileV4`. Anything malformed downgrades to defaults — never throws.
 */
export function parseStyleProfileV4(value: unknown): StyleProfileV4 {
  const base = defaultStyleProfileV4();
  if (!value || typeof value !== 'object') return base;
  const obj = value as Record<string, unknown>;
  return {
    version: 4,
    gender: parseEnum<Gender>(obj.gender, GENDERS, base.gender),
    height_cm: parseHeight(obj.height_cm),
    build: parseEnum<Build>(obj.build, BUILDS, base.build),
    ageRange: parseEnum<AgeRange>(obj.ageRange, AGE_RANGES, base.ageRange),
    lifestyle: parseLifestyle(obj.lifestyle),
    homeCity: parseOptionalString(obj.homeCity),
    secondaryCity: parseOptionalString(obj.secondaryCity),
    climate: parseEnum<Climate>(obj.climate, CLIMATES, base.climate),
    archetypes: parseStringArray(obj.archetypes, ARCHETYPE_ALLOW, 5),
    styleIcons: parseOptionalString(obj.styleIcons),
    favoriteColors: parseStringArray(obj.favoriteColors, COLOR_ALLOW, 3),
    dislikedColors: parseStringArray(obj.dislikedColors, COLOR_ALLOW, 3),
    paletteVibe: parseEnum<PaletteVibe>(obj.paletteVibe, PALETTE_VIBES, base.paletteVibe),
    patternComfort: parseEnum<PatternComfort>(
      obj.patternComfort,
      PATTERN_COMFORTS,
      base.patternComfort,
    ),
    fitOverall: parseEnum<FitOverall>(obj.fitOverall, FIT_OVERALLS, base.fitOverall),
    fitTopVsBottom: parseEnum<FitTopVsBottom>(
      obj.fitTopVsBottom,
      FIT_TOP_VS_BOTTOMS,
      base.fitTopVsBottom,
    ),
    layering: parseEnum<Layering>(obj.layering, LAYERINGS, base.layering),
    bodyFocus: parseEnum<BodyFocus>(obj.bodyFocus, BODY_FOCUSES, base.bodyFocus),
    formalityCeiling: clampPercent(obj.formalityCeiling ?? base.formalityCeiling),
    formalityFloor: clampPercent(obj.formalityFloor ?? base.formalityFloor),
    fabricPreferred: parseStringArray(obj.fabricPreferred, FABRIC_ALLOW, 3),
    fabricSensitivities: parseStringArray(
      obj.fabricSensitivities,
      FABRIC_SENS_ALLOW,
      FABRIC_SENS_ALLOW.length,
    ),
    carePreference: parseEnum<CarePreference>(obj.carePreference, CARE_PREFS, base.carePreference),
    occasions: parseStringArray(obj.occasions, OCCASION_ALLOW, OCCASION_ALLOW.length),
    shoppingFrequency: parseEnum<ShoppingFrequency>(
      obj.shoppingFrequency,
      SHOPPING_FREQS,
      base.shoppingFrequency,
    ),
    budget: parseEnum<Budget>(obj.budget, BUDGETS, base.budget),
    shoppingStyle: parseEnum<ShoppingStyle>(obj.shoppingStyle, SHOPPING_STYLES, base.shoppingStyle),
    primaryGoal: parseEnum<PrimaryGoal>(obj.primaryGoal, PRIMARY_GOALS, base.primaryGoal),
    cultural: parseOptionalString(obj.cultural),
  };
}
