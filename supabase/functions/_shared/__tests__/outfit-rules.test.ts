import { describe, expect, it } from 'vitest';

import {
  hasCompleteOutfitPath,
  normalizeOutfitRuleSlot,
  validateOutfitItems,
} from '../outfit-rules.ts';

describe('normalizeOutfitRuleSlot', () => {
  it('prefers an explicit returned slot over garment inference', () => {
    expect(
      normalizeOutfitRuleSlot({
        slot: 'outerwear',
        garment: { category: 'top', subcategory: 'shirt' },
      }),
    ).toBe('outerwear');
  });

  it('falls back to garment inference when the explicit slot is missing', () => {
    expect(
      normalizeOutfitRuleSlot({
        garment: { category: 'shoes', subcategory: 'oxfords' },
      }),
    ).toBe('shoes');
  });
});

describe('validateOutfitItems', () => {
  it('accepts explicit dress and shoes slots even when garment categories drift', () => {
    const result = validateOutfitItems([
      {
        slot: 'dress',
        garment: { id: 'dress-1', category: 'top', subcategory: 'vest' },
      },
      {
        slot: 'shoes',
        garment: { id: 'shoes-1', category: 'accessory', subcategory: 'oxfords' },
      },
    ]);

    expect(result.isValid).toBe(true);
    expect(result.isDressBased).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe('hasCompleteOutfitPath', () => {
  it('allows dress-plus-shoes wardrobes', () => {
    expect(
      hasCompleteOutfitPath([
        { category: 'dress', subcategory: null },
        { category: 'shoes', subcategory: 'boots' },
      ]),
    ).toBe(true);
  });

  it('rejects wardrobes that still lack a complete path', () => {
    expect(
      hasCompleteOutfitPath([
        { category: 'dress', subcategory: null },
        { category: 'accessory', subcategory: 'bag' },
      ]),
    ).toBe(false);
  });
});
