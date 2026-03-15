/**
 * Deterministic tests for the client-side fallback swap scoring logic.
 * Mirrors the scoring from useSwapGarment fallbackFetchCandidates().
 */
import { describe, it, expect } from 'vitest';

// ── Mirrored fallback scoring logic ──

const NEUTRALS = new Set(['black', 'white', 'grey', 'gray', 'navy', 'beige', 'cream', 'charcoal', 'brown', 'tan', 'khaki']);

function colorFamily(c: string): string {
  const cl = (c || '').toLowerCase();
  if (NEUTRALS.has(cl)) return 'neutral';
  if (['red', 'burgundy', 'maroon', 'wine', 'crimson'].some(k => cl.includes(k))) return 'red';
  if (['blue', 'cobalt', 'indigo', 'teal', 'cyan'].some(k => cl.includes(k))) return 'blue';
  if (['green', 'olive', 'sage', 'emerald', 'mint'].some(k => cl.includes(k))) return 'green';
  if (['pink', 'rose', 'blush', 'coral'].some(k => cl.includes(k))) return 'pink';
  if (['yellow', 'gold', 'mustard'].some(k => cl.includes(k))) return 'yellow';
  if (['orange', 'rust', 'terracotta'].some(k => cl.includes(k))) return 'orange';
  if (['purple', 'violet', 'plum', 'lavender'].some(k => cl.includes(k))) return 'purple';
  return 'other';
}

interface FallbackGarment {
  color_primary: string;
  wear_count: number;
  last_worn_at: string | null;
  formality: number | null;
  fit: string | null;
  in_laundry: boolean;
}

function fallbackScore(garment: FallbackGarment, otherColors: string[]): number {
  let score = 5;

  const wc = garment.wear_count ?? 0;
  if (wc === 0) score += 2;
  else if (wc < 3) score += 1.5;
  else if (wc < 8) score += 0.5;
  else score -= 0.5;

  if (garment.last_worn_at) {
    const daysSince = (Date.now() - new Date(garment.last_worn_at).getTime()) / 86400000;
    if (daysSince > 30) score += 1;
    else if (daysSince > 14) score += 0.5;
    else if (daysSince < 3) score -= 1;
  } else {
    score += 0.5;
  }

  const otherFamilies = otherColors.map(c => colorFamily(c));
  const otherNeutralCount = otherFamilies.filter(f => f === 'neutral').length;
  const cFamily = colorFamily(garment.color_primary);

  if (cFamily === 'neutral') {
    score += otherNeutralCount < otherFamilies.length ? 1.5 : 0.5;
  } else {
    const clashCount = otherFamilies.filter(f => f !== 'neutral' && f !== cFamily).length;
    if (clashCount === 0) score += 1;
    else if (clashCount === 1) score += 0.5;
    else score -= clashCount * 0.5;
  }

  const formality = garment.formality;
  if (typeof formality === 'number') {
    if (formality >= 3 && formality <= 7) score += 0.5;
    else if (formality > 8 || formality < 2) score -= 0.5;
  }

  const fit = (garment.fit || '').toLowerCase();
  if (['regular', 'straight'].some(f => fit.includes(f))) score += 0.3;

  return Math.max(0, Math.min(10, score));
}

// ── Tests ──

describe('Fallback swap scoring returns deterministic ranked results', () => {
  it('ranks unworn garment higher than heavily worn garment', () => {
    const unworn: FallbackGarment = { color_primary: 'black', wear_count: 0, last_worn_at: null, formality: 5, fit: 'regular', in_laundry: false };
    const worn: FallbackGarment = { color_primary: 'black', wear_count: 20, last_worn_at: new Date().toISOString(), formality: 5, fit: 'regular', in_laundry: false };

    const otherColors = ['navy', 'white'];
    expect(fallbackScore(unworn, otherColors)).toBeGreaterThan(fallbackScore(worn, otherColors));
  });

  it('ranks neutral color higher when outfit has non-neutral colors', () => {
    const neutral: FallbackGarment = { color_primary: 'black', wear_count: 0, last_worn_at: null, formality: 5, fit: null, in_laundry: false };
    const clashing: FallbackGarment = { color_primary: 'red', wear_count: 0, last_worn_at: null, formality: 5, fit: null, in_laundry: false };

    // Outfit has blue and green — red would clash, black is safe
    const otherColors = ['blue', 'green'];
    expect(fallbackScore(neutral, otherColors)).toBeGreaterThan(fallbackScore(clashing, otherColors));
  });

  it('penalizes extreme formality garments', () => {
    const versatile: FallbackGarment = { color_primary: 'grey', wear_count: 0, last_worn_at: null, formality: 5, fit: 'regular', in_laundry: false };
    const extreme: FallbackGarment = { color_primary: 'grey', wear_count: 0, last_worn_at: null, formality: 10, fit: 'regular', in_laundry: false };

    const otherColors = ['black'];
    expect(fallbackScore(versatile, otherColors)).toBeGreaterThan(fallbackScore(extreme, otherColors));
  });

  it('gives consistent scores for identical inputs', () => {
    const garment: FallbackGarment = { color_primary: 'navy', wear_count: 2, last_worn_at: null, formality: 4, fit: 'slim', in_laundry: false };
    const otherColors = ['white', 'black'];

    const score1 = fallbackScore(garment, otherColors);
    const score2 = fallbackScore(garment, otherColors);
    expect(score1).toBe(score2);
  });

  it('scores are always clamped between 0 and 10', () => {
    const best: FallbackGarment = { color_primary: 'black', wear_count: 0, last_worn_at: null, formality: 5, fit: 'regular', in_laundry: false };
    const worst: FallbackGarment = { color_primary: 'orange', wear_count: 50, last_worn_at: new Date().toISOString(), formality: 1, fit: 'oversized', in_laundry: false };

    const otherColors = ['red', 'green', 'purple', 'yellow'];
    const bestScore = fallbackScore(best, otherColors);
    const worstScore = fallbackScore(worst, otherColors);

    expect(bestScore).toBeGreaterThanOrEqual(0);
    expect(bestScore).toBeLessThanOrEqual(10);
    expect(worstScore).toBeGreaterThanOrEqual(0);
    expect(worstScore).toBeLessThanOrEqual(10);
  });
});
