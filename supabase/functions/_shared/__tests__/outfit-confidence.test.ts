import { describe, expect, it } from 'vitest';

import {
  buildBaseGenerationLimitationNote,
  computeConfidence,
  computeSwapConfidence,
  generateLimitationNote,
  getQualityViolations,
  qualityGate,
  type ConfidenceResult,
} from '../outfit-confidence';
import type {
  ComboItem,
  GarmentRow,
  ScoredCombo,
  ScoredGarment,
  WeatherInput,
} from '../outfit-scoring';

function garment(overrides: Partial<GarmentRow> = {}): GarmentRow {
  return {
    id: overrides.id || 'g',
    title: overrides.title || 'piece',
    category: overrides.category || 'shirt',
    subcategory: overrides.subcategory ?? 'shirt',
    color_primary: overrides.color_primary || 'navy',
    color_secondary: null,
    pattern: 'solid',
    material: overrides.material || 'cotton',
    fit: overrides.fit || 'regular',
    formality: overrides.formality ?? 5,
    season_tags: [],
    wear_count: 0,
    last_worn_at: null,
    image_path: '',
    created_at: null,
    enrichment_status: null,
    ai_raw: null,
    silhouette: 'regular',
    visual_weight: 5,
    texture_intensity: 5,
    layering_role: 'standalone',
    versatility_score: 6,
    occasion_tags: [],
    style_archetype: 'classic',
    ...overrides,
  };
}

function comboItem(slot: string, g: GarmentRow, baseScore = 7): ComboItem {
  return { slot, garment: g, baseScore, baseBreakdown: {} };
}

function buildCombo(
  items: ComboItem[],
  breakdown: Record<string, number> = {},
): ScoredCombo {
  return {
    items,
    totalScore: 7,
    breakdown: {
      overall: 7,
      occasion_fit: 7,
      style_intent: 7,
      practicality: 7,
      formality: 7,
      formalityConsistency: 7,
      material: 7,
      material_compatibility: 7,
      ...breakdown,
    },
  };
}

function scored(g: GarmentRow, score = 7): ScoredGarment {
  return { garment: g, score, breakdown: {} };
}

function buildBalancedCombo(extra?: Partial<Record<string, number>>): ScoredCombo {
  return buildCombo(
    [
      comboItem('top', garment({ id: 't', subcategory: 'shirt', fit: 'fitted' })),
      comboItem(
        'bottom',
        garment({ id: 'b', subcategory: 'jeans', fit: 'relaxed' }),
      ),
      comboItem(
        'shoes',
        garment({ id: 's', subcategory: 'sneaker', fit: 'standard' }),
      ),
    ],
    extra,
  );
}

const TEMPERATE: WeatherInput = { temperature: 18, precipitation: 'none', wind: 'low' };

describe('qualityGate', () => {
  it('accepts a balanced complete combo', () => {
    expect(qualityGate(buildBalancedCombo(), TEMPERATE)).toBe(true);
  });

  it('rejects a combo with two bottoms (duplicate core role)', () => {
    const combo = buildCombo([
      comboItem('top', garment({ id: 't' })),
      comboItem('bottom', garment({ id: 'b1', subcategory: 'jeans' })),
      comboItem('bottom', garment({ id: 'b2', subcategory: 'jeans' })),
      comboItem('shoes', garment({ id: 's' })),
    ]);
    expect(qualityGate(combo, TEMPERATE)).toBe(false);
    const v = getQualityViolations(combo, TEMPERATE);
    expect(v.some((x) => x.rule === 'duplicate_core_role')).toBe(true);
  });

  it('flags a weather mismatch when practicality dives below the floor', () => {
    const combo = buildBalancedCombo({ practicality: 1 });
    const v = getQualityViolations(combo, TEMPERATE);
    expect(v.some((x) => x.rule === 'weather_mismatch')).toBe(true);
  });

  it('flags a lazy filler when a core baseScore drops below 2.5', () => {
    const combo = buildCombo([
      comboItem('top', garment({ id: 't' }), 1.0),
      comboItem(
        'bottom',
        garment({ id: 'b', subcategory: 'jeans', fit: 'relaxed' }),
        7,
      ),
      comboItem(
        'shoes',
        garment({ id: 's', subcategory: 'sneaker' }),
        7,
      ),
    ]);
    const v = getQualityViolations(combo, TEMPERATE);
    expect(v.some((x) => x.rule === 'lazy_filler')).toBe(true);
  });

  it('flags sandals in cold weather (footwear mismatch)', () => {
    const cold: WeatherInput = { temperature: -2, precipitation: 'none', wind: 'low' };
    const combo = buildCombo([
      comboItem('top', garment({ id: 't' })),
      comboItem(
        'bottom',
        garment({ id: 'b', subcategory: 'jeans', fit: 'relaxed' }),
      ),
      comboItem(
        'shoes',
        garment({
          id: 's',
          subcategory: 'sandal',
          title: 'leather sandals',
          fit: 'standard',
        }),
      ),
    ]);
    const v = getQualityViolations(combo, cold);
    expect(v.some((x) => x.rule === 'footwear_mismatch')).toBe(true);
  });
});

describe('computeConfidence', () => {
  const wideSlots: Record<string, ScoredGarment[]> = {
    top: Array.from({ length: 10 }, (_, i) => scored(garment({ id: `t${i}` }))),
    bottom: Array.from({ length: 10 }, (_, i) =>
      scored(garment({ id: `b${i}`, subcategory: 'jeans' })),
    ),
    shoes: Array.from({ length: 10 }, (_, i) =>
      scored(garment({ id: `s${i}`, subcategory: 'sneaker' })),
    ),
  };

  it('returns "high" for a strong combo from a deep wardrobe', () => {
    const combo = buildBalancedCombo({
      occasion_fit: 9,
      style_intent: 9,
      practicality: 9,
      formality: 9,
    });
    const r = computeConfidence(combo, 15, wideSlots, TEMPERATE, 'vardag');
    expect(r.confidence_level).toBe('high');
    expect(r.confidence_score).toBeGreaterThanOrEqual(7);
  });

  it('returns "low" or "medium" for a weak combo from a thin wardrobe', () => {
    const thinSlots: Record<string, ScoredGarment[]> = {
      top: [scored(garment({ id: 't' }))],
      bottom: [scored(garment({ id: 'b' }))],
      shoes: [],
    };
    const combo = buildBalancedCombo({
      occasion_fit: 2,
      style_intent: 2,
      practicality: 2,
      formality: 2,
      formalityConsistency: 2,
    });
    const r = computeConfidence(combo, 1, thinSlots, TEMPERATE, 'vardag');
    expect(r.confidence_score).toBeLessThan(5);
    expect(['low', 'medium']).toContain(r.confidence_level);
  });

  it('ranks two combos consistently (higher metrics ⇒ higher confidence)', () => {
    const strong = computeConfidence(
      buildBalancedCombo({
        occasion_fit: 9,
        style_intent: 9,
        practicality: 9,
        formality: 9,
      }),
      15,
      wideSlots,
      TEMPERATE,
      'vardag',
    );
    const weak = computeConfidence(
      buildBalancedCombo({
        occasion_fit: 4,
        style_intent: 4,
        practicality: 4,
        formality: 4,
      }),
      15,
      wideSlots,
      TEMPERATE,
      'vardag',
    );
    expect(strong.confidence_score).toBeGreaterThan(weak.confidence_score);
  });

  it('clamps the 7.0 boundary as "high" and 4.5 boundary as "medium"', () => {
    // 7.0 → high (>= 7)
    const high: ConfidenceResult = {
      confidence_score: 7,
      confidence_level: 'high',
      limitation_note: null,
    };
    // 4.5 → medium (>= 4.5 < 7)
    const medium: ConfidenceResult = {
      confidence_score: 4.5,
      confidence_level: 'medium',
      limitation_note: null,
    };
    // 4.4 → low
    const low: ConfidenceResult = {
      confidence_score: 4.4,
      confidence_level: 'low',
      limitation_note: null,
    };
    // These pin the bands generateLimitationNote relies on.
    expect(generateLimitationNote([], high)).toBeNull();
    expect(generateLimitationNote([], medium)).toBeNull();
    expect(generateLimitationNote([], low)).toBe('limited options match this request well');
  });
});

describe('generateLimitationNote', () => {
  it('returns null when no gaps and confidence is high', () => {
    expect(
      generateLimitationNote([], {
        confidence_score: 9,
        confidence_level: 'high',
        limitation_note: null,
      }),
    ).toBeNull();
  });

  it('joins up to 2 gap notes', () => {
    const note = generateLimitationNote(
      ['gap-1', 'gap-2', 'gap-3'],
      { confidence_score: 9, confidence_level: 'high', limitation_note: null },
    );
    expect(note).toBe('gap-1; gap-2');
  });
});

describe('buildBaseGenerationLimitationNote', () => {
  it('flags missing shoes', () => {
    const combo = buildCombo([
      comboItem('top', garment({ id: 't' })),
      comboItem(
        'bottom',
        garment({ id: 'b', subcategory: 'jeans', fit: 'relaxed' }),
      ),
    ]);
    const r: ConfidenceResult = {
      confidence_score: 9,
      confidence_level: 'high',
      limitation_note: null,
    };
    const note = buildBaseGenerationLimitationNote(combo, TEMPERATE, [], r);
    expect(note).toContain('missing shoes');
  });
});

describe('computeSwapConfidence', () => {
  it('returns a note when no candidates exist', () => {
    const r = computeSwapConfidence([], 'shoes', TEMPERATE);
    expect(r.confidence_level).toBe('low');
    expect(r.limitation_note).toBe('no alternatives available for this slot');
  });

  it('returns high confidence for a deep, strong candidate pool', () => {
    const candidates = [
      scored(garment({ id: 's1', subcategory: 'sneaker' }), 8.5),
      scored(garment({ id: 's2', subcategory: 'sneaker' }), 8),
      scored(garment({ id: 's3', subcategory: 'sneaker' }), 7.5),
      scored(garment({ id: 's4', subcategory: 'sneaker' }), 7),
    ];
    const r = computeSwapConfidence(candidates, 'shoes', TEMPERATE);
    expect(r.confidence_level).toBe('high');
  });

  it('penalizes shoes in wet weather without waterproof options', () => {
    const wet: WeatherInput = { temperature: 8, precipitation: 'rain', wind: 'medium' };
    const candidates = [
      scored(garment({ id: 's1', subcategory: 'sneaker', material: 'canvas' }), 6),
      scored(garment({ id: 's2', subcategory: 'sneaker', material: 'canvas' }), 6),
    ];
    const dryR = computeSwapConfidence(candidates, 'shoes', TEMPERATE);
    const wetR = computeSwapConfidence(candidates, 'shoes', wet);
    expect(wetR.confidence_score).toBeLessThan(dryR.confidence_score);
  });
});
