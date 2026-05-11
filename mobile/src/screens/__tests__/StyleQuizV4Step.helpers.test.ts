// StyleQuizV4Step.helpers — N13 split unit coverage.
//
// Sanity checks the touched-map shim used by `migrateV4ToV3Compat` and
// verifies the option lists stay in lockstep with the canonical V4
// vocabulary in styleProfileV4.ts.

import {
  AGE_RANGES,
  BUILDS,
  GENDERS,
  TOUCHED_DEFAULT,
  touchedToCompatTouched,
  type Touched,
} from '../onboarding/StyleQuizV4Step.helpers';

describe('StyleQuizV4Step.helpers', () => {
  describe('TOUCHED_DEFAULT', () => {
    it('starts every flag false', () => {
      const values = Object.values(TOUCHED_DEFAULT);
      expect(values).toHaveLength(17);
      expect(values.every((v) => v === false)).toBe(true);
    });
  });

  describe('touchedToCompatTouched', () => {
    it('renames the screen-local `goal` flag to `primaryGoal`', () => {
      const touched: Touched = { ...TOUCHED_DEFAULT, goal: true };
      const out = touchedToCompatTouched(touched);
      expect(out.primaryGoal).toBe(true);
      expect((out as Record<string, unknown>).goal).toBeUndefined();
    });

    it('passes same-named flags through unchanged', () => {
      const touched: Touched = {
        ...TOUCHED_DEFAULT,
        gender: true,
        height_cm: true,
        build: true,
        ageRange: true,
        formality: true,
      };
      const out = touchedToCompatTouched(touched);
      expect(out.gender).toBe(true);
      expect(out.height_cm).toBe(true);
      expect(out.build).toBe(true);
      expect(out.ageRange).toBe(true);
      expect(out.formality).toBe(true);
    });
  });

  describe('option lists', () => {
    it('GENDERS covers 4 options', () => {
      expect(GENDERS).toHaveLength(4);
      expect(GENDERS).toContain('prefer_not');
    });

    it('BUILDS covers 5 options including prefer_not', () => {
      expect(BUILDS).toHaveLength(5);
      expect(BUILDS).toContain('prefer_not');
    });

    it('AGE_RANGES covers the 6 brackets', () => {
      expect(AGE_RANGES).toHaveLength(6);
      expect(AGE_RANGES[0]).toBe('18-24');
      expect(AGE_RANGES[AGE_RANGES.length - 1]).toBe('65+');
    });
  });
});
