import { describe, expect, it } from 'vitest';
import { canBuildCompleteOutfitPath, validateBaseOutfit, validateCompleteOutfit, filterValidCompleteOutfits } from '../outfitValidation';

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

  it('rejects dress mixed with separates', () => {
    expect(validateBaseOutfit([
      { slot: 'dress' },
      { slot: 'bottom' },
    ]).isValid).toBe(false);
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

  it('accepts dress + shoes', () => {
    expect(validateCompleteOutfit([
      { slot: 'dress' },
      { slot: 'shoes' },
    ])).toMatchObject({ isValid: true, isStandard: false, isDressBased: true });
  });

  it('rejects duplicate bottom slots', () => {
    expect(validateCompleteOutfit([
      { slot: 'top' },
      { slot: 'bottom' },
      { slot: 'bottom' },
      { slot: 'shoes' },
    ]).isValid).toBe(false);
  });

  it('rejects dress with bottom even when shoes are present', () => {
    expect(validateCompleteOutfit([
      { slot: 'dress' },
      { slot: 'bottom' },
      { slot: 'shoes' },
    ]).isValid).toBe(false);
  });

  it('accepts a layered top outfit with one base layer and one mid layer', () => {
    expect(validateCompleteOutfit([
      { garment: { category: 'top', subcategory: 't-shirt' } },
      { garment: { category: 'top', subcategory: 'cardigan' } },
      { garment: { category: 'bottom', subcategory: 'trousers' } },
      { garment: { category: 'shoes', subcategory: 'boots' } },
      { garment: { category: 'outerwear', subcategory: 'coat' } },
    ]).isValid).toBe(true);
  });

  it('rejects layered tops without a real base layer', () => {
    expect(validateCompleteOutfit([
      { garment: { category: 'top', subcategory: 'cardigan' } },
      { garment: { category: 'top', subcategory: 'hoodie' } },
      { garment: { category: 'bottom', subcategory: 'trousers' } },
      { garment: { category: 'shoes', subcategory: 'boots' } },
    ]).isValid).toBe(false);
  });

  it('uses garment categories over stale stored slot labels', () => {
    expect(validateCompleteOutfit([
      { slot: 'top', garment: { category: 'bottom', subcategory: 'trousers' } },
      { slot: 'bottom', garment: { category: 'bottom', subcategory: 'jeans' } },
      { slot: 'shoes', garment: null },
    ]).isValid).toBe(false);
  });

  it('rejects outfits when a required garment relation is missing', () => {
    expect(validateCompleteOutfit([
      { slot: 'top', garment: { category: 'top', subcategory: 'shirt' } },
      { slot: 'bottom', garment: { category: 'bottom', subcategory: 'trousers' } },
      { slot: 'shoes', garment: null },
    ])).toMatchObject({ isValid: false, missing: ['shoes'] });
  });

  it('filters incomplete persisted outfits from visible flows', () => {
    const outfits = filterValidCompleteOutfits([
      { id: 'missing-bottom', outfit_items: [{ slot: 'top' }, { slot: 'shoes' }] },
      { id: 'missing-shoes', outfit_items: [{ slot: 'top' }, { slot: 'bottom' }] },
      { id: 'duplicate-bottom', outfit_items: [{ slot: 'top' }, { slot: 'bottom' }, { slot: 'bottom' }, { slot: 'shoes' }] },
      { id: 'complete', outfit_items: [{ slot: 'top' }, { slot: 'bottom' }, { slot: 'shoes' }] },
    ]);

    expect(outfits).toHaveLength(1);
    expect(outfits[0]).toMatchObject({ id: 'complete' });
  });
});

describe('canBuildCompleteOutfitPath', () => {
  it('accepts dress + shoes wardrobes', () => {
    expect(canBuildCompleteOutfitPath([
      { category: 'dress', subcategory: null },
      { category: 'shoes', subcategory: 'boots' },
    ])).toBe(true);
  });

  it('rejects wardrobes without a complete path', () => {
    expect(canBuildCompleteOutfitPath([
      { category: 'top', subcategory: 'shirt' },
      { category: 'bottom', subcategory: 'trousers' },
    ])).toBe(false);
  });
});
