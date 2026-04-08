/**
 * Import/export stability tests for the outfit-scoring architecture split.
 * Validates that all re-exported symbols from outfit-scoring.ts resolve
 * correctly after the split into outfit-scoring-color.ts and outfit-scoring-body.ts.
 */
import { describe, it, expect } from 'vitest';

// Import everything through the barrel (outfit-scoring.ts)
import {
  // ── From outfit-scoring-color.ts ──
  getHSL,
  isNeutral,
  hueDiff,
  getCurrentSeason,
  getSeasonTransitionInfo,
  isTransitionalGarment,
  seasonalTransitionScore,
  isInSeasonalPalette,
  colorHarmonyScore,
  getColorTemperature,
  buildStyleVector,
  styleVectorScore,
  COLOR_HSL,
  SEASONAL_PALETTES,
  SEASON_ORDER,
  TRANSITION_MONTHS,
  TRANSITIONAL_MATERIALS,
  TRANSITIONAL_CATEGORIES,

  // ── From outfit-scoring-body.ts ──
  getMaterialGroup,
  materialCompatibility,
  buildComfortStyleProfile,
  percentile,
  comfortStyleScore,
  buildBodyProfile,
  fitProportionScore,
  normalizeEventTitle,
  buildSocialContextMap,
  socialContextPenalty,
  buildPersonalUniform,
  clamp01,
  garmentReadinessSignals,
  personalUniformScore,
  decayWeight,
  MATERIAL_GROUPS,
  MATERIAL_AFFINITY,
  FIT_BALANCE_RULES,
  BODY_FIT_PREFERENCES,
  FEEDBACK_HALF_LIFE_DAYS,

  // ── Stayed in outfit-scoring.ts ──
  scoreGarment,
  weatherSuitability,
  formalityScore,
  wearRotationScore,
  feedbackScore,
  styleAlignmentScore,
  categorizeSlot,
  hydrateEnrichment,
  fitFamily,
} from '../../../supabase/functions/_shared/outfit-scoring';

describe('outfit-scoring split — re-export stability', () => {
  it('color module exports resolve as functions', () => {
    expect(typeof getHSL).toBe('function');
    expect(typeof isNeutral).toBe('function');
    expect(typeof hueDiff).toBe('function');
    expect(typeof getCurrentSeason).toBe('function');
    expect(typeof getSeasonTransitionInfo).toBe('function');
    expect(typeof isTransitionalGarment).toBe('function');
    expect(typeof seasonalTransitionScore).toBe('function');
    expect(typeof isInSeasonalPalette).toBe('function');
    expect(typeof colorHarmonyScore).toBe('function');
    expect(typeof getColorTemperature).toBe('function');
    expect(typeof buildStyleVector).toBe('function');
    expect(typeof styleVectorScore).toBe('function');
  });

  it('color module constants are present', () => {
    expect(COLOR_HSL).toBeDefined();
    expect(COLOR_HSL['black']).toEqual([0, 0, 5]);
    expect(SEASONAL_PALETTES).toHaveProperty('winter');
    expect(SEASON_ORDER).toEqual(['winter', 'spring', 'summer', 'autumn']);
    expect(Object.keys(TRANSITION_MONTHS).length).toBeGreaterThan(0);
    expect(TRANSITIONAL_MATERIALS).toContain('cotton');
    expect(TRANSITIONAL_CATEGORIES).toContain('blazer');
  });

  it('body module exports resolve as functions', () => {
    expect(typeof getMaterialGroup).toBe('function');
    expect(typeof materialCompatibility).toBe('function');
    expect(typeof buildComfortStyleProfile).toBe('function');
    expect(typeof percentile).toBe('function');
    expect(typeof comfortStyleScore).toBe('function');
    expect(typeof buildBodyProfile).toBe('function');
    expect(typeof fitProportionScore).toBe('function');
    expect(typeof normalizeEventTitle).toBe('function');
    expect(typeof buildSocialContextMap).toBe('function');
    expect(typeof socialContextPenalty).toBe('function');
    expect(typeof buildPersonalUniform).toBe('function');
    expect(typeof clamp01).toBe('function');
    expect(typeof garmentReadinessSignals).toBe('function');
    expect(typeof personalUniformScore).toBe('function');
    expect(typeof decayWeight).toBe('function');
  });

  it('body module constants are present', () => {
    expect(MATERIAL_GROUPS).toHaveProperty('refined');
    expect(MATERIAL_AFFINITY).toHaveProperty('casual');
    expect(FIT_BALANCE_RULES).toHaveProperty('oversized');
    expect(BODY_FIT_PREFERENCES).toHaveProperty('slim');
    expect(FEEDBACK_HALF_LIFE_DAYS).toBe(14);
  });

  it('main module exports that stayed in outfit-scoring.ts resolve', () => {
    expect(typeof scoreGarment).toBe('function');
    expect(typeof weatherSuitability).toBe('function');
    expect(typeof formalityScore).toBe('function');
    expect(typeof wearRotationScore).toBe('function');
    expect(typeof feedbackScore).toBe('function');
    expect(typeof styleAlignmentScore).toBe('function');
    expect(typeof categorizeSlot).toBe('function');
    expect(typeof hydrateEnrichment).toBe('function');
    expect(typeof fitFamily).toBe('function');
  });

  it('cross-module functions produce consistent results', () => {
    // getHSL (color) → used by styleAlignmentScore (main)
    expect(getHSL('black')).toEqual([0, 0, 5]);
    expect(isNeutral([0, 0, 5])).toBe(true);

    // getMaterialGroup (body) → used by buildStyleVector (color)
    expect(getMaterialGroup('silk blazer')).toBe('refined');
    expect(getMaterialGroup('denim jacket')).toBe('casual');

    // decayWeight (body) → used by buildFeedbackPenalties (main)
    expect(decayWeight(null)).toBe(0.5);

    // clamp01 (body) → standalone
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.7)).toBe(0.7);
  });
});
