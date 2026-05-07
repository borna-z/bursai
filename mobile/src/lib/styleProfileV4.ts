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
//
// V4 → V3-compat shim: the AI engine consumers (`burs_style_engine`,
// `_shared/outfit-scoring*`, `style-summary-builder`, `suggest_outfit_combinations`,
// `shopping_chat`, `style_chat`) all read `preferences.styleProfile` in V3
// vocab. Until those readers are migrated to native V4, we dual-write a
// V3-shaped mirror at quiz-completion time so V4-native mobile users
// don't get silent AI-quality regression. `migrateV4ToV3Compat` below is
// a verbatim port of the web helper of the same name (see
// `src/types/styleProfile.ts`); a `touched` companion lets the caller
// omit fields the user never explicitly answered so default scalars
// (`paletteVibe: 'mixed'`, `patternComfort: 'some'`, etc.) aren't written
// as definitive answers and indistinguishable from skip-defaults
// downstream.

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
  // Note (skip-default semantics): scalar enum defaults below
  // (`paletteVibe: 'mixed'`, `patternComfort: 'some'`, `carePreference: 'mixed'`,
  // etc.) are valid USER choices AND skip-defaults, indistinguishable to
  // any AI consumer that just reads the field. The companion `Touched`
  // flag set in `StyleQuizV4Step` tracks which scalar enums the user
  // explicitly tapped; on submit, `migrateV4ToV3Compat(answers, touched)`
  // omits untouched fields from the V3-compat mirror so the engine treats
  // them as missing rather than as definitive answers. height_cm uses 170
  // (web V4 parity) as the displayed default — also gated by the touched
  // flag set so a user who skipped Q1 doesn't silently get "170 cm" written.
  return {
    version: 4,
    gender: 'prefer_not',
    height_cm: 170,
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

// ─── V4 → V3-compat shim (write path) ──────────────────────────────────────
//
// Verbatim port of the web helper of the same name (see
// `src/types/styleProfile.ts:migrateV4ToV3Compat`). Mobile cannot runtime-
// import from `src/` so the function body lives here. The on-disk shape MUST
// match the web output byte-for-byte where keys overlap.
//
// V3-shaped mirror keys are written ALONGSIDE the canonical V4 record so the
// AI engine consumers (`burs_style_engine`, `_shared/outfit-scoring*`,
// `_shared/style-summary-builder`, `suggest_outfit_combinations`,
// `shopping_chat`, `style_chat`) see populated `preferences.styleProfile`
// fields. They read V3 vocab; until they're migrated to native V4, this shim
// is the bridge.
//
// Skip semantics: `Touched` flags from `StyleQuizV4Step` indicate which
// scalar enums the user explicitly tapped. Untouched scalar fields are
// OMITTED from the V3 mirror so the engine treats them as missing rather
// than as definitive answers — see `applyTouchedOmissions` below. Array
// fields with empty defaults (`favoriteColors: []`, `archetypes: []`)
// already self-encode "user didn't pick anything" so no touched flag is
// needed there.

/** V3-shape mirror keys persisted alongside the canonical V4 record so
 * legacy AI engine readers see populated values. Matches the web's
 * `V3CompatKeys` (Partial<LegacyStyleProfile>) byte-for-byte at the JSON
 * level. Typed loosely as `Record<string, unknown>` here because we don't
 * want to drag the web's `LegacyStyleProfile` type into mobile's runtime
 * — the JSON shape is what edge functions parse. */
export type V3CompatShape = Record<string, unknown>;

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

function v4FitToV3(fit: FitOverall): 'slim' | 'regular' | 'loose' | 'oversized' {
  switch (fit) {
    case 'fitted':
      return 'slim';
    case 'relaxed':
      return 'loose';
    case 'mixed':
      return 'regular';
    case 'oversized':
      return 'oversized';
    case 'regular':
    default:
      return 'regular';
  }
}

function v4ClimateToV3(
  climate: Climate,
): 'cold' | 'temperate' | 'warm' | 'tropical' | 'mixed' {
  switch (climate) {
    case 'nordic':
      return 'cold';
    case 'mediterranean':
    case 'desert':
      return 'warm';
    case 'tropical':
      return 'tropical';
    case 'varies':
      return 'mixed';
    case 'temperate':
    default:
      return 'temperate';
  }
}

function v4LayeringToV3(layering: Layering): 'minimal' | 'moderate' | 'loves' {
  switch (layering) {
    case 'some':
      return 'moderate';
    case 'love':
      return 'loves';
    case 'minimal':
    default:
      return 'minimal';
  }
}

function v4PaletteVibeToV3(
  vibe: PaletteVibe,
): 'neutral' | 'muted' | 'bold' | 'monochrome' {
  switch (vibe) {
    case 'neutrals':
      return 'neutral';
    case 'pastels':
    case 'earth':
      return 'muted';
    case 'dark':
    case 'mixed':
      return 'monochrome';
    case 'bold':
    default:
      return 'bold';
  }
}

function v4PrimaryGoalToV3(
  goal: PrimaryGoal,
): 'save_time' | 'better_style' | 'wardrobe_org' | 'reduce_waste' | 'plan_outfits' {
  switch (goal) {
    case 'reduce_decisions':
      return 'save_time';
    case 'discover_style':
    case 'professional_polish':
    case 'fun_experimenting':
      return 'better_style';
    case 'curate_capsule':
      return 'wardrobe_org';
    case 'sustainability':
      return 'reduce_waste';
    case 'special_events':
    default:
      return 'plan_outfits';
  }
}

/** Per-question "did the user explicitly tap a scalar choice" flags. Used to
 * omit untouched scalar enums from the V3-compat mirror so default values
 * (`paletteVibe: 'mixed'`, `patternComfort: 'some'`, `carePreference: 'mixed'`,
 * etc.) aren't written as definitive answers. Array fields and free-text
 * fields self-encode "missing" via empty value (`[]` / `''`) so they're not
 * tracked here. Keys mirror `StyleProfileV4` field names where touchedness
 * matters. */
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
  formality?: boolean; // ceiling+floor are a pair; one flag for the slider
  carePreference?: boolean;
  shoppingFrequency?: boolean;
  budget?: boolean;
  shoppingStyle?: boolean;
  primaryGoal?: boolean;
}

/**
 * Merge a V4 profile with V3-compatible mirror keys so legacy edge readers see
 * populated values. Returned object has BOTH shapes (V4 + V3 compat) — V4
 * canonical-only fields (`fitOverall`, `formalityCeiling`, `archetypes`,
 * `lifestyle`, …) keep V4 shape; V3-mirror-only fields (`weekdayLife`,
 * `workFormality`, …) populate V3 names; same-name collision fields persist
 * V3 vocab so legacy edge readers (`burs_style_engine`, `style_chat`,
 * `_shared/outfit-scoring.ts`) keep emitting populated prompt lines that
 * the AI parses correctly.
 *
 * If `touched` is provided, scalar enum fields the user did NOT explicitly
 * tap are omitted from the V3 mirror (skip semantics — fixes Codex P2 where
 * `'mixed'` / `'some'` defaults were indistinguishable from valid user picks
 * downstream). Array fields and free-text fields encode "missing" via their
 * empty value and are not gated.
 *
 * Matches the web's `migrateV4ToV3Compat` byte-for-byte (see
 * `src/types/styleProfile.ts`).
 */
export function migrateV4ToV3Compat(
  v4: StyleProfileV4,
  touched?: StyleProfileV4Touched,
): StyleProfileV4 & V3CompatShape {
  // V4-only fields (no V3 collision) — spread V4 raw.
  const {
    gender: _g,
    climate: _c,
    paletteVibe: _pv,
    primaryGoal: _pg,
    layering: _l,
    favoriteColors: _fc,
    dislikedColors: _dc,
    archetypes: _a,
    occasions: _o,
    styleIcons: _si,
    cultural: _cu,
    ageRange: _ar,
    ...v4OnlyFields
  } = v4;

  // V3-mirror-only fields — V3 names V4 doesn't have. Empty strings let
  // legacy `if (sp.X)` guards skip cleanly.
  const v3MirrorOnly: V3CompatShape = {
    height: String(v4.height_cm),
    weekdayLife: '',
    workFormality: '',
    weekendLife: '',
    specialOccasion: '',
    styleWords: v4.archetypes.slice(0, 5),
    // Average floor + ceiling so comfortVsStyle reflects the user's TYPICAL
    // dress-up state, not just the upper bound. Web parity (Wave 7.9 P2 #1).
    comfortVsStyle: Math.max(
      0,
      Math.min(100, Math.round(100 - (v4.formalityFloor + v4.formalityCeiling) / 2)),
    ),
    adventurousness: '',
    trendFollowing: '',
    genderNeutral: v4.gender === 'neutral' ? 'yes' : '',
    topFit: '',
    bottomLength: '',
    patternFeeling: v4.patternComfort,
    shoppingMindset: '',
    sustainability: '',
    capsuleWardrobe: '',
    wardrobeFrustrations: [],
    hardestOccasions: v4.occasions,
    fabricFeel: '',
    signaturePieces: '',
    bursGoal: v4PrimaryGoalToV3(v4.primaryGoal),
    morningTime: '',
    freeNote: v4.cultural ?? '',
    freeText: v4.cultural ?? '',
  };

  const merged: StyleProfileV4 & V3CompatShape = {
    // 1. V3 mirror-only keys.
    ...v3MirrorOnly,
    // 2. V4-only fields (no name collision) — preserve V4 schema.
    ...v4OnlyFields,
    // 3. Pure-array / pure-string fields shared by name (no vocab translation).
    favoriteColors: v4.favoriteColors,
    dislikedColors: v4.dislikedColors,
    archetypes: v4.archetypes,
    occasions: v4.occasions,
    styleIcons: v4.styleIcons ?? '',
    cultural: v4.cultural ?? '',
    ageRange: v4.ageRange,
    // 4. Same-name collision fields — V3 vocab WINS so legacy readers parse
    //    them. V4-aware code reads `version: 4` + V4-only canonical fields.
    gender: v4GenderToV3(v4.gender),
    climate: v4ClimateToV3(v4.climate),
    layering: v4LayeringToV3(v4.layering),
    paletteVibe: v4PaletteVibeToV3(v4.paletteVibe),
    primaryGoal: v4PrimaryGoalToV3(v4.primaryGoal),
    // 5. V4 has no `fit` key; the V3 mirror's `fit` is a separate name.
    fit: v4FitToV3(v4.fitOverall),
    // Two-step cast: V3 vocab on collision keys (gender, climate, …) makes
    // the literal union narrower than V4's, so a direct `as
    // StyleProfileV4 & V3CompatShape` would fail strict type comparison.
    // The runtime shape is correct — V3 readers parse the V3 strings; V4-
    // aware code reads `version: 4` + V4-only fields and ignores the
    // collision keys.
  } as unknown as StyleProfileV4 & V3CompatShape;

  // Skip-semantics omission: scrub V3-vocab scalar mirrors the user never
  // explicitly chose, so the AI engine sees them as "missing" rather than
  // a confident default. Only fires for scalar enums where the V4 default
  // (`'mixed'`, `'some'`, …) is a valid user choice. Array / free-text
  // mirrors aren't gated — `[]` / `''` self-encode "missing".
  if (touched) {
    if (!touched.gender) delete (merged as Record<string, unknown>).gender;
    if (!touched.climate) delete (merged as Record<string, unknown>).climate;
    if (!touched.paletteVibe) delete (merged as Record<string, unknown>).paletteVibe;
    if (!touched.patternComfort) {
      delete (merged as Record<string, unknown>).patternFeeling;
    }
    if (!touched.fitOverall) delete (merged as Record<string, unknown>).fit;
    if (!touched.layering) delete (merged as Record<string, unknown>).layering;
    if (!touched.primaryGoal) {
      delete (merged as Record<string, unknown>).bursGoal;
      delete (merged as Record<string, unknown>).primaryGoal;
    }
    if (!touched.formality) {
      delete (merged as Record<string, unknown>).comfortVsStyle;
    }
    if (!touched.height_cm) delete (merged as Record<string, unknown>).height;
  }

  return merged;
}
