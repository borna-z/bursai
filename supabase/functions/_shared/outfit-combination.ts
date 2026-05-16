/**
 * outfit-combination.ts — Combo building, deduplication, scoring,
 * quality gate, confidence, failure analysis, and swap confidence.
 *
 * Extracted from burs_style_engine/index.ts — zero logic changes.
 */

import { collectOccasionSignals, hasOccasionSignal } from "./style-signals.ts";
import {
  type GarmentRow,
  type ScoredGarment,
  type ComboItem,
  type ScoredCombo,
  type WeatherInput,
  type PairMemoryRow,
  type PairMemoryMap,
  type BodyProfile,
  colorHarmonyScore,
  materialCompatibility,
  fitProportionScore,
  styleIntentScore,
  occasionTemplateScore,
  weatherPracticalityScore,
  silhouetteBalanceScore,
  textureDepthScore,
  getPairMemoryScore,
  isCompleteOutfit,
  validateLayeringCompleteness,
  getHSL,
  isNeutral,
  isWetWeather,
  isSuitableShoeCandidate,
  requiresOuterwear,
  getFormalityRange,
  fitFamily,
  WATERPROOF_MATERIALS,
} from "./outfit-scoring.ts";
// Phase 5b — confidence + quality gate moved to a sibling module so this
// file stays focused on combo *construction*. `qualityGate` is still used
// internally by `buildCombos` / `buildFallbackCombos` below, so it's
// imported back in. The remaining names are re-exported for backwards
// compatibility — the orchestrator now imports from `outfit-confidence.ts`
// directly, but downstream readers may still reach here for them.
import {
  qualityGate,
  type ConfidenceLevel,
  type ConfidenceResult,
  type QualityViolation,
} from "./outfit-confidence.ts";
export {
  qualityGate,
  getQualityViolations,
  computeConfidence,
  computeSwapConfidence,
  buildBaseGenerationLimitationNote,
  generateLimitationNote,
} from "./outfit-confidence.ts";
export type { ConfidenceLevel, ConfidenceResult, QualityViolation };

// ─────────────────────────────────────────────
// ANTI-REPETITION (Jaccard)
// ─────────────────────────────────────────────

export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  let intersection = 0;
  for (const item of setA) if (setB.has(item)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

// ─────────────────────────────────────────────
// OUTFIT FAMILY DEDUPLICATION
// ─────────────────────────────────────────────

export interface OutfitFamilySignature {
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

export type FamilyLabel = 'classic' | 'bold-alternative' | 'weather-ready' | 'comfort-pick' | 'dressy';

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

export interface DeduplicatedCombo extends ScoredCombo {
  family_label: string;
  variation_reason: string;
}

export function comboHasPreferredGarment(combo: ScoredCombo, preferGarmentIds: Set<string>): boolean {
  if (preferGarmentIds.size === 0) return true;
  return combo.items.some((item) => preferGarmentIds.has(item.garment.id));
}

export function filterCombosByPreferredGarment<TCombo extends ScoredCombo>(
  combos: TCombo[],
  preferGarmentIds: Set<string>,
): TCombo[] {
  if (preferGarmentIds.size === 0) return combos;
  return combos.filter((combo) => comboHasPreferredGarment(combo, preferGarmentIds));
}

export function pickRepresentativeOutfits(
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
// COMBO BUILDER
// ─────────────────────────────────────────────

export function buildCombos(
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
  const suitableShoes = shoes.filter((shoe) => isSuitableShoeCandidate(shoe, weather));
  const baseTops = tops.filter(t => {
    const role = t.garment.layering_role || 'standalone';
    return role === 'base' || role === 'standalone';
  });
  const midLayers = tops.filter(t => (t.garment.layering_role || 'standalone') === 'mid');
  const primaryTopSeeds = baseTops;

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

  const midLayerOptions: Array<ScoredGarment | null> =
    midLayers.length > 0
      ? [null, ...midLayers.slice(0, 2)]
      : [null];

  const shoeOptions: Array<ScoredGarment | null> = suitableShoes.length > 0
    ? suitableShoes.slice(0, 5)
    : shoes.slice(0, 3);

  const combos: ScoredCombo[] = [];

  const pushCombo = (items: ComboItem[]) => {
    const { complete } = isCompleteOutfit(items, weather, 'strict_visible');
    if (!complete) return; // Reject incomplete outfits before scoring
    const layering = validateLayeringCompleteness(items);
    if (!layering.valid) return;
    combos.push(
      scoreCombo(items, recentOutfitSets, occasion, weather, style, prefs, body, pairMemory)
    );
  };

  // Dress-based combos
  for (const d of dresses.slice(0, 4)) {
    for (const s of shoeOptions) {
      for (const ow of outerwearOptions) {
        for (const acc of accessoryOptions) {
          const items: ComboItem[] = [
            {
              slot: 'dress',
              garment: d.garment,
              baseScore: d.score,
              baseBreakdown: d.breakdown,
            },
          ];

          if (s) {
            items.push({
              slot: 'shoes',
              garment: s.garment,
              baseScore: s.score,
              baseBreakdown: s.breakdown,
            });
          }

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
  for (const t of primaryTopSeeds.slice(0, 5)) {
    for (const b of bottoms.slice(0, 5)) {
      for (const s of shoeOptions) {
        for (const mid of midLayerOptions) {
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
              ];

              if (s) {
                items.push({
                  slot: 'shoes',
                  garment: s.garment,
                  baseScore: s.score,
                  baseBreakdown: s.breakdown,
                });
              }

              if (mid && mid.garment.id !== t.garment.id) {
                items.push({
                  slot: 'top',
                  garment: mid.garment,
                  baseScore: mid.score,
                  baseBreakdown: mid.breakdown,
                });
              }

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

  // Hard quality gate — reject weak outfits before ranking
  const qualityFiltered = Array.from(unique.values()).filter(c => qualityGate(c, weather));
  if (qualityFiltered.length === 0) return [];

  // Exact-id dedup first, then family-level dedup
  const exactDeduped = qualityFiltered.sort((a, b) => b.totalScore - a.totalScore);

  return pickRepresentativeOutfits(exactDeduped, maxCombos, 0.8);
}

export function buildFallbackCombos(
  slotCandidates: Record<string, ScoredGarment[]>,
  recentOutfitSets: Set<string>[],
  occasion: string,
  style: string | null,
  weather: WeatherInput,
  prefs: Record<string, any> | null,
  maxCombos: number = 3,
  body: BodyProfile | null = null,
  pairMemory: PairMemoryMap | null = null
): { combos: ScoredCombo[]; fallbackLevel: number } {
  const tops = slotCandidates['top'] || [];
  const bottoms = slotCandidates['bottom'] || [];
  const shoes = slotCandidates['shoes'] || [];
  const dresses = slotCandidates['dress'] || [];
  const outerwear = slotCandidates['outerwear'] || [];
  const suitableShoes = shoes.filter((shoe) => isSuitableShoeCandidate(shoe, weather));
  const baseTops = tops.filter((top) => {
    const role = top.garment.layering_role || 'standalone';
    return role === 'base' || role === 'standalone';
  });
  const outerwearOptions: Array<ScoredGarment | null> = requiresOuterwear(weather)
    ? (outerwear.length > 0 ? [outerwear[0]] : [null])
    : [null, ...(outerwear.length > 0 ? [outerwear[0]] : [])];
  const combos: ScoredCombo[] = [];

  const pushFallbackCombo = (items: ComboItem[]) => {
    const { complete } = isCompleteOutfit(items, weather, 'strict_visible');
    if (!complete) return;
    const layering = validateLayeringCompleteness(items);
    if (!layering.valid) return;
    const scored = scoreCombo(items, recentOutfitSets, occasion, weather, style, prefs, body, pairMemory);
    if (!qualityGate(scored, weather)) return;
    combos.push(scored);
  };

  if (baseTops.length > 0 && bottoms.length > 0 && suitableShoes.length > 0) {
    for (const t of baseTops.slice(0, 4)) {
      for (const b of bottoms.slice(0, 4)) {
        for (const s of suitableShoes.slice(0, 3)) {
          for (const ow of outerwearOptions) {
            pushFallbackCombo([
              { slot: 'top', garment: t.garment, baseScore: t.score, baseBreakdown: t.breakdown },
              { slot: 'bottom', garment: b.garment, baseScore: b.score, baseBreakdown: b.breakdown },
              { slot: 'shoes', garment: s.garment, baseScore: s.score, baseBreakdown: s.breakdown },
              ...(ow ? [{ slot: 'outerwear', garment: ow.garment, baseScore: ow.score, baseBreakdown: ow.breakdown }] : []),
            ]);
          }
        }
      }
    }
    if (combos.length > 0) {
      return { combos: combos.sort((a, b) => b.totalScore - a.totalScore).slice(0, maxCombos), fallbackLevel: 2 };
    }
  }

  if (dresses.length > 0 && suitableShoes.length > 0) {
    for (const d of dresses.slice(0, 4)) {
      for (const s of suitableShoes.slice(0, 3)) {
        for (const ow of outerwearOptions) {
          pushFallbackCombo([
            { slot: 'dress', garment: d.garment, baseScore: d.score, baseBreakdown: d.breakdown },
            { slot: 'shoes', garment: s.garment, baseScore: s.score, baseBreakdown: s.breakdown },
            ...(ow ? [{ slot: 'outerwear', garment: ow.garment, baseScore: ow.score, baseBreakdown: ow.breakdown }] : []),
          ]);
        }
      }
    }
    if (combos.length > 0) {
      return { combos: combos.sort((a, b) => b.totalScore - a.totalScore).slice(0, maxCombos), fallbackLevel: 3 };
    }
  }

  return { combos: [], fallbackLevel: -1 };
}

export function scoreCombo(
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

  // Enrichment-aware combo scores (Phase 1)
  const silBalance = silhouetteBalanceScore(items);
  const texDepth = textureDepthScore(items);

  // Pair memory scoring
  const garmentIds = items.map(i => i.garment.id);
  const pairMem = getPairMemoryScore(garmentIds, pairMemory);

  // Rebalanced weights: added silhouette + texture, slightly reduced others
  const totalScore =
    avgBaseScore * 0.28 +
    colorScore * 0.13 +
    matScore * 0.06 +
    formalityConsistency * 0.09 +
    fitScore * 0.07 +
    styleScore * 0.08 +
    occasionScore * 0.08 +
    practicality * 0.07 +
    silBalance * 0.07 +    // NEW: silhouette balance
    texDepth * 0.07 +      // NEW: texture depth
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
      silhouette_balance: silBalance,
      texture_depth: texDepth,
      repetitionPenalty,
      pair_memory_boost: pairMem.boost,
      pair_memory_penalty: pairMem.penalty,
    },
  };
}

// ─────────────────────────────────────────────
// WARDROBE GAP DETECTION
// ─────────────────────────────────────────────

export function detectWardrobeGapForRequest(
  slotCandidates: Record<string, ScoredGarment[]>,
  weather: WeatherInput,
  occasion: string
): string[] {
  const gaps: string[] = [];
  const occasionSignals = collectOccasionSignals(occasion);

  const temp = weather.temperature;
  const precip = (weather.precipitation || '').toLowerCase();
  const isRainy = precip.includes('rain') || precip.includes('regn');
  const isSnowy = precip.includes('snow') || precip.includes('snö');
  const isCold = temp !== undefined && temp < 10;
  const isVeryCold = temp !== undefined && temp < 0;

  // Missing outerwear in cold/wet weather
  const outerwearCount = (slotCandidates['outerwear'] || []).length;
  if ((isCold || isRainy || isSnowy) && outerwearCount === 0) {
    gaps.push('missing outerwear for cold or wet weather');
  }

  // Rain-friendly check
  if (isRainy || isSnowy) {
    const hasWaterproof = (slotCandidates['outerwear'] || []).some(g => {
      const mat = (g.garment.material || '').toLowerCase();
      return WATERPROOF_MATERIALS.some(w => mat.includes(w));
    });
    if (!hasWaterproof) {
      gaps.push('no rain-friendly outerwear available');
    }

    const hasWaterproofShoes = (slotCandidates['shoes'] || []).some(g => {
      const mat = (g.garment.material || '').toLowerCase();
      const title = (g.garment.title || '').toLowerCase();
      return WATERPROOF_MATERIALS.some(w => mat.includes(w)) || title.includes('boot') || title.includes('stövel');
    });
    if (!hasWaterproofShoes) {
      gaps.push('missing rain-friendly shoes');
    }
  }

  // Layering for very cold weather
  if (isVeryCold) {
    const topCount = (slotCandidates['top'] || []).length;
    if (topCount < 2 && outerwearCount === 0) {
      gaps.push('not enough layering pieces for current weather');
    }
  }

  // Formality gaps
  const needsRefinedCore =
    hasOccasionSignal(occasionSignals, 'work') ||
    hasOccasionSignal(occasionSignals, 'meeting') ||
    hasOccasionSignal(occasionSignals, 'formal');
  if (needsRefinedCore) {
    const [, maxFormality] = getFormalityRange(occasion);
    const refinedThreshold = Math.max(4, maxFormality - 1);
    const formalTops = (slotCandidates['top'] || []).filter(g => (g.garment.formality ?? 0) >= refinedThreshold);
    const formalBottoms = (slotCandidates['bottom'] || []).filter(g => (g.garment.formality ?? 0) >= refinedThreshold);
    const formalDresses = (slotCandidates['dress'] || []).filter(g => (g.garment.formality ?? 0) >= refinedThreshold);
    const hasFormalSeparates = formalTops.length > 0 && formalBottoms.length > 0;

    if (!hasFormalSeparates && formalDresses.length === 0) {
      if (formalTops.length === 0) gaps.push('weak formal top options for this occasion');
      if (formalBottoms.length === 0) gaps.push('weak formal bottom options for this occasion');
    }
  }

  // Thin wardrobe in general
  const totalGarments = Object.values(slotCandidates).reduce((sum, arr) => sum + arr.length, 0);
  if (totalGarments < 6) {
    gaps.push('small wardrobe limits outfit variety');
  }

  return gaps;
}


// ─────────────────────────────────────────────
// GENERATION-DRIVEN WARDROBE INSIGHTS
// ─────────────────────────────────────────────

export interface GenerationFailureSignal {
  occasion: string;
  weather: WeatherInput;
  gaps: string[];
  confidence_level: ConfidenceLevel;
  slotWeaknesses: string[]; // slots with 0-1 candidates
  formalityMismatch: boolean;
}

export function buildGenerationFailureSignal(
  occasion: string,
  weather: WeatherInput,
  gaps: string[],
  confidence: ConfidenceResult,
  slotCandidates: Record<string, ScoredGarment[]>
): GenerationFailureSignal {
  const slotWeaknesses: string[] = [];
  for (const [slot, candidates] of Object.entries(slotCandidates)) {
    if (candidates.length <= 1) slotWeaknesses.push(slot);
  }
  const formalOccasions = ['work', 'jobb', 'interview', 'intervju', 'formal', 'formell', 'business', 'date'];
  const formalityMismatch = formalOccasions.includes(occasion.toLowerCase()) &&
    gaps.some(g => g.includes('formal'));
  return { occasion, weather, gaps, confidence_level: confidence.confidence_level, slotWeaknesses, formalityMismatch };
}

export interface WardrobeInsight {
  type: 'weather_gap' | 'formality_gap' | 'category_imbalance' | 'slot_weakness' | 'versatility';
  severity: 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
  related_occasions: string[];
}

function aggregateFailurePatterns(signals: GenerationFailureSignal[]): {
  weatherFailures: number;
  formalityFailures: number;
  slotFailureCounts: Record<string, number>;
  weakOccasions: Record<string, number>;
  gapFrequency: Record<string, number>;
} {
  const weatherFailures = signals.filter(s => {
    const precip = (s.weather.precipitation || '').toLowerCase();
    return (precip.includes('rain') || precip.includes('snow') || precip.includes('regn') || precip.includes('snö')) &&
      s.gaps.some(g => g.includes('rain') || g.includes('outerwear') || g.includes('waterproof'));
  }).length;

  const formalityFailures = signals.filter(s => s.formalityMismatch).length;

  const slotFailureCounts: Record<string, number> = {};
  for (const s of signals) {
    for (const slot of s.slotWeaknesses) {
      slotFailureCounts[slot] = (slotFailureCounts[slot] || 0) + 1;
    }
  }

  const weakOccasions: Record<string, number> = {};
  for (const s of signals) {
    if (s.confidence_level !== 'high') {
      const occ = s.occasion.toLowerCase();
      weakOccasions[occ] = (weakOccasions[occ] || 0) + 1;
    }
  }

  const gapFrequency: Record<string, number> = {};
  for (const s of signals) {
    for (const gap of s.gaps) {
      gapFrequency[gap] = (gapFrequency[gap] || 0) + 1;
    }
  }

  return { weatherFailures, formalityFailures, slotFailureCounts, weakOccasions, gapFrequency };
}

export function deriveWardrobeInsightsFromGeneration(signals: GenerationFailureSignal[]): WardrobeInsight[] {
  if (signals.length === 0) return [];

  const patterns = aggregateFailurePatterns(signals);
  const insights: WardrobeInsight[] = [];

  // Weather-specific insights
  if (patterns.weatherFailures >= 2) {
    const rainGaps = signals.filter(s =>
      s.gaps.some(g => g.includes('rain-friendly shoes'))
    );
    const outerwearGaps = signals.filter(s =>
      s.gaps.some(g => g.includes('outerwear'))
    );
    if (rainGaps.length >= 2) {
      insights.push({
        type: 'weather_gap',
        severity: 'high',
        message: 'Your wardrobe struggles in rainy weather — no rain-friendly smart shoes found across multiple requests.',
        suggestion: 'Consider adding waterproof boots or rain-ready loafers.',
        related_occasions: [...new Set(rainGaps.map(s => s.occasion))],
      });
    }
    if (outerwearGaps.length >= 2) {
      insights.push({
        type: 'weather_gap',
        severity: 'high',
        message: 'Weak outerwear coverage for cold or rainy days — the engine had to compromise on practicality.',
        suggestion: 'A waterproof jacket or insulated coat would unlock better cold/wet weather outfits.',
        related_occasions: [...new Set(outerwearGaps.map(s => s.occasion))],
      });
    }
  }

  // Formality-specific insights
  if (patterns.formalityFailures >= 2) {
    const formalOccasions = [...new Set(
      signals.filter(s => s.formalityMismatch).map(s => s.occasion)
    )];
    insights.push({
      type: 'formality_gap',
      severity: 'high',
      message: 'Not enough elevated options for date or work occasions — the engine repeatedly lacks refined tops or bottoms.',
      suggestion: 'Adding a structured blazer, tailored trousers, or a dress shirt would significantly improve formal outfit options.',
      related_occasions: formalOccasions,
    });
  }

  // Slot weakness insights
  for (const [slot, count] of Object.entries(patterns.slotFailureCounts)) {
    if (count >= 2) {
      const severity = count >= 3 ? 'high' as const : 'medium' as const;
      const slotLabel = slot === 'outerwear' ? 'outerwear' : slot === 'shoes' ? 'shoes' : `${slot} pieces`;
      insights.push({
        type: 'slot_weakness',
        severity,
        message: `Too few ${slotLabel} in your wardrobe — this slot limited outfit variety in ${count} generation attempts.`,
        suggestion: `Adding 2-3 more ${slotLabel} would meaningfully expand your outfit combinations.`,
        related_occasions: [...new Set(
          signals.filter(s => s.slotWeaknesses.includes(slot)).map(s => s.occasion)
        )],
      });
    }
  }

  // Category imbalance
  const casualTopGaps = signals.filter(s =>
    s.gaps.some(g => g.includes('formal top') || g.includes('formal bottom'))
  );
  if (casualTopGaps.length >= 2 && !insights.some(i => i.type === 'formality_gap')) {
    insights.push({
      type: 'category_imbalance',
      severity: 'medium',
      message: 'Your wardrobe leans casual — too many relaxed pieces and not enough refined bottoms or structured tops.',
      suggestion: 'Balance with a pair of tailored chinos or slim trousers.',
      related_occasions: [...new Set(casualTopGaps.map(s => s.occasion))],
    });
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return insights.slice(0, 5);
}

