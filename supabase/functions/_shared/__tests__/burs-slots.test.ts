import { describe, expect, it } from 'vitest';
import {
  CANONICAL_SLOTS,
  classifySlot,
  isValidSlot,
  normalizeSlot,
  SLOT_CATEGORIES,
  type SlotName,
} from '../burs-slots';

describe('CANONICAL_SLOTS', () => {
  it('contains exactly 6 canonical slots', () => {
    expect(CANONICAL_SLOTS).toEqual(['top', 'bottom', 'shoes', 'outerwear', 'dress', 'accessory']);
  });

  it('every entry is a valid SlotName', () => {
    for (const slot of CANONICAL_SLOTS) {
      expect(isValidSlot(slot)).toBe(true);
    }
  });
});

describe('SLOT_CATEGORIES', () => {
  it('maps every canonical slot to a category', () => {
    for (const slot of CANONICAL_SLOTS) {
      expect(SLOT_CATEGORIES[slot]).toBeTruthy();
    }
  });
});

describe('isValidSlot', () => {
  it.each(CANONICAL_SLOTS)('returns true for canonical slot "%s"', (slot) => {
    expect(isValidSlot(slot)).toBe(true);
  });

  it.each(['unknown', 'other', 'shirt', '', 'foo', 'TOP'])('returns false for "%s"', (value) => {
    expect(isValidSlot(value)).toBe(false);
  });
});

describe('normalizeSlot', () => {
  it('returns canonical slots unchanged', () => {
    expect(normalizeSlot('top')).toBe('top');
    expect(normalizeSlot('bottom')).toBe('bottom');
    expect(normalizeSlot('shoes')).toBe('shoes');
    expect(normalizeSlot('outerwear')).toBe('outerwear');
    expect(normalizeSlot('dress')).toBe('dress');
    expect(normalizeSlot('accessory')).toBe('accessory');
  });

  it('maps direct aliases', () => {
    expect(normalizeSlot('shoe')).toBe('shoes');
    expect(normalizeSlot('outer')).toBe('outerwear');
    expect(normalizeSlot('layer')).toBe('outerwear');
    expect(normalizeSlot('layering')).toBe('outerwear');
  });

  it('handles case insensitivity', () => {
    expect(normalizeSlot('TOP')).toBe('top');
    expect(normalizeSlot('Shoes')).toBe('shoes');
    expect(normalizeSlot('DRESS')).toBe('dress');
  });

  it('maps token-based matches', () => {
    expect(normalizeSlot('jacket')).toBe('outerwear');
    expect(normalizeSlot('sneakers')).toBe('shoes');
    expect(normalizeSlot('oxfords')).toBe('shoes');
    expect(normalizeSlot('mules')).toBe('shoes');
    expect(normalizeSlot('jeans')).toBe('bottom');
    expect(normalizeSlot('scarf')).toBe('accessory');
    expect(normalizeSlot('jumpsuit')).toBe('dress');
    expect(normalizeSlot('blouse')).toBe('top');
    expect(normalizeSlot('waistcoat')).toBe('outerwear');
  });

  it('maps Swedish tokens', () => {
    expect(normalizeSlot('jacka')).toBe('outerwear');
    expect(normalizeSlot('skor')).toBe('shoes');
    expect(normalizeSlot('byxor')).toBe('bottom');
    expect(normalizeSlot('klänning')).toBe('dress');
    expect(normalizeSlot('väska')).toBe('accessory');
    expect(normalizeSlot('tröja')).toBe('top');
  });

  it('returns null for unknown strings', () => {
    expect(normalizeSlot('')).toBeNull();
    expect(normalizeSlot('spaceship')).toBeNull();
    expect(normalizeSlot('xyz123')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(normalizeSlot('  shoes  ')).toBe('shoes');
    expect(normalizeSlot(' jacket ')).toBe('outerwear');
  });
});

describe('classifySlot', () => {
  it('classifies category + subcategory combinations', () => {
    expect(classifySlot('top', 't-shirt')).toBe('top');
    expect(classifySlot('bottom', 'jeans')).toBe('bottom');
    expect(classifySlot('shoes', 'sneakers')).toBe('shoes');
    expect(classifySlot('outerwear', 'jacket')).toBe('outerwear');
    expect(classifySlot('dress', null)).toBe('dress');
    expect(classifySlot('accessory', 'belt')).toBe('accessory');
  });

  it('infers slot from subcategory alone', () => {
    expect(classifySlot('clothing', 'sneakers')).toBe('shoes');
    expect(classifySlot('clothing', 'oxfords')).toBe('shoes');
    expect(classifySlot('clothing', 'jacket')).toBe('outerwear');
    expect(classifySlot('clothing', 'waistcoat')).toBe('outerwear');
    expect(classifySlot('clothing', 'jumpsuit')).toBe('dress');
  });

  it('returns null for unrecognizable input', () => {
    expect(classifySlot(null, null)).toBeNull();
    expect(classifySlot('', '')).toBeNull();
    expect(classifySlot('unknown', 'thing')).toBeNull();
  });

  it('handles Swedish categories', () => {
    expect(classifySlot('tröja', null)).toBe('top');
    expect(classifySlot('byxor', null)).toBe('bottom');
    expect(classifySlot('skor', null)).toBe('shoes');
    expect(classifySlot('jacka', null)).toBe('outerwear');
    expect(classifySlot('klänning', null)).toBe('dress');
    expect(classifySlot('väska', null)).toBe('accessory');
  });

  it('dress takes priority over ambiguous categories', () => {
    expect(classifySlot('dress', 'jumpsuit')).toBe('dress');
  });
});
