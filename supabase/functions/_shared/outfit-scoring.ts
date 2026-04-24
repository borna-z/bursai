/**
 * outfit-scoring.ts — Garment scoring, color harmony, weather, formality,
 * feedback, pair memory, style alignment, enrichment, layering, completeness,
 * wear patterns, comfort, body profile, social context, and uniform detection.
 *
 * Extracted from burs_style_engine/index.ts — zero logic changes.
 */

import { classifySlot } from "./burs-slots.ts";
import { collectStyleSignals, hasStyleSignal, collectOccasionSignals, hasOccasionSignal, normalizeSignalText } from "./style-signals.ts";
import { validateCompleteOutfit } from "./outfit-validation.ts";

// Internal imports from split modules
import { getHSL, isNeutral, getCurrentSeason, styleVectorScore, seasonalTransitionScore } from "./outfit-scoring-color.ts";
import type { StyleVector, SeasonTransitionInfo, WearLog } from "./outfit-scoring-color.ts";
import { decayWeight, comfortStyleScore, socialContextPenalty, personalUniformScore, garmentReadinessSignals } from "./outfit-scoring-body.ts";
import type { ComfortStyleProfile, SocialContextMap, PersonalUniform } from "./outfit-scoring-body.ts";

// Re-export split modules for backward compatibility
export * from "./outfit-scoring-color.ts";
export * from "./outfit-scoring-body.ts";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface GarmentRow {
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
  created_at: string | null;
  enrichment_status: string | null;
  ai_raw: any;
  // Enrichment fields from ai_raw (populated at load time with safe defaults)
  silhouette: string;           // e.g. "boxy", "fitted", "relaxed", "straight", "a-line"
  visual_weight: number;        // 1-10, higher = heavier/chunkier
  texture_intensity: number;    // 1-10, 1=smooth, 10=bold texture
  layering_role: string;        // "base", "mid", "outer", "standalone"
  versatility_score: number;    // 1-10, how many contexts it works in
  occasion_tags: string[];      // e.g. ["casual", "work", "date"]
  style_archetype: string;      // e.g. "minimal", "classic", "street", "romantic"
}

export interface ScoredGarment {
  garment: GarmentRow;
  score: number;
  breakdown: Record<string, number>;
}

export interface ComboItem {
  slot: string;
  garment: GarmentRow;
  baseScore: number;
  baseBreakdown: Record<string, number>;
}

export interface ScoredCombo {
  items: ComboItem[];
  totalScore: number;
  breakdown: Record<string, number>;
}

export interface WeatherInput {
  temperature?: number;
  precipitation?: string;
  wind?: string;
}

export interface DayContextInput {
  dominant_occasion?: string;
  dominant_formality?: number;
  strategy?: string;
  transition_complexity?: string;
  transition_summary?: string;
  weather_sensitivity?: string;
  weather_constraints?: string[];
  wardrobe_priorities?: string[];
  anchor_event?: { title?: string; occasion?: string } | null;
  first_important_event?: { title?: string } | null;
  final_event?: { title?: string; occasion?: string } | null;
  emphasis?: {
    comfort?: number;
    polish?: number;
    versatility?: number;
    weather_protection?: number;
    travel_practicality?: number;
  };
}

// ─────────────────────────────────────────────
// WEATHER MICROCLIMATE INTELLIGENCE
// ─────────────────────────────────────────────

export const WARM_MATERIALS = ["wool", "ull", "fleece", "cashmere", "kashmir", "flanell", "flannel", "tweed", "dun", "down"];
export const LIGHT_MATERIALS = ["cotton", "bomull", "linen", "linne", "silk", "siden", "jersey", "chiffon", "mesh"];
export const WATERPROOF_MATERIALS = ["gore-tex", "polyester", "nylon", "softshell", "regn", "rain"];
export const WINDPROOF_MATERIALS = ["gore-tex", "softshell", "nylon", "leather", "läder", "dun", "down"];
export const BREATHABLE_MATERIALS = ["cotton", "bomull", "linen", "linne", "mesh", "jersey", "silk", "siden"];

// Wind chill approximation: feels-like temperature
export function feelsLikeTemp(temp: number, wind: string | undefined): number {
  if (!wind) return temp;
  const w = wind.toLowerCase();
  if (w === "high" || w === "hög") return temp - 6;
  if (w === "medium" || w === "medel") return temp - 3;
  return temp;
}

// Layering intelligence: does the garment serve as a good layer?
export function isLayeringPiece(category: string): boolean {
  const cat = category.toLowerCase();
  return ["cardigan", "blazer", "vest", "väst", "hoodie", "sweater", "tröja"].some(k => cat.includes(k));
}

export function weatherSuitability(garment: GarmentRow, weather: WeatherInput): number {
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
export const OCCASION_FORMALITY: Record<string, { range: [number, number]; styleHints: string[] }> = {
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

export function getFormalityRange(occasion: string): [number, number] {
  const signals = collectOccasionSignals(occasion);
  if (hasOccasionSignal(signals, 'formal')) return [4, 5];
  if (hasOccasionSignal(signals, 'meeting')) return [3, 5];
  if (hasOccasionSignal(signals, 'work')) return [2, 4];
  if (hasOccasionSignal(signals, 'party') || hasOccasionSignal(signals, 'date') || hasOccasionSignal(signals, 'dinner')) {
    return [3, 5];
  }
  if (hasOccasionSignal(signals, 'brunch')) return [2, 3];
  if (hasOccasionSignal(signals, 'travel') || hasOccasionSignal(signals, 'school')) return [1, 3];
  if (hasOccasionSignal(signals, 'workout')) return [1, 1];
  if (hasOccasionSignal(signals, 'casual')) return [1, 3];

  const occ = normalizeSignalText(occasion);
  for (const [key, entry] of Object.entries(OCCASION_FORMALITY)) {
    if (occ.includes(key)) return entry.range;
  }
  return [1, 4]; // default permissive
}

export function getOccasionStyleHints(occasion: string): string[] {
  const signals = collectOccasionSignals(occasion);
  const hints = new Set<string>();

  if (hasOccasionSignal(signals, 'casual')) {
    hints.add('relaxed');
    hints.add('comfortable');
  }
  if (hasOccasionSignal(signals, 'work')) {
    hints.add('polished');
    hints.add('professional');
  }
  if (hasOccasionSignal(signals, 'meeting')) {
    hints.add('sharp');
    hints.add('confident');
  }
  if (hasOccasionSignal(signals, 'date')) {
    hints.add('intentional');
    hints.add('attractive');
  }
  if (hasOccasionSignal(signals, 'party')) {
    hints.add('expressive');
    hints.add('statement');
  }
  if (hasOccasionSignal(signals, 'formal')) {
    hints.add('formal');
    hints.add('elegant');
  }
  if (hasOccasionSignal(signals, 'travel')) {
    hints.add('versatile');
    hints.add('comfortable');
  }
  if (hasOccasionSignal(signals, 'workout')) {
    hints.add('athletic');
    hints.add('performance');
  }
  if (hasOccasionSignal(signals, 'brunch')) {
    hints.add('smart casual');
    hints.add('relaxed');
  }
  if (hasOccasionSignal(signals, 'dinner')) {
    hints.add('elegant');
  }

  const occ = normalizeSignalText(occasion);
  for (const [key, entry] of Object.entries(OCCASION_FORMALITY)) {
    if (occ.includes(key)) {
      entry.styleHints.forEach((hint) => hints.add(hint));
    }
  }
  return Array.from(hints);
}

export function mapDayOccasionToEngine(occasion: string | undefined | null): string | null {
  const value = normalizeSignalText(occasion || "");
  if (!value) return null;
  if (["formal", "ceremony", "wedding"].includes(value)) return "formal";
  if (["party", "celebration"].includes(value)) return "party";
  if (["dinner", "date", "drinks"].includes(value)) return "date";
  if (["travel", "commute"].includes(value)) return "travel";
  if (["workout", "training", "gym"].includes(value)) return "workout";
  if (["work", "office", "meeting", "remote"].includes(value)) return "work";
  if (["social", "casual", "brunch"].includes(value)) return "casual";
  return null;
}

export function formalityScore(garment: GarmentRow, occasion: string): number {
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

export function wearRotationScore(garment: GarmentRow): number {
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

export interface FeedbackSignal {
  garmentIds: Set<string>;
  rating: number | null;
  feedback: string[] | null;
  weather: WeatherInput | null;
  generatedAt?: string | null;
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

export interface GarmentPenalty {
  total: number;
  weatherPenalty: number;
  formalityPenalty: number;
  fitPenalty: number;
  positiveBoost: number;
  rejected?: boolean;
}

export function buildFeedbackPenalties(feedbackHistory: FeedbackSignal[]): Map<string, GarmentPenalty> {
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
    const isDirectRejection = signal.rating === 1;
    const feedbackTags = signal.feedback || [];

    for (const gId of signal.garmentIds) {
      const p = getOrInit(gId);

      if (isNegative) p.total += 2 * weight;
      if (isPositive) p.positiveBoost += 1.5 * weight;
      if (isDirectRejection) p.rejected = true;

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

export function feedbackScore(garmentId: string, penalties: Map<string, GarmentPenalty>): number {
  const p = penalties.get(garmentId);
  if (!p) return 8; // no data = slight optimism
  const net = p.positiveBoost - p.total;
  return Math.max(0, Math.min(10, 8 + net));
}

// ─────────────────────────────────────────────
// PAIR MEMORY (Learned pairing preferences)
// ─────────────────────────────────────────────

export interface PairMemoryRow {
  garment_a_id: string;
  garment_b_id: string;
  positive_count: number;
  negative_count: number;
  last_positive_at: string | null;
  last_negative_at: string | null;
}

export type PairMemoryMap = Map<string, PairMemoryRow>;

export function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

export function buildPairMemoryMap(rows: PairMemoryRow[]): PairMemoryMap {
  const map: PairMemoryMap = new Map();
  for (const row of rows) {
    const key = pairKey(row.garment_a_id, row.garment_b_id);
    map.set(key, row);
  }
  return map;
}

export function getPairMemoryScore(
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

export async function recordPairOutcome(
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

export function clampScore(value: number): number {
  return Math.max(0, Math.min(10, value));
}

export function getStylePrefs(prefs: Record<string, any> | null): Record<string, any> {
  return (prefs?.styleProfile || prefs || {}) as Record<string, any>;
}

export function styleAlignmentScore(garment: GarmentRow, prefs: Record<string, any> | null): number {
  if (!prefs) return 7;

  const sp = getStylePrefs(prefs);
  let score = 7;

  const favColors = (sp.favoriteColors || []) as string[];
  const dislikedColors = (sp.dislikedColors || []) as string[];
  const styleSignals = collectStyleSignals((sp.styleWords || []) as string[]);
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

  if (hasStyleSignal(styleSignals, 'minimal')) {
    if (!garment.pattern || ['solid', 'none'].includes(garment.pattern.toLowerCase())) score += 0.8;
    if ((garment.formality || 0) >= 3) score += 0.5;
  }

  if (hasStyleSignal(styleSignals, 'classic')) {
    if ((garment.formality || 0) >= 4) score += 0.8;
    if (['shirt', 'blazer', 'coat', 'trousers', 'loafer'].some((x) => `${category} ${subcategory}`.includes(x))) {
      score += 0.8;
    }
  }

  if (hasStyleSignal(styleSignals, 'smart_casual')) {
    if ((garment.formality || 0) >= 3 && (garment.formality || 0) <= 4) score += 0.9;
    if (['shirt', 'polo', 'chino', 'trouser', 'loafer', 'blazer', 'knit'].some((x) => `${category} ${subcategory}`.includes(x))) {
      score += 0.7;
    }
  }

  if (hasStyleSignal(styleSignals, 'street')) {
    if (['hoodie', 'sneaker', 'cargo', 'oversized', 'relaxed'].some((x) => `${category} ${subcategory} ${fit}`.includes(x))) {
      score += 0.9;
    }
  }

  if (hasStyleSignal(styleSignals, 'sporty')) {
    if (['sneaker', 'hoodie', 'track', 'running', 'trainer'].some((x) => `${category} ${subcategory}`.includes(x))) {
      score += 0.9;
    }
  }

  if (hasStyleSignal(styleSignals, 'scandinavian')) {
    if (!garment.pattern || ['solid', 'none'].includes(garment.pattern.toLowerCase())) score += 0.7;
    if (['shirt', 'coat', 'trouser', 'knit', 'loafer', 'boot'].some((x) => `${category} ${subcategory}`.includes(x))) {
      score += 0.6;
    }
    const hsl = getHSL(garment.color_primary);
    if (hsl && (isNeutral(hsl) || ['blue', 'navy', 'grey', 'gray', 'white', 'black', 'beige', 'cream'].some((x) => gc.includes(x)))) {
      score += 0.5;
    }
  }

  if (hasStyleSignal(styleSignals, 'edgy')) {
    if (['leather', 'biker', 'boot', 'combat', 'graphic', 'black'].some((x) => `${gc} ${material} ${category} ${subcategory}`.includes(x))) {
      score += 0.9;
    }
  }

  if (hasStyleSignal(styleSignals, 'bohemian')) {
    if (['linen', 'suede', 'crochet', 'flow', 'floral', 'paisley', 'earth'].some((x) => `${material} ${subcategory} ${gc}`.includes(x))) {
      score += 0.8;
    }
    if (['relaxed', 'regular', 'oversized'].includes(fit)) score += 0.4;
  }

  if (hasStyleSignal(styleSignals, 'preppy')) {
    if (['oxford', 'shirt', 'polo', 'cardigan', 'blazer', 'chino', 'loafer'].some((x) => `${category} ${subcategory}`.includes(x))) {
      score += 0.9;
    }
  }

  if (hasStyleSignal(styleSignals, 'relaxed')) {
    if (['relaxed', 'regular', 'oversized'].includes(fit)) score += 0.7;
    if (['cotton', 'jersey', 'knit', 'linen', 'fleece'].some((x) => material.includes(x))) score += 0.4;
  }

  if (paletteVibe.includes('neutral') || paletteVibe.includes('tonal')) {
    const hsl = getHSL(garment.color_primary);
    if (hsl && isNeutral(hsl)) score += 0.8;
  }

  if (comfortVsStyle >= 65) {
    if (['relaxed', 'regular', 'oversized'].includes(fit)) score += 0.8;
    if (['jersey', 'cotton', 'knit', 'merino'].some((x) => material.includes(x))) score += 0.4;
  } else if (comfortVsStyle <= 35) {
    if ((garment.formality || 0) >= 4) score += 0.8;
    if (['wool', 'leather', 'tailored'].some((x) => material.includes(x) || subcategory.includes(x))) score += 0.4;
  }

  return clampScore(score);
}

// ─────────────────────────────────────────────
// OCCASION / STYLE / WEATHER COMBO HELPERS
// ─────────────────────────────────────────────

export function garmentText(garment: GarmentRow): string {
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

export function hasComboSlot(items: ComboItem[], slot: string): boolean {
  return items.some((item) => item.slot === slot);
}

export function isWetWeather(weather: WeatherInput): boolean {
  const p = String(weather.precipitation || '').toLowerCase();
  return p !== '' && !['none', 'ingen'].includes(p);
}

export function styleIntentScore(
  items: ComboItem[],
  requestedStyle: string | null,
  prefs: Record<string, any> | null
): number {
  const sp = getStylePrefs(prefs);
  const styleSignals = collectStyleSignals(requestedStyle, (sp.styleWords || []) as string[]);

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
    return (item.garment.formality || 0) >= 4 || ['blazer', 'coat', 'shirt', 'loafer', 'trouser', 'oxford', 'chino'].some((x) => txt.includes(x));
  }).length;

  const sportyCount = items.filter((item) => {
    const txt = garmentText(item.garment);
    return ['sneaker', 'hoodie', 'running', 'trainer', 'track'].some((x) => txt.includes(x));
  }).length;

  const romanticCount = items.filter((item) => {
    const txt = garmentText(item.garment);
    return ['dress', 'skirt', 'silk', 'satin', 'soft'].some((x) => txt.includes(x));
  }).length;

  const edgyCount = items.filter((item) => {
    const txt = garmentText(item.garment);
    return ['leather', 'biker', 'combat', 'boot', 'graphic', 'black'].some((x) => txt.includes(x));
  }).length;

  const bohemianCount = items.filter((item) => {
    const txt = garmentText(item.garment);
    return ['linen', 'suede', 'paisley', 'floral', 'crochet', 'flow', 'earth', 'relaxed'].some((x) => txt.includes(x));
  }).length;

  const preppyCount = items.filter((item) => {
    const txt = garmentText(item.garment);
    return ['oxford', 'polo', 'cardigan', 'blazer', 'chino', 'loafer', 'pleat'].some((x) => txt.includes(x));
  }).length;

  const formalities = items
    .map((item) => item.garment.formality)
    .filter((v): v is number => typeof v === 'number');

  const avgFormality = formalities.length
    ? formalities.reduce((sum, v) => sum + v, 0) / formalities.length
    : 5;

  let score = 7;

  if (hasStyleSignal(styleSignals, 'minimal')) {
    score += neutralRatio * 2.5;
    score -= patternCount * 1.1;
  }

  if (hasStyleSignal(styleSignals, 'classic')) {
    score += structuredCount * 0.8;
    score += neutralRatio * 1.2;
  }

  if (hasStyleSignal(styleSignals, 'smart_casual')) {
    if (avgFormality >= 2.8 && avgFormality <= 4.2) score += 1.5;
    else score -= 1.2;
    score += structuredCount * 0.6;
  }

  if (hasStyleSignal(styleSignals, 'street')) {
    score += relaxedCount * 0.6;
    score += sportyCount * 0.8;
  }

  if (hasStyleSignal(styleSignals, 'sporty')) {
    score += sportyCount * 1.2;
  }

  if (hasStyleSignal(styleSignals, 'romantic')) {
    score += romanticCount * 1.0;
  }

  if (hasStyleSignal(styleSignals, 'scandinavian')) {
    score += neutralRatio * 2.2;
    score += structuredCount * 0.4;
    score -= patternCount * 0.8;
  }

  if (hasStyleSignal(styleSignals, 'edgy')) {
    score += edgyCount * 1.1;
    if (colors.some((hsl) => hsl[2] < 20)) score += 0.6;
  }

  if (hasStyleSignal(styleSignals, 'bohemian')) {
    score += bohemianCount * 1.0;
    score += relaxedCount * 0.4;
    score += patternCount * 0.4;
  }

  if (hasStyleSignal(styleSignals, 'preppy')) {
    score += preppyCount * 1.0;
    score += structuredCount * 0.3;
  }

  if (hasStyleSignal(styleSignals, 'relaxed')) {
    score += relaxedCount * 0.8;
    if (avgFormality <= 3.3) score += 0.8;
    else score -= 0.6;
  }

  const paletteVibe = String(sp.paletteVibe || '').toLowerCase();
  if ((paletteVibe.includes('neutral') || paletteVibe.includes('tonal')) && neutralRatio >= 0.5) {
    score += 0.8;
  }

  return clampScore(score);
}

export function occasionTemplateScore(
  items: ComboItem[],
  occasion: string,
  weather: WeatherInput
): number {
  const occasionSignals = collectOccasionSignals(occasion);
  const hasOuterwear = hasComboSlot(items, 'outerwear');
  const hasAccessory = hasComboSlot(items, 'accessory');

  const formalities = items
    .map((item) => item.garment.formality)
    .filter((v): v is number => typeof v === 'number');

  const avgFormality = formalities.length
    ? formalities.reduce((sum, v) => sum + v, 0) / formalities.length
    : 5;

  const shoeText = garmentText(items.find((item) => item.slot === 'shoes')?.garment || {
    id: '', title: '', category: '', subcategory: '', color_primary: '', color_secondary: null,
    pattern: null, material: null, fit: null, formality: null, season_tags: null,
    wear_count: null, last_worn_at: null, image_path: '',
    silhouette: 'straight', visual_weight: 5, texture_intensity: 3, layering_role: 'standalone',
    versatility_score: 5, occasion_tags: [], style_archetype: '',
  } as unknown as GarmentRow);

  let score = 7;

  if (hasOccasionSignal(occasionSignals, 'meeting')) {
    if (avgFormality >= 3.2 && avgFormality <= 5) score += 2;
    else score -= 1.5;
    if (shoeText.includes('sandals')) score -= 2;
  } else if (hasOccasionSignal(occasionSignals, 'work')) {
    if (avgFormality >= 2.5 && avgFormality <= 4.5) score += 2;
    else score -= 1.5;
    if (shoeText.includes('sandals')) score -= 2;
  } else if (hasOccasionSignal(occasionSignals, 'casual') || hasOccasionSignal(occasionSignals, 'school')) {
    if (avgFormality >= 1.5 && avgFormality <= 3.5) score += 1.5;
  } else if (hasOccasionSignal(occasionSignals, 'date')) {
    if (avgFormality >= 2.5 && avgFormality <= 4.5) score += 1.5;
    if (hasAccessory) score += 0.5;
  } else if (hasOccasionSignal(occasionSignals, 'party') || hasOccasionSignal(occasionSignals, 'dinner')) {
    if (avgFormality >= 3 && avgFormality <= 5) score += 1.2;
    if (hasAccessory) score += 0.8;
  } else if (hasOccasionSignal(occasionSignals, 'travel')) {
    if (hasOuterwear && (weather.temperature ?? 18) < 18) score += 1;
    if (shoeText.includes('sneaker') || shoeText.includes('boot')) score += 1;
  } else if (hasOccasionSignal(occasionSignals, 'formal')) {
    if (avgFormality >= 4) score += 2;
    else score -= 2;
  } else if (hasOccasionSignal(occasionSignals, 'workout')) {
    if (shoeText.includes('sneaker') || shoeText.includes('trainer')) score += 1.5;
    if (avgFormality <= 2.5) score += 1;
  }

  return clampScore(score);
}

export function weatherPracticalityScore(items: ComboItem[], weather: WeatherInput): number {
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
// ENRICHMENT DATA HYDRATION (Phase 1: AI Intelligence)
// ─────────────────────────────────────────────

// Outerwear categories used by inferLayeringRole
const OUTERWEAR_CATS = [
  "outerwear", "jacket", "coat", "parka", "windbreaker",
  "trench", "jacka", "kappa", "rock",
];

/** Extract enrichment fields from ai_raw JSONB into the GarmentRow with safe defaults. */
export function hydrateEnrichment(raw: any): GarmentRow {
  const aiRaw = (raw.ai_raw && typeof raw.ai_raw === 'object') ? raw.ai_raw : {};
  const enrichment = aiRaw.enrichment || aiRaw;

  return {
    ...raw,
    silhouette: String(enrichment.silhouette || inferSilhouetteFromFit(raw.fit)).toLowerCase(),
    visual_weight: clampNum(enrichment.visual_weight, 1, 10, 5),
    texture_intensity: clampNum(enrichment.texture_intensity, 1, 10, 3),
    layering_role: String(enrichment.layering_role || inferLayeringRole(raw.category, raw.subcategory)).toLowerCase(),
    versatility_score: clampNum(enrichment.versatility_score, 1, 10, 5),
    occasion_tags: Array.isArray(enrichment.occasion_tags) ? enrichment.occasion_tags.map((t: any) => String(t).toLowerCase()) : [],
    style_archetype: String(enrichment.style_archetype || '').toLowerCase(),
  };
}

export function clampNum(val: any, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : fallback;
  return Math.max(min, Math.min(max, n));
}

export function inferSilhouetteFromFit(fit: string | null): string {
  const f = (fit || '').toLowerCase();
  if (['oversized', 'loose', 'wide'].some(k => f.includes(k))) return 'relaxed';
  if (['slim', 'skinny', 'fitted', 'tailored'].some(k => f.includes(k))) return 'fitted';
  if (f.includes('regular')) return 'straight';
  return 'straight';
}

export function inferLayeringRole(category: string, subcategory: string | null): string {
  const both = `${category} ${subcategory || ''}`.toLowerCase();
  if (OUTERWEAR_CATS.some(c => both.includes(c))) return 'outer';
  if (['t-shirt', 'tank', 'camisole', 'undershirt'].some(c => both.includes(c))) return 'base';
  if (['cardigan', 'sweater', 'hoodie', 'vest', 'shacket', 'overshirt', 'utility shirt', 'shirt jacket'].some(c => both.includes(c))) return 'mid';
  return 'standalone';
}

// ─────────────────────────────────────────────
// LAYERING COMPLETENESS VALIDATION
// ─────────────────────────────────────────────

export interface LayeringValidation {
  needs_base_layer: boolean;
  layer_order: { slot: string; garment_id: string; layer_role: string }[];
  valid: boolean;
  violations: string[];
}

export const LAYER_SORT_ORDER: Record<string, number> = {
  base: 0, standalone: 1, mid: 2, outer: 3, bottom: 4, shoes: 5, accessory: 6,
};

export function normalizeLayerRole(item: ComboItem): string {
  if (item.slot === 'outerwear') return 'outer';
  if (['bottom', 'shoes', 'accessory', 'dress'].includes(item.slot)) return item.slot;
  return item.garment.layering_role || 'standalone';
}

export function validateLayeringCompleteness(items: ComboItem[]): LayeringValidation {
  const topItems = items.filter(i => i.slot === 'top');
  const topRoles = topItems.map(normalizeLayerRole);
  const baseLikeTopCount = topRoles.filter(role => role === 'base' || role === 'standalone').length;
  const midTopCount = topRoles.filter(role => role === 'mid').length;
  const outerwearCount = items.filter(i => i.slot === 'outerwear').length;

  const needs_base_layer = midTopCount > 0 && baseLikeTopCount === 0;
  const violations: string[] = [];

  if (needs_base_layer) {
    violations.push('mid_layer_without_base');
  }
  if (baseLikeTopCount > 1) {
    violations.push('multiple_base_tops');
  }
  if (midTopCount > 1) {
    violations.push('multiple_mid_layers');
  }
  if (topItems.length > 2) {
    violations.push('too_many_top_layers');
  }
  if (outerwearCount > 1) {
    violations.push('multiple_outerwear');
  }
  if (items.length > 6) {
    violations.push('too_many_garments');
  }

  const layer_order = items
    .map(i => ({ slot: i.slot, garment_id: i.garment.id, layer_role: normalizeLayerRole(i) }))
    .sort((a, b) => (LAYER_SORT_ORDER[a.layer_role] ?? 99) - (LAYER_SORT_ORDER[b.layer_role] ?? 99));

  return { needs_base_layer, layer_order, valid: violations.length === 0, violations };
}

// ─────────────────────────────────────────────
// OCCASION SUB-MODE RESOLUTION
// ─────────────────────────────────────────────

export function resolveOccasionSubmode(
  occasion: string,
  prefs: Record<string, any> | null,
  styleVector: StyleVector | null
): string | null {
  const occasionSignals = collectOccasionSignals(occasion);
  const isWork = hasOccasionSignal(occasionSignals, 'work') || hasOccasionSignal(occasionSignals, 'meeting');
  if (!isWork) return null;

  // Determine formality target from user's style vector or preferences
  const sp = prefs ? getStylePrefs(prefs) : {};
  const userFormalityCenter = styleVector?.formalityCenter ?? null;
  const primaryGoal = String(sp.primaryGoal || '').toLowerCase();

  const [formalityMin, formalityMax] = getFormalityRange(occasion);
  let formalityTarget = (formalityMin + formalityMax) / 2;
  if (userFormalityCenter !== null) {
    formalityTarget = userFormalityCenter;
  }
  if (primaryGoal.includes('formal') || primaryGoal.includes('professional')) {
    formalityTarget = Math.max(formalityTarget, 4.5);
  }
  if (primaryGoal.includes('comfort') || primaryGoal.includes('relaxed') || primaryGoal.includes('creative')) {
    formalityTarget = Math.min(formalityTarget, 2.8);
  }

  if (hasOccasionSignal(occasionSignals, 'formal') || hasOccasionSignal(occasionSignals, 'meeting') || formalityTarget >= 4.4) {
    return 'Formal Office';
  }
  if (formalityTarget >= 3) return 'Business Casual';
  return 'Relaxed Office';
}

// ─────────────────────────────────────────────
// ENRICHMENT-AWARE SCORING FUNCTIONS
// ─────────────────────────────────────────────

/** Score occasion suitability using enrichment occasion_tags. */
export function occasionTagScore(garment: GarmentRow, occasion: string): number {
  if (garment.occasion_tags.length === 0) return 7; // unenriched → neutral
  const normalizedOccasion = normalizeSignalText(occasion);
  if (garment.occasion_tags.some((tag) => normalizeSignalText(tag) === normalizedOccasion)) return 10;

  const targetSignals = collectOccasionSignals(occasion);
  const garmentSignals = new Set<string>();
  for (const tag of garment.occasion_tags) {
    garmentSignals.add(normalizeSignalText(tag));
    collectOccasionSignals(tag).forEach((signal) => garmentSignals.add(signal));
  }

  if (Array.from(targetSignals).some((signal) => garmentSignals.has(signal))) return 9;
  // No match at all
  return 5;
}

/** Score layering role against weather context. */
export function layeringRoleScore(garment: GarmentRow, weather: WeatherInput): number {
  const temp = weather.temperature;
  if (temp === undefined) return 7;
  const role = garment.layering_role;

  if (temp < 5) {
    // Cold: outer layers highly valued, base layers good for layering
    if (role === 'outer') return 10;
    if (role === 'mid') return 9;
    if (role === 'base') return 7;
    return 6;
  }
  if (temp < 15) {
    // Cool: mid layers ideal for flexibility
    if (role === 'mid') return 9;
    if (role === 'outer') return 8;
    if (role === 'standalone') return 7;
    return 6;
  }
  if (temp < 25) {
    // Mild: standalone pieces preferred
    if (role === 'standalone') return 9;
    if (role === 'base') return 8;
    if (role === 'outer') return 5;
    return 7;
  }
  // Hot: base/standalone only
  if (role === 'base' || role === 'standalone') return 9;
  if (role === 'mid') return 4;
  if (role === 'outer') return 2;
  return 7;
}

/** Versatility boost: more versatile garments get a small base score bump. */
export function versatilityBoost(garment: GarmentRow): number {
  // Map 1-10 versatility to 0-1.5 bonus
  return Math.max(0, (garment.versatility_score - 4) * 0.3);
}

/** Silhouette balance scoring for a combo. Rewards contrast, penalizes monotony. */
export function silhouetteBalanceScore(items: ComboItem[]): number {
  const coreItems = items.filter(i => ['top', 'bottom', 'dress', 'outerwear'].includes(i.slot));
  if (coreItems.length < 2) return 7;

  const silhouettes = coreItems.map(i => i.garment.silhouette);
  const weights = coreItems.map(i => i.garment.visual_weight);

  // Silhouette variety: penalize if all same
  const uniqueSilhouettes = new Set(silhouettes);
  let score = 7;

  if (uniqueSilhouettes.size === 1 && coreItems.length >= 2) {
    // All same silhouette — penalize
    const sil = silhouettes[0];
    if (sil === 'relaxed') score -= 2;      // all baggy
    else if (sil === 'fitted') score -= 1.5; // all tight
    else score -= 1;
  } else if (uniqueSilhouettes.size >= 2) {
    // Good contrast
    score += 1.5;
    // Bonus for classic combos like relaxed+fitted or relaxed+straight
    const hasRelaxed = silhouettes.includes('relaxed') || silhouettes.includes('boxy');
    const hasFitted = silhouettes.includes('fitted') || silhouettes.includes('slim');
    const hasStraight = silhouettes.includes('straight');
    if (hasRelaxed && (hasFitted || hasStraight)) score += 1;
  }

  // Visual weight balance: top vs bottom contrast
  const topItem = coreItems.find(i => i.slot === 'top' || i.slot === 'dress');
  const bottomItem = coreItems.find(i => i.slot === 'bottom');
  if (topItem && bottomItem) {
    const weightDiff = Math.abs(topItem.garment.visual_weight - bottomItem.garment.visual_weight);
    if (weightDiff >= 2 && weightDiff <= 5) score += 0.8;  // nice contrast
    if (weightDiff === 0) score -= 0.5;                      // too uniform
  }

  return clampScore(score);
}

/** Texture depth scoring for a combo. Rewards variety, penalizes monotony. */
export function textureDepthScore(items: ComboItem[]): number {
  const coreItems = items.filter(i => ['top', 'bottom', 'dress', 'outerwear'].includes(i.slot));
  if (coreItems.length < 2) return 7;

  const textures = coreItems.map(i => i.garment.texture_intensity);
  const avg = textures.reduce((s, v) => s + v, 0) / textures.length;
  const spread = Math.max(...textures) - Math.min(...textures);

  let score = 7;

  // Reward texture variety
  if (spread >= 3) score += 1.5;       // good mix of smooth and textured
  else if (spread >= 1.5) score += 0.8;
  else if (spread < 1) score -= 1;     // all same texture → flat

  // Penalty for all very high texture (busy/clashing)
  if (avg > 7) score -= 1;
  // Bonus for controlled texture: smooth base + one textured piece
  const smoothCount = textures.filter(t => t <= 3).length;
  const texturedCount = textures.filter(t => t >= 6).length;
  if (smoothCount >= 1 && texturedCount === 1) score += 0.8;

  return clampScore(score);
}

// ─────────────────────────────────────────────
// SLOT CATEGORIZATION — delegated to _shared/burs-slots.ts
// ─────────────────────────────────────────────

export function categorizeSlot(category: string, subcategory: string | null): string | null {
  return classifySlot(category, subcategory);
}

// ─────────────────────────────────────────────
// OUTFIT COMPLETENESS VALIDATION
// ─────────────────────────────────────────────

export type OutfitGenerationMode = 'full_outfit_generation' | 'partial_styling_task';

/** Determine whether the request is a full outfit or partial styling task. */
export function getOutfitGenerationMode(mode: string): OutfitGenerationMode {
  // Swap mode is explicitly partial — only returns candidates for a single slot
  if (mode === 'swap') return 'partial_styling_task';
  // Generate and suggest modes always produce full outfits
  return 'full_outfit_generation';
}

export function requiresOuterwear(weather: WeatherInput): boolean {
  const temp = weather.temperature;
  const precip = String(weather.precipitation || '').toLowerCase();
  const wind = String(weather.wind || '').toLowerCase();
  const coldEnough = temp !== undefined && temp < 8;
  const wet = precip !== '' && !['none', 'ingen'].includes(precip);
  const hasSnow = precip.includes('snow') || precip.includes('snö');
  const highWind = wind === 'high' || wind === 'hög';
  return coldEnough || wet || hasSnow || highWind;
}

export function isSuitableShoeCandidate(candidate: ScoredGarment, weather: WeatherInput): boolean {
  if (candidate.score < 5) return false;

  const text = garmentText(candidate.garment);
  const temp = weather.temperature ?? 18;
  const feelsTemp = feelsLikeTemp(temp, weather.wind);
  const wet = isWetWeather(weather);

  if ((wet || feelsTemp < 5) && (text.includes('sandal') || text.includes('flip'))) return false;
  if (feelsTemp > 30 && (text.includes('boot') || text.includes('stövel')) && !text.includes('chelsea')) return false;

  return true;
}

export function hasSuitableShoesAvailable(shoes: ScoredGarment[], weather: WeatherInput): boolean {
  return shoes.some((shoe) => isSuitableShoeCandidate(shoe, weather));
}

export type OutfitCompletenessMode = 'strict_visible' | 'guaranteed_base' | 'no_shoes' | 'dress_only' | 'any_two';

export interface OutfitCompletenessResult {
  complete: boolean;
  missing: string[];
  required_slots: string[];
  present_slots: string[];
}

/** Compute the required slots for the given items and weather context. */
export function getRequiredSlotsForContext(
  items: { slot: string }[],
  _weather: WeatherInput,
  mode: OutfitCompletenessMode = 'strict_visible'
): string[] {
  const slots = new Set(items.map(i => i.slot));
  const hasDress = slots.has('dress');
  const required = hasDress ? ['dress', 'shoes'] : ['top', 'bottom', 'shoes'];
  if (mode === 'dress_only') return ['dress', 'shoes'];
  if (mode === 'no_shoes') return hasDress ? ['dress'] : ['top', 'bottom'];
  if (mode === 'any_two') return [];
  return required;
}

export function isCompleteOutfit(
  items: ComboItem[],
  weather: WeatherInput,
  mode: OutfitCompletenessMode = 'strict_visible'
): OutfitCompletenessResult {
  const presentSlots = [...new Set(items.map(i => i.slot))];
  const normalizedItems = items.map((item) => ({
    slot: item.slot,
    garment: item.garment,
  }));
  const completeValidation = validateCompleteOutfit(normalizedItems);
  const baseMissing = completeValidation.missing.filter((slot) => slot !== 'shoes' && slot !== 'outerwear');
  const missing: string[] = [...baseMissing];
  const hasDress = completeValidation.isDressBased;

  if (mode === 'no_shoes') {
    return {
      complete: completeValidation.isStandard || completeValidation.isDressBased,
      missing,
      required_slots: getRequiredSlotsForContext(items, weather, mode),
      present_slots: presentSlots,
    };
  }

  if (mode === 'dress_only') {
    return {
      complete: hasDress && !completeValidation.missing.includes('shoes'),
      missing: hasDress ? completeValidation.missing.filter((slot) => slot === 'shoes') : ['dress', 'shoes'],
      required_slots: ['dress', 'shoes'],
      present_slots: presentSlots,
    };
  }

  if (mode === 'any_two') {
    const slots = new Set(items.map(i => i.slot));
    return { complete: items.length >= 2 && slots.size >= 2, missing: [], required_slots: [], present_slots: presentSlots };
  }

  if (completeValidation.missing.includes('shoes')) {
    missing.push('shoes');
  }

  const requiredSlots = getRequiredSlotsForContext(items, weather, mode);
  return {
    complete: completeValidation.isValid,
    missing: Array.from(new Set(missing)),
    required_slots: requiredSlots,
    present_slots: presentSlots,
  };
}

export function buildActiveLookSlotMap(garments: GarmentRow[], garmentIds: string[]): Map<string, string> {
  const garmentById = new Map(garments.map((garment) => [garment.id, garment]));
  const slotMap = new Map<string, string>();

  for (const garmentId of garmentIds) {
    const garment = garmentById.get(garmentId);
    if (!garment) continue;
    const slot = categorizeSlot(garment.category, garment.subcategory);
    if (!slot || slotMap.has(slot)) continue;
    slotMap.set(slot, garment.id);
  }

  return slotMap;
}

export function rankCombosForRefinement(
  combos: ScoredCombo[],
  params: {
    activeLookSlotMap: Map<string, string>;
    lockedGarmentIds: Set<string>;
    requestedEditSlots: Set<string>;
  },
): ScoredCombo[] {
  if (!combos.length || params.activeLookSlotMap.size === 0) return combos;

  const scored = combos.map((combo) => {
    const comboSlotMap = new Map(combo.items.map((item) => [item.slot, item.garment.id]));
    const comboIds = new Set(combo.items.map((item) => item.garment.id));

    if (Array.from(params.lockedGarmentIds).some((id) => !comboIds.has(id))) {
      return { combo, score: Number.NEGATIVE_INFINITY };
    }

    let continuityScore = 0;
    let changedRequestedSlots = 0;

    for (const [slot, activeGarmentId] of params.activeLookSlotMap.entries()) {
      const comboGarmentId = comboSlotMap.get(slot);
      const requested = params.requestedEditSlots.has(slot);

      if (comboGarmentId === activeGarmentId) {
        continuityScore += requested ? -1 : 5;
        continue;
      }

      if (requested && comboGarmentId) {
        changedRequestedSlots += 1;
        continuityScore += 7;
        continue;
      }

      if (!requested && comboGarmentId && comboGarmentId !== activeGarmentId) {
        continuityScore -= 8;
      }
    }

    if (params.requestedEditSlots.size > 0 && changedRequestedSlots === 0) {
      continuityScore -= 40;
    }

    return { combo, score: continuityScore };
  });

  const viable = scored.filter((entry) => Number.isFinite(entry.score));
  if (!viable.length) return combos;

  return viable
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.combo.totalScore - left.combo.totalScore;
    })
    .map((entry) => entry.combo);
}

export function explainMissingRequiredSlots(missing: string[]): string {
  if (missing.length === 0) return '';
  const slotLabels: Record<string, string> = {
    top: 'a top',
    bottom: 'a bottom',
    shoes: 'shoes',
    outerwear: 'outerwear for the weather',
  };
  const parts = missing.map(s => slotLabels[s] || s);
  return `Missing ${parts.join(' and ')} to complete the outfit.`;
}

/** Build a structured incomplete-outfit failure response. */
export function buildIncompleteOutfitFailure(
  weather: WeatherInput,
  occasion: string,
  slotCandidates: Record<string, ScoredGarment[]>
): { error: string; limitation_note: string | null; missing_slots: string[]; available_slots: string[] } {
  const availableSlots = Object.keys(slotCandidates).filter(s => slotCandidates[s]?.length > 0);
  const testItems: ComboItem[] = availableSlots.map(s => slotCandidates[s][0]).filter(Boolean).map(sg => ({
    slot: categorizeSlot(sg.garment.category, sg.garment.subcategory) || 'unknown',
    garment: sg.garment,
    baseScore: sg.score,
    baseBreakdown: sg.breakdown,
  }));
  const { missing } = isCompleteOutfit(testItems, weather);
  const explanation = explainMissingRequiredSlots(missing);
  return {
    error: 'Not enough matching garments',
    limitation_note: explanation || null,
    missing_slots: missing,
    available_slots: availableSlots,
  };
}

// ─────────────────────────────────────────────
// WEAR PATTERN ANALYSIS (Day-of-Week + Seasonal)
// ─────────────────────────────────────────────

export interface WearPatternProfile {
  // Day-of-week: garment_id → Map<dayOfWeek(0-6), count>
  dayOfWeekByGarment: Map<string, Map<number, number>>;
  // Season: garment_id → Map<season, count>
  seasonByGarment: Map<string, Map<string, number>>;
  // Category frequency by day: category → Map<dayOfWeek, count>
  categoryByDay: Map<string, Map<number, number>>;
  // Color frequency by season: color → Map<season, count>
  colorBySeason: Map<string, Map<string, number>>;
}

export function getSeasonFromDate(dateStr: string): string {
  const month = new Date(dateStr).getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

export function buildWearPatternProfile(wearLogs: WearLog[], garments: GarmentRow[]): WearPatternProfile {
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

export function wearPatternScore(garment: GarmentRow, patterns: WearPatternProfile | null): number {
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
// COMPOSITE SCORING
// ─────────────────────────────────────────────

export function scoreGarment(
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
  transInfo: SeasonTransitionInfo | null = null,
  uniform: PersonalUniform | null = null
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

  // Enrichment-aware scores (Phase 1)
  const ots = occasionTagScore(garment, occasion);
  const lrs = layeringRoleScore(garment, weather);
  const vb = versatilityBoost(garment);

  // IB-5c: Personal uniform boost
  const pus = personalUniformScore(garment, uniform);

  // Readiness awareness: softly down-rank low-confidence / still-processing garments
  const readiness = garmentReadinessSignals(garment);

  // Weighted composite: base factors + enrichment + uniform + social penalty
  const vectorConf = styleVector?.confidence || 0;
  const saWeight = 0.06 * (1 - vectorConf * 0.5);
  const svWeight = 0.06 + vectorConf * 0.04;

  // Rebalanced weights: slight reduction to accommodate uniform score
  const score = ws * 0.13 + fs * 0.13 + wr * 0.10 + fb * 0.08 + sa * saWeight + wp * 0.06 + sv * svWeight + cs * 0.06 + sts * 0.06
    + ots * 0.07   // occasion tag match
    + lrs * 0.06   // layering role fit
    + pus * 0.05   // personal uniform match (IB-5c)
    + vb           // versatility bonus (additive, max ~1.8)
    - scp * 0.5
    - readiness.penalty;

  return {
    garment,
    score,
    breakdown: {
      weather: ws, formality: fs, rotation: wr, feedback: fb, style: sa, pattern: wp,
      vector: sv, comfort: cs, socialPenalty: scp, seasonalTransition: sts,
      occasion_tag: ots, layering_role: lrs, versatility: garment.versatility_score,
      uniform: pus, readiness_penalty: readiness.penalty, analysis_confidence: readiness.analysisConfidence ?? -1,
    },
  };
}

// ─────────────────────────────────────────────
// FIT FAMILY (shared utility)
// ─────────────────────────────────────────────

export function fitFamily(fit: string | null | undefined): string {
  const v = String(fit || '').toLowerCase();
  if (['oversized', 'relaxed', 'loose', 'wide'].some((x) => v.includes(x))) return 'relaxed';
  if (['slim', 'skinny', 'fitted', 'tailored'].some((x) => v.includes(x))) return 'fitted';
  return 'regular';
}
