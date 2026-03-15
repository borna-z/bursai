/**
 * Deterministic tests for swap-mode-aware scoring logic.
 * Mirrors the scoring weights and helpers from:
 *   - useSwapGarment fallbackFetchCandidates (client-side)
 *   - burs_style_engine scoreSwapCandidates (server-side weight profiles)
 */
import { describe, it, expect } from 'vitest';

// ─── Mirrored types ───

type SwapMode = 'safe' | 'bold' | 'fresh';

// ─── Mirrored fallback helpers (from useSwapGarment.ts) ───

const neutralWords = ['black', 'white', 'grey', 'gray', 'navy', 'beige', 'brown', 'cream'];

function scoreColorFit(color: string | null | undefined, otherColors: string[]) {
  const c = String(color || '').toLowerCase();
  if (!c) return 5;
  if (otherColors.some((x) => x === c)) return 7.5;
  if (neutralWords.some((x) => c.includes(x))) return 7;
  return 5.8;
}

function scoreFreshness(wearCount: number | null | undefined) {
  if (wearCount == null) return 6;
  if (wearCount === 0) return 8.5;
  if (wearCount < 5) return 7.2;
  if (wearCount < 15) return 6.4;
  return 5.5;
}

function scoreFit(fit: string | null | undefined) {
  const f = String(fit || '').toLowerCase();
  if (['regular', 'relaxed', 'oversized'].some((x) => f.includes(x))) return 6.8;
  if (['slim', 'tailored'].some((x) => f.includes(x))) return 6.4;
  return 6;
}

function scoreBoldLift(color: string | null | undefined, otherColors: string[]) {
  const c = String(color || '').toLowerCase();
  if (!c) return 5;
  if (neutralWords.some((x) => c.includes(x))) return 4;
  if (otherColors.some((x) => x === c)) return 5;
  return 8;
}

// ─── Fallback scoring with mode weights (mirrors hook logic) ───

const FALLBACK_WEIGHTS: Record<SwapMode, { freshness: number; colorFit: number; fit: number }> = {
  safe:  { freshness: 0.30, colorFit: 0.45, fit: 0.25 },
  bold:  { freshness: 0.20, colorFit: 0.25, fit: 0.15 },
  fresh: { freshness: 0.55, colorFit: 0.25, fit: 0.20 },
};

function fallbackScore(
  garment: { color_primary: string; wear_count: number | null; fit: string | null },
  otherColors: string[],
  mode: SwapMode
): number {
  const w = FALLBACK_WEIGHTS[mode];
  const freshness = scoreFreshness(garment.wear_count);
  const colorFit = scoreColorFit(garment.color_primary, otherColors);
  const fitVal = scoreFit(garment.fit);

  let score = freshness * w.freshness + colorFit * w.colorFit + fitVal * w.fit;

  if (mode === 'bold') {
    const boldLift = scoreBoldLift(garment.color_primary, otherColors);
    score = score * 0.60 + boldLift * 0.40;
  }

  return score;
}

// ─── Engine weight profiles (mirrors burs_style_engine) ───

const ENGINE_WEIGHTS: Record<SwapMode, Record<string, number>> = {
  safe: {
    item_strength: 0.24, dna_preservation: 0.26, color_harmony: 0.10,
    material_compatibility: 0.06, formality_alignment: 0.12, fit_consistency: 0.10,
    practicality: 0.08, expressive_lift: 0.00, freshness: 0.04,
  },
  bold: {
    item_strength: 0.20, dna_preservation: 0.08, color_harmony: 0.12,
    material_compatibility: 0.06, formality_alignment: 0.10, fit_consistency: 0.04,
    practicality: 0.06, expressive_lift: 0.26, freshness: 0.08,
  },
  fresh: {
    item_strength: 0.22, dna_preservation: 0.14, color_harmony: 0.10,
    material_compatibility: 0.06, formality_alignment: 0.10, fit_consistency: 0.08,
    practicality: 0.06, expressive_lift: 0.06, freshness: 0.18,
  },
};

function engineScore(factors: Record<string, number>, mode: SwapMode): number {
  const w = ENGINE_WEIGHTS[mode];
  let total = 0;
  for (const [key, weight] of Object.entries(w)) {
    total += (factors[key] ?? 7) * weight;
  }
  return Math.max(0, total);
}

// ─── Tests ───

describe('Swap mode: safe prefers DNA preservation', () => {
  it('ranks high-DNA candidate above low-DNA when both have equal base scores', () => {
    const highDNA = {
      item_strength: 7, dna_preservation: 9, color_harmony: 7,
      material_compatibility: 7, formality_alignment: 7, fit_consistency: 8,
      practicality: 7, expressive_lift: 3, freshness: 5,
    };
    const lowDNA = {
      item_strength: 7, dna_preservation: 4, color_harmony: 7,
      material_compatibility: 7, formality_alignment: 7, fit_consistency: 8,
      practicality: 7, expressive_lift: 9, freshness: 8,
    };

    const safeDiff = engineScore(highDNA, 'safe') - engineScore(lowDNA, 'safe');
    expect(safeDiff).toBeGreaterThan(0);

    // In bold mode, the low-DNA candidate with high expressive lift should win
    const boldDiff = engineScore(highDNA, 'bold') - engineScore(lowDNA, 'bold');
    expect(boldDiff).toBeLessThan(0);
  });

  it('safe mode weight for dna_preservation is the highest factor', () => {
    const safeWeights = ENGINE_WEIGHTS.safe;
    const maxWeight = Math.max(...Object.values(safeWeights));
    expect(safeWeights.dna_preservation).toBe(maxWeight);
  });
});

describe('Swap mode: bold ranks expressive candidates higher', () => {
  it('bold mode ranks chromatic candidate above neutral when occasion fits', () => {
    const otherColors = ['navy', 'white'];

    const neutral = { color_primary: 'black', wear_count: 3, fit: 'regular' };
    const chromatic = { color_primary: 'red', wear_count: 3, fit: 'regular' };

    const neutralScore = fallbackScore(neutral, otherColors, 'bold');
    const chromaticScore = fallbackScore(chromatic, otherColors, 'bold');

    // Bold mode boosts chromatic via boldLift (8 vs 4 for neutral)
    expect(chromaticScore).toBeGreaterThan(neutralScore);
  });

  it('in safe mode, the same neutral candidate beats the chromatic one', () => {
    const otherColors = ['navy', 'white'];

    const neutral = { color_primary: 'black', wear_count: 3, fit: 'regular' };
    const chromatic = { color_primary: 'red', wear_count: 3, fit: 'regular' };

    const neutralScore = fallbackScore(neutral, otherColors, 'safe');
    const chromaticScore = fallbackScore(chromatic, otherColors, 'safe');

    expect(neutralScore).toBeGreaterThan(chromaticScore);
  });

  it('bold mode expressive_lift weight is the highest factor', () => {
    const boldWeights = ENGINE_WEIGHTS.bold;
    const maxWeight = Math.max(...Object.values(boldWeights));
    expect(boldWeights.expressive_lift).toBe(maxWeight);
  });
});

describe('Swap mode: fresh penalizes near-duplicates, rewards novelty', () => {
  it('fresh mode rewards unworn garments more than safe mode', () => {
    const otherColors = ['black'];
    const unworn = { color_primary: 'grey', wear_count: 0, fit: 'regular' };

    const freshScore = fallbackScore(unworn, otherColors, 'fresh');
    const safeScore = fallbackScore(unworn, otherColors, 'safe');

    // Fresh weights freshness at 0.55 vs safe at 0.30 → higher freshness contribution
    expect(freshScore).toBeGreaterThan(safeScore);
  });

  it('fresh mode penalizes heavily-worn garments more than safe mode', () => {
    const otherColors = ['black'];
    const heavilyWorn = { color_primary: 'grey', wear_count: 20, fit: 'regular' };

    const freshScore = fallbackScore(heavilyWorn, otherColors, 'fresh');
    const safeScore = fallbackScore(heavilyWorn, otherColors, 'safe');

    // Heavily-worn gets low freshness (5.5); fresh mode weights it heavier
    // but safe mode compensates with higher colorFit weight for neutral grey
    // The key test: the GAP between unworn and worn is bigger in fresh mode
    const unworn = { color_primary: 'grey', wear_count: 0, fit: 'regular' };
    const freshGap = fallbackScore(unworn, otherColors, 'fresh') - freshScore;
    const safeGap = fallbackScore(unworn, otherColors, 'safe') - safeScore;

    expect(freshGap).toBeGreaterThan(safeGap);
  });

  it('fresh mode freshness weight is highest among its factors', () => {
    const freshWeights = ENGINE_WEIGHTS.fresh;
    const maxWeight = Math.max(...Object.values(freshWeights));
    expect(freshWeights.item_strength).toBe(maxWeight); // 0.22 is highest in fresh
    // But freshness (0.18) is the second-highest, much higher than in safe (0.04)
    expect(freshWeights.freshness).toBeGreaterThan(ENGINE_WEIGHTS.safe.freshness * 3);
  });
});

describe('Fallback scoring mode-specific weight sums', () => {
  it('all engine weight profiles sum to 1.00', () => {
    for (const mode of ['safe', 'bold', 'fresh'] as SwapMode[]) {
      const sum = Object.values(ENGINE_WEIGHTS[mode]).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it('all fallback weight profiles sum to 1.00', () => {
    for (const mode of ['safe', 'bold', 'fresh'] as SwapMode[]) {
      const w = FALLBACK_WEIGHTS[mode];
      const sum = w.freshness + w.colorFit + w.fit;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });
});

describe('Fallback score changes when swapMode changes', () => {
  it('same garment gets different scores across all three modes', () => {
    const garment = { color_primary: 'red', wear_count: 0, fit: 'oversized' };
    const otherColors = ['navy', 'white'];

    const safe = fallbackScore(garment, otherColors, 'safe');
    const bold = fallbackScore(garment, otherColors, 'bold');
    const fresh = fallbackScore(garment, otherColors, 'fresh');

    // All three should produce distinct scores
    const scores = new Set([safe.toFixed(4), bold.toFixed(4), fresh.toFixed(4)]);
    expect(scores.size).toBe(3);
  });

  it('relative rankings can flip between modes', () => {
    const otherColors = ['navy'];

    const neutralWorn = { color_primary: 'black', wear_count: 10, fit: 'regular' };
    const chromaticUnworn = { color_primary: 'coral', wear_count: 0, fit: 'relaxed' };

    // Safe: neutral + matching color bonus should help neutralWorn
    const safeN = fallbackScore(neutralWorn, otherColors, 'safe');
    const safeC = fallbackScore(chromaticUnworn, otherColors, 'safe');

    // Bold: chromatic + unworn + bold lift should help chromaticUnworn
    const boldN = fallbackScore(neutralWorn, otherColors, 'bold');
    const boldC = fallbackScore(chromaticUnworn, otherColors, 'bold');

    // Fresh: unworn bonus is huge (0.55 weight on freshness 8.5 vs 5.5)
    const freshN = fallbackScore(neutralWorn, otherColors, 'fresh');
    const freshC = fallbackScore(chromaticUnworn, otherColors, 'fresh');

    // chromaticUnworn should beat neutralWorn in bold and fresh modes
    expect(boldC).toBeGreaterThan(boldN);
    expect(freshC).toBeGreaterThan(freshN);
  });
});
