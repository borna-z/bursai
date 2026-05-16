// ─────────────────────────────────────────────
// SWAP-MODE SCORING (extracted Phase 5d — verbatim port)
//
// Lifted from `supabase/functions/burs_style_engine/index.ts` lines 371–763.
// Pure module: no DB, no network. Consumes preloaded garment rows + slot +
// weather + preferences and returns ranked swap candidates with a stylist-
// grade reason string. `computeSwapConfidence` already lives in
// `_shared/outfit-confidence.ts` — the orchestrator continues to call it on
// the candidates returned by `scoreSwapCandidates`.
// ─────────────────────────────────────────────

import {
  type GarmentRow,
  type ScoredGarment,
  type WeatherInput,
  type PairMemoryMap,
  type GarmentPenalty,
  categorizeSlot,
  clampScore,
  fitFamily,
  garmentText,
  getHSL,
  isNeutral,
  colorHarmonyScore,
  materialCompatibility,
  getPairMemoryScore,
  scoreGarment,
} from "./outfit-scoring.ts";

export type SwapMode = 'safe' | 'bold' | 'fresh';

export function visualWeight(garment: GarmentRow | null | undefined): number {
  if (!garment) return 5;
  const txt = garmentText(garment);
  let score = 5;

  if (['boot', 'coat', 'puffer', 'chunky', 'wool', 'leather'].some((x) => txt.includes(x))) score += 2;
  if (['sandal', 'linen', 'lightweight', 'tank', 'tee'].some((x) => txt.includes(x))) score -= 1.5;

  const formality = garment.formality ?? 5;
  score += (formality - 5) * 0.15;

  return clampScore(score);
}

export function formalityAlignmentScore(
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

export function fitConsistencyScore(
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

export function dnaPreservationScore(
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

export function swapPracticalityScore(
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

export function expressiveLiftScore(
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

export function controlledNoveltyScore(
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

export function scoreSwapCandidates(
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
): (ScoredGarment & { swap_reason?: string })[] {
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

      // Explicit wear_recency bonus
      const daysSinceWorn = garment.last_worn_at
        ? (Date.now() - new Date(garment.last_worn_at).getTime()) / (1000 * 60 * 60 * 24)
        : 999;
      const wearRecencyBonus = daysSinceWorn >= 14 ? 5 : 0;

      // Explicit rejection penalty
      const rejectionPenalty = penalties.get(garment.id)?.rejected === true ? 20 : 0;

      const finalScore = Math.max(0, totalScore + wearRecencyBonus - rejectionPenalty);

      // Generate swap reason
      const swap_reason = buildSwapReason(garment, currentGarment, {
        colorHarmony, materialCompat, formalityAlignment, fitConsistency,
        dnaPreservation, practicality, expressiveLift, freshness, swapMode,
      });

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
          wear_recency: wearRecencyBonus,
          rejection_penalty: -rejectionPenalty,
        },
        swap_reason,
      } as ScoredGarment & { swap_reason?: string };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/** Build a concise, stylist-grade swap reason */
export function buildSwapReason(
  candidate: GarmentRow,
  current: GarmentRow | null,
  scores: {
    colorHarmony: number;
    materialCompat: number;
    formalityAlignment: number;
    fitConsistency: number;
    dnaPreservation: number;
    practicality: number;
    expressiveLift: number;
    freshness: number;
    swapMode: SwapMode;
  }
): string {
  const reasons: string[] = [];

  // Pick the top 1-2 strongest signals
  if (scores.colorHarmony >= 8) reasons.push('strong color harmony with the rest');
  if (scores.dnaPreservation >= 8.5 && scores.swapMode === 'safe') reasons.push('preserves the outfit\'s DNA');
  if (scores.expressiveLift >= 8 && scores.swapMode === 'bold') reasons.push('adds visual contrast');
  if (scores.freshness >= 8 && scores.swapMode === 'fresh') reasons.push('brings something new');
  if (scores.practicality >= 9) reasons.push('ideal for this weather');
  if (scores.formalityAlignment >= 9) reasons.push('perfect formality match');
  if (scores.materialCompat >= 9) reasons.push('great material pairing');
  if (scores.fitConsistency >= 9) reasons.push('balanced silhouette');

  // If no strong signal, use relative comparison
  if (reasons.length === 0 && current) {
    const candidateColor = (candidate.color_primary || '').toLowerCase();
    const currentColor = (current.color_primary || '').toLowerCase();
    if (candidateColor !== currentColor) reasons.push(`shifts the palette with ${candidateColor}`);
    if (fitFamily(candidate.fit) !== fitFamily(current.fit)) reasons.push('changes the silhouette');
    if (candidate.wear_count === 0) reasons.push('unworn — time to debut');
  }

  if (reasons.length === 0) reasons.push('solid alternative');

  return reasons.slice(0, 2).join(', ');
}
