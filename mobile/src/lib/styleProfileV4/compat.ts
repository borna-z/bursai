import type {
  Climate,
  FitOverall,
  Gender,
  Layering,
  PaletteVibe,
  PrimaryGoal,
  StyleProfileV4,
  StyleProfileV4Touched,
  V3CompatShape,
} from './types';

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

/**
 * Merge a V4 profile with V3-compatible mirror keys so legacy edge readers see
 * populated values. Returned object has BOTH shapes (V4 + V3 compat).
 *
 * If `touched` is provided, scalar enum fields the user did NOT explicitly
 * tap are omitted from the V3 mirror.
 *
 * @deprecated Removed in a future PR once V3-consuming edge readers
 * (`burs_style_engine`, `_shared/outfit-scoring*`, `_shared/style-summary-builder`,
 * `suggest_outfit_combinations`, `shopping_chat`, `style_chat`) are migrated
 * to native V4. Until then this shim is the bridge.
 */
export function migrateV4ToV3Compat(
  v4: StyleProfileV4,
  touched?: StyleProfileV4Touched,
): StyleProfileV4 & V3CompatShape {
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

  const v3MirrorOnly: V3CompatShape = {
    height: String(v4.height_cm),
    weekdayLife: '',
    workFormality: '',
    weekendLife: '',
    specialOccasion: '',
    styleWords: v4.archetypes.slice(0, 5),
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
    ...v3MirrorOnly,
    ...v4OnlyFields,
    favoriteColors: v4.favoriteColors,
    dislikedColors: v4.dislikedColors,
    archetypes: v4.archetypes,
    occasions: v4.occasions,
    styleIcons: v4.styleIcons ?? '',
    cultural: v4.cultural ?? '',
    ageRange: v4.ageRange,
    gender: v4GenderToV3(v4.gender),
    climate: v4ClimateToV3(v4.climate),
    layering: v4LayeringToV3(v4.layering),
    paletteVibe: v4PaletteVibeToV3(v4.paletteVibe),
    primaryGoal: v4PrimaryGoalToV3(v4.primaryGoal),
    fit: v4FitToV3(v4.fitOverall),
  } as unknown as StyleProfileV4 & V3CompatShape;

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
