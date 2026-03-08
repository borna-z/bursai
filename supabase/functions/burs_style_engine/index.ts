import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

interface ScoredCombo {
  items: { slot: string; garment: GarmentRow }[];
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
// STYLE PROFILE ALIGNMENT (Quiz-based)
// ─────────────────────────────────────────────

function styleAlignmentScore(garment: GarmentRow, prefs: Record<string, any> | null): number {
  if (!prefs) return 7;
  const sp = prefs.styleProfile || prefs;
  let score = 7;

  // Favorite colors boost
  const favColors = (sp.favoriteColors || []) as string[];
  const dislikedColors = (sp.dislikedColors || []) as string[];
  const gc = garment.color_primary?.toLowerCase() || "";
  if (favColors.some(c => gc.includes(c.toLowerCase()))) score += 2;
  if (dislikedColors.some(c => gc.includes(c.toLowerCase()))) score -= 3;

  // Fit preference
  if (sp.fit && garment.fit) {
    if (sp.fit === garment.fit) score += 1;
  }

  return Math.max(0, Math.min(10, score));
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
  comfortProfile: ComfortStyleProfile | null = null
): ScoredGarment {
  const ws = weatherSuitability(garment, weather);
  const fs = formalityScore(garment, occasion);
  const wr = wearRotationScore(garment);
  const fb = feedbackScore(garment.id, penalties);
  const sa = styleAlignmentScore(garment, prefs);
  const wp = wearPatternScore(garment, patterns);
  const sv = styleVectorScore(garment, styleVector);
  const cs = comfortStyleScore(garment, comfortProfile);

  // Weighted composite: 9 factors
  const vectorConf = styleVector?.confidence || 0;
  const saWeight = 0.08 * (1 - vectorConf * 0.5);
  const svWeight = 0.08 + vectorConf * 0.04;

  const score = ws * 0.18 + fs * 0.18 + wr * 0.14 + fb * 0.10 + sa * saWeight + wp * 0.10 + sv * svWeight + cs * 0.10 + 0.02 * 7;

  return {
    garment,
    score,
    breakdown: { weather: ws, formality: fs, rotation: wr, feedback: fb, style: sa, pattern: wp, vector: sv, comfort: cs },
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

function buildCombos(
  slotCandidates: Record<string, ScoredGarment[]>,
  recentOutfitSets: Set<string>[],
  weather: WeatherInput,
  maxCombos: number = 10,
  body: BodyProfile | null = null
): ScoredCombo[] {
  const tops = slotCandidates["top"] || [];
  const bottoms = slotCandidates["bottom"] || [];
  const shoes = slotCandidates["shoes"] || [];
  const outerwear = slotCandidates["outerwear"] || [];
  const dresses = slotCandidates["dress"] || [];

  const needsOuterwear = (weather.temperature !== undefined && weather.temperature < 15) ||
    (weather.precipitation && !["none", "ingen"].includes(weather.precipitation.toLowerCase()));

  const combos: ScoredCombo[] = [];

  // Dress-based combos
  for (const d of dresses.slice(0, 3)) {
    for (const s of shoes.slice(0, 5)) {
      const items = [
        { slot: "dress", garment: d.garment },
        { slot: "shoes", garment: s.garment },
      ];
      if (needsOuterwear && outerwear.length > 0) {
        items.push({ slot: "outerwear", garment: outerwear[0].garment });
      }
      combos.push(scoreCombo(items, recentOutfitSets, body));
    }
  }

  // Standard combos: top × bottom × shoes
  for (const t of tops.slice(0, 5)) {
    for (const b of bottoms.slice(0, 5)) {
      for (const s of shoes.slice(0, 5)) {
        const items = [
          { slot: "top", garment: t.garment },
          { slot: "bottom", garment: b.garment },
          { slot: "shoes", garment: s.garment },
        ];
        if (needsOuterwear && outerwear.length > 0) {
          items.push({ slot: "outerwear", garment: outerwear[0].garment });
        }
        combos.push(scoreCombo(items, recentOutfitSets, body));
      }
    }
  }

  // Add variety with different outerwear
  if (outerwear.length > 1 && combos.length > 0) {
    const best = combos.sort((a, b) => b.totalScore - a.totalScore)[0];
    for (const ow of outerwear.slice(1, 3)) {
      const newItems = best.items.filter(i => i.slot !== "outerwear");
      newItems.push({ slot: "outerwear", garment: ow.garment });
      combos.push(scoreCombo(newItems, recentOutfitSets, body));
    }
  }

  // Sort by total score, return top N
  return combos.sort((a, b) => b.totalScore - a.totalScore).slice(0, maxCombos);
}

function scoreCombo(
  items: { slot: string; garment: GarmentRow }[],
  recentSets: Set<string>[],
  body: BodyProfile | null = null
): ScoredCombo {
  // Color harmony across all items
  const colors = items
    .map(i => getHSL(i.garment.color_primary))
    .filter(Boolean) as [number, number, number][];
  const colorScore = colorHarmonyScore(colors);

  // Material compatibility
  const matScore = materialCompatibility(items.map(i => i.garment.material));

  // Formality consistency
  const formalities = items.map(i => i.garment.formality).filter(Boolean) as number[];
  let formalityConsistency = 10;
  if (formalities.length >= 2) {
    const spread = Math.max(...formalities) - Math.min(...formalities);
    formalityConsistency = Math.max(0, 10 - spread * 2);
  }

  // Anti-repetition
  const comboSet = new Set(items.map(i => i.garment.id));
  let repetitionPenalty = 0;
  for (const recent of recentSets) {
    const sim = jaccardSimilarity(comboSet, recent);
    if (sim >= 0.6) repetitionPenalty += 3;
    else if (sim >= 0.4) repetitionPenalty += 1;
  }

  // Fit proportion score (body-aware)
  const fitScore = fitProportionScore(items, body);

  // Average individual scores
  const avgIndividual = items.reduce((sum, i) => sum + 7, 0) / items.length;

  const totalScore = colorScore * 0.22 + matScore * 0.13 + formalityConsistency * 0.18 + avgIndividual * 0.22 + fitScore * 0.10 - repetitionPenalty + 0.15 * 7;

  return {
    items,
    totalScore,
    breakdown: {
      color: colorScore,
      material: matScore,
      formalityConsistency,
      fitProportion: fitScore,
      repetitionPenalty,
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
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: mode === "generate" ? "Pick the best outfit." : "Select the best 2-3 outfits." },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) return { error: "rate_limit", status: 429 };
    if (resp.status === 402) return { error: "payment", status: 402 };
    const errText = await resp.text();
    console.error("AI gateway error:", resp.status, errText);
    return { error: "ai_error", status: 500 };
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) return { error: "no_output", status: 500 };

  try {
    return { data: JSON.parse(toolCall.function.arguments) };
  } catch {
    return { error: "parse_error", status: 500 };
  }
}

// ─────────────────────────────────────────────
// SWAP MODE
// ─────────────────────────────────────────────

function scoreSwapCandidates(
  slot: string,
  currentGarmentId: string,
  otherItems: { slot: string; garment: GarmentRow }[],
  allGarments: GarmentRow[],
  occasion: string,
  weather: WeatherInput,
  penalties: Map<string, GarmentPenalty>,
  prefs: Record<string, any> | null
): ScoredGarment[] {
  const slotGarments = allGarments.filter(g => {
    const gSlot = categorizeSlot(g.category, g.subcategory);
    return gSlot === slot && g.id !== currentGarmentId;
  });

  const otherColors = otherItems
    .map(i => getHSL(i.garment.color_primary))
    .filter(Boolean) as [number, number, number][];

  return slotGarments.map(garment => {
    const base = scoreGarment(garment, occasion, weather, penalties, prefs);
    
    // Additional: color harmony with existing items
    const gColor = getHSL(garment.color_primary);
    if (gColor && otherColors.length > 0) {
      const harmony = colorHarmonyScore([...otherColors, gColor]);
      base.score = base.score * 0.6 + harmony * 0.4;
      base.breakdown.colorHarmony = harmony;
    }

    // Material compatibility with existing items
    const otherMats = otherItems.map(i => i.garment.material);
    const matCompat = materialCompatibility([...otherMats, garment.material]);
    base.score = base.score * 0.85 + matCompat * 0.15;
    base.breakdown.materialCompat = matCompat;

    return base;
  }).sort((a, b) => b.score - a.score);
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
    const mode: string = body.mode || "generate"; // "generate" | "suggest" | "swap"
    const occasion: string = body.occasion || "vardag";
    const style: string | null = body.style || null;
    const weather: WeatherInput = body.weather || { precipitation: "none", wind: "low" };
    const locale: string = body.locale || "sv";

    // For swap mode
    const swapSlot: string | null = body.swap_slot || null;
    const currentGarmentId: string | null = body.current_garment_id || null;
    const otherItemsRaw: { slot: string; garment_id: string }[] | null = body.other_items || null;

    // Fetch data in parallel
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [garmentsRes, profileRes, recentOutfitsRes, feedbackRes, wearLogsRes] = await Promise.all([
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
      // Fetch wear logs for pattern analysis (last 6 months)
      supabase
        .from("wear_logs")
        .select("garment_id, worn_at, occasion")
        .eq("user_id", userId)
        .gte("worn_at", new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0])
        .order("worn_at", { ascending: false })
        .limit(500),
    ]);

    if (garmentsRes.error) throw garmentsRes.error;
    const garments = garmentsRes.data as GarmentRow[];

    if (garments.length < 3) {
      return new Response(
        JSON.stringify({ error: "Du behöver minst 3 plagg för att generera en outfit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        swapSlot, currentGarmentId, otherItems, garments, occasion, weather, penalties, preferences
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
      slotCandidates[slot].push(scoreGarment(garment, occasion, weather, penalties, preferences, wearPatterns, styleVector, comfortProfile));
    }

    // Sort each slot by score
    for (const slot of Object.keys(slotCandidates)) {
      slotCandidates[slot].sort((a, b) => b.score - a.score);
    }

    // Build combos
    const combos = buildCombos(slotCandidates, recentOutfitSets, weather, 10, bodyProfile);

    if (combos.length === 0) {
      return new Response(
        JSON.stringify({ error: "Inte tillräckligt med matchande plagg" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const styleContext = buildStyleContext(preferences);

    // AI refinement
    const aiMode = mode === "suggest" ? "suggest" : "generate";
    const aiResult = await aiRefine(combos, aiMode, occasion, style, weather, styleContext, locale);

    if (aiResult.error) {
      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ error: "För många förfrågningar, försök igen." }), {
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
