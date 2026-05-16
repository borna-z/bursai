import { describe, expect, it } from 'vitest';

import {
  buildSwapReason,
  controlledNoveltyScore,
  dnaPreservationScore,
  expressiveLiftScore,
  fitConsistencyScore,
  formalityAlignmentScore,
  scoreSwapCandidates,
  swapPracticalityScore,
  visualWeight,
  type SwapMode,
} from '../outfit-swap';
import { computeSwapConfidence } from '../outfit-confidence';
import type {
  GarmentPenalty,
  GarmentRow,
  PairMemoryMap,
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

const dryWeather: WeatherInput = { temperature: 18, precipitation: 'none', wind: 'low' };

describe('visualWeight', () => {
  it('returns 5 for missing garment', () => {
    expect(visualWeight(null)).toBe(5);
    expect(visualWeight(undefined)).toBe(5);
  });

  it('boosts heavy materials and pieces', () => {
    const heavy = garment({ title: 'wool coat', material: 'wool', formality: 7 });
    expect(visualWeight(heavy)).toBeGreaterThan(5);
  });

  it('reduces score for lightweight items', () => {
    const light = garment({ title: 'linen tank', material: 'linen', formality: 3 });
    expect(visualWeight(light)).toBeLessThan(5);
  });
});

describe('formalityAlignmentScore', () => {
  it('returns 7 when no formality signal available', () => {
    const candidate = garment({ formality: undefined as unknown as number });
    expect(formalityAlignmentScore(candidate, [], null)).toBe(7);
  });

  it('rewards matching formality with the current garment', () => {
    const candidate = garment({ formality: 5 });
    const current = garment({ id: 'cur', formality: 5 });
    const score = formalityAlignmentScore(candidate, [], current);
    expect(score).toBeGreaterThanOrEqual(9);
  });

  it('penalizes large formality gaps', () => {
    const candidate = garment({ formality: 2 });
    const current = garment({ id: 'cur', formality: 9 });
    const score = formalityAlignmentScore(candidate, [], current);
    expect(score).toBeLessThan(5);
  });
});

describe('fitConsistencyScore', () => {
  it('rewards matching fit family with current garment', () => {
    const candidate = garment({ fit: 'slim' });
    const current = garment({ id: 'cur', fit: 'slim' });
    const score = fitConsistencyScore(candidate, [], current);
    expect(score).toBeGreaterThanOrEqual(9);
  });

  it('penalizes fit mismatch', () => {
    const candidate = garment({ fit: 'relaxed' });
    const current = garment({ id: 'cur', fit: 'slim' });
    expect(fitConsistencyScore(candidate, [], current)).toBeLessThan(7);
  });
});

describe('dnaPreservationScore', () => {
  it('returns 7 with no current garment', () => {
    expect(dnaPreservationScore(garment(), null, [])).toBe(7);
  });

  it('rewards very similar candidates', () => {
    const current = garment({ id: 'cur', material: 'cotton', pattern: 'solid', fit: 'regular', formality: 5 });
    const candidate = garment({ material: 'cotton', pattern: 'solid', fit: 'regular', formality: 5 });
    expect(dnaPreservationScore(candidate, current, [])).toBeGreaterThanOrEqual(8.5);
  });
});

describe('swapPracticalityScore', () => {
  it('penalizes sandals in wet weather', () => {
    const candidate = garment({ title: 'leather sandals', category: 'shoes' });
    const wet: WeatherInput = { temperature: 10, precipitation: 'rain', wind: 'low' };
    expect(swapPracticalityScore(candidate, 'shoes', wet)).toBeLessThan(5);
  });

  it('rewards outerwear in cold rainy weather', () => {
    const coat = garment({ title: 'rain coat', category: 'outerwear' });
    const wet: WeatherInput = { temperature: 6, precipitation: 'rain', wind: 'low' };
    expect(swapPracticalityScore(coat, 'outerwear', wet)).toBeGreaterThan(7);
  });
});

describe('expressiveLiftScore', () => {
  it('rewards chromatic, patterned, or premium materials', () => {
    const expressive = garment({ color_primary: 'red', pattern: 'floral', title: 'leather jacket' });
    expect(expressiveLiftScore(expressive, null)).toBeGreaterThan(7);
  });
});

describe('controlledNoveltyScore', () => {
  it('returns 6.5 with no current garment', () => {
    expect(controlledNoveltyScore(garment(), null, 7, 7, 7)).toBe(6.5);
  });

  it('penalizes identical color + material to current', () => {
    const current = garment({ id: 'cur', color_primary: 'black', material: 'wool' });
    const dupe = garment({ color_primary: 'black', material: 'wool' });
    const score = controlledNoveltyScore(dupe, current, 7, 7, 7);
    expect(score).toBeLessThan(6);
  });
});

describe('scoreSwapCandidates', () => {
  const current = garment({ id: 'current', category: 'shoes', subcategory: 'sneakers' });
  const candidate1 = garment({
    id: 'cand1',
    category: 'shoes',
    subcategory: 'sneakers',
    color_primary: 'white',
  });
  const candidate2 = garment({
    id: 'cand2',
    category: 'shoes',
    subcategory: 'boots',
    color_primary: 'black',
  });
  // unrelated garment from another slot
  const top = garment({ id: 'top1', category: 'top', subcategory: 'shirt' });
  const penalties: Map<string, GarmentPenalty> = new Map();
  const pairMemory: PairMemoryMap = new Map();

  it('excludes the current garment from candidates', () => {
    const candidates = scoreSwapCandidates(
      'shoes',
      current.id,
      [{ slot: 'top', garment: top }],
      [current, candidate1, candidate2, top],
      'vardag',
      dryWeather,
      penalties,
      null,
      'safe',
      pairMemory,
    );
    expect(candidates.map((c) => c.garment.id)).not.toContain(current.id);
    expect(candidates.length).toBe(2);
  });

  it('returns at most 10 ranked candidates', () => {
    const allCandidates: GarmentRow[] = Array.from({ length: 15 }).map((_, i) =>
      garment({ id: `c${i}`, category: 'shoes', subcategory: 'sneakers' }),
    );
    const result = scoreSwapCandidates(
      'shoes',
      'nonexistent',
      [],
      allCandidates,
      'vardag',
      dryWeather,
      penalties,
      null,
      'safe',
      pairMemory,
    );
    expect(result.length).toBeLessThanOrEqual(10);
    // sorted descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it('applies massive penalty for rejected garments', () => {
    const rejectedPenalties = new Map<string, GarmentPenalty>();
    rejectedPenalties.set('cand1', {
      total: 0,
      weatherPenalty: 0,
      formalityPenalty: 0,
      fitPenalty: 0,
      positiveBoost: 0,
      rejected: true,
    });
    const result = scoreSwapCandidates(
      'shoes',
      current.id,
      [],
      [current, candidate1, candidate2],
      'vardag',
      dryWeather,
      rejectedPenalties,
      null,
      'safe',
      pairMemory,
    );
    const rejected = result.find((c) => c.garment.id === 'cand1');
    const accepted = result.find((c) => c.garment.id === 'cand2');
    expect(rejected).toBeDefined();
    expect(accepted).toBeDefined();
    expect(rejected!.score).toBeLessThan(accepted!.score);
  });

  it('produces a swap_reason string for every candidate', () => {
    const result = scoreSwapCandidates(
      'shoes',
      current.id,
      [],
      [current, candidate1, candidate2],
      'vardag',
      dryWeather,
      penalties,
      null,
      'safe',
      pairMemory,
    );
    for (const r of result) {
      expect(typeof r.swap_reason).toBe('string');
      expect(r.swap_reason!.length).toBeGreaterThan(0);
    }
  });

  it('different swap modes adjust weights', () => {
    const modes: SwapMode[] = ['safe', 'bold', 'fresh'];
    const breakdowns = modes.map((m) => {
      const result = scoreSwapCandidates(
        'shoes',
        current.id,
        [],
        [current, candidate1, candidate2],
        'vardag',
        dryWeather,
        penalties,
        null,
        m,
        pairMemory,
      );
      return result[0]?.breakdown.swap_mode;
    });
    expect(breakdowns).toEqual([1, 2, 3]);
  });
});

describe('buildSwapReason', () => {
  it('uses fallback when nothing pops', () => {
    const reason = buildSwapReason(garment(), garment({ id: 'cur' }), {
      colorHarmony: 5,
      materialCompat: 5,
      formalityAlignment: 5,
      fitConsistency: 5,
      dnaPreservation: 5,
      practicality: 5,
      expressiveLift: 5,
      freshness: 5,
      swapMode: 'safe',
    });
    expect(typeof reason).toBe('string');
    expect(reason.length).toBeGreaterThan(0);
  });

  it('mentions DNA preservation when safe mode and high DNA score', () => {
    const reason = buildSwapReason(garment(), garment({ id: 'cur' }), {
      colorHarmony: 6,
      materialCompat: 6,
      formalityAlignment: 6,
      fitConsistency: 6,
      dnaPreservation: 9,
      practicality: 6,
      expressiveLift: 6,
      freshness: 6,
      swapMode: 'safe',
    });
    expect(reason.toLowerCase()).toContain('dna');
  });
});

describe('integration with computeSwapConfidence', () => {
  it('confidence is computed over the candidate list returned by scoreSwapCandidates', () => {
    const current = garment({ id: 'current', category: 'shoes', subcategory: 'sneakers' });
    const alt = garment({ id: 'alt', category: 'shoes', subcategory: 'boots' });
    const result = scoreSwapCandidates(
      'shoes',
      current.id,
      [],
      [current, alt],
      'vardag',
      dryWeather,
      new Map(),
      null,
      'safe',
      new Map(),
    );
    const conf = computeSwapConfidence(result, 'shoes', dryWeather);
    expect(typeof conf.confidence_score).toBe('number');
    expect(['high', 'medium', 'low']).toContain(conf.confidence_level);
  });
});
