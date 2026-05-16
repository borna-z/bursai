import { describe, expect, it } from 'vitest';

import {
  hashOutfit,
  isColorSwap,
  isExactMatch,
  isSilhouetteSwap,
} from '../outfit-deduplication';
import type { ComboItem } from '../outfit-scoring';

// Minimal ComboItem factory — the dedup helpers only read slot + garment
// fingerprint fields, so the rest of GarmentRow can stay at type-cast
// defaults to keep the test focused on what's actually compared.
function item(
  slot: string,
  id: string,
  subcategory: string,
  fit: string,
  color: string,
): ComboItem {
  return {
    slot,
    garment: {
      id,
      title: id,
      category: subcategory,
      subcategory,
      color_primary: color,
      color_secondary: null,
      pattern: 'solid',
      material: 'cotton',
      fit,
      formality: 5,
      season_tags: [],
      wear_count: 0,
      last_worn_at: null,
      image_path: null,
      created_at: '',
      enrichment_status: null,
      ai_raw: null,
    } as unknown as ComboItem['garment'],
    baseScore: 7,
    baseBreakdown: {},
  };
}

describe('hashOutfit', () => {
  it('is order-independent and `|`-joined', () => {
    expect(hashOutfit(['b', 'a', 'c'])).toBe('a|b|c');
  });

  it('handles a single id', () => {
    expect(hashOutfit(['only'])).toBe('only');
  });

  it('returns empty string for an empty set', () => {
    expect(hashOutfit([])).toBe('');
  });

  it('is byte-stable on duplicate calls (log lookup contract)', () => {
    const ids = ['z9', 'a0', 'm3'];
    expect(hashOutfit(ids)).toBe(hashOutfit(ids));
  });
});

describe('isExactMatch', () => {
  it('returns true when both id-sets are identical', () => {
    expect(isExactMatch(['a', 'b', 'c'], ['c', 'b', 'a'])).toBe(true);
  });

  it('returns false when one id differs', () => {
    expect(isExactMatch(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe(false);
  });

  it('returns false on different lengths even with overlap', () => {
    expect(isExactMatch(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });
});

describe('isColorSwap', () => {
  it('detects a same-silhouette palette swap', () => {
    const a = [
      item('top', 't1', 'shirt', 'fitted', 'navy'),
      item('bottom', 'b1', 'jeans', 'fitted', 'indigo'),
      item('shoes', 's1', 'sneaker', 'standard', 'white'),
    ];
    const b = [
      item('top', 't2', 'shirt', 'fitted', 'cream'),
      item('bottom', 'b2', 'jeans', 'fitted', 'indigo'),
      item('shoes', 's2', 'sneaker', 'standard', 'white'),
    ];
    expect(isColorSwap(a, b)).toBe(true);
  });

  it('returns false when a fit changes (silhouette swap, not color swap)', () => {
    const a = [
      item('top', 't1', 'shirt', 'fitted', 'navy'),
      item('bottom', 'b1', 'jeans', 'fitted', 'indigo'),
    ];
    const b = [
      item('top', 't2', 'shirt', 'fitted', 'cream'),
      item('bottom', 'b2', 'jeans', 'relaxed', 'indigo'),
    ];
    expect(isColorSwap(a, b)).toBe(false);
  });

  it('returns false when subcategory changes', () => {
    const a = [
      item('top', 't1', 'shirt', 'fitted', 'navy'),
      item('bottom', 'b1', 'jeans', 'fitted', 'indigo'),
    ];
    const b = [
      item('top', 't2', 'tee', 'fitted', 'cream'),
      item('bottom', 'b2', 'jeans', 'fitted', 'indigo'),
    ];
    expect(isColorSwap(a, b)).toBe(false);
  });

  it('returns false when colors are identical (no swap at all)', () => {
    const a = [
      item('top', 't1', 'shirt', 'fitted', 'navy'),
    ];
    const b = [
      item('top', 't2', 'shirt', 'fitted', 'navy'),
    ];
    expect(isColorSwap(a, b)).toBe(false);
  });

  it('returns false on different lengths', () => {
    const a = [item('top', 't1', 'shirt', 'fitted', 'navy')];
    const b = [
      item('top', 't2', 'shirt', 'fitted', 'cream'),
      item('bottom', 'b2', 'jeans', 'fitted', 'indigo'),
    ];
    expect(isColorSwap(a, b)).toBe(false);
  });
});

describe('isSilhouetteSwap', () => {
  it('detects a same-palette cut change', () => {
    const a = [
      item('top', 't1', 'shirt', 'fitted', 'navy'),
      item('bottom', 'b1', 'jeans', 'fitted', 'indigo'),
    ];
    const b = [
      item('top', 't2', 'shirt', 'fitted', 'navy'),
      item('bottom', 'b2', 'jeans', 'relaxed', 'indigo'),
    ];
    expect(isSilhouetteSwap(a, b)).toBe(true);
  });

  it('returns false when a color changes (color swap, not silhouette swap)', () => {
    const a = [
      item('top', 't1', 'shirt', 'fitted', 'navy'),
    ];
    const b = [
      item('top', 't2', 'shirt', 'relaxed', 'cream'),
    ];
    expect(isSilhouetteSwap(a, b)).toBe(false);
  });

  it('returns false on identical fits', () => {
    const a = [item('top', 't1', 'shirt', 'fitted', 'navy')];
    const b = [item('top', 't2', 'shirt', 'fitted', 'navy')];
    expect(isSilhouetteSwap(a, b)).toBe(false);
  });
});

describe('mutual exclusivity of swap kinds', () => {
  // The three flags shouldn't all light up for the same pair — a strict
  // color-only swap is not also a silhouette swap, and vice versa.
  it('a pure color swap is not a silhouette swap', () => {
    const a = [item('top', 't1', 'shirt', 'fitted', 'navy')];
    const b = [item('top', 't2', 'shirt', 'fitted', 'cream')];
    expect(isColorSwap(a, b)).toBe(true);
    expect(isSilhouetteSwap(a, b)).toBe(false);
  });

  it('a pure silhouette swap is not a color swap', () => {
    const a = [item('top', 't1', 'shirt', 'fitted', 'navy')];
    const b = [item('top', 't2', 'shirt', 'relaxed', 'navy')];
    expect(isColorSwap(a, b)).toBe(false);
    expect(isSilhouetteSwap(a, b)).toBe(true);
  });
});
