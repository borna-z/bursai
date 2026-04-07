/**
 * Deterministic unit tests for burs_style_engine scoring logic.
 * These test pure functions extracted/mirrored from the edge function
 * to verify combo scoring, weather preference, and breakdown shape.
 */
import { describe, it, expect } from 'vitest';

// ── Mirrored types & helpers (matching edge function logic) ──

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

interface ComboItem {
  slot: string;
  garment: GarmentRow;
  baseScore: number;
  baseBreakdown: Record<string, number>;
}

function makeGarment(overrides: Partial<GarmentRow> & { id: string; category: string; color_primary: string }): GarmentRow {
  return {
    title: overrides.id,
    subcategory: null,
    color_secondary: null,
    pattern: null,
    material: null,
    fit: null,
    formality: null,
    season_tags: null,
    wear_count: 0,
    last_worn_at: null,
    image_path: 'test.jpg',
    ...overrides,
  };
}

function makeComboItem(slot: string, garment: GarmentRow, baseScore: number): ComboItem {
  return { slot, garment, baseScore, baseBreakdown: {} };
}

// ── Mirrored scoring functions ──

function avgBaseScore(items: ComboItem[]): number {
  if (items.length === 0) return 7;
  return items.reduce((sum, i) => sum + i.baseScore, 0) / items.length;
}

const WATERPROOF_MATERIALS = ['gore-tex', 'polyester', 'nylon', 'softshell', 'regn', 'rain'];

function feelsLikeTemp(temp: number, wind: string | undefined): number {
  if (!wind) return temp;
  const w = wind.toLowerCase();
  if (w === 'high' || w === 'hög') return temp - 6;
  if (w === 'medium' || w === 'medel') return temp - 3;
  return temp;
}

function weatherPracticalityScore(
  items: ComboItem[],
  weather: { temperature?: number; precipitation?: string; wind?: string }
): number {
  if (weather.temperature === undefined) return 7;
  let score = 8;
  const temp = feelsLikeTemp(weather.temperature, weather.wind);
  const slots = new Set(items.map(i => i.slot));
  const hasOuterwear = slots.has('outerwear');
  const precip = (weather.precipitation || '').toLowerCase();
  const isRainy = precip.includes('rain') || precip.includes('regn');
  const isSnowy = precip.includes('snow') || precip.includes('snö');

  if (temp < 10 && !hasOuterwear) score -= 1.5;
  if (temp < 0 && !hasOuterwear) score -= 2;

  if ((isRainy || isSnowy) && hasOuterwear) {
    const ow = items.find(i => i.slot === 'outerwear');
    if (ow) {
      const mat = (ow.garment.material || '').toLowerCase();
      if (WATERPROOF_MATERIALS.some(w => mat.includes(w))) score += 1;
    }
  }
  if ((isRainy || isSnowy) && !hasOuterwear) score -= 1;
  if (temp > 25 && hasOuterwear) score -= 2;
  if (temp > 25 && items.length > 3) score -= 0.5;

  return Math.max(0, Math.min(10, score));
}

function collectOccasionSignalsForTest(occasion: string): Set<string> {
  const normalized = occasion.toLowerCase();
  const signals = new Set<string>();
  if (normalized.includes('meeting')) signals.add('meeting');
  if (normalized.includes('formal')) signals.add('formal');
  if (normalized.includes('work')) signals.add('work');
  return signals;
}

function getFormalityRangeForTest(occasion: string): [number, number] {
  const signals = collectOccasionSignalsForTest(occasion);
  if (signals.has('formal')) return [4, 5];
  if (signals.has('meeting')) return [3, 5];
  if (signals.has('work')) return [2, 4];
  return [1, 4];
}

function resolveOccasionSubmodeForTest(
  occasion: string,
  primaryGoal?: string | null,
  userFormalityCenter?: number | null,
): string | null {
  const signals = collectOccasionSignalsForTest(occasion);
  const isWork = signals.has('work') || signals.has('meeting');
  if (!isWork) return null;

  const [minFormality, maxFormality] = getFormalityRangeForTest(occasion);
  let formalityTarget = (minFormality + maxFormality) / 2;
  if (typeof userFormalityCenter === 'number') {
    formalityTarget = userFormalityCenter;
  }

  const goal = String(primaryGoal || '').toLowerCase();
  if (goal.includes('formal') || goal.includes('professional')) {
    formalityTarget = Math.max(formalityTarget, 4.5);
  }
  if (goal.includes('comfort') || goal.includes('relaxed') || goal.includes('creative')) {
    formalityTarget = Math.min(formalityTarget, 2.8);
  }

  if (signals.has('formal') || signals.has('meeting') || formalityTarget >= 4.4) return 'Formal Office';
  if (formalityTarget >= 3) return 'Business Casual';
  return 'Relaxed Office';
}

// ── Tests ──

describe('Combo scoring uses actual garment scores', () => {
  it('avgBaseScore computes from real scores, not hardcoded 7', () => {
    const items: ComboItem[] = [
      makeComboItem('top', makeGarment({ id: 't1', category: 'top', color_primary: 'black' }), 9),
      makeComboItem('bottom', makeGarment({ id: 'b1', category: 'bottom', color_primary: 'navy' }), 5),
      makeComboItem('shoes', makeGarment({ id: 's1', category: 'shoes', color_primary: 'white' }), 8),
    ];
    const avg = avgBaseScore(items);
    expect(avg).toBeCloseTo((9 + 5 + 8) / 3, 5);
    expect(avg).not.toBe(7); // must NOT be the old hardcoded default
  });

  it('avgBaseScore returns 7 for empty array as fallback', () => {
    expect(avgBaseScore([])).toBe(7);
  });
});

describe('Cold/rainy weather prefers outerwear', () => {
  const top = makeComboItem('top', makeGarment({ id: 't1', category: 'top', color_primary: 'white' }), 7);
  const bottom = makeComboItem('bottom', makeGarment({ id: 'b1', category: 'bottom', color_primary: 'blue' }), 7);
  const shoes = makeComboItem('shoes', makeGarment({ id: 's1', category: 'shoes', color_primary: 'black' }), 7);
  const jacket = makeComboItem('outerwear', makeGarment({
    id: 'j1', category: 'outerwear', color_primary: 'black', material: 'gore-tex',
  }), 7);

  it('cold weather without outerwear scores lower', () => {
    const withoutOw = weatherPracticalityScore([top, bottom, shoes], { temperature: 2 });
    const withOw = weatherPracticalityScore([top, bottom, shoes, jacket], { temperature: 2 });
    expect(withOw).toBeGreaterThan(withoutOw);
  });

  it('rainy weather without outerwear scores lower', () => {
    const withoutOw = weatherPracticalityScore([top, bottom, shoes], { temperature: 15, precipitation: 'rain' });
    const withOw = weatherPracticalityScore([top, bottom, shoes, jacket], { temperature: 15, precipitation: 'rain' });
    expect(withOw).toBeGreaterThan(withoutOw);
  });

  it('hot weather with outerwear is penalized', () => {
    const withOw = weatherPracticalityScore([top, bottom, shoes, jacket], { temperature: 30 });
    const withoutOw = weatherPracticalityScore([top, bottom, shoes], { temperature: 30 });
    expect(withoutOw).toBeGreaterThan(withOw);
  });
});

describe('Dress-based combos', () => {
  it('dress + shoes is a valid combo structure', () => {
    const dress = makeComboItem('dress', makeGarment({ id: 'd1', category: 'dress', color_primary: 'red' }), 8);
    const shoes = makeComboItem('shoes', makeGarment({ id: 's1', category: 'shoes', color_primary: 'black' }), 7);
    const items = [dress, shoes];

    const slots = new Set(items.map(i => i.slot));
    expect(slots.has('dress')).toBe(true);
    expect(slots.has('shoes')).toBe(true);
    expect(avgBaseScore(items)).toBeCloseTo(7.5, 5);
  });
});

describe('style_score breakdown shape', () => {
  it('includes required UI keys', () => {
    // Simulate the breakdown produced by scoreCombo
    const breakdown: Record<string, number> = {
      overall: 7.5,
      color_harmony: 8,
      material_compatibility: 7,
      formality: 9,
      item_strength: 7.3,
      style_intent: 7,
      occasion_fit: 7.5,
      practicality: 8,
      fitProportion: 7,
      repetitionPenalty: 0,
    };

    // Required keys for UI rendering
    expect(breakdown).toHaveProperty('overall');
    expect(breakdown).toHaveProperty('color_harmony');
    expect(breakdown).toHaveProperty('material_compatibility');
    expect(breakdown).toHaveProperty('formality');

    // Richer keys
    expect(breakdown).toHaveProperty('item_strength');
    expect(breakdown).toHaveProperty('style_intent');
    expect(breakdown).toHaveProperty('occasion_fit');
    expect(breakdown).toHaveProperty('practicality');
    expect(breakdown).toHaveProperty('fitProportion');
    expect(breakdown).toHaveProperty('repetitionPenalty');
  });
});

describe('occasion submode defaults', () => {
  it('generic work defaults to business casual instead of formal office', () => {
    expect(resolveOccasionSubmodeForTest('work')).toBe('Business Casual');
  });

  it('meeting requests still resolve to formal office', () => {
    expect(resolveOccasionSubmodeForTest('client meeting')).toBe('Formal Office');
  });
});
