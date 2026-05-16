/**
 * outfit-confidence.ts — Confidence scoring, ranking and quality gates.
 *
 * Phase 5b: moved from `outfit-combination.ts` so the orchestrator's
 * "confidence rank → quality gate" pipeline can be reasoned about in
 * isolation from combo construction. Logic is unchanged.
 */

import {
  type ComboItem,
  type ScoredCombo,
  type ScoredGarment,
  type WeatherInput,
  fitFamily,
  feelsLikeTemp,
  getHSL,
  getFormalityRange,
  hasSuitableShoesAvailable,
  requiresOuterwear,
  validateLayeringCompleteness,
  WATERPROOF_MATERIALS,
} from "./outfit-scoring.ts";

// ─────────────────────────────────────────────
// HARD QUALITY GATE — reject weak outfits
// ─────────────────────────────────────────────

export interface QualityViolation {
  rule: string;
  detail: string;
}

export function qualityGate(combo: ScoredCombo, weather: WeatherInput): boolean {
  const violations = getQualityViolations(combo, weather);
  return violations.length === 0;
}

export function getQualityViolations(combo: ScoredCombo, weather: WeatherInput): QualityViolation[] {
  const violations: QualityViolation[] = [];
  const { items, breakdown } = combo;

  // 1. Duplicate core roles — only top may repeat, and only as a valid base + mid stack
  const slotCounts = new Map<string, number>();
  for (const item of items) {
    const s = item.slot;
    slotCounts.set(s, (slotCounts.get(s) || 0) + 1);
  }
  for (const [slot, count] of slotCounts) {
    if (['bottom', 'shoes', 'dress', 'outerwear'].includes(slot) && count > 1) {
      violations.push({ rule: 'duplicate_core_role', detail: `${count}x ${slot}` });
    }
  }

  const layering = validateLayeringCompleteness(items);
  if (!layering.valid) {
    for (const violation of layering.violations) {
      violations.push({ rule: 'layering_invalid', detail: violation });
    }
  }

  // 2. Weather mismatch — practicality too low
  if ((breakdown.practicality ?? 7) < 3) {
    violations.push({ rule: 'weather_mismatch', detail: `practicality ${breakdown.practicality?.toFixed(1)}` });
  }

  // 3. Formality mismatch — too wide a spread between items
  if ((breakdown.formalityConsistency ?? 7) < 3) {
    violations.push({ rule: 'formality_mismatch', detail: `consistency ${breakdown.formalityConsistency?.toFixed(1)}` });
  }

  // 4. Material clash — hard incompatibility
  if ((breakdown.material ?? breakdown.material_compatibility ?? 7) < 3) {
    violations.push({ rule: 'material_clash', detail: `score ${(breakdown.material ?? 7).toFixed(1)}` });
  }

  // 5. Silhouette imbalance — all oversized or all skin-tight
  const fits = items
    .filter(i => ['top', 'bottom', 'dress'].includes(i.slot))
    .map(i => fitFamily(i.garment.fit));
  if (fits.length >= 2) {
    const allRelaxed = fits.every(f => f === 'relaxed');
    const allTight = fits.every(f => f === 'fitted');
    if (allRelaxed) violations.push({ rule: 'silhouette_imbalance', detail: 'all oversized' });
    if (allTight && fits.length >= 3) violations.push({ rule: 'silhouette_imbalance', detail: 'all skin-tight' });
  }

  // 6. Statement conflict — more than one bold/saturated item in core slots
  const boldCount = items
    .filter(i => ['top', 'bottom', 'dress', 'shoes'].includes(i.slot))
    .filter(i => {
      const hsl = getHSL(i.garment.color_primary);
      if (!hsl) return false;
      const [, s, l] = hsl;
      return s > 65 && l > 25 && l < 75; // high saturation = statement piece
    }).length;
  if (boldCount > 2) {
    violations.push({ rule: 'statement_conflict', detail: `${boldCount} bold items` });
  }

  // 7. Lazy filler — any core-slot item with very low individual score
  const coreItems = items.filter(i => ['top', 'bottom', 'shoes', 'dress', 'outerwear'].includes(i.slot));
  for (const ci of coreItems) {
    if (ci.baseScore < 2.5) {
      violations.push({ rule: 'lazy_filler', detail: `${ci.slot} scored ${ci.baseScore.toFixed(1)}` });
      break; // one is enough to flag
    }
  }

  // 8. Incompatible footwear — sandals in cold / boots in extreme heat
  const shoesItem = items.find(i => i.slot === 'shoes');
  if (shoesItem && weather.temperature !== undefined) {
    const title = (shoesItem.garment.title || '').toLowerCase();
    const sub = (shoesItem.garment.subcategory || '').toLowerCase();
    const both = `${title} ${sub}`;
    const feelsTemp = feelsLikeTemp(weather.temperature, weather.wind);
    if (feelsTemp < 5 && (both.includes('sandal') || both.includes('flip'))) {
      violations.push({ rule: 'footwear_mismatch', detail: 'sandals in cold weather' });
    }
    if (feelsTemp > 30 && (both.includes('boot') || both.includes('stövel')) && !both.includes('chelsea')) {
      violations.push({ rule: 'footwear_mismatch', detail: 'heavy boots in extreme heat' });
    }
  }

  // 9. Texture monotony — all core items have nearly identical texture intensity (Phase 1)
  const coreTextures = items
    .filter(i => ['top', 'bottom', 'dress', 'outerwear'].includes(i.slot))
    .map(i => i.garment.texture_intensity);
  if (coreTextures.length >= 3) {
    const texSpread = Math.max(...coreTextures) - Math.min(...coreTextures);
    const allBold = coreTextures.every(t => t >= 7);
    if (texSpread < 1 && allBold) {
      violations.push({ rule: 'texture_monotony', detail: 'all items have bold/heavy texture' });
    }
  }

  return violations;
}

// ─────────────────────────────────────────────
// CONFIDENCE SCORING
// ─────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceResult {
  confidence_score: number;     // 0-10
  confidence_level: ConfidenceLevel;
  limitation_note: string | null;
}

export function computeConfidence(
  combo: ScoredCombo,
  candidateCount: number,
  slotCandidates: Record<string, ScoredGarment[]>,
  weather: WeatherInput,
  occasion: string,
  gaps: string[] = [],
  needsBaseLayer: boolean = false
): ConfidenceResult {
  const b = combo.breakdown;
  let score = 0;

  // Context fit (occasion + style intent): 30%
  const contextFit = ((b.occasion_fit || 7) + (b.style_intent || 7)) / 2;
  score += contextFit * 0.30;

  // Practicality (weather fit): 25%
  score += (b.practicality || 7) * 0.25;

  // Formality alignment: 15%
  score += (b.formality || b.formalityConsistency || 7) * 0.15;

  // Candidate pool depth: 15% — more options = higher confidence
  const poolDepth = Math.min(candidateCount, 20);
  const poolScore = (poolDepth / 20) * 10;
  score += poolScore * 0.15;

  // Wardrobe slot coverage: 15% — penalize thin slots
  const requiredSlots = hasSuitableShoesAvailable(slotCandidates['shoes'] || [], weather)
    ? ['top', 'bottom', 'shoes']
    : ['top', 'bottom'];
  let coverageScore = 10;
  for (const slot of requiredSlots) {
    const count = (slotCandidates[slot] || []).length;
    if (count === 0) coverageScore -= 4;
    else if (count === 1) coverageScore -= 2;
    else if (count <= 3) coverageScore -= 0.5;
  }
  score += Math.max(0, coverageScore) * 0.15;

  // Gap-aware penalty: reduce confidence when wardrobe gaps are detected
  for (const gap of gaps) {
    if (gap.includes('formal')) score -= 0.8;
    else if (gap.includes('weather') || gap.includes('rain') || gap.includes('outerwear')) score -= 0.6;
    else score -= 0.4;
  }

  // Structural incompleteness penalty
  if (needsBaseLayer) score -= 0.5;

  const final = Math.max(0, Math.min(10, score));
  const level: ConfidenceLevel = final >= 7 ? 'high' : final >= 4.5 ? 'medium' : 'low';

  return { confidence_score: Math.round(final * 10) / 10, confidence_level: level, limitation_note: null };
}

export function buildBaseGenerationLimitationNote(
  combo: ScoredCombo,
  weather: WeatherInput,
  gaps: string[],
  confidence: ConfidenceResult
): string | null {
  const parts: string[] = [];
  const slots = new Set(combo.items.map(item => item.slot));
  if (!slots.has('shoes')) {
    parts.push('missing shoes, so this is a base outfit only');
  }
  if (requiresOuterwear(weather) && !slots.has('outerwear')) {
    parts.push('missing weather-appropriate outerwear, so this is a base outfit only');
  }
  const generic = generateLimitationNote(gaps, confidence);
  if (generic) parts.push(generic);
  return parts.length > 0 ? Array.from(new Set(parts)).join('; ') : null;
}

export function generateLimitationNote(gaps: string[], confidence: ConfidenceResult): string | null {
  if (gaps.length === 0 && confidence.confidence_level === 'high') return null;

  const parts: string[] = [];
  if (gaps.length > 0) {
    parts.push(...gaps.slice(0, 2)); // max 2 gap notes
  }
  if (confidence.confidence_level === 'low' && gaps.length === 0) {
    parts.push('limited options match this request well');
  }
  return parts.length > 0 ? parts.join('; ') : null;
}

export function computeSwapConfidence(
  candidates: ScoredGarment[],
  slot: string,
  weather: WeatherInput
): ConfidenceResult {
  let score = 7;

  // Fewer candidates = lower confidence
  if (candidates.length === 0) score = 1;
  else if (candidates.length === 1) score -= 2;
  else if (candidates.length <= 3) score -= 1;

  // Best candidate score matters
  if (candidates.length > 0) {
    const bestScore = candidates[0].score;
    if (bestScore < 4) score -= 2;
    else if (bestScore < 5.5) score -= 1;
    else if (bestScore >= 7.5) score += 1;
  }

  // Weather penalty for shoes/outerwear in bad weather
  const precip = (weather.precipitation || '').toLowerCase();
  const isWet = precip.includes('rain') || precip.includes('regn') || precip.includes('snow') || precip.includes('snö');
  if (isWet && (slot === 'shoes' || slot === 'outerwear')) {
    const hasWeatherReady = candidates.some(c => {
      const mat = (c.garment.material || '').toLowerCase();
      return WATERPROOF_MATERIALS.some(w => mat.includes(w));
    });
    if (!hasWeatherReady) score -= 1.5;
  }

  const final = Math.max(0, Math.min(10, score));
  const level: ConfidenceLevel = final >= 7 ? 'high' : final >= 4.5 ? 'medium' : 'low';
  let note: string | null = null;
  if (candidates.length === 0) note = 'no alternatives available for this slot';
  else if (level === 'low') note = 'limited strong alternatives available';

  return { confidence_score: Math.round(final * 10) / 10, confidence_level: level, limitation_note: note };
}

// Re-exported for callers that want to iterate combos without recomputing.
export type { ComboItem };
