import { describe, expect, it } from 'vitest';
import { scoreBehavioralCandidate, type StylistBehaviorGarment, type StylistBehaviorProfile } from '../stylist-behavior';

const garments: StylistBehaviorGarment[] = [
  { id: 'cream-top', title: 'Cream Tee', category: 'top', color_primary: 'cream' },
  { id: 'navy-bottom', title: 'Navy Trouser', category: 'bottom', color_primary: 'navy' },
  { id: 'black-loafer', title: 'Black Loafer', category: 'shoes', color_primary: 'black' },
  { id: 'red-shirt', title: 'Red Shirt', category: 'top', color_primary: 'red' },
  { id: 'white-sneaker', title: 'White Sneaker', category: 'shoes', color_primary: 'white' },
  { id: 'olive-jacket', title: 'Olive Jacket', category: 'outerwear', color_primary: 'olive' },
];

const profile: StylistBehaviorProfile = {
  preferredGarmentIds: ['cream-top', 'navy-bottom', 'black-loafer'],
  avoidedGarmentIds: ['red-shirt', 'white-sneaker'],
  preferredColors: ['cream', 'navy'],
  avoidedColors: ['red', 'white'],
  favoredPairKeys: ['cream-top::navy-bottom'],
  avoidedPairKeys: ['red-shirt::white-sneaker'],
  summaryLines: [],
};

describe('stylist behavior evals', () => {
  it('ranks the polished proven formula above a weak repeated combo', () => {
    const polished = scoreBehavioralCandidate({
      garmentIds: ['cream-top', 'navy-bottom', 'black-loafer'],
      garments,
      profile,
      recentGarmentSets: [['red-shirt', 'white-sneaker', 'navy-bottom']],
    });

    const weakRepeat = scoreBehavioralCandidate({
      garmentIds: ['red-shirt', 'white-sneaker', 'navy-bottom'],
      garments,
      profile,
      recentGarmentSets: [['red-shirt', 'white-sneaker', 'navy-bottom']],
    });

    expect(polished.score).toBeGreaterThan(weakRepeat.score);
  });

  it('still gives credit to a fresh variation when it keeps learned colors', () => {
    const freshVariation = scoreBehavioralCandidate({
      garmentIds: ['cream-top', 'navy-bottom', 'olive-jacket'],
      garments,
      profile,
      recentGarmentSets: [['cream-top', 'navy-bottom', 'black-loafer']],
    });

    const offProfile = scoreBehavioralCandidate({
      garmentIds: ['red-shirt', 'navy-bottom', 'olive-jacket'],
      garments,
      profile,
      recentGarmentSets: [],
    });

    expect(freshVariation.score).toBeGreaterThan(offProfile.score);
    expect(freshVariation.reasons).toContain('preferred-colors:2');
  });
});
