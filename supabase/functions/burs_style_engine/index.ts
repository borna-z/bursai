import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface GarmentRow {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  color_primary: string;
  color_secondary: string | null;
  pattern: string | null;
  material: string | null;
  fit: string | null;
  formality: number | null;
  season_tags: string[] | null;
  wear_count: number | null;
  last_worn_at: string | null;
  image_path: string;
}

interface ScoredGarment {
  garment: GarmentRow;
  score: number;
  breakdown: Record<string, number>;
}

interface ComboItem {
  slot: string;
  garment: GarmentRow;
  baseScore: number;
  baseBreakdown: Record<string, number>;
}

interface ScoredCombo {
  items: ComboItem[];
  totalScore: number;
  breakdown: Record<string, number>;
}

interface WeatherInput {
  temperature?: number;
  precipitation?: string;
  wind?: string;
}

// ─────────────────────────────────────────────
// COLOR HARMONY ENGINE (HSL-based)
// ─────────────────────────────────────────────

const COLOR_HSL: Record<string, [number, number, number]> = {
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

function getHSL(colorName: string): [number, number, number] | null {
  const key = colorName.toLowerCase().trim();
  return COLOR_HSL[key] || null;
}

function isNeutral(hsl: [number, number, number]): boolean {
  return hsl[1] < 15 || hsl[2] < 12 || hsl[2] > 90;
}

function hueDiff(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2);
  return Math.min(d, 360 - d);
}

// Seasonal palette definitions (hue ranges that feel right per season)
const SEASONAL_PALETTES: Record<string, { hueRanges: [number, number][]; satRange: [number, number]; lightRange: [number, number] }> = {
  winter: { hueRanges: [[200, 280], [0, 30]], satRange: [20, 70], lightRange: [10, 40] },    // deep jewel tones, navy, burgundy
  spring: { hueRanges: [[80, 200], [320, 360]], satRange: [30, 70], lightRange: [55, 85] },   // pastels, fresh greens, soft pinks
  summer: { hueRanges: [[0, 60], [160, 220]], satRange: [40, 90], lightRange: [50, 80] },     // warm brights, ocean blues
  autumn: { hueRanges: [[10, 60], [70, 100]], satRange: [30, 70], lightRange: [25, 55] },      // earth tones, rust, olive, mustard
};

function getCurrentSeason(): string {
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
const SEASON_ORDER = ["winter", "spring", "summer", "autumn"] as const;
const TRANSITION_MONTHS: Record<number, { from: string; to: string; progress: number }> = {
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

interface SeasonTransitionInfo {
  currentSeason: string;
  isTransitional: boolean;
  fromSeason: string;
  toSeason: string;
  /** 0 = fully in fromSeason, 1 = fully in toSeason */
  progress: number;
}

function getSeasonTransitionInfo(): SeasonTransitionInfo {
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
const TRANSITIONAL_MATERIALS = [
  "cotton", "bomull", "jersey", "denim", "leather", "läder",
  "knit", "stickad", "linen-blend", "wool-blend", "blandull",
];

const TRANSITIONAL_CATEGORIES = [
  "cardigan", "blazer", "light jacket", "tunn jacka", "denim jacket",
  "jeansjacka", "shirt jacket", "shacket", "vest", "väst", "hoodie",
];

function isTransitionalGarment(garment: GarmentRow): boolean {
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
function seasonalTransitionScore(garment: GarmentRow, transInfo: SeasonTransitionInfo): number {
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

function isInSeasonalPalette(hsl: [number, number, number], season: string): boolean {
  const palette = SEASONAL_PALETTES[season];
  if (!palette) return false;
  const [h, s, l] = hsl;
  const hueMatch = palette.hueRanges.some(([min, max]) => h >= min && h <= max);
  const satMatch = s >= palette.satRange[0] && s <= palette.satRange[1];
  const lightMatch = l >= palette.lightRange[0] && l <= palette.lightRange[1];
  return hueMatch && satMatch && lightMatch;
}

function colorHarmonyScore(colors: [number, number, number][], seasonBoost = true): number {
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
// MATERIAL COMPATIBILITY
// ─────────────────────────────────────────────

const MATERIAL_GROUPS: Record<string, string[]> = {
  refined: ["silk", "siden", "cashmere", "kashmir", "satin", "chiffon", "merino"],
  casual: ["denim", "cotton", "bomull", "jersey", "fleece", "flanell", "flannel", "cord", "manchester"],
  technical: ["polyester", "nylon", "gore-tex", "softshell", "mesh", "spandex", "lycra"],
  rugged: ["leather", "läder", "suede", "mocka", "canvas", "tweed", "twill"],
  knit: ["wool", "ull", "stickad", "knit", "mohair", "angora"],
};

function getMaterialGroup(material: string | null): string | null {
  if (!material) return null;
  const m = material.toLowerCase();
  for (const [group, keywords] of Object.entries(MATERIAL_GROUPS)) {
    if (keywords.some(k => m.includes(k))) return group;
  }
  return null;
}

// Full affinity matrix: score from -2 (clash) to +2 (great pairing)
const MATERIAL_AFFINITY: Record<string, Record<string, number>> = {
  refined:   { refined: 2, casual: -1, technical: -2, rugged: 0, knit: 1 },
  casual:    { refined: -1, casual: 1, technical: 0, rugged: 1, knit: 1 },
  technical: { refined: -2, casual: 0, technical: 1, rugged: 0, knit: -1 },
  rugged:    { refined: 0, casual: 1, technical: 0, rugged: 1, knit: 1 },
  knit:      { refined: 1, casual: 1, technical: -1, rugged: 1, knit: 1 },
};

function materialCompatibility(materials: (string | null)[]): number {
  const groups = materials.map(getMaterialGroup).filter(Boolean) as string[];
  if (groups.length < 2) return 8;

  let affinitySum = 0;
  let pairCount = 0;
  const unique = [...new Set(groups)];

  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const affinity = MATERIAL_AFFINITY[unique[i]]?.[unique[j]] ?? 0;
      affinitySum += affinity;
      pairCount++;
    }
  }

  if (pairCount === 0) return 8;

  // Map affinity range (-2 to +2) to score range (2 to 10)
  const avgAffinity = affinitySum / pairCount;
  const score = 6 + avgAffinity * 2; // -2→2, 0→6, +2→10
  return Math.max(0, Math.min(10, score));
}

// ─────────────────────────────────────────────
// WEATHER MICROCLIMATE INTELLIGENCE
// ─────────────────────────────────────────────

const WARM_MATERIALS = ["wool", "ull", "fleece", "cashmere", "kashmir", "flanell", "flannel", "tweed", "dun", "down"];
const LIGHT_MATERIALS = ["cotton", "bomull", "linen", "linne", "silk", "siden", "jersey", "chiffon", "mesh"];
const WATERPROOF_MATERIALS = ["gore-tex", "polyester", "nylon", "softshell", "regn", "rain"];
const WINDPROOF_MATERIALS = ["gore-tex", "softshell", "nylon", "leather", "läder", "dun", "down"];
const BREATHABLE_MATERIALS = ["cotton", "bomull", "linen", "linne", "mesh", "jersey", "silk", "siden"];

// Wind chill approximation: feels-like temperature
function feelsLikeTemp(temp: number, wind: string | undefined): number {
  if (!wind) return temp;
  const w = wind.toLowerCase();
  if (w === "high" || w === "hög") return temp - 6;
  if (w === "medium" || w === "medel") return temp - 3;
  return temp;
}

// Layering intelligence: does the garment serve as a good layer?
function isLayeringPiece(category: string): boolean {
  const cat = category.toLowerCase();
  return ["cardigan", "blazer", "vest", "väst", "hoodie", "sweater", "tröja"].some(k => cat.includes(k));
}

function weatherSuitability(garment: GarmentRow, weather: WeatherInput): number {
  const rawTemp = weather.temperature;
  if (rawTemp === undefined) return 7;

  const feelsLike = feelsLikeTemp(rawTemp, weather.wind);
  const mat = (garment.material || "").toLowerCase();
  const cat = (garment.category || "").toLowerCase();
  const sub = (garment.subcategory || "").toLowerCase();
  const both = `${cat} ${sub}`;
  const isWarm = WARM_MATERIALS.some(w => mat.includes(w));
  const isLight = LIGHT_MATERIALS.some(l => mat.includes(l));
  const isWaterproof = WATERPROOF_MATERIALS.some(w => mat.includes(w));
  const isWindproof = WINDPROOF_MATERIALS.some(w => mat.includes(w));
  const isBreathable = BREATHABLE_MATERIALS.some(b => mat.includes(b));
  const seasonTags = garment.season_tags || [];

  let score = 7;

  // ── TEMPERATURE BANDS (using feels-like) ──
  if (feelsLike < -5) {
    // Extreme cold
    if (isWarm) score += 3;
    if (isLight && !isWarm) score -= 4;
    if (seasonTags.includes("summer")) score -= 5;
    if (seasonTags.includes("winter")) score += 2;
    if (both.includes("short") || both.includes("tank") || both.includes("sandal")) score -= 5;
  } else if (feelsLike < 5) {
    // Cold
    if (isWarm) score += 2;
    if (isLight && !isWarm) score -= 2;
    if (seasonTags.includes("summer")) score -= 3;
    if (seasonTags.includes("winter")) score += 1;
    if (both.includes("short") || both.includes("tank")) score -= 4;
    if (isLayeringPiece(cat)) score += 1; // layering weather
  } else if (feelsLike < 12) {
    // Cool — prime layering weather
    if (isLayeringPiece(cat)) score += 2;
    if (seasonTags.includes("summer") && !seasonTags.includes("spring")) score -= 1;
    if (seasonTags.includes("winter") && !isLight) score -= 1;
    if (isWarm && cat.includes("sweater")) score += 1;
  } else if (feelsLike < 20) {
    // Mild
    if (isLight) score += 1;
    if (isBreathable) score += 0.5;
    if (isWarm && (cat.includes("coat") || cat.includes("parka"))) score -= 3;
    if (seasonTags.includes("winter")) score -= 2;
  } else if (feelsLike < 28) {
    // Warm
    if (isLight) score += 2;
    if (isBreathable) score += 1;
    if (isWarm) score -= 3;
    if (both.includes("shorts") || both.includes("tank")) score += 1;
    if (seasonTags.includes("winter")) score -= 4;
  } else {
    // Extreme heat
    if (isLight && isBreathable) score += 3;
    if (isWarm) score -= 5;
    if (both.includes("shorts") || both.includes("tank") || both.includes("sandal")) score += 2;
    if (seasonTags.includes("winter")) score -= 5;
  }

  // ── WIND AWARENESS ──
  const wind = (weather.wind || "").toLowerCase();
  if (wind === "high" || wind === "hög") {
    if (isWindproof) score += 2;
    // Light fabrics suffer in high wind
    if (["chiffon", "silk", "siden"].some(f => mat.includes(f))) score -= 1;
  }

  // ── PRECIPITATION ──
  const precip = (weather.precipitation || "").toLowerCase();
  if (precip.includes("rain") || precip.includes("regn")) {
    if (isWaterproof) score += 2;
    // Suede/leather penalized in rain
    if (["suede", "mocka"].some(f => mat.includes(f))) score -= 2;
    if (["leather", "läder"].some(f => mat.includes(f)) && !isWaterproof) score -= 1;
  }
  if (precip.includes("snow") || precip.includes("snö")) {
    if (isWaterproof) score += 2;
    if (isWarm) score += 1;
    if (both.includes("boot") || both.includes("stövel")) score += 2;
    if (both.includes("sandal") || both.includes("loafer")) score -= 3;
  }

  return Math.max(0, Math.min(10, score));
}

// ─────────────────────────────────────────────
// FORMALITY MATCHING
// ─────────────────────────────────────────────

// Expanded occasion mapping with granular formality and style hints
const OCCASION_FORMALITY: Record<string, { range: [number, number]; styleHints: string[] }> = {
  // Casual / everyday
  vardag: { range: [1, 3], styleHints: ["relaxed", "comfortable"] },
  casual: { range: [1, 3], styleHints: ["relaxed"] },
  everyday: { range: [1, 3], styleHints: ["relaxed"] },
  weekend: { range: [1, 3], styleHints: ["relaxed", "layered"] },
  helg: { range: [1, 3], styleHints: ["relaxed", "layered"] },
  promenad: { range: [1, 2], styleHints: ["comfortable", "outdoor"] },
  walk: { range: [1, 2], styleHints: ["comfortable", "outdoor"] },
  // Sport
  träning: { range: [1, 1], styleHints: ["athletic", "performance"] },
  gym: { range: [1, 1], styleHints: ["athletic"] },
  sport: { range: [1, 1], styleHints: ["athletic"] },
  yoga: { range: [1, 1], styleHints: ["stretchy", "breathable"] },
  löpning: { range: [1, 1], styleHints: ["athletic", "breathable"] },
  // Work
  jobb: { range: [2, 4], styleHints: ["polished", "professional"] },
  work: { range: [2, 4], styleHints: ["polished"] },
  office: { range: [2, 4], styleHints: ["polished"] },
  kontor: { range: [2, 4], styleHints: ["polished"] },
  möte: { range: [3, 5], styleHints: ["sharp", "confident"] },
  meeting: { range: [3, 5], styleHints: ["sharp"] },
  presentation: { range: [3, 5], styleHints: ["authoritative", "sharp"] },
  intervju: { range: [3, 5], styleHints: ["confident", "polished"] },
  interview: { range: [3, 5], styleHints: ["confident"] },
  konferens: { range: [3, 4], styleHints: ["professional", "comfortable"] },
  conference: { range: [3, 4], styleHints: ["professional"] },
  // Social
  fest: { range: [3, 5], styleHints: ["expressive", "statement"] },
  party: { range: [3, 5], styleHints: ["expressive"] },
  dejt: { range: [3, 5], styleHints: ["attractive", "intentional"] },
  date: { range: [3, 5], styleHints: ["attractive"] },
  middag: { range: [3, 5], styleHints: ["elegant"] },
  dinner: { range: [3, 5], styleHints: ["elegant"] },
  brunch: { range: [2, 3], styleHints: ["smart casual", "relaxed"] },
  fika: { range: [2, 3], styleHints: ["casual chic"] },
  "after work": { range: [2, 4], styleHints: ["transitional"] },
  afterwork: { range: [2, 4], styleHints: ["transitional"] },
  mingel: { range: [3, 5], styleHints: ["social", "polished"] },
  // Formal
  bröllop: { range: [4, 5], styleHints: ["elegant", "formal"] },
  wedding: { range: [4, 5], styleHints: ["elegant", "formal"] },
  gala: { range: [5, 5], styleHints: ["black tie", "formal"] },
  ceremoni: { range: [4, 5], styleHints: ["formal", "respectful"] },
  ceremony: { range: [4, 5], styleHints: ["formal"] },
  // Travel
  resa: { range: [1, 3], styleHints: ["versatile", "comfortable"] },
  travel: { range: [1, 3], styleHints: ["versatile"] },
  flygresa: { range: [1, 2], styleHints: ["comfortable", "layered"] },
  flight: { range: [1, 2], styleHints: ["comfortable", "layered"] },
  // Education
  skola: { range: [1, 3], styleHints: ["casual"] },
  school: { range: [1, 3], styleHints: ["casual"] },
  universitet: { range: [1, 3], styleHints: ["casual", "smart"] },
  university: { range: [1, 3], styleHints: ["casual"] },
};

function getFormalityRange(occasion: string): [number, number] {
  const occ = occasion.toLowerCase();
  for (const [key, entry] of Object.entries(OCCASION_FORMALITY)) {
    if (occ.includes(key)) return entry.range;
  }
  return [1, 4]; // default permissive
}

function getOccasionStyleHints(occasion: string): string[] {
  const occ = occasion.toLowerCase();
  for (const [key, entry] of Object.entries(OCCASION_FORMALITY)) {
    if (occ.includes(key)) return entry.styleHints;
  }
  return [];
}

function formalityScore(garment: GarmentRow, occasion: string): number {
  const formality = garment.formality;
  if (!formality) return 6; // unknown = neutral
  const [min, max] = getFormalityRange(occasion);
  if (formality >= min && formality <= max) return 10;
  const distance = formality < min ? min - formality : formality - max;
  return Math.max(0, 10 - distance * 3);
}

// ─────────────────────────────────────────────
// WEAR ROTATION
// ─────────────────────────────────────────────

function wearRotationScore(garment: GarmentRow): number {
  if (!garment.last_worn_at) return 10; // never worn = max freshness
  const daysSince = Math.floor((Date.now() - new Date(garment.last_worn_at).getTime()) / 86400000);
  if (daysSince <= 1) return 0;
  if (daysSince <= 3) return 3;
  if (daysSince <= 7) return 6;
  if (daysSince <= 14) return 8;
  return 10;
}

// ─────────────────────────────────────────────
// FEEDBACK LEARNING v2 (Exponential Decay)
// ─────────────────────────────────────────────

interface FeedbackSignal {
  garmentIds: Set<string>;
  rating: number | null;
  feedback: string[] | null;
  weather: WeatherInput | null;
  generatedAt?: string | null;
}

// Exponential decay: half-life of 14 days
const FEEDBACK_HALF_LIFE_DAYS = 14;

function decayWeight(generatedAt: string | null | undefined): number {
  if (!generatedAt) return 0.5; // unknown age → half weight
  const daysSince = Math.max(0, (Date.now() - new Date(generatedAt).getTime()) / 86400000);
  return Math.pow(0.5, daysSince / FEEDBACK_HALF_LIFE_DAYS);
}

// Context-aware tags: map feedback to specific conditions
const CONTEXTUAL_TAGS: Record<string, string> = {
  "too_warm": "weather", "för varm": "weather",
  "too_cold": "weather", "för kall": "weather",
  "too_formal": "formality", "för formell": "formality",
  "too_casual": "formality", "för casual": "formality",
  "uncomfortable": "fit", "obekväm": "fit",
  "bad_color": "color", "dålig färg": "color",
  "boring": "style", "tråkig": "style",
  "loved_it": "positive", "älskade den": "positive",
};

interface GarmentPenalty {
  total: number;
  weatherPenalty: number;
  formalityPenalty: number;
  fitPenalty: number;
  positiveBoost: number;
}

function buildFeedbackPenalties(feedbackHistory: FeedbackSignal[]): Map<string, GarmentPenalty> {
  const penalties = new Map<string, GarmentPenalty>();

  const getOrInit = (id: string): GarmentPenalty => {
    if (!penalties.has(id)) {
      penalties.set(id, { total: 0, weatherPenalty: 0, formalityPenalty: 0, fitPenalty: 0, positiveBoost: 0 });
    }
    return penalties.get(id)!;
  };

  for (const signal of feedbackHistory) {
    if (!signal.rating && !signal.feedback?.length) continue;

    const weight = decayWeight(signal.generatedAt);
    const isNegative = (signal.rating && signal.rating <= 2) || false;
    const isPositive = (signal.rating && signal.rating >= 4) || false;
    const feedbackTags = signal.feedback || [];

    for (const gId of signal.garmentIds) {
      const p = getOrInit(gId);

      if (isNegative) p.total += 2 * weight;
      if (isPositive) p.positiveBoost += 1.5 * weight;

      for (const tag of feedbackTags) {
        const ctx = CONTEXTUAL_TAGS[tag];
        const tagWeight = weight * 1;
        if (ctx === "weather") p.weatherPenalty += tagWeight;
        else if (ctx === "formality") p.formalityPenalty += tagWeight;
        else if (ctx === "fit") p.fitPenalty += tagWeight;
        else if (ctx === "positive") p.positiveBoost += tagWeight;
        else if (ctx) p.total += tagWeight;
      }

      p.total += p.weatherPenalty + p.formalityPenalty + p.fitPenalty;
    }
  }
  return penalties;
}

function feedbackScore(garmentId: string, penalties: Map<string, GarmentPenalty>): number {
  const p = penalties.get(garmentId);
  if (!p) return 8; // no data = slight optimism
  const net = p.positiveBoost - p.total;
  return Math.max(0, Math.min(10, 8 + net));
}

// ─────────────────────────────────────────────
// PAIR MEMORY (Learned pairing preferences)
// ─────────────────────────────────────────────

interface PairMemoryRow {
  garment_a_id: string;
  garment_b_id: string;
  positive_count: number;
  negative_count: number;
  last_positive_at: string | null;
  last_negative_at: string | null;
}

type PairMemoryMap = Map<string, PairMemoryRow>;

function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

function buildPairMemoryMap(rows: PairMemoryRow[]): PairMemoryMap {
  const map: PairMemoryMap = new Map();
  for (const row of rows) {
    const key = pairKey(row.garment_a_id, row.garment_b_id);
    map.set(key, row);
  }
  return map;
}

function getPairMemoryScore(
  garmentIds: string[],
  pairMemory: PairMemoryMap | null
): { boost: number; penalty: number } {
  if (!pairMemory || pairMemory.size === 0 || garmentIds.length < 2) {
    return { boost: 0, penalty: 0 };
  }

  let boost = 0;
  let penalty = 0;

  for (let i = 0; i < garmentIds.length; i++) {
    for (let j = i + 1; j < garmentIds.length; j++) {
      const key = pairKey(garmentIds[i], garmentIds[j]);
      const mem = pairMemory.get(key);
      if (!mem) continue;

      // Positive: diminishing returns, capped at 3
      if (mem.positive_count > 0) {
        const recency = mem.last_positive_at
          ? Math.max(0.3, 1 - (Date.now() - new Date(mem.last_positive_at).getTime()) / (90 * 86400000))
          : 0.5;
        boost += Math.min(3, Math.log2(mem.positive_count + 1) * 1.2 * recency);
      }

      // Negative: linear with cap at 4
      if (mem.negative_count > 0) {
        const recency = mem.last_negative_at
          ? Math.max(0.3, 1 - (Date.now() - new Date(mem.last_negative_at).getTime()) / (90 * 86400000))
          : 0.5;
        penalty += Math.min(4, mem.negative_count * 1.0 * recency);
      }
    }
  }

  // Normalize by number of pairs to keep influence bounded
  const pairCount = (garmentIds.length * (garmentIds.length - 1)) / 2;
  return {
    boost: Math.min(3, boost / Math.max(1, pairCount) * 2),
    penalty: Math.min(4, penalty / Math.max(1, pairCount) * 2),
  };
}

async function recordPairOutcome(
  serviceClient: any,
  userId: string,
  garmentIds: string[],
  positive: boolean
): Promise<void> {
  if (garmentIds.length < 2) return;

  const now = new Date().toISOString();
  const upserts: any[] = [];

  for (let i = 0; i < garmentIds.length; i++) {
    for (let j = i + 1; j < garmentIds.length; j++) {
      const a = garmentIds[i] < garmentIds[j] ? garmentIds[i] : garmentIds[j];
      const b = garmentIds[i] < garmentIds[j] ? garmentIds[j] : garmentIds[i];
      upserts.push({ a, b });
    }
  }

  // Batch: read existing then upsert
  for (const { a, b } of upserts) {
    const { data: existing } = await serviceClient
      .from("garment_pair_memory")
      .select("id, positive_count, negative_count")
      .eq("user_id", userId)
      .eq("garment_a_id", a)
      .eq("garment_b_id", b)
      .maybeSingle();

    if (existing) {
      const update: Record<string, any> = { updated_at: now };
      if (positive) {
        update.positive_count = (existing.positive_count || 0) + 1;
        update.last_positive_at = now;
      } else {
        update.negative_count = (existing.negative_count || 0) + 1;
        update.last_negative_at = now;
      }
      await serviceClient
        .from("garment_pair_memory")
        .update(update)
        .eq("id", existing.id);
    } else {
      await serviceClient
        .from("garment_pair_memory")
        .insert({
          user_id: userId,
          garment_a_id: a,
          garment_b_id: b,
          positive_count: positive ? 1 : 0,
          negative_count: positive ? 0 : 1,
          last_positive_at: positive ? now : null,
          last_negative_at: positive ? null : now,
        });
    }
  }
}

// ─────────────────────────────────────────────
// STYLE PROFILE ALIGNMENT (Quiz-based)
// ─────────────────────────────────────────────

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, value));
}

function getStylePrefs(prefs: Record<string, any> | null): Record<string, any> {
  return (prefs?.styleProfile || prefs || {}) as Record<string, any>;
}

function styleAlignmentScore(garment: GarmentRow, prefs: Record<string, any> | null): number {
  if (!prefs) return 7;

  const sp = getStylePrefs(prefs);
  let score = 7;

  const favColors = (sp.favoriteColors || []) as string[];
  const dislikedColors = (sp.dislikedColors || []) as string[];
  const styleWords = ((sp.styleWords || []) as string[]).map((v) => String(v).toLowerCase());
  const paletteVibe = String(sp.paletteVibe || '').toLowerCase();
  const comfortVsStyle =
    typeof sp.comfortVsStyle === 'number' ? sp.comfortVsStyle : 50;

  const gc = garment.color_primary?.toLowerCase() || '';
  const fit = garment.fit?.toLowerCase() || '';
  const material = garment.material?.toLowerCase() || '';
  const category = garment.category?.toLowerCase() || '';
  const subcategory = garment.subcategory?.toLowerCase() || '';

  if (favColors.some((c) => gc.includes(String(c).toLowerCase()))) score += 2;
  if (dislikedColors.some((c) => gc.includes(String(c).toLowerCase()))) score -= 3;

  if (sp.fit && garment.fit && String(sp.fit).toLowerCase() === fit) {
    score += 1;
  }

  if (styleWords.includes('minimal')) {
    if (!garment.pattern || ['solid', 'none'].includes(garment.pattern.toLowerCase())) score += 0.8;
    if ((garment.formality || 0) >= 4) score += 0.5;
  }

  if (styleWords.includes('classic')) {
    if ((garment.formality || 0) >= 6) score += 0.8;
    if (['shirt', 'blazer', 'coat', 'trousers', 'loafer'].some((x) => `${category} ${subcategory}`.includes(x))) {
      score += 0.8;
    }
  }

  if (styleWords.includes('street')) {
    if (['hoodie', 'sneaker', 'cargo', 'oversized', 'relaxed'].some((x) => `${category} ${subcategory} ${fit}`.includes(x))) {
      score += 0.9;
    }
  }

  if (styleWords.includes('sporty')) {
    if (['sneaker', 'hoodie', 'track', 'running', 'trainer'].some((x) => `${category} ${subcategory}`.includes(x))) {
      score += 0.9;
    }
  }

  if (paletteVibe.includes('neutral') || paletteVibe.includes('tonal')) {
    const hsl = getHSL(garment.color_primary);
    if (hsl && isNeutral(hsl)) score += 0.8;
  }

  if (comfortVsStyle >= 65) {
    if (['relaxed', 'regular', 'oversized'].includes(fit)) score += 0.8;
    if (['jersey', 'cotton', 'knit', 'merino'].some((x) => material.includes(x))) score += 0.4;
  } else if (comfortVsStyle <= 35) {
    if ((garment.formality || 0) >= 6) score += 0.8;
    if (['wool', 'leather', 'tailored'].some((x) => material.includes(x) || subcategory.includes(x))) score += 0.4;
  }

  return clampScore(score);
}

// ─────────────────────────────────────────────
// OCCASION / STYLE / WEATHER COMBO HELPERS
// ─────────────────────────────────────────────

function garmentText(garment: GarmentRow): string {
  return [
    garment.title,
    garment.category,
    garment.subcategory,
    garment.material,
    garment.fit,
    garment.pattern,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function hasComboSlot(items: ComboItem[], slot: string): boolean {
  return items.some((item) => item.slot === slot);
}

function isWetWeather(weather: WeatherInput): boolean {
  const p = String(weather.precipitation || '').toLowerCase();
  return p !== '' && !['none', 'ingen'].includes(p);
}

function styleIntentScore(
  items: ComboItem[],
  requestedStyle: string | null,
  prefs: Record<string, any> | null
): number {
  const sp = getStylePrefs(prefs);
  const styleWords = ((sp.styleWords || []) as string[]).map((v) => String(v).toLowerCase());
  const target = [String(requestedStyle || '').toLowerCase(), ...styleWords].join(' ');

  const colors = items
    .map((item) => getHSL(item.garment.color_primary))
    .filter(Boolean) as [number, number, number][];

  const neutralRatio = colors.length
    ? colors.filter((hsl) => isNeutral(hsl)).length / colors.length
    : 0;

  const patternCount = items.filter((item) => {
    const pattern = String(item.garment.pattern || 'solid').toLowerCase();
    return pattern !== 'solid' && pattern !== 'none';
  }).length;

  const relaxedCount = items.filter((item) =>
    ['relaxed', 'oversized', 'loose'].includes(String(item.garment.fit || '').toLowerCase())
  ).length;

  const structuredCount = items.filter((item) => {
    const txt = garmentText(item.garment);
    return (item.garment.formality || 0) >= 6 || ['blazer', 'coat', 'shirt', 'loafer', 'trouser'].some((x) => txt.includes(x));
  }).length;

  const sportyCount = items.filter((item) => {
    const txt = garmentText(item.garment);
    return ['sneaker', 'hoodie', 'running', 'trainer', 'track'].some((x) => txt.includes(x));
  }).length;

  const romanticCount = items.filter((item) => {
    const txt = garmentText(item.garment);
    return ['dress', 'skirt', 'silk', 'satin', 'soft'].some((x) => txt.includes(x));
  }).length;

  const formalities = items
    .map((item) => item.garment.formality)
    .filter((v): v is number => typeof v === 'number');

  const avgFormality = formalities.length
    ? formalities.reduce((sum, v) => sum + v, 0) / formalities.length
    : 5;

  let score = 7;

  if (target.includes('minimal')) {
    score += neutralRatio * 2.5;
    score -= patternCount * 1.1;
  }

  if (target.includes('classic')) {
    score += structuredCount * 0.8;
    score += neutralRatio * 1.2;
  }

  if (target.includes('smart') || target.includes('smart-casual')) {
    if (avgFormality >= 4.5 && avgFormality <= 7.5) score += 1.5;
    else score -= 1.2;
    score += structuredCount * 0.4;
  }

  if (target.includes('street')) {
    score += relaxedCount * 0.6;
    score += sportyCount * 0.8;
  }

  if (target.includes('sporty') || target.includes('athletic')) {
    score += sportyCount * 1.2;
  }

  if (target.includes('romantic')) {
    score += romanticCount * 1.0;
  }

  const paletteVibe = String(sp.paletteVibe || '').toLowerCase();
  if ((paletteVibe.includes('neutral') || paletteVibe.includes('tonal')) && neutralRatio >= 0.5) {
    score += 0.8;
  }

  return clampScore(score);
}

function occasionTemplateScore(
  items: ComboItem[],
  occasion: string,
  weather: WeatherInput
): number {
  const occ = String(occasion || '').toLowerCase();
  const hasOuterwear = hasComboSlot(items, 'outerwear');
  const hasAccessory = hasComboSlot(items, 'accessory');

  const formalities = items
    .map((item) => item.garment.formality)
    .filter((v): v is number => typeof v === 'number');

  const avgFormality = formalities.length
    ? formalities.reduce((sum, v) => sum + v, 0) / formalities.length
    : 5;

  const shoeText = garmentText(items.find((item) => item.slot === 'shoes')?.garment || {
    id: '',
    title: '',
    category: '',
    subcategory: '',
    color_primary: '',
    color_secondary: null,
    pattern: null,
    material: null,
    fit: null,
    formality: null,
    season_tags: null,
    wear_count: null,
    last_worn_at: null,
    image_path: '',
  });

  let score = 7;

  if (['work', 'jobb'].includes(occ)) {
    if (avgFormality >= 4.5 && avgFormality <= 7.5) score += 2;
    else score -= 1.5;
    if (shoeText.includes('sandals')) score -= 2;
  } else if (['casual', 'vardag'].includes(occ)) {
    if (avgFormality >= 2.5 && avgFormality <= 5.5) score += 1.5;
  } else if (['date', 'dejt'].includes(occ)) {
    if (avgFormality >= 4 && avgFormality <= 7.5) score += 1.5;
    if (hasAccessory) score += 0.5;
  } else if (['party', 'fest'].includes(occ)) {
    if (avgFormality >= 4.5 && avgFormality <= 8.5) score += 1.2;
    if (hasAccessory) score += 0.8;
  } else if (['travel', 'resa'].includes(occ)) {
    if (hasOuterwear && (weather.temperature ?? 18) < 18) score += 1;
    if (shoeText.includes('sneaker') || shoeText.includes('boot')) score += 1;
  } else if (['formal'].includes(occ)) {
    if (avgFormality >= 7) score += 2;
    else score -= 2;
  }

  return clampScore(score);
}

function weatherPracticalityScore(items: ComboItem[], weather: WeatherInput): number {
  const temp = weather.temperature;
  const wet = isWetWeather(weather);
  const hasOuterwear = hasComboSlot(items, 'outerwear');
  const shoes = items.find((item) => item.slot === 'shoes');
  const shoeText = shoes ? garmentText(shoes.garment) : '';

  let score = 7;

  if (temp !== undefined && temp < 12 && hasOuterwear) score += 1.5;
  if (temp !== undefined && temp < 12 && !hasOuterwear) score -= 2;

  if (wet && hasOuterwear) score += 1.5;
  if (wet && !hasOuterwear) score -= 2.5;

  if (wet && shoeText.includes('sandals')) score -= 3;
  if (wet && (shoeText.includes('boot') || shoeText.includes('sneaker'))) score += 0.7;

  if (temp !== undefined && temp >= 24 && hasOuterwear) score -= 1.2;

  return clampScore(score);
}


// ─────────────────────────────────────────────
// BEHAVIORAL STYLE VECTOR (learned from usage)
// ─────────────────────────────────────────────

interface StyleVector {
  colorTemperature: number;    // -1 (cool) to +1 (warm)
  formalityCenter: number;     // 1-5 average formality worn
  patternTolerance: number;    // 0 (solid only) to 1 (loves patterns)
  materialAffinities: Record<string, number>; // normalized weights per group
  categoryDiversity: number;   // 0-1 variety score
  neutralRatio: number;        // 0 (all chromatic) to 1 (all neutral)
  confidence: number;          // 0-1 based on data quantity
}

function getColorTemperature(colorName: string): number {
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

function buildStyleVector(wearLogs: WearLog[], garments: GarmentRow[]): StyleVector | null {
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

function styleVectorScore(garment: GarmentRow, vector: StyleVector | null): number {
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

// ─────────────────────────────────────────────
// SLOT CATEGORIZATION
// ─────────────────────────────────────────────

const TOP_CATS = ["top", "shirt", "t-shirt", "blouse", "sweater", "hoodie", "polo", "tank_top", "cardigan", "tröja", "skjorta"];
const BOTTOM_CATS = ["bottom", "pants", "jeans", "trousers", "shorts", "skirt", "chinos", "byxor", "kjol"];
const SHOES_CATS = ["shoes", "sneakers", "boots", "loafers", "sandals", "heels", "skor", "stövlar"];
const OUTERWEAR_CATS = ["outerwear", "jacket", "coat", "blazer", "parka", "windbreaker", "jacka", "kappa", "rock"];
const DRESS_CATS = ["dress", "jumpsuit", "overall", "klänning"];
const ACCESSORY_CATS = ["accessory", "scarf", "hat", "belt", "bag", "watch", "jewelry", "halsduk", "mössa", "bälte", "väska"];

function categorizeSlot(category: string, subcategory: string | null): string | null {
  const cat = (category || "").toLowerCase();
  const sub = (subcategory || "").toLowerCase();
  const both = `${cat} ${sub}`;

  if (DRESS_CATS.some(d => both.includes(d))) return "dress";
  if (OUTERWEAR_CATS.some(o => both.includes(o))) return "outerwear";
  if (ACCESSORY_CATS.some(a => both.includes(a))) return "accessory";
  if (TOP_CATS.some(t => both.includes(t))) return "top";
  if (BOTTOM_CATS.some(b => both.includes(b))) return "bottom";
  if (SHOES_CATS.some(s => both.includes(s))) return "shoes";
  return null;
}

// ─────────────────────────────────────────────
// WEAR PATTERN ANALYSIS (Day-of-Week + Seasonal)
// ─────────────────────────────────────────────

interface WearLog {
  garment_id: string;
  worn_at: string; // date string
  occasion: string | null;
  event_title: string | null;
}

interface WearPatternProfile {
  // Day-of-week: garment_id → Map<dayOfWeek(0-6), count>
  dayOfWeekByGarment: Map<string, Map<number, number>>;
  // Season: garment_id → Map<season, count>
  seasonByGarment: Map<string, Map<string, number>>;
  // Category frequency by day: category → Map<dayOfWeek, count>
  categoryByDay: Map<string, Map<number, number>>;
  // Color frequency by season: color → Map<season, count>
  colorBySeason: Map<string, Map<string, number>>;
}

function getSeasonFromDate(dateStr: string): string {
  const month = new Date(dateStr).getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

function buildWearPatternProfile(wearLogs: WearLog[], garments: GarmentRow[]): WearPatternProfile {
  const garmentMap = new Map(garments.map(g => [g.id, g]));
  const profile: WearPatternProfile = {
    dayOfWeekByGarment: new Map(),
    seasonByGarment: new Map(),
    categoryByDay: new Map(),
    colorBySeason: new Map(),
  };

  for (const log of wearLogs) {
    const date = new Date(log.worn_at);
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
    const season = getSeasonFromDate(log.worn_at);
    const garment = garmentMap.get(log.garment_id);

    // Per-garment day-of-week frequency
    if (!profile.dayOfWeekByGarment.has(log.garment_id)) {
      profile.dayOfWeekByGarment.set(log.garment_id, new Map());
    }
    const dayMap = profile.dayOfWeekByGarment.get(log.garment_id)!;
    dayMap.set(dayOfWeek, (dayMap.get(dayOfWeek) || 0) + 1);

    // Per-garment seasonal frequency
    if (!profile.seasonByGarment.has(log.garment_id)) {
      profile.seasonByGarment.set(log.garment_id, new Map());
    }
    const seasonMap = profile.seasonByGarment.get(log.garment_id)!;
    seasonMap.set(season, (seasonMap.get(season) || 0) + 1);

    if (!garment) continue;

    // Category by day-of-week
    const cat = garment.category.toLowerCase();
    if (!profile.categoryByDay.has(cat)) {
      profile.categoryByDay.set(cat, new Map());
    }
    const catDayMap = profile.categoryByDay.get(cat)!;
    catDayMap.set(dayOfWeek, (catDayMap.get(dayOfWeek) || 0) + 1);

    // Color by season
    const color = garment.color_primary.toLowerCase();
    if (!profile.colorBySeason.has(color)) {
      profile.colorBySeason.set(color, new Map());
    }
    const colorSeasonMap = profile.colorBySeason.get(color)!;
    colorSeasonMap.set(season, (colorSeasonMap.get(season) || 0) + 1);
  }

  return profile;
}

function wearPatternScore(garment: GarmentRow, patterns: WearPatternProfile | null): number {
  if (!patterns) return 7; // neutral if no history

  const today = new Date();
  const dayOfWeek = today.getDay();
  const currentSeason = getCurrentSeason();
  let score = 7;

  // 1. Does user tend to wear THIS specific garment on this day of week?
  const garmentDayMap = patterns.dayOfWeekByGarment.get(garment.id);
  if (garmentDayMap) {
    const totalWears = Array.from(garmentDayMap.values()).reduce((a, b) => a + b, 0);
    const todayWears = garmentDayMap.get(dayOfWeek) || 0;
    if (totalWears >= 3) { // need enough data
      const dayRatio = todayWears / totalWears;
      const expectedRatio = 1 / 7;
      if (dayRatio > expectedRatio * 2) score += 1; // strong affinity for this day
      else if (dayRatio < expectedRatio * 0.3 && totalWears >= 5) score -= 0.5; // avoids this day
    }
  }

  // 2. Does user tend to wear THIS garment in this season?
  const garmentSeasonMap = patterns.seasonByGarment.get(garment.id);
  if (garmentSeasonMap) {
    const totalWears = Array.from(garmentSeasonMap.values()).reduce((a, b) => a + b, 0);
    const seasonWears = garmentSeasonMap.get(currentSeason) || 0;
    if (totalWears >= 3) {
      const seasonRatio = seasonWears / totalWears;
      const expectedRatio = 1 / 4;
      if (seasonRatio > expectedRatio * 2) score += 1.5; // strong seasonal preference
      else if (seasonRatio < expectedRatio * 0.2 && totalWears >= 5) score -= 1; // avoids this season
    }
  }

  // 3. Does the user wear this CATEGORY more on this day? (e.g., casual on Fridays)
  const catDayMap = patterns.categoryByDay.get(garment.category.toLowerCase());
  if (catDayMap) {
    const totalCatWears = Array.from(catDayMap.values()).reduce((a, b) => a + b, 0);
    const todayCatWears = catDayMap.get(dayOfWeek) || 0;
    if (totalCatWears >= 5) {
      const dayRatio = todayCatWears / totalCatWears;
      if (dayRatio > 1 / 7 * 2) score += 0.5; // category popular today
    }
  }

  // 4. Is this COLOR popular in the current season? (e.g., dark colors in winter)
  const colorSeasonMap = patterns.colorBySeason.get(garment.color_primary.toLowerCase());
  if (colorSeasonMap) {
    const totalColorWears = Array.from(colorSeasonMap.values()).reduce((a, b) => a + b, 0);
    const seasonColorWears = colorSeasonMap.get(currentSeason) || 0;
    if (totalColorWears >= 3) {
      const seasonRatio = seasonColorWears / totalColorWears;
      if (seasonRatio > 1 / 4 * 2) score += 0.5; // color favored this season
    }
  }

  return Math.max(0, Math.min(10, score));
}

// ─────────────────────────────────────────────
// COMFORT VS STYLE LEARNING (Step 8)
// ─────────────────────────────────────────────
// Identifies "comfort" garments (high rewear, moderate ratings)
// vs "aspiration" garments (high ratings, low rewear).
// Balances both signals to avoid suggesting only safe picks.

interface ComfortStyleProfile {
  // garment_id → { comfortSignal, aspirationSignal }
  garmentSignals: Map<string, { comfort: number; aspiration: number }>;
  // Overall user tendency: -1 (prefers comfort) to +1 (prefers style)
  userTendency: number;
}

function buildComfortStyleProfile(
  wearLogs: WearLog[],
  garments: GarmentRow[],
  feedbackHistory: FeedbackSignal[]
): ComfortStyleProfile {
  const garmentMap = new Map(garments.map(g => [g.id, g]));
  const signals = new Map<string, { comfort: number; aspiration: number }>();

  // Build rating map: garment_id → weighted avg rating
  const garmentRatings = new Map<string, { sum: number; weight: number }>();
  for (const signal of feedbackHistory) {
    if (!signal.rating) continue;
    const w = decayWeight(signal.generatedAt);
    for (const gId of signal.garmentIds) {
      const existing = garmentRatings.get(gId) || { sum: 0, weight: 0 };
      existing.sum += signal.rating * w;
      existing.weight += w;
      garmentRatings.set(gId, existing);
    }
  }

  // Build rewear frequency: garment_id → recency-weighted wear count
  const rewearCounts = new Map<string, number>();
  const sixMonthsAgo = Date.now() - 180 * 86400000;
  for (const log of wearLogs) {
    const logTime = new Date(log.worn_at).getTime();
    if (logTime < sixMonthsAgo) continue;
    const recency = Math.pow(0.5, (Date.now() - logTime) / (60 * 86400000));
    rewearCounts.set(log.garment_id, (rewearCounts.get(log.garment_id) || 0) + recency);
  }

  // Compute percentiles for normalization
  const allRewears = [...rewearCounts.values()];
  const allRatings = [...garmentRatings.entries()]
    .map(([_, v]) => v.weight > 0 ? v.sum / v.weight : 0)
    .filter(r => r > 0);

  const rewearP75 = percentile(allRewears, 0.75) || 1;
  const ratingP75 = percentile(allRatings, 0.75) || 4;

  let totalComfort = 0;
  let totalAspiration = 0;
  let count = 0;

  for (const g of garments) {
    const rewear = rewearCounts.get(g.id) || 0;
    const ratingEntry = garmentRatings.get(g.id);
    const avgRating = ratingEntry && ratingEntry.weight > 0 ? ratingEntry.sum / ratingEntry.weight : 0;

    // Comfort: high rewear relative to peers (normalized 0-1)
    const comfortSignal = Math.min(1, rewear / rewearP75);

    // Aspiration: high rating but not proportionally reworn
    let aspirationSignal = 0;
    if (avgRating > 0) {
      const normalizedRating = Math.min(1, avgRating / ratingP75);
      const rewearRatio = rewearP75 > 0 ? Math.min(1, rewear / rewearP75) : 0;
      // High rating + low rewear = aspiration piece
      aspirationSignal = normalizedRating * Math.max(0, 1 - rewearRatio * 0.7);
    }

    if (comfortSignal > 0.1 || aspirationSignal > 0.1) {
      signals.set(g.id, { comfort: comfortSignal, aspiration: aspirationSignal });
      totalComfort += comfortSignal;
      totalAspiration += aspirationSignal;
      count++;
    }
  }

  // User tendency: do they rewear favorites (comfort) or chase high-rated items (style)?
  const userTendency = count > 0
    ? Math.max(-1, Math.min(1, (totalAspiration - totalComfort) / count * 2))
    : 0;

  return { garmentSignals: signals, userTendency };
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function comfortStyleScore(garment: GarmentRow, profile: ComfortStyleProfile | null): number {
  if (!profile) return 7;
  const signal = profile.garmentSignals.get(garment.id);
  if (!signal) return 7;

  let score = 7;
  const tendency = profile.userTendency;

  // Blend: comfort-leaning users get boosted comfort picks;
  // style-leaning users get boosted aspiration picks;
  // balanced users get both.
  const comfortWeight = 0.5 - tendency * 0.3;  // 0.2–0.8
  const aspirationWeight = 0.5 + tendency * 0.3; // 0.2–0.8

  score += signal.comfort * comfortWeight * 3;     // up to +2.4
  score += signal.aspiration * aspirationWeight * 2; // up to +1.6

  return Math.max(0, Math.min(10, score));
}

// ─────────────────────────────────────────────
// BODY-AWARE FIT INTELLIGENCE (Step 10)
// ─────────────────────────────────────────────
// Uses height/weight to determine body type and recommends
// proportionally balanced silhouettes (e.g., oversized top + slim bottom).

interface BodyProfile {
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;           // rough proxy for build
  buildCategory: 'slim' | 'average' | 'athletic' | 'broad' | null;
  fitPreference: string | null; // from quiz
}

function buildBodyProfile(profileData: Record<string, any> | null): BodyProfile {
  const heightCm = profileData?.height_cm || null;
  const weightKg = profileData?.weight_kg || null;
  const prefs = profileData?.preferences || {};
  const sp = prefs.styleProfile || prefs;
  const fitPreference = sp.fit || null;

  let bmi: number | null = null;
  let buildCategory: BodyProfile['buildCategory'] = null;

  if (heightCm && weightKg && heightCm > 0) {
    const heightM = heightCm / 100;
    bmi = weightKg / (heightM * heightM);
    if (bmi < 20) buildCategory = 'slim';
    else if (bmi < 25) buildCategory = 'average';
    else if (bmi < 28) buildCategory = 'athletic';
    else buildCategory = 'broad';
  }

  return { heightCm, weightKg, bmi, buildCategory, fitPreference };
}

// Proportional balance rules: which fit combos create good silhouettes
const FIT_BALANCE_RULES: Record<string, Record<string, number>> = {
  // top fit → bottom fit → bonus (-2 to +2)
  oversized:  { slim: 2, skinny: 2, regular: 1, relaxed: -1, oversized: -2, wide: -1 },
  relaxed:    { slim: 1, skinny: 1, regular: 1, relaxed: 0, oversized: -1, wide: -1 },
  regular:    { slim: 1, skinny: 0, regular: 1, relaxed: 1, oversized: 0, wide: 0 },
  slim:       { slim: 0, skinny: -1, regular: 1, relaxed: 1, oversized: 1, wide: 1 },
  fitted:     { slim: 0, skinny: -1, regular: 1, relaxed: 1, oversized: 1, wide: 1 },
};

// Body-specific fit recommendations
const BODY_FIT_PREFERENCES: Record<string, { favors: string[]; avoids: string[] }> = {
  slim:     { favors: ['regular', 'relaxed', 'oversized'], avoids: ['skinny'] },
  average:  { favors: ['regular', 'slim', 'relaxed'], avoids: [] },
  athletic: { favors: ['regular', 'slim', 'fitted'], avoids: ['oversized'] },
  broad:    { favors: ['regular', 'relaxed', 'straight'], avoids: ['skinny', 'fitted'] },
};

function fitProportionScore(
  items: { slot: string; garment: GarmentRow }[],
  body: BodyProfile | null
): number {
  let score = 7; // neutral baseline

  // 1. Proportional balance between top and bottom
  const top = items.find(i => i.slot === 'top' || i.slot === 'dress');
  const bottom = items.find(i => i.slot === 'bottom');

  if (top?.garment.fit && bottom?.garment.fit) {
    const topFit = top.garment.fit.toLowerCase();
    const bottomFit = bottom.garment.fit.toLowerCase();
    const balance = FIT_BALANCE_RULES[topFit]?.[bottomFit];
    if (balance !== undefined) {
      score += balance; // -2 to +2
    }
  }

  // 2. Body-aware adjustments
  if (body?.buildCategory) {
    const bodyPrefs = BODY_FIT_PREFERENCES[body.buildCategory];
    if (bodyPrefs) {
      for (const item of items) {
        const fit = item.garment.fit?.toLowerCase();
        if (!fit) continue;
        if (bodyPrefs.favors.includes(fit)) score += 0.5;
        if (bodyPrefs.avoids.includes(fit)) score -= 1;
      }
    }
  }

  // 3. Height-aware: tall users can pull off more volume, shorter users benefit from streamlined looks
  if (body?.heightCm) {
    const hasOversized = items.some(i => ['oversized', 'wide', 'relaxed'].includes(i.garment.fit?.toLowerCase() || ''));
    if (body.heightCm >= 180 && hasOversized) score += 0.5;  // tall + volume = works
    if (body.heightCm < 165 && hasOversized) score -= 0.5;   // shorter + too much volume = risky
  }

  // 4. Respect user's stated fit preference if available
  if (body?.fitPreference) {
    const pref = body.fitPreference.toLowerCase();
    const matchCount = items.filter(i => i.garment.fit?.toLowerCase() === pref).length;
    if (matchCount > 0) score += 0.5;
  }

  return Math.max(0, Math.min(10, score));
}

// ─────────────────────────────────────────────
// SOCIAL CONTEXT AWARENESS (Step 13)
// ─────────────────────────────────────────────

interface SocialContextMap {
  // Normalized event title → Set of garment IDs worn at that event
  contextGarments: Map<string, Set<string>>;
  // Normalized event title → most recent date worn
  contextLastSeen: Map<string, string>;
}

function normalizeEventTitle(title: string): string {
  // Normalize to detect recurring events: lowercase, strip dates/numbers, trim
  return title
    .toLowerCase()
    .replace(/\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?/g, "") // strip dates
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun|mån|tis|ons|tor|fre|lör|sön)\w*/gi, "") // strip day names
    .replace(/\b\d+\b/g, "") // strip standalone numbers
    .replace(/\s+/g, " ")
    .trim();
}

function buildSocialContextMap(wearLogs: WearLog[]): SocialContextMap {
  const contextGarments = new Map<string, Set<string>>();
  const contextLastSeen = new Map<string, string>();

  for (const log of wearLogs) {
    if (!log.event_title) continue;
    const key = normalizeEventTitle(log.event_title);
    if (key.length < 3) continue; // skip very short/empty

    if (!contextGarments.has(key)) contextGarments.set(key, new Set());
    contextGarments.get(key)!.add(log.garment_id);

    const existing = contextLastSeen.get(key);
    if (!existing || log.worn_at > existing) {
      contextLastSeen.set(key, log.worn_at);
    }
  }

  return { contextGarments, contextLastSeen };
}

function socialContextPenalty(
  garmentId: string,
  currentEventTitle: string | null,
  socialMap: SocialContextMap
): number {
  if (!currentEventTitle) return 0; // no event context → no penalty
  const key = normalizeEventTitle(currentEventTitle);
  if (key.length < 3) return 0;

  const wornGarments = socialMap.contextGarments.get(key);
  if (!wornGarments || !wornGarments.has(garmentId)) return 0;

  // Garment was worn at this recurring event before → penalty
  // Stronger penalty if it was recent
  const lastSeen = socialMap.contextLastSeen.get(key);
  if (!lastSeen) return 1;

  const daysSince = Math.max(0, (Date.now() - new Date(lastSeen).getTime()) / 86400000);
  if (daysSince < 14) return 3; // worn at same event within 2 weeks
  if (daysSince < 30) return 2; // within a month
  if (daysSince < 60) return 1; // within 2 months
  return 0; // long ago, no penalty
}

// ─────────────────────────────────────────────
// COMPOSITE SCORING
// ─────────────────────────────────────────────

function scoreGarment(
  garment: GarmentRow,
  occasion: string,
  weather: WeatherInput,
  penalties: Map<string, GarmentPenalty>,
  prefs: Record<string, any> | null,
  patterns: WearPatternProfile | null = null,
  styleVector: StyleVector | null = null,
  comfortProfile: ComfortStyleProfile | null = null,
  socialMap: SocialContextMap | null = null,
  currentEventTitle: string | null = null,
  transInfo: SeasonTransitionInfo | null = null
): ScoredGarment {
  const ws = weatherSuitability(garment, weather);
  const fs = formalityScore(garment, occasion);
  const wr = wearRotationScore(garment);
  const fb = feedbackScore(garment.id, penalties);
  const sa = styleAlignmentScore(garment, prefs);
  const wp = wearPatternScore(garment, patterns);
  const sv = styleVectorScore(garment, styleVector);
  const cs = comfortStyleScore(garment, comfortProfile);

  // Social context penalty (avoid repeating at same recurring event)
  const scp = socialMap ? socialContextPenalty(garment.id, currentEventTitle, socialMap) : 0;

  // Seasonal transition score
  const sts = transInfo ? seasonalTransitionScore(garment, transInfo) : 7;

  // Weighted composite: 10 factors + social penalty
  const vectorConf = styleVector?.confidence || 0;
  const saWeight = 0.07 * (1 - vectorConf * 0.5);
  const svWeight = 0.07 + vectorConf * 0.04;

  const score = ws * 0.16 + fs * 0.16 + wr * 0.12 + fb * 0.09 + sa * saWeight + wp * 0.09 + sv * svWeight + cs * 0.09 + sts * 0.08 - scp * 0.5;

  return {
    garment,
    score,
    breakdown: { weather: ws, formality: fs, rotation: wr, feedback: fb, style: sa, pattern: wp, vector: sv, comfort: cs, socialPenalty: scp, seasonalTransition: sts },
  };
}

// ─────────────────────────────────────────────
// ANTI-REPETITION (Jaccard)
// ─────────────────────────────────────────────

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  let intersection = 0;
  for (const item of setA) if (setB.has(item)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

// ─────────────────────────────────────────────
// COMBO BUILDER
// ─────────────────────────────────────────────
// OUTFIT FAMILY DEDUPLICATION
// ─────────────────────────────────────────────

interface OutfitFamilySignature {
  slotStructure: string;       // e.g. "top+bottom+shoes+outerwear"
  colorDirection: string;      // e.g. "neutral-warm" or "cool-bold"
  formalityBand: string;       // "casual" | "smart-casual" | "formal"
  fitSilhouette: string;       // e.g. "fitted-fitted-regular"
  categoryKey: string;         // e.g. "shirt/jeans/sneakers"
}

function getColorTemperatureLabel(color: string): string {
  const hsl = getHSL(color);
  if (!hsl) return 'neutral';
  if (isNeutral(hsl)) return 'neutral';
  const [h] = hsl;
  if (h >= 0 && h < 60) return 'warm';
  if (h >= 60 && h < 150) return 'warm-green';
  if (h >= 150 && h < 270) return 'cool';
  return 'warm';
}

function getColorBoldness(color: string): string {
  const hsl = getHSL(color);
  if (!hsl) return 'muted';
  const [, s, l] = hsl;
  if (s > 60 && l > 30 && l < 70) return 'bold';
  return 'muted';
}

function getFormalityBand(formality: number | null): string {
  const f = formality ?? 5;
  if (f <= 3) return 'casual';
  if (f <= 6) return 'smart-casual';
  return 'formal';
}

function buildOutfitFamilySignature(items: ComboItem[]): OutfitFamilySignature {
  const sorted = [...items].sort((a, b) => a.slot.localeCompare(b.slot));

  const slotStructure = sorted.map(i => i.slot).join('+');

  // Color direction: dominant temperature + boldness
  const temps = sorted.map(i => getColorTemperatureLabel(i.garment.color_primary));
  const boldness = sorted.map(i => getColorBoldness(i.garment.color_primary));
  const dominantTemp = temps.find(t => t !== 'neutral') || 'neutral';
  const hasBold = boldness.includes('bold');
  const colorDirection = `${dominantTemp}-${hasBold ? 'bold' : 'muted'}`;

  // Formality band from average
  const formalities = sorted
    .map(i => i.garment.formality)
    .filter((v): v is number => typeof v === 'number');
  const avgFormality = formalities.length > 0
    ? formalities.reduce((s, v) => s + v, 0) / formalities.length
    : 5;
  const formalityBand = getFormalityBand(avgFormality);

  // Fit silhouette
  const fitSilhouette = sorted.map(i => fitFamily(i.garment.fit)).join('-');

  // Category key (subcategory when available for richer signal)
  const categoryKey = sorted
    .map(i => (i.garment.subcategory || i.garment.category || '').toLowerCase().slice(0, 12))
    .join('/');

  return { slotStructure, colorDirection, formalityBand, fitSilhouette, categoryKey };
}

function outfitFamilySimilarity(a: OutfitFamilySignature, b: OutfitFamilySignature): number {
  let sim = 0;
  const total = 5;

  if (a.slotStructure === b.slotStructure) sim += 1;
  if (a.colorDirection === b.colorDirection) sim += 1;
  if (a.formalityBand === b.formalityBand) sim += 1;
  if (a.fitSilhouette === b.fitSilhouette) sim += 1;
  if (a.categoryKey === b.categoryKey) sim += 1;

  return sim / total; // 0..1
}

type FamilyLabel = 'classic' | 'bold-alternative' | 'weather-ready' | 'comfort-pick' | 'dressy';

function classifyFamilyLabel(sig: OutfitFamilySignature, combo: ScoredCombo): FamilyLabel {
  if (combo.breakdown.practicality >= 8.5) return 'weather-ready';
  if (sig.colorDirection.includes('bold')) return 'bold-alternative';
  if (sig.formalityBand === 'formal') return 'dressy';
  if (sig.fitSilhouette.includes('relaxed')) return 'comfort-pick';
  return 'classic';
}

function deriveVariationReason(label: FamilyLabel, refLabel: FamilyLabel): string {
  if (label === refLabel) return '';
  const reasons: Record<FamilyLabel, string> = {
    'classic': 'safer everyday option',
    'bold-alternative': 'bolder, more expressive choice',
    'weather-ready': 'better suited for current weather',
    'comfort-pick': 'more relaxed and comfortable',
    'dressy': 'more polished and refined',
  };
  return reasons[label] || '';
}

interface DeduplicatedCombo extends ScoredCombo {
  family_label: string;
  variation_reason: string;
}

function pickRepresentativeOutfits(
  combos: ScoredCombo[],
  maxResults: number = 10,
  similarityThreshold: number = 0.8
): DeduplicatedCombo[] {
  if (combos.length === 0) return [];

  // Sort by score descending (should already be sorted, but ensure)
  const sorted = [...combos].sort((a, b) => b.totalScore - a.totalScore);

  const picked: { combo: ScoredCombo; sig: OutfitFamilySignature; label: FamilyLabel }[] = [];

  for (const combo of sorted) {
    const sig = buildOutfitFamilySignature(combo.items);

    // Check if this combo is too similar to any already-picked one
    let isTooSimilar = false;
    for (const existing of picked) {
      const sim = outfitFamilySimilarity(sig, existing.sig);
      if (sim >= similarityThreshold) {
        // Also check garment overlap (Jaccard) as a secondary filter
        const aIds = new Set(combo.items.map(i => i.garment.id));
        const bIds = new Set(existing.combo.items.map(i => i.garment.id));
        const jaccard = jaccardSimilarity(aIds, bIds);
        if (jaccard >= 0.4 || sim >= 1.0) {
          isTooSimilar = true;
          break;
        }
      }
    }

    if (!isTooSimilar) {
      const label = classifyFamilyLabel(sig, combo);
      picked.push({ combo, sig, label });
      if (picked.length >= maxResults) break;
    }
  }

  // Assign labels and variation reasons
  const refLabel = picked.length > 0 ? picked[0].label : 'classic';
  return picked.map(({ combo, label }) => ({
    ...combo,
    family_label: label,
    variation_reason: deriveVariationReason(label, refLabel),
  }));
}

// ─────────────────────────────────────────────

function buildCombos(
  slotCandidates: Record<string, ScoredGarment[]>,
  recentOutfitSets: Set<string>[],
  occasion: string,
  style: string | null,
  weather: WeatherInput,
  prefs: Record<string, any> | null,
  maxCombos: number = 10,
  body: BodyProfile | null = null,
  pairMemory: PairMemoryMap | null = null
): ScoredCombo[] {
  const tops = slotCandidates['top'] || [];
  const bottoms = slotCandidates['bottom'] || [];
  const shoes = slotCandidates['shoes'] || [];
  const outerwear = slotCandidates['outerwear'] || [];
  const dresses = slotCandidates['dress'] || [];
  const accessories = slotCandidates['accessory'] || [];

  const wet = isWetWeather(weather);
  const needsOuterwear =
    (weather.temperature !== undefined && weather.temperature < 15) || wet;

  const occasionKey = String(occasion || '').toLowerCase();
  const wantsAccessory = ['date', 'dejt', 'party', 'fest', 'work', 'jobb'].includes(occasionKey);

  const outerwearOptions: Array<ScoredGarment | null> = needsOuterwear
    ? (outerwear.length ? outerwear.slice(0, 3) : [null])
    : [null, ...outerwear.slice(0, 2)];

  const accessoryOptions: Array<ScoredGarment | null> =
    wantsAccessory && accessories.length > 0
      ? [null, ...accessories.slice(0, 2)]
      : [null];

  const combos: ScoredCombo[] = [];

  const pushCombo = (items: ComboItem[]) => {
    combos.push(
      scoreCombo(items, recentOutfitSets, occasion, weather, style, prefs, body, pairMemory)
    );
  };

  // Dress-based combos
  for (const d of dresses.slice(0, 4)) {
    for (const s of shoes.slice(0, 5)) {
      for (const ow of outerwearOptions) {
        for (const acc of accessoryOptions) {
          const items: ComboItem[] = [
            {
              slot: 'dress',
              garment: d.garment,
              baseScore: d.score,
              baseBreakdown: d.breakdown,
            },
            {
              slot: 'shoes',
              garment: s.garment,
              baseScore: s.score,
              baseBreakdown: s.breakdown,
            },
          ];

          if (ow) {
            items.push({
              slot: 'outerwear',
              garment: ow.garment,
              baseScore: ow.score,
              baseBreakdown: ow.breakdown,
            });
          }

          if (acc && acc.score >= 5.5) {
            items.push({
              slot: 'accessory',
              garment: acc.garment,
              baseScore: acc.score,
              baseBreakdown: acc.breakdown,
            });
          }

          pushCombo(items);
        }
      }
    }
  }

  // Standard combos
  for (const t of tops.slice(0, 5)) {
    for (const b of bottoms.slice(0, 5)) {
      for (const s of shoes.slice(0, 5)) {
        for (const ow of outerwearOptions) {
          for (const acc of accessoryOptions) {
            const items: ComboItem[] = [
              {
                slot: 'top',
                garment: t.garment,
                baseScore: t.score,
                baseBreakdown: t.breakdown,
              },
              {
                slot: 'bottom',
                garment: b.garment,
                baseScore: b.score,
                baseBreakdown: b.breakdown,
              },
              {
                slot: 'shoes',
                garment: s.garment,
                baseScore: s.score,
                baseBreakdown: s.breakdown,
              },
            ];

            if (ow) {
              items.push({
                slot: 'outerwear',
                garment: ow.garment,
                baseScore: ow.score,
                baseBreakdown: ow.breakdown,
              });
            }

            if (acc && acc.score >= 5.5) {
              items.push({
                slot: 'accessory',
                garment: acc.garment,
                baseScore: acc.score,
                baseBreakdown: acc.breakdown,
              });
            }

            pushCombo(items);
          }
        }
      }
    }
  }

  const unique = new Map<string, ScoredCombo>();

  for (const combo of combos.sort((a, b) => b.totalScore - a.totalScore)) {
    const key = combo.items
      .map((item) => `${item.slot}:${item.garment.id}`)
      .sort()
      .join('|');

    if (!unique.has(key)) {
      unique.set(key, combo);
    }
  }

  // Exact-id dedup first, then family-level dedup
  const exactDeduped = Array.from(unique.values())
    .sort((a, b) => b.totalScore - a.totalScore);

  return pickRepresentativeOutfits(exactDeduped, maxCombos, 0.8);
}

function scoreCombo(
  items: ComboItem[],
  recentSets: Set<string>[],
  occasion: string,
  weather: WeatherInput,
  style: string | null,
  prefs: Record<string, any> | null,
  body: BodyProfile | null = null,
  pairMemory: PairMemoryMap | null = null
): ScoredCombo {
  const colors = items
    .map((item) => getHSL(item.garment.color_primary))
    .filter(Boolean) as [number, number, number][];

  const colorScore = colorHarmonyScore(colors);
  const matScore = materialCompatibility(items.map((item) => item.garment.material));

  const formalities = items
    .map((item) => item.garment.formality)
    .filter((v): v is number => typeof v === 'number');

  let formalityConsistency = 10;
  if (formalities.length >= 2) {
    const spread = Math.max(...formalities) - Math.min(...formalities);
    formalityConsistency = Math.max(0, 10 - spread * 2);
  }

  const comboSet = new Set(items.map((item) => item.garment.id));
  let repetitionPenalty = 0;

  for (const recent of recentSets) {
    const sim = jaccardSimilarity(comboSet, recent);
    if (sim >= 0.6) repetitionPenalty += 3;
    else if (sim >= 0.4) repetitionPenalty += 1;
  }

  const fitScore = fitProportionScore(items, body);

  const avgBaseScore =
    items.reduce((sum, item) => sum + item.baseScore, 0) / items.length;

  const styleScore = styleIntentScore(items, style, prefs);
  const occasionScore = occasionTemplateScore(items, occasion, weather);
  const practicality = weatherPracticalityScore(items, weather);

  // Pair memory scoring
  const garmentIds = items.map(i => i.garment.id);
  const pairMem = getPairMemoryScore(garmentIds, pairMemory);

  const totalScore =
    avgBaseScore * 0.32 +
    colorScore * 0.15 +
    matScore * 0.07 +
    formalityConsistency * 0.11 +
    fitScore * 0.09 +
    styleScore * 0.09 +
    occasionScore * 0.09 +
    practicality * 0.08 +
    pairMem.boost -
    pairMem.penalty -
    repetitionPenalty;

  const finalScore = Math.max(0, totalScore);

  return {
    items,
    totalScore: finalScore,
    breakdown: {
      overall: finalScore,
      color: colorScore,
      color_harmony: colorScore,
      material: matScore,
      material_compatibility: matScore,
      formalityConsistency,
      formality: formalityConsistency,
      item_strength: avgBaseScore,
      style_intent: styleScore,
      occasion_fit: occasionScore,
      practicality,
      fitProportion: fitScore,
      repetitionPenalty,
      pair_memory_boost: pairMem.boost,
      pair_memory_penalty: pairMem.penalty,
    },
  };
}

// ─────────────────────────────────────────────
// LOCALE
// ─────────────────────────────────────────────

const LOCALE_NAMES: Record<string, string> = {
  sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "finska",
  de: "Deutsch", fr: "français", es: "español", it: "italiano",
  pt: "português", nl: "Nederlands", ja: "日本語", ko: "한국어",
  ar: "العربية", fa: "فارسی", zh: "中文", pl: "polski",
};

// ─────────────────────────────────────────────
// STYLE CONTEXT BUILDER
// ─────────────────────────────────────────────

function buildStyleContext(preferences: Record<string, any> | null): string {
  if (!preferences) return "";
  const sp = preferences.styleProfile || preferences;
  const lines: string[] = [];
  if (sp.gender) lines.push(`Gender: ${sp.gender}`);
  if (sp.ageRange) lines.push(`Age: ${sp.ageRange}`);
  if (sp.styleWords?.length) lines.push(`Style words: ${sp.styleWords.join(", ")}`);
  if (sp.comfortVsStyle !== undefined) lines.push(`Comfort vs style: ${sp.comfortVsStyle}/100`);
  if (sp.adventurousness) lines.push(`Adventurousness: ${sp.adventurousness}`);
  if (sp.favoriteColors?.length) lines.push(`Favorite colors: ${sp.favoriteColors.join(", ")}`);
  if (sp.dislikedColors?.length) lines.push(`Avoids: ${sp.dislikedColors.join(", ")}`);
  if (sp.paletteVibe) lines.push(`Palette: ${sp.paletteVibe}`);
  if (sp.fit) lines.push(`Fit: ${sp.fit}`);
  if (sp.layering) lines.push(`Layering: ${sp.layering}`);
  if (sp.fabricFeel) lines.push(`Fabrics: ${sp.fabricFeel}`);
  if (sp.primaryGoal) lines.push(`Goal: ${sp.primaryGoal}`);
  return lines.join(". ");
}

// ─────────────────────────────────────────────
// AI REFINEMENT
// ─────────────────────────────────────────────

const TOOL_SELECT = {
  type: "function" as const,
  function: {
    name: "select_outfit",
    description: "Pick the best outfit from pre-scored candidates",
    parameters: {
      type: "object",
      properties: {
        chosen_index: { type: "number", description: "0-based index of the best combo" },
        explanation: { type: "string", description: "2-3 sentence explanation of why this outfit works" },
      },
      required: ["chosen_index", "explanation"],
      additionalProperties: false,
    },
  },
};

const TOOL_SUGGEST = {
  type: "function" as const,
  function: {
    name: "suggest_outfits",
    description: "Select 2-3 outfits from pre-scored candidates",
    parameters: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              combo_index: { type: "number" },
              title: { type: "string" },
              explanation: { type: "string" },
              occasion: { type: "string" },
            },
            required: ["combo_index", "title", "explanation", "occasion"],
            additionalProperties: false,
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  },
};

async function aiRefine(
  combos: ScoredCombo[],
  mode: "generate" | "suggest",
  occasion: string,
  style: string | null,
  weather: WeatherInput,
  styleContext: string,
  locale: string
): Promise<any> {
  const localeName = LOCALE_NAMES[locale] || "English";

  const comboDescriptions = combos.map((combo, idx) => {
    const parts = combo.items.map(i =>
      `${i.slot}: ${i.garment.title} (${i.garment.color_primary}${i.garment.material ? ", " + i.garment.material : ""})`
    );
    return `Combo ${idx}: [score: ${combo.totalScore.toFixed(1)}] ${parts.join(" + ")}`;
  }).join("\n");

  const styleHints = getOccasionStyleHints(occasion);
  const season = getCurrentSeason();
  const hintsStr = styleHints.length > 0 ? `\nSTYLE DIRECTION: ${styleHints.join(", ")}` : "";
  const seasonStr = `\nSEASON: ${season}`;

  const systemPrompt = mode === "generate"
    ? `You are a world-class stylist. Pick the SINGLE best outfit from the pre-scored candidates below. Consider overall aesthetic, color harmony, seasonal appropriateness, and suitability for the occasion.

OCCASION: ${occasion}${style ? `\nSTYLE: ${style}` : ""}${hintsStr}${seasonStr}
WEATHER: ${weather.temperature !== undefined ? weather.temperature + "°C" : "unknown"}${weather.precipitation ? ", " + weather.precipitation : ""}${weather.wind ? ", wind: " + weather.wind : ""}
${styleContext ? `\nUSER PROFILE: ${styleContext}` : ""}

Write the explanation in ${localeName}.

CANDIDATES:
${comboDescriptions}`
    : `You are a world-class stylist. Select the 2-3 BEST and most DIVERSE outfits from the candidates below. Each should suit a different occasion or vibe. Prioritize variety.

${styleContext ? `USER PROFILE: ${styleContext}` : ""}

Write all text in ${localeName}.

CANDIDATES:
${comboDescriptions}`;

  const tool = mode === "generate" ? TOOL_SELECT : TOOL_SUGGEST;
  const toolName = mode === "generate" ? "select_outfit" : "suggest_outfits";

  try {
    const { data } = await callBursAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: mode === "generate" ? "Pick the best outfit." : "Select the best 2-3 outfits." },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
      complexity: "standard",
      max_tokens: mode === "generate" ? 200 : estimateMaxTokens({ outputItems: 3, perItemTokens: 100, baseTokens: 150 }),
    });
    return { data };
  } catch (e: any) {
    if (e.status === 429) return { error: "rate_limit", status: 429 };
    if (e.status === 402) return { error: "payment", status: 402 };
    console.error("AI gateway error:", e);
    return { error: "ai_error", status: 500 };
  }
}

// ─────────────────────────────────────────────
// SWAP MODE
// ─────────────────────────────────────────────

// ── Swap-specific helpers ──

function fitFamily(fit: string | null | undefined): string {
  const v = String(fit || '').toLowerCase();
  if (['oversized', 'relaxed', 'loose', 'wide'].some((x) => v.includes(x))) return 'relaxed';
  if (['slim', 'skinny', 'fitted', 'tailored'].some((x) => v.includes(x))) return 'fitted';
  return 'regular';
}

function visualWeight(garment: GarmentRow | null | undefined): number {
  if (!garment) return 5;
  const txt = garmentText(garment);
  let score = 5;

  if (['boot', 'coat', 'puffer', 'chunky', 'wool', 'leather'].some((x) => txt.includes(x))) score += 2;
  if (['sandal', 'linen', 'lightweight', 'tank', 'tee'].some((x) => txt.includes(x))) score -= 1.5;

  const formality = garment.formality ?? 5;
  score += (formality - 5) * 0.15;

  return clampScore(score);
}

function formalityAlignmentScore(
  garment: GarmentRow,
  others: GarmentRow[],
  currentGarment: GarmentRow | null
): number {
  const allFormalities = others
    .map((g) => g.formality)
    .filter((v): v is number => typeof v === 'number');

  const currentFormality = currentGarment?.formality;
  const candidateFormality = garment.formality ?? 5;

  if (allFormalities.length === 0 && typeof currentFormality !== 'number') return 7;

  const target =
    typeof currentFormality === 'number'
      ? currentFormality
      : allFormalities.reduce((sum, v) => sum + v, 0) / allFormalities.length;

  const diff = Math.abs(candidateFormality - target);
  return clampScore(10 - diff * 2);
}

function fitConsistencyScore(
  garment: GarmentRow,
  others: GarmentRow[],
  currentGarment: GarmentRow | null
): number {
  const candidateFit = fitFamily(garment.fit);
  const currentFit = fitFamily(currentGarment?.fit);
  let score = 7;

  if (currentGarment && candidateFit === currentFit) score += 2;
  else if (currentGarment && candidateFit !== currentFit) score -= 1.2;

  const relaxedOthers = others.filter((g) => fitFamily(g.fit) === 'relaxed').length;
  const fittedOthers = others.filter((g) => fitFamily(g.fit) === 'fitted').length;

  if (candidateFit === 'relaxed' && relaxedOthers >= fittedOthers) score += 0.7;
  if (candidateFit === 'fitted' && fittedOthers > relaxedOthers) score += 0.7;

  return clampScore(score);
}

function dnaPreservationScore(
  garment: GarmentRow,
  currentGarment: GarmentRow | null,
  others: GarmentRow[]
): number {
  if (!currentGarment) return 7;

  let score = 7;

  const currentText = garmentText(currentGarment);
  const candidateText = garmentText(garment);

  const currentFit = fitFamily(currentGarment.fit);
  const candidateFit = fitFamily(garment.fit);
  if (currentFit === candidateFit) score += 1.5;

  const currentFormality = currentGarment.formality ?? 5;
  const candidateFormality = garment.formality ?? 5;
  const formalityDiff = Math.abs(candidateFormality - currentFormality);
  score += Math.max(0, 1.8 - formalityDiff * 0.6);

  const currentWeight = visualWeight(currentGarment);
  const candidateWeight = visualWeight(garment);
  const weightDiff = Math.abs(candidateWeight - currentWeight);
  score += Math.max(0, 1.2 - weightDiff * 0.4);

  const sameMaterial =
    currentGarment.material &&
    garment.material &&
    currentGarment.material.toLowerCase() === garment.material.toLowerCase();
  if (sameMaterial) score += 0.8;

  const samePattern =
    (currentGarment.pattern || 'solid').toLowerCase() ===
    (garment.pattern || 'solid').toLowerCase();
  if (samePattern) score += 0.5;

  const othersText = others.map(garmentText).join(' ');
  if (currentText.includes('sneaker') && candidateText.includes('sneaker')) score += 0.7;
  if (currentText.includes('loafer') && candidateText.includes('loafer')) score += 0.7;
  if (currentText.includes('coat') && candidateText.includes('jacket')) score += 0.3;
  if (othersText.includes('tailored') && candidateText.includes('hoodie')) score -= 1.5;

  return clampScore(score);
}

function swapPracticalityScore(
  garment: GarmentRow,
  slot: string,
  weather: WeatherInput
): number {
  const txt = garmentText(garment);
  const temp = weather.temperature;
  const precipitation = String(weather.precipitation || '').toLowerCase();
  const wet = precipitation !== '' && !['none', 'ingen'].includes(precipitation);

  let score = 7;

  if (slot === 'shoes') {
    if (wet && txt.includes('sandals')) score -= 4;
    if (wet && (txt.includes('boot') || txt.includes('sneaker'))) score += 1;
  }

  if (slot === 'outerwear') {
    if (temp !== undefined && temp < 12) score += 1.5;
    if (wet) score += 1.5;
    if (temp !== undefined && temp >= 24) score -= 1.2;
  }

  if (slot === 'top' || slot === 'dress') {
    if (temp !== undefined && temp >= 24 && ['wool', 'heavy knit', 'turtleneck'].some((x) => txt.includes(x))) {
      score -= 2;
    }
  }

  return clampScore(score);
}

type SwapMode = 'safe' | 'bold' | 'fresh';

function expressiveLiftScore(
  garment: GarmentRow,
  currentGarment: GarmentRow | null
): number {
  const txt = garmentText(garment);
  const hsl = getHSL(garment.color_primary);
  const currentHsl = currentGarment ? getHSL(currentGarment.color_primary) : null;

  let score = 5.5;

  if (hsl && !isNeutral(hsl)) score += 1.2;
  if (garment.pattern && !['solid', 'none'].includes(garment.pattern.toLowerCase())) score += 1.2;
  if (['leather', 'boot', 'loafer', 'blazer', 'coat', 'silk', 'satin'].some((x) => txt.includes(x))) score += 0.8;

  if (currentHsl && hsl) {
    const hd = Math.abs(hsl[0] - currentHsl[0]);
    if (hd >= 18) score += 0.5;
  }

  if (currentGarment) {
    const formalityDiff = Math.abs((garment.formality ?? 5) - (currentGarment.formality ?? 5));
    if (formalityDiff <= 2) score += 0.6;
    else if (formalityDiff > 3.5) score -= 1.0;
  }

  return clampScore(score);
}

function controlledNoveltyScore(
  garment: GarmentRow,
  currentGarment: GarmentRow | null,
  colorHarmony: number,
  formalityAlignment: number,
  dnaPreservation: number
): number {
  if (!currentGarment) return 6.5;

  let score = 6;

  const currentColor = String(currentGarment.color_primary || '').toLowerCase();
  const candidateColor = String(garment.color_primary || '').toLowerCase();
  const currentMaterial = String(currentGarment.material || '').toLowerCase();
  const candidateMaterial = String(garment.material || '').toLowerCase();

  if (candidateColor && candidateColor !== currentColor) score += 1.0;
  if (candidateMaterial && candidateMaterial !== currentMaterial) score += 0.8;
  if (fitFamily(garment.fit) !== fitFamily(currentGarment.fit)) score += 0.6;

  if (candidateColor === currentColor && candidateMaterial === currentMaterial) score -= 1.4;

  if (colorHarmony < 5 || formalityAlignment < 5 || dnaPreservation < 4.5) score -= 2.2;

  return clampScore(score);
}

function scoreSwapCandidates(
  slot: string,
  currentGarmentId: string,
  otherItems: { slot: string; garment: GarmentRow }[],
  allGarments: GarmentRow[],
  occasion: string,
  weather: WeatherInput,
  penalties: Map<string, GarmentPenalty>,
  prefs: Record<string, any> | null,
  swapMode: SwapMode = 'safe',
  pairMemory: PairMemoryMap | null = null
): ScoredGarment[] {
  const currentGarment = allGarments.find((g) => g.id === currentGarmentId) || null;

  const slotGarments = allGarments.filter((g) => {
    const gSlot = categorizeSlot(g.category, g.subcategory);
    return gSlot === slot && g.id !== currentGarmentId;
  });

  const otherGarments = otherItems.map((i) => i.garment).filter(Boolean);
  const otherColors = otherGarments
    .map((g) => getHSL(g.color_primary))
    .filter(Boolean) as [number, number, number][];

  return slotGarments
    .map((garment) => {
      const base = scoreGarment(garment, occasion, weather, penalties, prefs);

      const gColor = getHSL(garment.color_primary);
      const colorHarmony =
        gColor && otherColors.length > 0 ? colorHarmonyScore([...otherColors, gColor]) : 7;

      const materialCompat = materialCompatibility([
        ...otherGarments.map((g) => g.material),
        garment.material,
      ]);

      const formalityAlignment = formalityAlignmentScore(
        garment,
        otherGarments,
        currentGarment
      );

      const fitConsistency = fitConsistencyScore(
        garment,
        otherGarments,
        currentGarment
      );

      const dnaPreservation = dnaPreservationScore(
        garment,
        currentGarment,
        otherGarments
      );

      const practicality = swapPracticalityScore(garment, slot, weather);
      const expressiveLift = expressiveLiftScore(garment, currentGarment);
      const freshness = controlledNoveltyScore(
        garment,
        currentGarment,
        colorHarmony,
        formalityAlignment,
        dnaPreservation
      );

      // Pair memory: score candidate against all other garments in the outfit
      const swapPairIds = [garment.id, ...otherItems.map(i => i.garment.id)];
      const pairMem = getPairMemoryScore(swapPairIds, pairMemory);

      let totalScore = 0;

      if (swapMode === 'safe') {
        totalScore =
          base.score * 0.24 +
          dnaPreservation * 0.30 +
          colorHarmony * 0.11 +
          materialCompat * 0.07 +
          formalityAlignment * 0.09 +
          fitConsistency * 0.06 +
          practicality * 0.05 +
          pairMem.boost * 0.08 -
          pairMem.penalty * 0.10;
      } else if (swapMode === 'bold') {
        totalScore =
          base.score * 0.20 +
          dnaPreservation * 0.15 +
          colorHarmony * 0.11 +
          materialCompat * 0.05 +
          formalityAlignment * 0.09 +
          fitConsistency * 0.04 +
          practicality * 0.05 +
          expressiveLift * 0.17 +
          freshness * 0.05 +
          pairMem.boost * 0.06 -
          pairMem.penalty * 0.08;
      } else {
        totalScore =
          base.score * 0.21 +
          dnaPreservation * 0.16 +
          colorHarmony * 0.11 +
          materialCompat * 0.06 +
          formalityAlignment * 0.08 +
          fitConsistency * 0.05 +
          practicality * 0.05 +
          expressiveLift * 0.06 +
          freshness * 0.13 +
          pairMem.boost * 0.06 -
          pairMem.penalty * 0.08;
      }

      if (formalityAlignment < 4.5) totalScore -= 1.5;
      if (colorHarmony < 4.5) totalScore -= 1.2;
      if (swapMode === 'safe' && dnaPreservation < 4.5) totalScore -= 2;

      const finalScore = Math.max(0, totalScore);

      return {
        garment,
        score: finalScore,
        breakdown: {
          overall: finalScore,
          item_strength: base.score,
          dna_preservation: dnaPreservation,
          color_harmony: colorHarmony,
          material_compatibility: materialCompat,
          formality_alignment: formalityAlignment,
          fit_consistency: fitConsistency,
          practicality,
          expressive_lift: expressiveLift,
          freshness,
          pair_memory_boost: pairMem.boost,
          pair_memory_penalty: pairMem.penalty,
          swap_mode: swapMode === 'safe' ? 1 : swapMode === 'bold' ? 2 : 3,
        },
      } as ScoredGarment;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// ─────────────────────────────────────────────
// MAIN SERVER
// ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const mode: string = body.mode || "generate"; // "generate" | "suggest" | "swap" | "record_pair"

    // ── RECORD PAIR OUTCOME (lightweight, early return) ──
    if (mode === "record_pair") {
      const garmentIds: string[] = body.garment_ids || [];
      const positive: boolean = body.positive !== false;
      if (garmentIds.length >= 2) {
        const svc = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await recordPairOutcome(svc, userId, garmentIds, positive);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const occasion: string = body.occasion || "vardag";
    const style: string | null = body.style || null;
    const weather: WeatherInput = body.weather || { precipitation: "none", wind: "low" };
    const locale: string = body.locale || "sv";
    const eventTitle: string | null = body.event_title || null; // Social context
    const preferGarmentIds: Set<string> = new Set(body.prefer_garment_ids || []);

    // For swap mode
    const swapSlot: string | null = body.swap_slot || null;
    const currentGarmentId: string | null = body.current_garment_id || null;
    const otherItemsRaw: { slot: string; garment_id: string }[] | null = body.other_items || null;
    const swapMode: SwapMode =
      body.swap_mode === 'bold' || body.swap_mode === 'fresh' ? body.swap_mode : 'safe';

    // Fetch data in parallel
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [garmentsRes, profileRes, recentOutfitsRes, feedbackRes, wearLogsRes, laundryCountRes, pairMemoryRes] = await Promise.all([
      supabase
        .from("garments")
        .select("id, title, category, subcategory, color_primary, color_secondary, pattern, material, fit, formality, season_tags, wear_count, last_worn_at, image_path")
        .eq("user_id", userId)
        .eq("in_laundry", false),
      supabase.from("profiles").select("preferences, height_cm, weight_kg").eq("id", userId).single(),
      serviceSupabase
        .from("outfit_items")
        .select("outfit_id, garment_id, outfits!inner(user_id, generated_at)")
        .eq("outfits.user_id", userId)
        .order("outfits(generated_at)", { ascending: false })
        .limit(50),
      // Fetch outfits with ratings/feedback for learning (include generated_at for decay)
      supabase
        .from("outfits")
        .select("id, rating, feedback, weather, generated_at")
        .eq("user_id", userId)
        .not("rating", "is", null)
        .order("generated_at", { ascending: false })
        .limit(30),
      // Fetch wear logs for pattern analysis + social context (last 6 months)
      supabase
        .from("wear_logs")
        .select("garment_id, worn_at, occasion, event_title")
        .eq("user_id", userId)
        .gte("worn_at", new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0])
        .order("worn_at", { ascending: false })
        .limit(500),
      // Count garments currently in laundry (Step 14: Laundry Cycle)
      supabase
        .from("garments")
        .select("id, title, category", { count: "exact", head: false })
        .eq("user_id", userId)
        .eq("in_laundry", true),
      // Fetch pair memory for learned pairing preferences
      supabase
        .from("garment_pair_memory")
        .select("garment_a_id, garment_b_id, positive_count, negative_count, last_positive_at, last_negative_at")
        .eq("user_id", userId)
        .limit(500),
    ]);

    if (garmentsRes.error) throw garmentsRes.error;
    const garments = garmentsRes.data as GarmentRow[];

    if (garments.length < 3) {
      return new Response(
        JSON.stringify({ error: "You need at least 3 garments to generate an outfit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 14: Laundry cycle info
    const laundryItems = (laundryCountRes.data || []) as { id: string; title: string; category: string }[];
    const laundryCount = laundryItems.length;

    const preferences = (profileRes.data?.preferences as Record<string, any>) || null;
    const bodyProfile = buildBodyProfile(profileRes.data);

    // Build feedback penalties from historical ratings
    const feedbackSignals: FeedbackSignal[] = [];
    if (feedbackRes.data?.length) {
      const ratedOutfitIds = feedbackRes.data.map(o => o.id);
      // Fetch items for rated outfits
      const { data: ratedItems } = await serviceSupabase
        .from("outfit_items")
        .select("outfit_id, garment_id")
        .in("outfit_id", ratedOutfitIds);

      const itemsByOutfit = new Map<string, Set<string>>();
      for (const item of ratedItems || []) {
        if (!itemsByOutfit.has(item.outfit_id)) itemsByOutfit.set(item.outfit_id, new Set());
        itemsByOutfit.get(item.outfit_id)!.add(item.garment_id);
      }

      for (const outfit of feedbackRes.data) {
        feedbackSignals.push({
          garmentIds: itemsByOutfit.get(outfit.id) || new Set(),
          rating: outfit.rating,
          feedback: outfit.feedback,
          weather: outfit.weather as WeatherInput | null,
          generatedAt: (outfit as any).generated_at || null,
        });
      }
    }
    const penalties = buildFeedbackPenalties(feedbackSignals);

    // Build pair memory from DB
    const pairMemory = buildPairMemoryMap((pairMemoryRes.data || []) as PairMemoryRow[]);

    // Build wear pattern profile and style vector from historical wear logs
    const wearLogs = (wearLogsRes.data || []) as WearLog[];
    const wearPatterns = wearLogs.length > 0
      ? buildWearPatternProfile(wearLogs, garments)
      : null;
    const styleVector = wearLogs.length >= 5
      ? buildStyleVector(wearLogs, garments)
      : null;
    const comfortProfile = wearLogs.length >= 5
      ? buildComfortStyleProfile(wearLogs, garments, feedbackSignals)
      : null;
    // Build social context map for recurring event awareness
    const socialMap = wearLogs.length > 0 ? buildSocialContextMap(wearLogs) : null;
    // Seasonal transition info
    const transInfo = getSeasonTransitionInfo();

    // Build recent outfit sets for anti-repetition
    const recentOutfitSets: Set<string>[] = [];
    if (recentOutfitsRes.data?.length) {
      const outfitMap = new Map<string, Set<string>>();
      for (const item of recentOutfitsRes.data) {
        if (!outfitMap.has(item.outfit_id)) outfitMap.set(item.outfit_id, new Set());
        outfitMap.get(item.outfit_id)!.add(item.garment_id);
      }
      for (const [, ids] of Array.from(outfitMap.entries()).slice(0, 10)) {
        recentOutfitSets.push(ids);
      }
    }

    // ── SWAP MODE ──
    if (mode === "swap" && swapSlot && currentGarmentId) {
      const garmentMap = new Map(garments.map(g => [g.id, g]));
      const otherItems = (otherItemsRaw || [])
        .map(i => ({ slot: i.slot, garment: garmentMap.get(i.garment_id)! }))
        .filter(i => i.garment);

      const candidates = scoreSwapCandidates(
        swapSlot, currentGarmentId, otherItems, garments, occasion, weather, penalties, preferences, swapMode, pairMemory
      );

      return new Response(JSON.stringify({
        candidates: candidates.slice(0, 10).map(c => ({
          garment: c.garment,
          score: c.score,
          breakdown: c.breakdown,
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GENERATE / SUGGEST MODE ──

    // Score all garments per slot
    const slotCandidates: Record<string, ScoredGarment[]> = {};
    for (const garment of garments) {
      const slot = categorizeSlot(garment.category, garment.subcategory);
      if (!slot) continue;
      if (!slotCandidates[slot]) slotCandidates[slot] = [];
      const scored = scoreGarment(garment, occasion, weather, penalties, preferences, wearPatterns, styleVector, comfortProfile, socialMap, eventTitle, transInfo);
      // Boost preferred (unused) garments
      if (preferGarmentIds.size > 0 && preferGarmentIds.has(garment.id)) {
        scored.score += 2.5;
      }
      slotCandidates[slot].push(scored);
    }

    // Sort each slot by score
    for (const slot of Object.keys(slotCandidates)) {
      slotCandidates[slot].sort((a, b) => b.score - a.score);
    }

    // Build combos
    const combos = buildCombos(slotCandidates, recentOutfitSets, occasion, style, weather, preferences, 10, bodyProfile, pairMemory);

    if (combos.length === 0) {
      return new Response(
        JSON.stringify({ error: "Not enough matching garments" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const styleContext = buildStyleContext(preferences);

    // AI refinement
    const aiMode = mode === "suggest" ? "suggest" : "generate";
    const aiResult = await aiRefine(combos, aiMode, occasion, style, weather, styleContext, locale);

    if (aiResult.error) {
      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests, please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResult.status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Fallback: use best scoring combo without AI explanation
      console.warn("AI refinement failed, using deterministic fallback");
      const best = combos[0];
      if (aiMode === "suggest") {
        const suggestions = combos.slice(0, 3).map((c, i) => ({
          title: `Outfit ${i + 1}`,
          garment_ids: c.items.map(item => item.garment.id),
          garments: c.items.map(item => item.garment),
          explanation: "",
          occasion,
        }));
        return new Response(JSON.stringify({ suggestions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        items: best.items.map(i => ({ slot: i.slot, garment_id: i.garment.id })),
        explanation: "",
        style_score: best.breakdown,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── FORMAT RESPONSE ──

    if (aiMode === "generate") {
      const chosenIdx = Math.min(aiResult.data.chosen_index || 0, combos.length - 1);
      const chosen = combos[chosenIdx];
      return new Response(JSON.stringify({
        items: chosen.items.map(i => ({ slot: i.slot, garment_id: i.garment.id })),
        explanation: aiResult.data.explanation || "",
        style_score: chosen.breakdown,
        laundry: laundryCount > 0 ? { count: laundryCount, items: laundryItems.slice(0, 5).map(i => ({ id: i.id, title: i.title, category: i.category })) } : undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Suggest mode
    const suggestions = (aiResult.data.suggestions || []).map((s: any) => {
      const idx = Math.min(s.combo_index || 0, combos.length - 1);
      const combo = combos[idx];
      return {
        title: s.title,
        garment_ids: combo.items.map((i: any) => i.garment.id),
        garments: combo.items.map((i: any) => i.garment),
        explanation: s.explanation,
        occasion: s.occasion,
      };
    });

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("BURS Style Engine error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
