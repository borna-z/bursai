import { describe, expect, it } from 'vitest';
import { deriveStylistBehaviorProfile, scoreBehavioralCandidate } from '../stylist-behavior';

describe('deriveStylistBehaviorProfile', () => {
  it('learns preferred and avoided garments from outfit behavior and swaps', () => {
    const profile = deriveStylistBehaviorProfile({
      signals: [
        { signal_type: 'save', outfit_id: 'o-positive' },
        { signal_type: 'wear_confirm', outfit_id: 'o-positive' },
        { signal_type: 'planned_follow_through', metadata: { garment_ids: ['g-top', 'g-bottom', 'g-shoes'] } },
        { signal_type: 'swap_choice', garment_id: 'g-shoes', metadata: { replaced: 'g-old-shoes' } },
        { signal_type: 'planned_skip', outfit_id: 'o-negative' },
        { signal_type: 'rating', outfit_id: 'o-negative', value: '1' },
      ],
      outfitItems: [
        { outfit_id: 'o-positive', garment_id: 'g-top' },
        { outfit_id: 'o-positive', garment_id: 'g-bottom' },
        { outfit_id: 'o-positive', garment_id: 'g-shoes' },
        { outfit_id: 'o-negative', garment_id: 'g-old-shoes' },
        { outfit_id: 'o-negative', garment_id: 'g-avoid-top' },
      ],
      garments: [
        { id: 'g-top', title: 'Cream Tee', category: 'top', color_primary: 'cream' },
        { id: 'g-bottom', title: 'Navy Trouser', category: 'bottom', color_primary: 'navy' },
        { id: 'g-shoes', title: 'Black Loafer', category: 'shoes', color_primary: 'black' },
        { id: 'g-old-shoes', title: 'Chunky Sneaker', category: 'shoes', color_primary: 'white' },
        { id: 'g-avoid-top', title: 'Loud Shirt', category: 'top', color_primary: 'red' },
      ],
      pairMemory: [
        { garment_a_id: 'g-top', garment_b_id: 'g-bottom', positive_count: 3, negative_count: 0 },
        { garment_a_id: 'g-old-shoes', garment_b_id: 'g-avoid-top', positive_count: 0, negative_count: 2 },
      ],
    });

    expect(profile.preferredGarmentIds).toEqual(expect.arrayContaining(['g-top', 'g-bottom', 'g-shoes']));
    expect(profile.avoidedGarmentIds).toEqual(expect.arrayContaining(['g-old-shoes', 'g-avoid-top']));
    expect(profile.preferredColors).toEqual(expect.arrayContaining(['cream', 'navy', 'black']));
    expect(profile.avoidedColors).toEqual(expect.arrayContaining(['white', 'red']));
    expect(profile.summaryLines.join(' ')).toContain('Behavior-backed hero pieces');
  });
});

describe('scoreBehavioralCandidate', () => {
  it('prefers trusted pairs and penalizes avoided repeats', () => {
    const garments = [
      { id: 'g-top', title: 'Cream Tee', category: 'top', color_primary: 'cream' },
      { id: 'g-bottom', title: 'Navy Trouser', category: 'bottom', color_primary: 'navy' },
      { id: 'g-shoes', title: 'Black Loafer', category: 'shoes', color_primary: 'black' },
      { id: 'g-avoid-top', title: 'Loud Shirt', category: 'top', color_primary: 'red' },
      { id: 'g-old-shoes', title: 'Chunky Sneaker', category: 'shoes', color_primary: 'white' },
    ];

    const preferredScore = scoreBehavioralCandidate({
      garmentIds: ['g-top', 'g-bottom', 'g-shoes'],
      garments,
      profile: {
        preferredGarmentIds: ['g-top', 'g-bottom', 'g-shoes'],
        avoidedGarmentIds: ['g-old-shoes', 'g-avoid-top'],
        preferredColors: ['cream', 'navy'],
        avoidedColors: ['red', 'white'],
        favoredPairKeys: ['g-bottom::g-top'],
        avoidedPairKeys: ['g-avoid-top::g-old-shoes'],
        summaryLines: [],
      },
      recentGarmentSets: [['g-avoid-top', 'g-old-shoes']],
      successfulGarmentSets: [['g-top', 'g-bottom', 'g-shoes']],
    });

    const avoidedScore = scoreBehavioralCandidate({
      garmentIds: ['g-avoid-top', 'g-bottom', 'g-old-shoes'],
      garments,
      profile: {
        preferredGarmentIds: ['g-top', 'g-bottom', 'g-shoes'],
        avoidedGarmentIds: ['g-old-shoes', 'g-avoid-top'],
        preferredColors: ['cream', 'navy'],
        avoidedColors: ['red', 'white'],
        favoredPairKeys: ['g-bottom::g-top'],
        avoidedPairKeys: ['g-avoid-top::g-old-shoes'],
        summaryLines: [],
      },
      recentGarmentSets: [['g-avoid-top', 'g-bottom', 'g-old-shoes']],
      successfulGarmentSets: [['g-top', 'g-bottom', 'g-shoes']],
    });

    expect(preferredScore.score).toBeGreaterThan(avoidedScore.score);
    expect(preferredScore.reasons).toContain('favored-pair');
    expect(preferredScore.reasons).toContain('successful-formula:3');
    expect(avoidedScore.reasons).toContain('avoided-pair');
    expect(avoidedScore.reasons.some((reason) => reason.startsWith('avoided-colors:'))).toBe(true);
    expect(avoidedScore.reasons).toContain('exact-repeat');
  });
});
