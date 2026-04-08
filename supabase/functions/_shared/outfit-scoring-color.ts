/**
 * outfit-scoring-color.ts — Color harmony, seasonal intelligence, seasonal transitions,
 * and behavioral style vector scoring.
 *
 * Extracted from outfit-scoring.ts — zero logic changes.
 */

import type { GarmentRow } from "./outfit-scoring.ts";
import { getMaterialGroup } from "./outfit-scoring-body.ts";

// ─────────────────────────────────────────────
// COLOR HARMONY ENGINE (HSL-based)
// ─────────────────────────────────────────────

export const COLOR_HSL: Record<string, [number, number, number]> = {
  // Neutrals
  svart: [0, 0, 5], black: [0, 0, 5],
  vit: [0, 0, 97], white: [0, 0, 97],
  grå: [0, 0, 50], grey: [0, 0, 50], gray: [0, 0, 50],
  beige: [40, 30, 80],
  krämvit: [40, 25, 93], cream: [40, 25, 93], "off-white": [40, 25, 93],
  marin: [220, 60, 20], marinblå: [220, 60, 20], navy: [220, 60, 20],
  brun: [25, 50, 30], brown: [25, 50, 30],
  taupe: [30, 15, 55],
  kamel: [30, 45, 55], camel: [30, 45, 55],
  khaki: [55, 30, 55],
  olivgrön: [80, 40, 35], olive: [80, 40, 35],
  // Blues
  blå: [220, 70, 50], blue: [220, 70, 50],
  ljusblå: [200, 60, 70], "light blue": [200, 60, 70],
  mörkblå: [220, 70, 25], "dark blue": [220, 70, 25],
  himmelsblå: [200, 70, 65], "sky blue": [200, 70, 65],
  koboltblå: [225, 80, 45], cobalt: [225, 80, 45],
  // Reds
  röd: [0, 80, 45], red: [0, 80, 45],
  vinröd: [345, 60, 30], burgundy: [345, 60, 30], bordeaux: [345, 60, 30],
  korall: [15, 70, 60], coral: [15, 70, 60],
  // Pinks
  rosa: [330, 60, 70], pink: [330, 60, 70],
  ljusrosa: [330, 50, 85], "light pink": [330, 50, 85],
  magenta: [300, 70, 45],
  // Greens
  grön: [130, 60, 40], green: [130, 60, 40],
  mörkgrön: [140, 50, 25], "dark green": [140, 50, 25],
  ljusgrön: [120, 50, 65], "light green": [120, 50, 65],
  mintgrön: [160, 50, 70], mint: [160, 50, 70],
  salvia: [140, 20, 55], sage: [140, 20, 55],
  // Yellows / Oranges
  gul: [50, 80, 55], yellow: [50, 80, 55],
  senapsgul: [45, 70, 45], mustard: [45, 70, 45],
  orange: [25, 85, 55],
  terrakotta: [15, 55, 45], terracotta: [15, 55, 45],
  // Purples
  lila: [270, 60, 50], purple: [270, 60, 50],
  lavendel: [270, 40, 70], lavender: [270, 40, 70],
  plommon: [310, 50, 30], plum: [310, 50, 30],
  // Metallics
  guld: [45, 60, 50], gold: [45, 60, 50],
  silver: [0, 0, 75],
  // Multi
  flerfärgad: [0, 0, 50], multicolor: [0, 0, 50],
};

export function getHSL(colorName: string): [number, number, number] | null {
  const key = colorName.toLowerCase().trim();
  return COLOR_HSL[key] || null;
}

export function isNeutral(hsl: [number, number, number]): boolean {
  return hsl[1] < 15 || hsl[2] < 12 || hsl[2] > 90;
}

export function hueDiff(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2);
  return Math.min(d, 360 - d);
}

// Seasonal palette definitions (hue ranges that feel right per season)
export const SEASONAL_PALETTES: Record<string, { hueRanges: [number, number][]; satRange: [number, number]; lightRange: [number, number] }> = {
  winter: { hueRanges: [[200, 280], [0, 30]], satRange: [20, 70], lightRange: [10, 40] },    // deep jewel tones, navy, burgundy
  spring: { hueRanges: [[80, 200], [320, 360]], satRange: [30, 70], lightRange: [55, 85] },   // pastels, fresh greens, soft pinks
  summer: { hueRanges: [[0, 60], [160, 220]], satRange: [40, 90], lightRange: [50, 80] },     // warm brights, ocean blues
  autumn: { hueRanges: [[10, 60], [70, 100]], satRange: [30, 70], lightRange: [25, 55] },      // earth tones, rust, olive, mustard
};

export function getCurrentSeason(): string {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

// ─────────────────────────────────────────────
// SEASONAL TRANSITION INTELLIGENCE
// ─────────────────────────────────────────────

// Transition windows: which months are "transitional" between seasons
export const SEASON_ORDER = ["winter", "spring", "summer", "autumn"] as const;
export const TRANSITION_MONTHS: Record<number, { from: string; to: string; progress: number }> = {
  // Feb: late winter → early spring (30% into transition)
  1: { from: "winter", to: "spring", progress: 0.3 },
  // March: mid transition winter→spring
  2: { from: "winter", to: "spring", progress: 0.6 },
  // May: late spring → early summer
  4: { from: "spring", to: "summer", progress: 0.3 },
  // June: mid transition spring→summer
  5: { from: "spring", to: "summer", progress: 0.6 },
  // Aug: late summer → early autumn
  7: { from: "summer", to: "autumn", progress: 0.3 },
  // Sept: mid transition summer→autumn
  8: { from: "summer", to: "autumn", progress: 0.6 },
  // Nov: late autumn → early winter
  10: { from: "autumn", to: "winter", progress: 0.3 },
  // Dec: mid transition autumn→winter
  11: { from: "autumn", to: "winter", progress: 0.6 },
};

export interface SeasonTransitionInfo {
  currentSeason: string;
  isTransitional: boolean;
  fromSeason: string;
  toSeason: string;
  /** 0 = fully in fromSeason, 1 = fully in toSeason */
  progress: number;
}

export function getSeasonTransitionInfo(): SeasonTransitionInfo {
  const month = new Date().getMonth();
  const season = getCurrentSeason();
  const trans = TRANSITION_MONTHS[month];

  if (trans) {
    return {
      currentSeason: season,
      isTransitional: true,
      fromSeason: trans.from,
      toSeason: trans.to,
      progress: trans.progress,
    };
  }

  return {
    currentSeason: season,
    isTransitional: false,
    fromSeason: season,
    toSeason: season,
    progress: 0.5,
  };
}

// Materials and categories that work across season boundaries
export const TRANSITIONAL_MATERIALS = [
  "cotton", "bomull", "jersey", "denim", "leather", "läder",
  "knit", "stickad", "linen-blend", "wool-blend", "blandull",
];

export const TRANSITIONAL_CATEGORIES = [
  "cardigan", "blazer", "light jacket", "tunn jacka", "denim jacket",
  "jeansjacka", "shirt jacket", "shacket", "vest", "väst", "hoodie",
];

export function isTransitionalGarment(garment: GarmentRow): boolean {
  const mat = (garment.material || "").toLowerCase();
  const cat = (garment.category || "").toLowerCase();
  const sub = (garment.subcategory || "").toLowerCase();
  const combined = `${cat} ${sub}`;

  // Garments tagged for multiple seasons are inherently transitional
  const tags = garment.season_tags || [];
  if (tags.length >= 2) return true;

  // Material check
  if (TRANSITIONAL_MATERIALS.some(m => mat.includes(m))) return true;

  // Category check (layering pieces)
  if (TRANSITIONAL_CATEGORIES.some(c => combined.includes(c))) return true;

  return false;
}

/**
 * Scores a garment's seasonal fit during transition periods.
 * During stable seasons → rewards in-season, penalizes off-season.
 * During transitions → rewards transitional pieces and garments matching either season.
 */
export function seasonalTransitionScore(garment: GarmentRow, transInfo: SeasonTransitionInfo): number {
  const tags = garment.season_tags || [];
  const { isTransitional, fromSeason, toSeason, progress } = transInfo;

  const matchesFrom = tags.includes(fromSeason);
  const matchesTo = tags.includes(toSeason);
  const isTransPiece = isTransitionalGarment(garment);
  const hasNoTags = tags.length === 0;

  // Base score
  let score = 5;

  if (isTransitional) {
    // TRANSITION PERIOD: blend scores from both seasons

    // Perfect: garment bridges both seasons
    if (matchesFrom && matchesTo) score += 3;
    // Good: transitional piece (layering, versatile materials)
    else if (isTransPiece) score += 2.5;
    // Outgoing season garment: decreasing value as transition progresses
    else if (matchesFrom && !matchesTo) score += 2 * (1 - progress);
    // Incoming season garment: increasing value as transition progresses
    else if (matchesTo && !matchesFrom) score += 2 * progress;
    // No tags: neutral, slight transitional bonus
    else if (hasNoTags) score += 1;
    // Off-season (neither from nor to): penalize
    else score -= 2;
  } else {
    // STABLE SEASON: straightforward seasonal scoring
    const current = transInfo.currentSeason;
    if (tags.includes(current)) score += 2;
    else if (hasNoTags) score += 0.5; // untagged = year-round
    else if (isTransPiece) score += 1; // transitional pieces always somewhat OK
    else {
      // Check adjacency: adjacent season is mildly acceptable
      const idx = SEASON_ORDER.indexOf(current as any);
      const prevSeason = SEASON_ORDER[(idx + 3) % 4];
      const nextSeason = SEASON_ORDER[(idx + 1) % 4];
      if (tags.includes(prevSeason) || tags.includes(nextSeason)) score -= 0.5;
      else score -= 2; // fully off-season
    }
  }

  return Math.max(0, Math.min(10, score));
}

export function isInSeasonalPalette(hsl: [number, number, number], season: string): boolean {
  const palette = SEASONAL_PALETTES[season];
  if (!palette) return false;
  const [h, s, l] = hsl;
  const hueMatch = palette.hueRanges.some(([min, max]) => h >= min && h <= max);
  const satMatch = s >= palette.satRange[0] && s <= palette.satRange[1];
  const lightMatch = l >= palette.lightRange[0] && l <= palette.lightRange[1];
  return hueMatch && satMatch && lightMatch;
}

export function colorHarmonyScore(colors: [number, number, number][], seasonBoost = true): number {
  if (colors.length < 2) return 8;
  const chromatic = colors.filter(c => !isNeutral(c));
  if (chromatic.length === 0) return 9; // all neutral = safe
  if (chromatic.length === 1) return 10; // neutral base + one accent = ideal

  let score = 5;
  for (let i = 0; i < chromatic.length; i++) {
    for (let j = i + 1; j < chromatic.length; j++) {
      const hd = hueDiff(chromatic[i][0], chromatic[j][0]);
      if (hd < 30) score += 2;        // analogous
      else if (hd > 150 && hd < 210) score += 1.5; // complementary
      else if (hd > 110 && hd < 130) score += 1;   // triadic
      else if (hd > 50 && hd < 90) score -= 1;     // tension
    }
  }

  // Seasonal palette bonus: reward outfits that match the current season's color mood
  if (seasonBoost) {
    const season = getCurrentSeason();
    const seasonalCount = chromatic.filter(c => isInSeasonalPalette(c, season)).length;
    if (seasonalCount > 0) {
      score += Math.min(2, seasonalCount * 0.7); // up to +2 for seasonal harmony
    }
  }

  return Math.max(0, Math.min(10, score));
}

// ─────────────────────────────────────────────
// BEHAVIORAL STYLE VECTOR (learned from usage)
// ─────────────────────────────────────────────

export interface StyleVector {
  colorTemperature: number;    // -1 (cool) to +1 (warm)
  formalityCenter: number;     // 1-5 average formality worn
  patternTolerance: number;    // 0 (solid only) to 1 (loves patterns)
  materialAffinities: Record<string, number>; // normalized weights per group
  categoryDiversity: number;   // 0-1 variety score
  neutralRatio: number;        // 0 (all chromatic) to 1 (all neutral)
  confidence: number;          // 0-1 based on data quantity
}

export interface WearLog {
  garment_id: string;
  worn_at: string; // date string
  occasion: string | null;
  event_title: string | null;
}

export function getColorTemperature(colorName: string): number {
  const hsl = getHSL(colorName);
  if (!hsl) return 0;
  if (isNeutral(hsl)) return 0;
  const h = hsl[0];
  if (h <= 60 || h >= 330) return 0.8;   // warm (reds, oranges, yellows)
  if (h >= 180 && h <= 270) return -0.8;  // cool (blues, purples)
  if (h > 60 && h < 120) return 0.3;      // warm-leaning greens
  if (h >= 120 && h < 180) return -0.3;    // cool-leaning greens
  if (h > 270 && h < 330) return -0.4;     // cool purples
  return 0;
}

export function buildStyleVector(wearLogs: WearLog[], garments: GarmentRow[]): StyleVector | null {
  if (wearLogs.length < 5) return null;

  const garmentMap = new Map(garments.map(g => [g.id, g]));
  const garmentWearWeights = new Map<string, number>();

  for (const log of wearLogs) {
    const daysSince = Math.max(0, (Date.now() - new Date(log.worn_at).getTime()) / 86400000);
    const recencyWeight = Math.pow(0.5, daysSince / 60); // 60-day half-life
    garmentWearWeights.set(log.garment_id, (garmentWearWeights.get(log.garment_id) || 0) + recencyWeight);
  }

  let totalWeight = 0;
  let colorTempSum = 0;
  let formalitySum = 0;
  let formalityCount = 0;
  let patternCount = 0;
  let neutralCount = 0;
  let chromaticCount = 0;
  const materialGroupCounts: Record<string, number> = {};
  const categoriesUsed = new Set<string>();

  for (const [garmentId, weight] of garmentWearWeights) {
    const g = garmentMap.get(garmentId);
    if (!g) continue;
    totalWeight += weight;

    colorTempSum += getColorTemperature(g.color_primary) * weight;

    const hsl = getHSL(g.color_primary);
    if (hsl) {
      if (isNeutral(hsl)) neutralCount += weight;
      else chromaticCount += weight;
    }

    if (g.formality) {
      formalitySum += g.formality * weight;
      formalityCount += weight;
    }

    if (g.pattern && g.pattern !== "solid" && g.pattern !== "enfärgad") {
      patternCount += weight;
    }

    const matGroup = getMaterialGroup(g.material);
    if (matGroup) {
      materialGroupCounts[matGroup] = (materialGroupCounts[matGroup] || 0) + weight;
    }

    categoriesUsed.add(g.category.toLowerCase());
  }

  if (totalWeight === 0) return null;

  const totalMatWeight = Object.values(materialGroupCounts).reduce((a, b) => a + b, 0);
  const materialAffinities: Record<string, number> = {};
  if (totalMatWeight > 0) {
    for (const [group, count] of Object.entries(materialGroupCounts)) {
      materialAffinities[group] = count / totalMatWeight;
    }
  }

  return {
    colorTemperature: colorTempSum / totalWeight,
    formalityCenter: formalityCount > 0 ? formalitySum / formalityCount : 3,
    patternTolerance: patternCount / totalWeight,
    materialAffinities,
    categoryDiversity: Math.min(1, categoriesUsed.size / 8),
    neutralRatio: (neutralCount + chromaticCount) > 0 ? neutralCount / (neutralCount + chromaticCount) : 0.5,
    confidence: Math.min(1, wearLogs.length / 50),
  };
}

export function styleVectorScore(garment: GarmentRow, vector: StyleVector | null): number {
  if (!vector || vector.confidence < 0.2) return 7;

  let score = 7;
  const conf = vector.confidence;

  // Color temperature alignment
  const garmentTemp = getColorTemperature(garment.color_primary);
  if (garmentTemp !== 0) {
    score += (garmentTemp * vector.colorTemperature) * 1.5 * conf;
  }

  // Formality proximity
  if (garment.formality) {
    const dist = Math.abs(garment.formality - vector.formalityCenter);
    if (dist <= 1) score += 0.5 * conf;
    else if (dist >= 3) score -= 1 * conf;
  }

  // Pattern alignment
  const hasPattern = garment.pattern && garment.pattern !== "solid" && garment.pattern !== "enfärgad";
  if (hasPattern) {
    score += (vector.patternTolerance - 0.3) * 2 * conf;
  }

  // Material affinity
  const matGroup = getMaterialGroup(garment.material);
  if (matGroup && vector.materialAffinities[matGroup]) {
    const affinity = vector.materialAffinities[matGroup];
    if (affinity > 0.3) score += 1 * conf;
    else if (affinity > 0.15) score += 0.5 * conf;
  }

  // Neutral vs chromatic alignment
  const hsl = getHSL(garment.color_primary);
  if (hsl) {
    const garmentIsNeutral = isNeutral(hsl);
    if (garmentIsNeutral && vector.neutralRatio > 0.6) score += 0.5 * conf;
    if (!garmentIsNeutral && vector.neutralRatio < 0.3) score += 0.5 * conf;
  }

  return Math.max(0, Math.min(10, score));
}
