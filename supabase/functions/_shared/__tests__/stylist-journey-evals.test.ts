import { describe, expect, it } from 'vitest';
import { rankArchivedSuccessfulOutfits } from '../stylist-outfit-memory';
import { scoreBehavioralCandidate, type StylistBehaviorProfile, type StylistBehaviorGarment } from '../stylist-behavior';

const garments: StylistBehaviorGarment[] = [
  { id: 'g-top', title: 'Cream Tee', category: 'top', color_primary: 'cream' },
  { id: 'g-bottom', title: 'Navy Trouser', category: 'bottom', color_primary: 'navy' },
  { id: 'g-anchor', title: 'Black Loafer', category: 'shoes', color_primary: 'black' },
  { id: 'g-layer', title: 'Camel Coat', category: 'outerwear', color_primary: 'camel' },
  { id: 'g-knit', title: 'Soft Knit', category: 'top', color_primary: 'cream' },
  { id: 'g-jean', title: 'Blue Jean', category: 'bottom', color_primary: 'blue' },
  { id: 'g-sneaker', title: 'White Sneaker', category: 'shoes', color_primary: 'white' },
];

const profile: StylistBehaviorProfile = {
  preferredGarmentIds: ['g-top', 'g-bottom', 'g-anchor'],
  avoidedGarmentIds: ['g-sneaker'],
  preferredColors: ['cream', 'navy', 'black'],
  avoidedColors: ['white'],
  favoredPairKeys: ['g-bottom::g-top', 'g-anchor::g-bottom'],
  avoidedPairKeys: ['g-jean::g-sneaker'],
  summaryLines: [],
};

describe('stylist journey evals', () => {
  it('prioritizes the office analog when generating a polished office look', () => {
    const archived = rankArchivedSuccessfulOutfits({
      outfits: [
        {
          id: 'office-win',
          occasion: 'office',
          style_vibe: 'polished',
          worn_at: '2026-03-28T09:00:00.000Z',
          outfit_items: [
            { slot: 'top', garment_id: 'g-top', garments: { title: 'Cream Tee', color_primary: 'cream' } },
            { slot: 'bottom', garment_id: 'g-bottom', garments: { title: 'Navy Trouser', color_primary: 'navy' } },
            { slot: 'shoes', garment_id: 'g-anchor', garments: { title: 'Black Loafer', color_primary: 'black' } },
            { slot: 'outerwear', garment_id: 'g-layer', garments: { title: 'Camel Coat', color_primary: 'camel' } },
          ],
        },
        {
          id: 'weekend-win',
          occasion: 'weekend',
          style_vibe: 'relaxed',
          worn_at: '2026-03-27T09:00:00.000Z',
          outfit_items: [
            { slot: 'top', garment_id: 'g-knit', garments: { title: 'Soft Knit', color_primary: 'cream' } },
            { slot: 'bottom', garment_id: 'g-jean', garments: { title: 'Blue Jean', color_primary: 'blue' } },
            { slot: 'shoes', garment_id: 'g-sneaker', garments: { title: 'White Sneaker', color_primary: 'white' } },
          ],
        },
      ],
      signals: [
        { signal_type: 'save', outfit_id: 'office-win' },
        { signal_type: 'wear_confirm', outfit_id: 'office-win' },
        { signal_type: 'save', outfit_id: 'weekend-win' },
      ],
      request: {
        occasion: 'office',
        style: 'polished',
        anchorGarmentId: 'g-anchor',
        activeLookGarmentIds: ['g-anchor'],
      },
    });

    const officeCandidate = scoreBehavioralCandidate({
      garmentIds: ['g-top', 'g-bottom', 'g-anchor', 'g-layer'],
      garments,
      profile,
      recentGarmentSets: [['g-knit', 'g-jean', 'g-sneaker']],
      successfulGarmentSets: archived.successfulGarmentSets,
    });
    const weekendCandidate = scoreBehavioralCandidate({
      garmentIds: ['g-knit', 'g-jean', 'g-sneaker'],
      garments,
      profile,
      recentGarmentSets: [['g-knit', 'g-jean', 'g-sneaker']],
      successfulGarmentSets: archived.successfulGarmentSets,
    });

    expect(archived.successfulGarmentSets[0]).toEqual(
      expect.arrayContaining(['g-top', 'g-bottom', 'g-anchor']),
    );
    expect(officeCandidate.score).toBeGreaterThan(weekendCandidate.score);
  });

  it('keeps an anchor-led refinement closer to the archived winning formula than an unrelated swap', () => {
    const archived = rankArchivedSuccessfulOutfits({
      outfits: [
        {
          id: 'shoe-anchor-win',
          occasion: 'everyday',
          style_vibe: 'sharp',
          worn_at: '2026-03-21T09:00:00.000Z',
          outfit_items: [
            { slot: 'top', garment_id: 'g-top', garments: { title: 'Cream Tee', color_primary: 'cream' } },
            { slot: 'bottom', garment_id: 'g-bottom', garments: { title: 'Navy Trouser', color_primary: 'navy' } },
            { slot: 'shoes', garment_id: 'g-anchor', garments: { title: 'Black Loafer', color_primary: 'black' } },
          ],
        },
      ],
      signals: [
        { signal_type: 'save', outfit_id: 'shoe-anchor-win' },
        { signal_type: 'wear_confirm', outfit_id: 'shoe-anchor-win' },
      ],
      request: {
        occasion: 'everyday',
        style: 'sharp',
        anchorGarmentId: 'g-anchor',
        activeLookGarmentIds: ['g-anchor', 'g-top'],
        preferredGarmentIds: ['g-bottom'],
      },
    });

    const onFormula = scoreBehavioralCandidate({
      garmentIds: ['g-top', 'g-bottom', 'g-anchor'],
      garments,
      profile,
      recentGarmentSets: [],
      successfulGarmentSets: archived.successfulGarmentSets,
    });
    const offFormula = scoreBehavioralCandidate({
      garmentIds: ['g-knit', 'g-jean', 'g-anchor'],
      garments,
      profile,
      recentGarmentSets: [],
      successfulGarmentSets: archived.successfulGarmentSets,
    });

    expect(onFormula.score).toBeGreaterThan(offFormula.score);
    expect(onFormula.reasons).toContain('successful-formula:3');
  });
});
