/**
 * Wave 7 P45 — Style DNA Quiz V4 schema.
 *
 * Twelve-question rebuild that supersedes StyleQuizV3 / QuickStyleQuiz.
 * Saved to `profiles.preferences.styleProfile` with `version: 4` so older
 * AI consumers can detect the upgraded shape and adjust prompt building.
 *
 * Migration: `migrateV3ToV4(v3)` lifts overlapping V3 fields into the V4
 * shape using best-guess defaults for new dimensions (height_cm 0,
 * lifestyle even-split, formality midpoints, etc.). Real users land
 * directly on V4 via the new quiz; the migration helper exists for
 * back-compat against any existing v3 records read by AI prompt builders.
 */

import type { StyleProfile as LegacyStyleProfile } from '@/types/preferences';

export const STYLE_PROFILE_VERSION = 4 as const;

// ─── Enums (string unions) ───

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

// ─── Catalog constants ───

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

/** 18-swatch palette mirrors the QuickStyleQuiz set — keep IDs stable across V3/V4. */
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

// ─── Core schema ───

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

// ─── Defaults / factory ───

export function createEmptyStyleProfileV4(): StyleProfileV4 {
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

// ─── V3 → V4 migration helper ───

/**
 * Upgrade an existing V3 record (or the legacy untyped StyleProfile shape)
 * to V4. Used by AI prompt builders that may still encounter older records;
 * the live quiz writes V4 directly. Best-guess mappings:
 *
 *  - V3 `gender: 'male'` → V4 `gender: 'masculine'`
 *  - V3 `gender: 'female'` → V4 `gender: 'feminine'`
 *  - V3 `gender: 'nonbinary'` → V4 `gender: 'neutral'`
 *  - V3 `fit: 'loose'` → V4 `fitOverall: 'relaxed'`
 *  - V3 `workFormality: 'business'/'formal'` → ceiling 80, else 60
 *  - V3 `morningTime: 'enjoy'` → primaryGoal `discover_style`
 *  - Lifestyle / build / fabricPreferred default to even / prefer_not / [].
 */
export function migrateV3ToV4(
  v3: Partial<LegacyStyleProfile> & Record<string, unknown>,
): StyleProfileV4 {
  const base = createEmptyStyleProfileV4();

  const v3Gender = typeof v3.gender === 'string' ? v3.gender : '';
  const gender: Gender =
    v3Gender === 'male'
      ? 'masculine'
      : v3Gender === 'female'
        ? 'feminine'
        : v3Gender === 'nonbinary'
          ? 'neutral'
          : 'prefer_not';

  const v3Age = typeof v3.ageRange === 'string' ? v3.ageRange : '';
  const ageRange: AgeRange = ((): AgeRange => {
    switch (v3Age) {
      case '18-24':
      case '25-34':
      case '35-44':
      case '45-54':
        return v3Age;
      case '55+':
        return '55-64';
      default:
        return base.ageRange;
    }
  })();

  const v3Climate = typeof v3.climate === 'string' ? v3.climate : '';
  const climate: Climate =
    v3Climate === 'nordic'
      ? 'nordic'
      : v3Climate === 'temperate'
        ? 'temperate'
        : v3Climate === 'warm'
          ? 'mediterranean'
          : 'varies';

  const v3Fit = typeof v3.fit === 'string' ? v3.fit : '';
  const fitOverall: FitOverall =
    v3Fit === 'loose'
      ? 'relaxed'
      : v3Fit === 'slim'
        ? 'fitted'
        : v3Fit === 'depends'
          ? 'mixed'
          : 'regular';

  const v3Formality = typeof v3.workFormality === 'string' ? v3.workFormality : '';
  const formalityCeiling =
    v3Formality === 'formal' ? 90 : v3Formality === 'business' ? 75 : v3Formality === 'smart_casual' ? 55 : 60;

  const v3Pattern = typeof v3.patternFeeling === 'string' ? v3.patternFeeling : '';
  const patternComfort: PatternComfort =
    v3Pattern === 'love'
      ? 'love'
      : v3Pattern === 'some'
        ? 'some'
        : v3Pattern === 'solids'
          ? 'solids_only'
          : 'some';

  const v3Palette = typeof v3.paletteVibe === 'string' ? v3.paletteVibe : '';
  const paletteVibe: PaletteVibe =
    v3Palette === 'neutrals'
      ? 'neutrals'
      : v3Palette === 'bold'
        ? 'bold'
        : v3Palette === 'dark'
          ? 'dark'
          : v3Palette === 'pastels'
            ? 'pastels'
            : 'mixed';

  const v3Goal = typeof v3.bursGoal === 'string' ? v3.bursGoal : '';
  const primaryGoal: PrimaryGoal =
    v3Goal === 'better_wardrobe'
      ? 'curate_capsule'
      : v3Goal === 'personal_style'
        ? 'discover_style'
        : v3Goal === 'plan_events'
          ? 'special_events'
          : 'reduce_decisions';

  const v3Height = typeof v3.height === 'string' ? Number(v3.height) : 0;

  return {
    ...base,
    gender,
    height_cm: Number.isFinite(v3Height) && v3Height > 0 ? v3Height : 0,
    ageRange,
    climate,
    archetypes: Array.isArray(v3.styleWords) ? (v3.styleWords as string[]).slice(0, 5) : [],
    styleIcons: typeof v3.styleIcons === 'string' ? v3.styleIcons : '',
    favoriteColors: Array.isArray(v3.favoriteColors) ? (v3.favoriteColors as string[]).slice(0, 3) : [],
    dislikedColors: Array.isArray(v3.dislikedColors) ? (v3.dislikedColors as string[]).slice(0, 3) : [],
    paletteVibe,
    patternComfort,
    fitOverall,
    formalityCeiling,
    formalityFloor: Math.max(0, formalityCeiling - 30),
    occasions: Array.isArray(v3.hardestOccasions) ? (v3.hardestOccasions as string[]) : [],
    primaryGoal,
    cultural: typeof v3.freeText === 'string' ? v3.freeText : '',
  };
}

// ─── V4 → V3 compat shim (write path) ───
//
// Persisted V4 records carry V3-shaped mirror keys so legacy edge-function
// readers (`burs_style_engine`, `style_chat`, `_shared/outfit-scoring.ts`)
// keep emitting populated prompt lines until they're migrated to the V4
// schema. Used at quiz-completion time to merge the V4 object with the V3
// keys it implies. Both shapes coexist on the saved object.

/** Mirror keys from the legacy V3 `StyleProfile` shape. Optional everywhere
 * because not every V3 field has a clean V4 source — readers already guard
 * with `?.` / `if (sp.X)` checks so missing keys degrade gracefully. */
export type V3CompatKeys = Partial<LegacyStyleProfile>;

/** Map V4 gender enum → V3 `'male' | 'female' | 'nonbinary' | 'prefer_not'`.
 * V4 'feminine' → V3 'female', V4 'masculine' → V3 'male', V4 'neutral' →
 * V3 'nonbinary', V4 'prefer_not' passes through. */
function v4GenderToV3(gender: Gender): 'male' | 'female' | 'nonbinary' | 'prefer_not' {
  switch (gender) {
    case 'feminine':
      return 'female';
    case 'masculine':
      return 'male';
    case 'neutral':
      return 'nonbinary';
    case 'prefer_not':
    default:
      return 'prefer_not';
  }
}

/**
 * Merge a V4 profile with V3-compatible mirror keys so legacy readers see
 * populated values. Returned object has BOTH shapes (V4 + V3) — V4 readers
 * use the canonical V4 keys, V3 readers find their expected keys populated.
 *
 * Heuristics:
 *  - `comfortVsStyle: 100 - formalityCeiling` (ceiling 90 = comfort 10,
 *    ceiling 30 = comfort 70). Rough but lets the legacy comfort scoring
 *    in `_shared/outfit-scoring.ts` keep producing useful gradients.
 *  - V3 `wardrobeFrustrations` doesn't exist in V4 — defaulted to `[]`.
 *  - V3 fields V4 doesn't capture (weekday, weekend, workFormality,
 *    specialOccasion, topStyle, bottomLength, etc.) defaulted to `''` so
 *    legacy `if (sp.X)` guards skip cleanly.
 */
export function migrateV4ToV3Compat(
  v4: StyleProfileV4,
): StyleProfileV4 & V3CompatKeys {
  const compat: V3CompatKeys = {
    // Identity
    gender: v4GenderToV3(v4.gender),
    ageRange: v4.ageRange,
    climate: v4.climate,
    height: String(v4.height_cm),
    // Daily life — V4 doesn't capture; legacy guards skip
    weekdayLife: '',
    workFormality: '',
    weekendLife: '',
    specialOccasion: '',
    // Style direction
    styleWords: v4.archetypes.slice(0, 5),
    comfortVsStyle: 100 - v4.formalityCeiling,
    adventurousness: '',
    trendFollowing: '',
    genderNeutral: v4.gender === 'neutral' ? 'yes' : 'no',
    // Fit & silhouette
    fit: v4.fitOverall,
    layering: v4.layering,
    topFit: '',
    bottomLength: '',
    // Color & pattern
    favoriteColors: v4.favoriteColors,
    dislikedColors: v4.dislikedColors,
    paletteVibe: v4.paletteVibe,
    patternFeeling: v4.patternComfort,
    // Philosophy
    shoppingMindset: '',
    sustainability: '',
    capsuleWardrobe: '',
    wardrobeFrustrations: [],
    // Inspiration
    styleIcons: v4.styleIcons ?? '',
    hardestOccasions: v4.occasions,
    fabricFeel: '',
    signaturePieces: '',
    // Goals
    primaryGoal: v4.primaryGoal,
    bursGoal: v4.primaryGoal,
    morningTime: '',
    freeNote: v4.cultural ?? '',
    freeText: v4.cultural ?? '',
  };
  return { ...v4, ...compat };
}
