/**
 * outfit-scoring-body.ts — Material compatibility, comfort/style learning, body profile,
 * social context awareness, personal uniform detection, and garment readiness signals.
 *
 * Extracted from outfit-scoring.ts — zero logic changes.
 */

import type { GarmentRow, FeedbackSignal } from "./outfit-scoring.ts";
import type { WearLog } from "./outfit-scoring-color.ts";
import { classifySlot } from "./burs-slots.ts";

// ─────────────────────────────────────────────
// MATERIAL COMPATIBILITY
// ─────────────────────────────────────────────

export const MATERIAL_GROUPS: Record<string, string[]> = {
  refined: ["silk", "siden", "cashmere", "kashmir", "satin", "chiffon", "merino"],
  casual: ["denim", "cotton", "bomull", "jersey", "fleece", "flanell", "flannel", "cord", "manchester"],
  technical: ["polyester", "nylon", "gore-tex", "softshell", "mesh", "spandex", "lycra"],
  rugged: ["leather", "läder", "suede", "mocka", "canvas", "tweed", "twill"],
  knit: ["wool", "ull", "stickad", "knit", "mohair", "angora"],
};

export function getMaterialGroup(material: string | null): string | null {
  if (!material) return null;
  const m = material.toLowerCase();
  for (const [group, keywords] of Object.entries(MATERIAL_GROUPS)) {
    if (keywords.some(k => m.includes(k))) return group;
  }
  return null;
}

// Full affinity matrix: score from -2 (clash) to +2 (great pairing)
export const MATERIAL_AFFINITY: Record<string, Record<string, number>> = {
  refined:   { refined: 2, casual: -1, technical: -2, rugged: 0, knit: 1 },
  casual:    { refined: -1, casual: 1, technical: 0, rugged: 1, knit: 1 },
  technical: { refined: -2, casual: 0, technical: 1, rugged: 0, knit: -1 },
  rugged:    { refined: 0, casual: 1, technical: 0, rugged: 1, knit: 1 },
  knit:      { refined: 1, casual: 1, technical: -1, rugged: 1, knit: 1 },
};

export function materialCompatibility(materials: (string | null)[]): number {
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
// FEEDBACK DECAY HELPER
// (moved here so comfort profile can use it without circular imports)
// ─────────────────────────────────────────────

// Exponential decay: half-life of 14 days
export const FEEDBACK_HALF_LIFE_DAYS = 14;

export function decayWeight(generatedAt: string | null | undefined): number {
  if (!generatedAt) return 0.5; // unknown age → half weight
  const daysSince = Math.max(0, (Date.now() - new Date(generatedAt).getTime()) / 86400000);
  return Math.pow(0.5, daysSince / FEEDBACK_HALF_LIFE_DAYS);
}

// ─────────────────────────────────────────────
// COMFORT VS STYLE LEARNING (Step 8)
// ─────────────────────────────────────────────

export interface ComfortStyleProfile {
  // garment_id → { comfortSignal, aspirationSignal }
  garmentSignals: Map<string, { comfort: number; aspiration: number }>;
  // Overall user tendency: -1 (prefers comfort) to +1 (prefers style)
  userTendency: number;
}

export function buildComfortStyleProfile(
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

export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

export function comfortStyleScore(garment: GarmentRow, profile: ComfortStyleProfile | null): number {
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

export interface BodyProfile {
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;           // rough proxy for build
  buildCategory: 'slim' | 'average' | 'athletic' | 'broad' | null;
  fitPreference: string | null; // from quiz
}

export function buildBodyProfile(profileData: Record<string, any> | null): BodyProfile {
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
export const FIT_BALANCE_RULES: Record<string, Record<string, number>> = {
  // top fit → bottom fit → bonus (-2 to +2)
  oversized:  { slim: 2, skinny: 2, regular: 1, relaxed: -1, oversized: -2, wide: -1 },
  relaxed:    { slim: 1, skinny: 1, regular: 1, relaxed: 0, oversized: -1, wide: -1 },
  regular:    { slim: 1, skinny: 0, regular: 1, relaxed: 1, oversized: 0, wide: 0 },
  slim:       { slim: 0, skinny: -1, regular: 1, relaxed: 1, oversized: 1, wide: 1 },
  fitted:     { slim: 0, skinny: -1, regular: 1, relaxed: 1, oversized: 1, wide: 1 },
};

// Body-specific fit recommendations
export const BODY_FIT_PREFERENCES: Record<string, { favors: string[]; avoids: string[] }> = {
  slim:     { favors: ['regular', 'relaxed', 'oversized'], avoids: ['skinny'] },
  average:  { favors: ['regular', 'slim', 'relaxed'], avoids: [] },
  athletic: { favors: ['regular', 'slim', 'fitted'], avoids: ['oversized'] },
  broad:    { favors: ['regular', 'relaxed', 'straight'], avoids: ['skinny', 'fitted'] },
};

export function fitProportionScore(
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

export interface SocialContextMap {
  // Normalized event title → Set of garment IDs worn at that event
  contextGarments: Map<string, Set<string>>;
  // Normalized event title → most recent date worn
  contextLastSeen: Map<string, string>;
}

export function normalizeEventTitle(title: string): string {
  // Normalize to detect recurring events: lowercase, strip dates/numbers, trim
  return title
    .toLowerCase()
    .replace(/\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?/g, "") // strip dates
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun|mån|tis|ons|tor|fre|lör|sön)\w*/gi, "") // strip day names
    .replace(/\b\d+\b/g, "") // strip standalone numbers
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSocialContextMap(wearLogs: WearLog[]): SocialContextMap {
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

export function socialContextPenalty(
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
// PERSONAL UNIFORM DETECTION (IB-5c)
// ─────────────────────────────────────────────

export interface UniformFormula {
  topSilhouette: string;
  bottomSilhouette: string;
  shoeCategory: string;
}

export interface PersonalUniform {
  formula: UniformFormula | null;
  frequency: number; // 0-1
  confidence: number; // 0-1 based on data volume
}

export function buildPersonalUniform(wearLogs: WearLog[], garments: GarmentRow[]): PersonalUniform | null {
  if (wearLogs.length < 15) return null; // Need enough data

  const garmentMap = new Map(garments.map(g => [g.id, g]));

  // Group wear logs by date to reconstruct "outfit-like" groupings
  const dayGroups = new Map<string, string[]>();
  for (const log of wearLogs) {
    const date = log.worn_at.slice(0, 10);
    if (!dayGroups.has(date)) dayGroups.set(date, []);
    dayGroups.get(date)!.push(log.garment_id);
  }

  // Build silhouette formulas from daily groupings
  const formulaCounts = new Map<string, number>();
  let totalDays = 0;

  for (const [, garmentIds] of dayGroups) {
    const gs = garmentIds.map(id => garmentMap.get(id)).filter(Boolean) as GarmentRow[];
    const top = gs.find(g => ['top', 'shirt', 'blouse', 'sweater', 't-shirt', 'hoodie', 'polo'].some(c => g.category.toLowerCase().includes(c)));
    const bottom = gs.find(g => ['bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt'].some(c => g.category.toLowerCase().includes(c)));
    const shoes = gs.find(g => ['shoes', 'sneakers', 'boots', 'loafers', 'sandals'].some(c => g.category.toLowerCase().includes(c)));

    if (top && bottom && shoes) {
      const key = `${top.silhouette}|${bottom.silhouette}|${shoes.subcategory || shoes.category}`.toLowerCase();
      formulaCounts.set(key, (formulaCounts.get(key) || 0) + 1);
      totalDays++;
    }
  }

  if (totalDays < 10) return null;

  // Find dominant formula
  let maxCount = 0;
  let dominantKey = '';
  for (const [key, count] of formulaCounts) {
    if (count > maxCount) { maxCount = count; dominantKey = key; }
  }

  const frequency = maxCount / totalDays;
  if (frequency < 0.3) return null; // Not enough consistency

  const parts = dominantKey.split('|');
  return {
    formula: {
      topSilhouette: parts[0] || 'straight',
      bottomSilhouette: parts[1] || 'straight',
      shoeCategory: parts[2] || 'shoes',
    },
    frequency,
    confidence: Math.min(1, totalDays / 30),
  };
}

// ─────────────────────────────────────────────
// GARMENT READINESS SIGNALS
// ─────────────────────────────────────────────

export interface GarmentReadinessSignals {
  analysisConfidence: number | null;
  enrichmentReady: boolean;
  isRecentlyAdded: boolean;
  penalty: number;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function garmentReadinessSignals(garment: GarmentRow): GarmentReadinessSignals {
  const aiRaw = garment.ai_raw && typeof garment.ai_raw === 'object' ? garment.ai_raw as Record<string, any> : {};
  const systemSignals = aiRaw.system_signals && typeof aiRaw.system_signals === 'object'
    ? aiRaw.system_signals as Record<string, any>
    : {};

  const analysisConfidenceRaw =
    typeof systemSignals.analysis_confidence === 'number'
      ? systemSignals.analysis_confidence
      : typeof aiRaw.confidence === 'number'
        ? aiRaw.confidence
        : typeof aiRaw?.enrichment?.confidence === 'number'
          ? aiRaw.enrichment.confidence
          : null;

  const analysisConfidence = analysisConfidenceRaw == null ? null : clamp01(analysisConfidenceRaw);
  const enrichmentReady = garment.enrichment_status === 'complete' || garment.enrichment_status === 'completed';
  const createdAt = garment.created_at ? new Date(garment.created_at).getTime() : null;
  const ageHours = createdAt == null ? Number.POSITIVE_INFINITY : (Date.now() - createdAt) / 36e5;
  const isRecentlyAdded = Number.isFinite(ageHours) && ageHours <= 72;

  let penalty = 0;
  if (!enrichmentReady) penalty += 0.55;

  if (analysisConfidence != null && analysisConfidence < 0.75) {
    penalty += Math.min(0.8, (0.75 - analysisConfidence) * 2);
  }

  if (isRecentlyAdded && analysisConfidence != null && analysisConfidence < 0.65) {
    penalty += 0.45;
  }

  if (isRecentlyAdded && !enrichmentReady) {
    penalty += 0.2;
  }

  return {
    analysisConfidence,
    enrichmentReady,
    isRecentlyAdded,
    penalty: Math.min(1.6, penalty),
  };
}

export function personalUniformScore(garment: GarmentRow, uniform: PersonalUniform | null): number {
  if (!uniform || !uniform.formula || uniform.confidence < 0.3) return 7;

  const slot = classifySlot(garment.category, garment.subcategory);
  const boost = uniform.frequency >= 0.6 ? 1.5 : uniform.frequency >= 0.4 ? 1.0 : 0.5;

  if (slot === 'top' && garment.silhouette === uniform.formula.topSilhouette) {
    return 7 + boost * uniform.confidence;
  }
  if (slot === 'bottom' && garment.silhouette === uniform.formula.bottomSilhouette) {
    return 7 + boost * uniform.confidence;
  }
  if (slot === 'shoes') {
    const shoeMatch = (garment.subcategory || garment.category).toLowerCase().includes(uniform.formula.shoeCategory);
    if (shoeMatch) return 7 + boost * 0.7 * uniform.confidence;
  }

  return 7;
}
