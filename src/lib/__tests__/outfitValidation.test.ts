import { describe, expect, it } from 'vitest';
import { validateBaseOutfit } from '../outfitValidation';

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
