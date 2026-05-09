// useTravelCapsules.helpers — N7 split unit coverage.
//
// Sanity checks the boundary parsers that moved out of useTravelCapsules.

import {
  parseMustHaves,
  parsePackedState,
  parsePackingList,
  parseRow,
} from '../useTravelCapsules.helpers';

describe('useTravelCapsules.helpers', () => {
  describe('parsePackingList', () => {
    it('returns [] for non-array input', () => {
      expect(parsePackingList(null)).toEqual([]);
      expect(parsePackingList({})).toEqual([]);
    });

    it('drops items without an id and keeps valid ones', () => {
      const out = parsePackingList([
        { id: '', title: 'no id' },
        { id: 'a', title: 'item a', category: 'tops' },
      ]);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ id: 'a', title: 'item a', category: 'tops' });
    });
  });

  describe('parseMustHaves', () => {
    it('defaults legacy rows without source to "gap"', () => {
      const out = parseMustHaves([{ id: 'g1', label: 'l', status: 'unsure' }]);
      expect(out[0].source).toBe('gap');
    });

    it('preserves explicit picker source', () => {
      const out = parseMustHaves([
        { id: 'p1', label: 'l', status: 'have', source: 'picker' },
      ]);
      expect(out[0].source).toBe('picker');
    });
  });

  describe('parsePackedState', () => {
    it('returns {} for non-object input', () => {
      expect(parsePackedState(null)).toEqual({});
      expect(parsePackedState([])).toEqual({});
    });

    it('keeps only boolean values', () => {
      const out = parsePackedState({ a: true, b: 'no', c: false });
      expect(out).toEqual({ a: true, c: false });
    });
  });

  describe('parseRow', () => {
    it('returns null when capsule_items is not an array', () => {
      expect(
        parseRow({
          id: '1',
          destination: 'Paris',
          capsule_items: 'oops',
          outfits: [],
        }),
      ).toBeNull();
    });

    it('returns a hydrated row when shape is valid', () => {
      const row = parseRow({
        id: '1',
        destination: 'Paris',
        capsule_items: [],
        outfits: [],
        created_at: '2026-05-09T00:00:00.000Z',
      });
      expect(row?.id).toBe('1');
      expect(row?.must_haves).toEqual([]);
    });
  });
});
