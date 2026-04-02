import { describe, expect, it } from 'vitest';
import { deriveStylistOutfitMemory } from '../stylist-outfit-memory';

describe('deriveStylistOutfitMemory', () => {
  it('extracts reusable successful formulas from worn and positively rated looks', () => {
    const memory = deriveStylistOutfitMemory({
      outfits: [
        {
          id: 'o-hero',
          occasion: 'office',
          style_vibe: 'polished',
          worn_at: '2026-03-28T09:00:00.000Z',
          generated_at: '2026-03-27T09:00:00.000Z',
          outfit_items: [
            { slot: 'top', garment_id: 'g-top', garments: { title: 'Cream Tee', color_primary: 'cream' } },
            { slot: 'bottom', garment_id: 'g-bottom', garments: { title: 'Navy Trouser', color_primary: 'navy' } },
            { slot: 'shoes', garment_id: 'g-shoes', garments: { title: 'Black Loafer', color_primary: 'black' } },
          ],
        },
        {
          id: 'o-weekend',
          occasion: 'weekend',
          style_vibe: 'easy',
          generated_at: '2026-03-20T09:00:00.000Z',
          outfit_items: [
            { slot: 'top', garment_id: 'g-knit', garments: { title: 'Soft Knit', color_primary: 'cream' } },
            { slot: 'bottom', garment_id: 'g-bottom', garments: { title: 'Navy Trouser', color_primary: 'navy' } },
            { slot: 'shoes', garment_id: 'g-sneaker', garments: { title: 'White Sneaker', color_primary: 'white' } },
          ],
        },
        {
          id: 'o-weak',
          occasion: 'party',
          generated_at: '2026-03-15T09:00:00.000Z',
          outfit_items: [
            { slot: 'top', garment_id: 'g-loud', garments: { title: 'Loud Shirt', color_primary: 'red' } },
            { slot: 'shoes', garment_id: 'g-boots', garments: { title: 'Chunky Boot', color_primary: 'black' } },
          ],
        },
      ],
      signals: [
        { signal_type: 'save', outfit_id: 'o-hero' },
        { signal_type: 'wear_confirm', outfit_id: 'o-hero' },
        { signal_type: 'rating', outfit_id: 'o-weekend', value: '5' },
        { signal_type: 'quick_reaction', outfit_id: 'o-weekend', value: 'polished' },
      ],
    });

    expect(memory.preferredGarmentIds).toEqual(expect.arrayContaining(['g-bottom', 'g-top']));
    expect(memory.successfulGarmentSets).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(['g-top', 'g-bottom', 'g-shoes']),
        expect.arrayContaining(['g-knit', 'g-bottom', 'g-sneaker']),
      ]),
    );
    expect(memory.promptBlock).toContain('Historically successful look formulas');
    expect(memory.promptBlock).toContain('office/polished');
  });
});
