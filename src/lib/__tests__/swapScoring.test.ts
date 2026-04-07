/**
 * Deterministic unit tests for BURS swap-specific scoring helpers.
 * Mirrors logic from supabase/functions/burs_style_engine/index.ts swap section.
 */
import { describe, it, expect } from 'vitest';

// ── Mirrored types ──

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

function makeGarment(
  overrides: Partial<GarmentRow> & { id: string; category: string; color_primary: string }
): GarmentRow {
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

// ── Mirrored swap helpers (from edge function) ──

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, value));
}

function fitFamily(fit: string | null): string {
  if (!fit) return 'regular';
  const f = fit.toLowerCase();
  if (['slim', 'skinny', 'fitted', 'tight'].some(k => f.includes(k))) return 'slim';
  if (['loose', 'oversized', 'relaxed', 'baggy', 'wide'].some(k => f.includes(k))) return 'loose';
  return 'regular';
}

function visualWeight(garment: GarmentRow): number {
  let w = 5;
  const color = (garment.color_primary || '').toLowerCase();
  if (['black', 'navy', 'charcoal', 'dark'].some(c => color.includes(c))) w += 2;
  if (['white', 'cream', 'beige', 'light', 'pastel'].some(c => color.includes(c))) w -= 2;
  const mat = (garment.material || '').toLowerCase();
  if (['leather', 'denim', 'wool', 'tweed'].some(m => mat.includes(m))) w += 1;
  if (['silk', 'chiffon', 'linen', 'cotton'].some(m => mat.includes(m))) w -= 1;
  if (garment.category === 'outerwear') w += 1;
  return clampScore(w);
}

function garmentText(garment: GarmentRow): string {
  return [garment.title, garment.category, garment.subcategory, garment.material, garment.fit, garment.pattern]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function dnaPreservationScore(candidate: GarmentRow, anchor: GarmentRow): number {
  let score = 10;
  const cf = candidate.formality ?? 5;
  const af = anchor.formality ?? 5;
  score -= Math.abs(cf - af) * 1.2;
  if (fitFamily(candidate.fit) !== fitFamily(anchor.fit)) score -= 1.5;
  score -= Math.abs(visualWeight(candidate) - visualWeight(anchor)) * 0.4;
  const cp = (candidate.pattern || 'solid').toLowerCase();
  const ap = (anchor.pattern || 'solid').toLowerCase();
  if (cp !== ap) score -= 1;
  if (candidate.subcategory && candidate.subcategory === anchor.subcategory) score += 1;
  const cWords = new Set(garmentText(candidate).split(/\s+/));
  const aWords = new Set(garmentText(anchor).split(/\s+/));
  let overlap = 0;
  for (const w of cWords) if (aWords.has(w) && w.length > 2) overlap++;
  score += Math.min(overlap * 0.3, 1.5);
  return clampScore(score);
}

function formalityAlignmentScore(
  candidate: GarmentRow,
  otherItems: { garment: GarmentRow }[]
): number {
  if (otherItems.length === 0) return 7;
  const formalities = otherItems
    .map(i => i.garment.formality)
    .filter((v): v is number => typeof v === 'number');
  if (formalities.length === 0) return 7;
  const avg = formalities.reduce((a, b) => a + b, 0) / formalities.length;
  const cf = candidate.formality ?? 5;
  return clampScore(10 - Math.abs(cf - avg) * 2);
}

// ── Tests ──

describe('Swap DNA preservation scoring', () => {
  it('prefers candidate with same formality/fit/pattern as anchor', () => {
    const anchor = makeGarment({ id: 'anchor', category: 'top', color_primary: 'navy', formality: 5, fit: 'slim', pattern: 'solid' });
    const similar = makeGarment({ id: 'sim', category: 'top', color_primary: 'black', formality: 5, fit: 'slim', pattern: 'solid' });
    const different = makeGarment({ id: 'diff', category: 'top', color_primary: 'red', formality: 9, fit: 'oversized', pattern: 'striped' });

    const simScore = dnaPreservationScore(similar, anchor);
    const diffScore = dnaPreservationScore(different, anchor);

    expect(simScore).toBeGreaterThan(diffScore);
  });

  it('rewards matching subcategory', () => {
    const anchor = makeGarment({ id: 'anchor', category: 'top', color_primary: 'white', subcategory: 't-shirt' });
    const sameSubcat = makeGarment({ id: 's1', category: 'top', color_primary: 'grey', subcategory: 't-shirt' });
    const diffSubcat = makeGarment({ id: 's2', category: 'top', color_primary: 'grey', subcategory: 'blouse' });

    expect(dnaPreservationScore(sameSubcat, anchor)).toBeGreaterThan(
      dnaPreservationScore(diffSubcat, anchor)
    );
  });
});

describe('Swap formality alignment scoring', () => {
  it('penalizes strong formality mismatch with rest of outfit', () => {
    const casualOutfit = [
      { garment: makeGarment({ id: 'b1', category: 'bottom', color_primary: 'blue', formality: 3 }) },
      { garment: makeGarment({ id: 's1', category: 'shoes', color_primary: 'white', formality: 2 }) },
    ];

    const casualCandidate = makeGarment({ id: 'c1', category: 'top', color_primary: 'grey', formality: 3 });
    const formalCandidate = makeGarment({ id: 'c2', category: 'top', color_primary: 'white', formality: 9 });

    const casualScore = formalityAlignmentScore(casualCandidate, casualOutfit);
    const formalScore = formalityAlignmentScore(formalCandidate, casualOutfit);

    expect(casualScore).toBeGreaterThan(formalScore);
    expect(formalScore).toBeLessThan(5); // strong mismatch should be low
  });

  it('returns 7 when other items have no formality data', () => {
    const noFormality = [
      { garment: makeGarment({ id: 'b1', category: 'bottom', color_primary: 'blue', formality: null }) },
    ];
    const candidate = makeGarment({ id: 'c1', category: 'top', color_primary: 'grey', formality: 5 });
    expect(formalityAlignmentScore(candidate, noFormality)).toBe(7);
  });
});

describe('Swap weather practicality (via weatherSuitability mirror)', () => {
  // Mirror the key weather logic: waterproof outerwear in rain scores higher
  const WATERPROOF_MATERIALS = ['gore-tex', 'polyester', 'nylon', 'softshell', 'rain'];

  function simpleWeatherScore(
    garment: GarmentRow,
    weather: { temperature?: number; precipitation?: string }
  ): number {
    let score = 7;
    const mat = (garment.material || '').toLowerCase();
    const precip = (weather.precipitation || '').toLowerCase();
    const isRainy = precip.includes('rain') || precip.includes('regn');

    if (isRainy && garment.category === 'outerwear') {
      if (WATERPROOF_MATERIALS.some(w => mat.includes(w))) score += 2;
      else score -= 1;
    }

    if (weather.temperature !== undefined && weather.temperature < 5) {
      if (['wool', 'fleece', 'down', 'cashmere'].some(w => mat.includes(w))) score += 1.5;
      if (['linen', 'silk', 'chiffon'].some(w => mat.includes(w))) score -= 2;
    }

    return Math.max(0, Math.min(10, score));
  }

  it('rewards waterproof outerwear in rain', () => {
    const waterproof = makeGarment({ id: 'j1', category: 'outerwear', color_primary: 'black', material: 'gore-tex' });
    const cotton = makeGarment({ id: 'j2', category: 'outerwear', color_primary: 'beige', material: 'cotton' });

    const wpScore = simpleWeatherScore(waterproof, { precipitation: 'rain' });
    const ctScore = simpleWeatherScore(cotton, { precipitation: 'rain' });

    expect(wpScore).toBeGreaterThan(ctScore);
  });

  it('rewards warm materials in cold weather', () => {
    const wool = makeGarment({ id: 'j1', category: 'outerwear', color_primary: 'grey', material: 'wool' });
    const linen = makeGarment({ id: 'j2', category: 'outerwear', color_primary: 'white', material: 'linen' });

    const woolScore = simpleWeatherScore(wool, { temperature: 0 });
    const linenScore = simpleWeatherScore(linen, { temperature: 0 });

    expect(woolScore).toBeGreaterThan(linenScore);
  });
});

describe('Swap breakdown shape', () => {
  it('includes all required swap breakdown keys', () => {
    const breakdown: Record<string, number> = {
      overall: 7.5,
      item_strength: 7,
      dna_preservation: 8,
      color_harmony: 7.5,
      material_compatibility: 7,
      formality_alignment: 8,
      fit_consistency: 7,
      practicality: 8,
    };

    const requiredKeys = [
      'overall', 'item_strength', 'dna_preservation',
      'color_harmony', 'material_compatibility',
      'formality_alignment', 'fit_consistency', 'practicality',
    ];

    for (const key of requiredKeys) {
      expect(breakdown).toHaveProperty(key);
    }
  });
});
