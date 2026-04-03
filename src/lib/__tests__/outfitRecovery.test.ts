import { describe, expect, it } from 'vitest';

import { repairIncompleteOutfitItems, type RecoverableGarment } from '@/lib/outfitRecovery';

describe('outfitRecovery', () => {
  it('fills a missing bottom and shoes from the wardrobe', () => {
    const wardrobe: RecoverableGarment[] = [
      { id: 'top-1', category: 'top', wear_count: 3 },
      { id: 'bottom-1', category: 'bottom', wear_count: 1 },
      { id: 'shoe-1', category: 'shoes', wear_count: 2 },
    ];

    const repaired = repairIncompleteOutfitItems(
      [{ slot: 'top', garment: wardrobe[0] }],
      wardrobe,
      { temperature: 14, precipitation: 'none', wind: 'low' },
    );

    expect(repaired.map((item) => item.slot)).toEqual(expect.arrayContaining(['top', 'bottom', 'shoes']));
    expect(repaired.find((item) => item.slot === 'bottom')?.garment.id).toBe('bottom-1');
    expect(repaired.find((item) => item.slot === 'shoes')?.garment.id).toBe('shoe-1');
  });

  it('does not promote a mid-layer into the primary top slot when a standalone top exists', () => {
    const wardrobe: RecoverableGarment[] = [
      { id: 'top-mid', category: 'top', subcategory: 'cardigan', layering_role: 'mid', wear_count: 0 },
      { id: 'top-base', category: 'top', subcategory: 'shirt', layering_role: 'base', wear_count: 4 },
      { id: 'bottom-1', category: 'bottom', wear_count: 1 },
      { id: 'shoe-1', category: 'shoes', wear_count: 1 },
    ];

    const repaired = repairIncompleteOutfitItems(
      [
        { slot: 'bottom', garment: wardrobe[2] },
        { slot: 'shoes', garment: wardrobe[3] },
      ],
      wardrobe,
      { temperature: 9, precipitation: 'none', wind: 'low' },
    );

    expect(repaired.find((item) => item.slot === 'top')?.garment.id).toBe('top-base');
  });
});
