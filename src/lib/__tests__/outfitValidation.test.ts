import { describe, expect, it } from 'vitest';
import { validateBaseOutfit, validateCompleteOutfit, filterValidCompleteOutfits } from '../outfitValidation';

describe('validateBaseOutfit', () => {
  it('rejects top + shoes without bottom', () => {
    expect(validateBaseOutfit([
      { slot: 'top' },
      { slot: 'shoes' },
    ]).isValid).toBe(false);
  });

  it('rejects bottom + shoes without top', () => {
    expect(validateBaseOutfit([
      { slot: 'bottom' },
      { slot: 'shoes' },
    ]).isValid).toBe(false);
  });

  it('accepts top + bottom', () => {
    expect(validateBaseOutfit([
      { slot: 'top' },
      { slot: 'bottom' },
    ])).toMatchObject({ isValid: true, isStandard: true, isDressBased: false });
  });

  it('accepts dress/fullbody path', () => {
    expect(validateBaseOutfit([
      { slot: 'fullbody' },
      { slot: 'shoes' },
    ])).toMatchObject({ isValid: true, isStandard: false, isDressBased: true });
  });
});


describe('validateCompleteOutfit', () => {
  it('rejects top + bottom without shoes', () => {
    expect(validateCompleteOutfit([
      { slot: 'top' },
      { slot: 'bottom' },
    ])).toMatchObject({ isValid: false, missing: ['shoes'] });
  });

  it('rejects dress without shoes', () => {
    expect(validateCompleteOutfit([
      { slot: 'dress' },
    ])).toMatchObject({ isValid: false, isDressBased: true, missing: ['shoes'] });
  });

  it('accepts top + bottom + shoes', () => {
    expect(validateCompleteOutfit([
      { slot: 'top' },
      { slot: 'bottom' },
      { slot: 'shoes' },
    ])).toMatchObject({ isValid: true, isStandard: true, isDressBased: false });
  });

  it('filters incomplete persisted outfits from visible flows', () => {
    const outfits = filterValidCompleteOutfits([
      { id: 'missing-bottom', outfit_items: [{ slot: 'top' }, { slot: 'shoes' }] },
      { id: 'missing-shoes', outfit_items: [{ slot: 'top' }, { slot: 'bottom' }] },
      { id: 'complete', outfit_items: [{ slot: 'top' }, { slot: 'bottom' }, { slot: 'shoes' }] },
    ]);

    expect(outfits).toHaveLength(1);
    expect(outfits[0]).toMatchObject({ id: 'complete' });
  });
});
