// useGenerateTravelCapsule.helpers — N7 split unit coverage.
//
// Sanity checks `seedMustHaves` two-tier output: picker entries first,
// gap entries second, with deduped ids and per-code suffixing.

import { seedMustHaves } from '../useGenerateTravelCapsule.helpers';

describe('useGenerateTravelCapsule.helpers', () => {
  describe('seedMustHaves', () => {
    it('emits picker entries before gaps with stable ids', () => {
      const out = seedMustHaves(
        [{ code: 'missing_top', message: 'missing a top' }],
        ['g1'],
        [{ id: 'g1', title: 'White tee', category: 'top' }],
      );
      expect(out).toHaveLength(2);
      expect(out[0].source).toBe('picker');
      expect(out[0].id).toBe('pick-g1');
      expect(out[0].label).toBe('White tee');
      expect(out[1].source).toBe('gap');
      expect(out[1].id).toBe('gap-missing_top');
    });

    it('suffixes duplicate gap codes with -<n> starting at 2', () => {
      const out = seedMustHaves(
        [
          { code: 'missing_top', message: 'first' },
          { code: 'missing_top', message: 'second' },
          { code: 'missing_top', message: 'third' },
        ],
        [],
        [],
      );
      expect(out.map((r) => r.id)).toEqual([
        'gap-missing_top',
        'gap-missing_top-2',
        'gap-missing_top-3',
      ]);
    });

    it('dedupes picker ids and falls back to bare id when no snapshot', () => {
      const out = seedMustHaves([], ['x', 'x'], []);
      expect(out).toHaveLength(1);
      expect(out[0].label).toBe('x');
    });
  });
});
