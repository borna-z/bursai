// useOutfits.helpers — N7 split unit coverage.
//
// Sanity checks the module-scope `inFlightWearOutfit` Set and the
// `OUTFIT_WITH_ITEMS_SELECT` projection — both moved out of useOutfits
// in N7 and need a smoke test so a future refactor that breaks the
// shape fails the test suite.

import {
  inFlightWearOutfit,
  OUTFIT_WITH_ITEMS_SELECT,
} from '../useOutfits.helpers';

describe('useOutfits.helpers', () => {
  describe('inFlightWearOutfit', () => {
    afterEach(() => {
      inFlightWearOutfit.clear();
    });

    it('exposes Set semantics for double-tap guarding', () => {
      expect(inFlightWearOutfit.has('o1')).toBe(false);
      inFlightWearOutfit.add('o1');
      expect(inFlightWearOutfit.has('o1')).toBe(true);
      inFlightWearOutfit.delete('o1');
      expect(inFlightWearOutfit.has('o1')).toBe(false);
    });
  });

  describe('OUTFIT_WITH_ITEMS_SELECT', () => {
    it('joins outfit_items and nested garment row', () => {
      // Whitespace-tolerant assertion — supabase tolerates the embedded
      // newlines but the test should not depend on exact formatting.
      expect(OUTFIT_WITH_ITEMS_SELECT).toMatch(/outfit_items/);
      expect(OUTFIT_WITH_ITEMS_SELECT).toMatch(/garment:garments/);
    });
  });
});
