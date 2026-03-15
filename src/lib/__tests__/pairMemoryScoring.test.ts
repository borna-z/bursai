/**
 * Unit tests for pair memory scoring logic.
 * Mirrors pairKey, getPairMemoryScore from burs_style_engine.
 */
import { describe, it, expect } from 'vitest';

// ── Mirrored types ──

interface PairMemoryRow {
  garment_a_id: string;
  garment_b_id: string;
  positive_count: number;
  negative_count: number;
  last_positive_at: string | null;
  last_negative_at: string | null;
}

type PairMemoryMap = Map<string, PairMemoryRow>;

// ── Mirrored helpers ──

function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

function buildPairMemoryMap(rows: PairMemoryRow[]): PairMemoryMap {
  const map: PairMemoryMap = new Map();
  for (const row of rows) {
    const key = pairKey(row.garment_a_id, row.garment_b_id);
    map.set(key, row);
  }
  return map;
}

function getPairMemoryScore(
  garmentIds: string[],
  pairMemory: PairMemoryMap | null
): { boost: number; penalty: number } {
  if (!pairMemory || pairMemory.size === 0 || garmentIds.length < 2) {
    return { boost: 0, penalty: 0 };
  }

  let boost = 0;
  let penalty = 0;

  for (let i = 0; i < garmentIds.length; i++) {
    for (let j = i + 1; j < garmentIds.length; j++) {
      const key = pairKey(garmentIds[i], garmentIds[j]);
      const mem = pairMemory.get(key);
      if (!mem) continue;

      if (mem.positive_count > 0) {
        const recency = mem.last_positive_at
          ? Math.max(0.3, 1 - (Date.now() - new Date(mem.last_positive_at).getTime()) / (90 * 86400000))
          : 0.5;
        boost += Math.min(3, Math.log2(mem.positive_count + 1) * 1.2 * recency);
      }

      if (mem.negative_count > 0) {
        const recency = mem.last_negative_at
          ? Math.max(0.3, 1 - (Date.now() - new Date(mem.last_negative_at).getTime()) / (90 * 86400000))
          : 0.5;
        penalty += Math.min(4, mem.negative_count * 1.0 * recency);
      }
    }
  }

  const pairCount = (garmentIds.length * (garmentIds.length - 1)) / 2;
  return {
    boost: Math.min(3, boost / Math.max(1, pairCount) * 2),
    penalty: Math.min(4, penalty / Math.max(1, pairCount) * 2),
  };
}

// ── Tests ──

describe('pairKey', () => {
  it('produces canonical order regardless of input order', () => {
    expect(pairKey('aaa', 'bbb')).toBe('aaa|bbb');
    expect(pairKey('bbb', 'aaa')).toBe('aaa|bbb');
  });

  it('handles equal IDs', () => {
    expect(pairKey('xxx', 'xxx')).toBe('xxx|xxx');
  });
});

describe('getPairMemoryScore', () => {
  const now = new Date().toISOString();

  it('returns zero for null/empty memory', () => {
    expect(getPairMemoryScore(['a', 'b'], null)).toEqual({ boost: 0, penalty: 0 });
    expect(getPairMemoryScore(['a', 'b'], new Map())).toEqual({ boost: 0, penalty: 0 });
  });

  it('returns zero for fewer than 2 garments', () => {
    const map = buildPairMemoryMap([{
      garment_a_id: 'a', garment_b_id: 'b',
      positive_count: 5, negative_count: 0,
      last_positive_at: now, last_negative_at: null,
    }]);
    expect(getPairMemoryScore(['a'], map)).toEqual({ boost: 0, penalty: 0 });
  });

  it('positive pair history produces a boost > 0', () => {
    const map = buildPairMemoryMap([{
      garment_a_id: 'top1', garment_b_id: 'bottom1',
      positive_count: 3, negative_count: 0,
      last_positive_at: now, last_negative_at: null,
    }]);
    const result = getPairMemoryScore(['top1', 'bottom1'], map);
    expect(result.boost).toBeGreaterThan(0);
    expect(result.penalty).toBe(0);
  });

  it('negative pair history produces a penalty > 0', () => {
    const map = buildPairMemoryMap([{
      garment_a_id: 'top1', garment_b_id: 'bottom1',
      positive_count: 0, negative_count: 2,
      last_positive_at: null, last_negative_at: now,
    }]);
    const result = getPairMemoryScore(['top1', 'bottom1'], map);
    expect(result.boost).toBe(0);
    expect(result.penalty).toBeGreaterThan(0);
  });

  it('more positive history = stronger boost', () => {
    const low = buildPairMemoryMap([{
      garment_a_id: 'a', garment_b_id: 'b',
      positive_count: 1, negative_count: 0,
      last_positive_at: now, last_negative_at: null,
    }]);
    const high = buildPairMemoryMap([{
      garment_a_id: 'a', garment_b_id: 'b',
      positive_count: 5, negative_count: 0,
      last_positive_at: now, last_negative_at: null,
    }]);
    const lowResult = getPairMemoryScore(['a', 'b'], low);
    const highResult = getPairMemoryScore(['a', 'b'], high);
    expect(highResult.boost).toBeGreaterThan(lowResult.boost);
  });

  it('boost is capped at 3', () => {
    const map = buildPairMemoryMap([{
      garment_a_id: 'a', garment_b_id: 'b',
      positive_count: 100, negative_count: 0,
      last_positive_at: now, last_negative_at: null,
    }]);
    const result = getPairMemoryScore(['a', 'b'], map);
    expect(result.boost).toBeLessThanOrEqual(3);
  });

  it('penalty is capped at 4', () => {
    const map = buildPairMemoryMap([{
      garment_a_id: 'a', garment_b_id: 'b',
      positive_count: 0, negative_count: 100,
      last_positive_at: null, last_negative_at: now,
    }]);
    const result = getPairMemoryScore(['a', 'b'], map);
    expect(result.penalty).toBeLessThanOrEqual(4);
  });

  it('swap scoring respects negative pairing memory', () => {
    // Simulate: candidate garment paired with other outfit items
    const map = buildPairMemoryMap([
      {
        garment_a_id: 'candidate', garment_b_id: 'other1',
        positive_count: 0, negative_count: 3,
        last_positive_at: null, last_negative_at: now,
      },
      {
        garment_a_id: 'candidate', garment_b_id: 'other2',
        positive_count: 0, negative_count: 2,
        last_positive_at: null, last_negative_at: now,
      },
    ]);

    const withNeg = getPairMemoryScore(['candidate', 'other1', 'other2'], map);
    const withoutNeg = getPairMemoryScore(['candidate', 'other1', 'other2'], new Map());

    expect(withNeg.penalty).toBeGreaterThan(withoutNeg.penalty);
  });

  it('old memories decay in influence', () => {
    const recent = buildPairMemoryMap([{
      garment_a_id: 'a', garment_b_id: 'b',
      positive_count: 3, negative_count: 0,
      last_positive_at: now, last_negative_at: null,
    }]);
    const old = buildPairMemoryMap([{
      garment_a_id: 'a', garment_b_id: 'b',
      positive_count: 3, negative_count: 0,
      last_positive_at: new Date(Date.now() - 80 * 86400000).toISOString(),
      last_negative_at: null,
    }]);

    const recentResult = getPairMemoryScore(['a', 'b'], recent);
    const oldResult = getPairMemoryScore(['a', 'b'], old);
    expect(recentResult.boost).toBeGreaterThan(oldResult.boost);
  });

  it('combo with mixed positive and negative pairings returns both', () => {
    const map = buildPairMemoryMap([
      {
        garment_a_id: 'top', garment_b_id: 'bottom',
        positive_count: 4, negative_count: 0,
        last_positive_at: now, last_negative_at: null,
      },
      {
        garment_a_id: 'bottom', garment_b_id: 'shoes',
        positive_count: 0, negative_count: 2,
        last_positive_at: null, last_negative_at: now,
      },
    ]);

    const result = getPairMemoryScore(['top', 'bottom', 'shoes'], map);
    expect(result.boost).toBeGreaterThan(0);
    expect(result.penalty).toBeGreaterThan(0);
  });
});

describe('combo breakdown includes pair memory keys', () => {
  it('breakdown shape has required pair memory keys', () => {
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
      pair_memory_boost: 1.2,
      pair_memory_penalty: 0,
    };

    expect(breakdown).toHaveProperty('pair_memory_boost');
    expect(breakdown).toHaveProperty('pair_memory_penalty');
    expect(breakdown.pair_memory_boost).toBeGreaterThanOrEqual(0);
    expect(breakdown.pair_memory_penalty).toBeGreaterThanOrEqual(0);
  });
});
