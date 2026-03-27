import { describe, expect, it } from 'vitest';
import {
  buildTravelCapsulePlanSummary,
  classifyTravelCapsuleSlot,
  isCompleteTravelCapsuleOutfitIds,
  validateTravelCapsuleOutfitGarments,
} from '../travelCapsulePlanner';

describe('travelCapsulePlanner', () => {
  it('classifies canonical slots', () => {
    expect(classifyTravelCapsuleSlot('top', 'shirt')).toBe('top');
    expect(classifyTravelCapsuleSlot('bottom', 'jeans')).toBe('bottom');
    expect(classifyTravelCapsuleSlot('shoes', 'boots')).toBe('shoes');
    expect(classifyTravelCapsuleSlot('dress', null)).toBe('dress');
  });

  it('rejects top and bottom without shoes', () => {
    expect(
      validateTravelCapsuleOutfitGarments([
        { id: 'top-1', category: 'top', subcategory: 'shirt' },
        { id: 'bottom-1', category: 'bottom', subcategory: 'trousers' },
      ]),
    ).toMatchObject({ isComplete: false, missingCoreSlots: ['shoes'] });
  });

  it('rejects dress without shoes', () => {
    expect(
      validateTravelCapsuleOutfitGarments([
        { id: 'dress-1', category: 'dress', subcategory: null },
      ]),
    ).toMatchObject({ isComplete: false, missingCoreSlots: ['shoes'] });
  });

  it('rejects bottoms with outerwear and shoes but no top', () => {
    expect(
      validateTravelCapsuleOutfitGarments([
        { id: 'bottom-1', category: 'bottom', subcategory: 'trousers' },
        { id: 'outerwear-1', category: 'outerwear', subcategory: 'coat' },
        { id: 'shoes-1', category: 'shoes', subcategory: 'boots' },
      ]),
    ).toMatchObject({ isComplete: false, missingCoreSlots: ['top'] });
  });

  it('rejects conflicting dress and separate bases', () => {
    expect(
      validateTravelCapsuleOutfitGarments([
        { id: 'dress-1', category: 'dress', subcategory: null },
        { id: 'bottom-1', category: 'bottom', subcategory: 'trousers' },
        { id: 'shoes-1', category: 'shoes', subcategory: 'sneakers' },
      ]),
    ).toMatchObject({ isComplete: false, outfitKind: 'invalid' });
  });

  it('rejects duplicate core slots', () => {
    expect(
      validateTravelCapsuleOutfitGarments([
        { id: 'top-1', category: 'top', subcategory: 'shirt' },
        { id: 'top-2', category: 'top', subcategory: 'tee' },
        { id: 'bottom-1', category: 'bottom', subcategory: 'trousers' },
        { id: 'shoes-1', category: 'shoes', subcategory: 'sneakers' },
      ]),
    ).toMatchObject({ isComplete: false, duplicateCoreSlots: ['top'] });
  });

  it('accepts complete separates and dress looks by id', () => {
    const garmentById = new Map([
      ['top-1', { id: 'top-1', category: 'top', subcategory: 'shirt' }],
      ['bottom-1', { id: 'bottom-1', category: 'bottom', subcategory: 'trousers' }],
      ['shoes-1', { id: 'shoes-1', category: 'shoes', subcategory: 'sneakers' }],
      ['dress-1', { id: 'dress-1', category: 'dress', subcategory: null }],
    ]);

    expect(isCompleteTravelCapsuleOutfitIds(['top-1', 'bottom-1', 'shoes-1'], garmentById)).toBe(true);
    expect(isCompleteTravelCapsuleOutfitIds(['dress-1', 'shoes-1'], garmentById)).toBe(true);
  });

  it('uses the selected date range as source of truth and adds travel looks separately', () => {
    const summary = buildTravelCapsulePlanSummary('2026-07-01', '2026-07-05', 1, true);

    expect(summary.tripNights).toBe(4);
    expect(summary.tripDays).toBe(5);
    expect(summary.requiredOutfits).toBe(7);
    expect(summary.slots.filter((slot) => slot.kind === 'travel_outbound')).toHaveLength(1);
    expect(summary.slots.filter((slot) => slot.kind === 'travel_return')).toHaveLength(1);
  });

  it('builds the exact number of daily looks before travel-day extras', () => {
    const summary = buildTravelCapsulePlanSummary('2026-07-01', '2026-07-03', 2, true);

    expect(summary.tripDays).toBe(3);
    expect(summary.slots.filter((slot) => slot.kind === 'trip_day')).toHaveLength(6);
    expect(summary.requiredOutfits).toBe(8);
    expect(summary.slots.filter((slot) => slot.kind === 'travel_outbound')).toHaveLength(1);
    expect(summary.slots.filter((slot) => slot.kind === 'travel_return')).toHaveLength(1);
  });
});
