// Tests for `resolveOccasionSubmode` — Theme 5 fix.
//
// Background: pre-Theme 5 the function relied on substring matchers
// (`primaryGoal.includes('formal'|'professional'|'comfort'|'relaxed'|'creative')`)
// against V3 vocab. After `migrateV4ToV3Compat`, V3 values are
// `save_time | better_style | wardrobe_org | reduce_waste | plan_outfits`,
// none of which contain those substrings — so the formality adjustment never
// fired for ANY user. The fix replaces the dead matcher with a V4-native read
// of the `formalityCeiling` / `formalityFloor` midpoint.
//
// Coverage:
//   1.  Non-work occasion → null (early return)
//   2.  Meeting occasion → 'Formal Office' regardless of profile (occasion signal)
//   3.  Plain `work` + V3-native profile (V4 fields absent — `primaryGoal` is
//       no longer read at all post-fix) → 'Business Casual' (occasion midpoint = 3)
//   4.  Plain `work` + V4 default profile (floor=30, ceiling=60) → 'Business Casual' (no adjustment fires)
//   5.  Plain `work` + V4 formal-leaning profile (floor=70, ceiling=95) → 'Formal Office' (push up)
//   6.  Plain `work` + V4 comfort-leaning profile (floor=10, ceiling=30) → 'Relaxed Office' (push down)
//   7.  Plain `work` + styleVector formalityCenter override → uses vector value
//   8.  Plain `work` + only one of floor/ceiling present → no V4 adjustment (incomplete signal)
//   9.  Wrapped prefs shape (`{ styleProfile: { ... } }`) — `getStylePrefs`
//       unwrap path (production callers in `burs_style_engine` pass merged-row
//       prefs that may be wrapped this way; flat is the same code branch).
//  10.  Boundary: `floor=0, ceiling=0` (extreme comfort) → push down.
//  11.  Boundary: `floor=100, ceiling=100` (extreme formal) → push up.
//  12.  Wide-range user (floor=10, ceiling=95) → midpoint 52.5 / on-scale 3.1
//       → no adjustment, occasion default. Documents intentional treatment of
//       "I can wear anything" users — not an oversight.
//  13.  Defensive: NaN bound → typeof gate accepts it, but neither comparison
//       fires → no adjustment (safe).
//  14.  Defensive: string-typed bound (e.g. legacy DB write of `"60"`) →
//       typeof gate rejects → no adjustment (safe).

import { describe, expect, it } from 'vitest';
import { resolveOccasionSubmode } from '../outfit-scoring.ts';
import type { StyleVector } from '../outfit-scoring-color.ts';

describe('resolveOccasionSubmode — Theme 5 V4-native formality', () => {
  it('returns null for non-work occasions', () => {
    expect(resolveOccasionSubmode('brunch', null, null)).toBeNull();
    expect(resolveOccasionSubmode('party', null, null)).toBeNull();
    expect(resolveOccasionSubmode('travel', null, null)).toBeNull();
  });

  it('returns "Formal Office" for meeting occasion regardless of profile', () => {
    expect(resolveOccasionSubmode('meeting', null, null)).toBe('Formal Office');
    expect(
      resolveOccasionSubmode(
        'meeting',
        { formalityCeiling: 30, formalityFloor: 10 },
        null,
      ),
    ).toBe('Formal Office');
  });

  it('V3-native profile (no V4 fields) on work falls back to occasion midpoint', () => {
    // work range = [2, 4], midpoint = 3 → 'Business Casual' (>= 3, < 4.4)
    expect(
      resolveOccasionSubmode('work', { primaryGoal: 'better_style' }, null),
    ).toBe('Business Casual');
  });

  it('V4 default profile (floor=30, ceiling=60) on work → no adjustment', () => {
    // midpoint = 45 → on-scale = 1 + (0.45 * 4) = 2.8 → between 2.3 and 3.8
    // → no adjustment, target stays at 3.0 → 'Business Casual'
    expect(
      resolveOccasionSubmode(
        'work',
        { formalityCeiling: 60, formalityFloor: 30 },
        null,
      ),
    ).toBe('Business Casual');
  });

  it('V4 formal-leaning profile (floor=70, ceiling=95) on work → "Formal Office"', () => {
    // midpoint = 82.5 → on-scale = 1 + (0.825 * 4) = 4.3 → >= 3.8
    // → target pushed to 4.5 → 'Formal Office' (>= 4.4)
    expect(
      resolveOccasionSubmode(
        'work',
        { formalityCeiling: 95, formalityFloor: 70 },
        null,
      ),
    ).toBe('Formal Office');
  });

  it('V4 comfort-leaning profile (floor=10, ceiling=30) on work → "Relaxed Office"', () => {
    // midpoint = 20 → on-scale = 1 + (0.2 * 4) = 1.8 → <= 2.3
    // → target pushed to 2.8 → 'Relaxed Office' (< 3)
    expect(
      resolveOccasionSubmode(
        'work',
        { formalityCeiling: 30, formalityFloor: 10 },
        null,
      ),
    ).toBe('Relaxed Office');
  });

  it('styleVector formalityCenter overrides occasion midpoint', () => {
    // styleVector center = 4.5 → no V4 adjustment, target = 4.5 → 'Formal Office'.
    // Using `Partial<StyleVector>` so future StyleVector field additions
    // surface at typecheck rather than getting masked by `as never`.
    const styleVector: Partial<StyleVector> = { formalityCenter: 4.5 };
    expect(
      resolveOccasionSubmode('work', null, styleVector as StyleVector),
    ).toBe('Formal Office');
  });

  it('only one of floor/ceiling present → V4 adjustment skipped (no false signal)', () => {
    // ceiling alone is incomplete — adjustment requires both bounds. Falls
    // through to occasion midpoint (3) → 'Business Casual'.
    expect(
      resolveOccasionSubmode('work', { formalityCeiling: 95 }, null),
    ).toBe('Business Casual');
    expect(
      resolveOccasionSubmode('work', { formalityFloor: 5 }, null),
    ).toBe('Business Casual');
  });

  it('wrapped prefs shape ({ styleProfile: { ... } }) — getStylePrefs unwrap', () => {
    // Production callers in `burs_style_engine` pass merged-row prefs to
    // `resolveOccasionSubmode`; `getStylePrefs` (`outfit-scoring.ts:603`)
    // unwraps `prefs.styleProfile` if present, so both flat and wrapped
    // shapes must yield identical results. A regression in the unwrap
    // semantics would silently revert every V4 user to the dead-branch
    // baseline.
    const wrappedFormal = {
      styleProfile: { formalityCeiling: 95, formalityFloor: 70 },
    };
    expect(resolveOccasionSubmode('work', wrappedFormal, null)).toBe(
      'Formal Office',
    );
    const wrappedComfort = {
      styleProfile: { formalityCeiling: 30, formalityFloor: 10 },
    };
    expect(resolveOccasionSubmode('work', wrappedComfort, null)).toBe(
      'Relaxed Office',
    );
  });

  it('extreme bounds — both 0 → push down; both 100 → push up', () => {
    // floor=0, ceiling=0 → midpoint 0 → on-scale 1 → ≤ 2.3 → target = 2.8
    // → 'Relaxed Office'.
    expect(
      resolveOccasionSubmode(
        'work',
        { formalityCeiling: 0, formalityFloor: 0 },
        null,
      ),
    ).toBe('Relaxed Office');
    // floor=100, ceiling=100 → midpoint 100 → on-scale 5 → ≥ 3.8 → target = 4.5
    // → 'Formal Office' (>= 4.4).
    expect(
      resolveOccasionSubmode(
        'work',
        { formalityCeiling: 100, formalityFloor: 100 },
        null,
      ),
    ).toBe('Formal Office');
  });

  it('wide-range user (floor=10, ceiling=95) → no adjustment, occasion default', () => {
    // midpoint 52.5 → on-scale 3.1 → between 2.3 and 3.8 → no adjustment,
    // occasion midpoint (3) → 'Business Casual'. Intentional: a user whose
    // bounds straddle the formality spectrum signals "I can wear anything";
    // letting both bounds fire independently would push BOTH up and down at
    // once, which is meaningless. Midpoint-only treatment is by design.
    expect(
      resolveOccasionSubmode(
        'work',
        { formalityCeiling: 95, formalityFloor: 10 },
        null,
      ),
    ).toBe('Business Casual');
  });

  it('defensive: NaN bound → typeof passes but comparisons fail → no adjustment', () => {
    // `typeof NaN === 'number'` is true so the guard accepts it, but
    // `(NaN + …) / 2 / 100 * 4 + 1 = NaN`, and `NaN >= 3.8` / `NaN <= 2.3`
    // are both false — adjustment never fires, target stays at the occasion
    // midpoint. Safe-by-arithmetic but worth pinning so future refactors
    // can't introduce a false-signal regression.
    expect(
      resolveOccasionSubmode(
        'work',
        { formalityCeiling: NaN, formalityFloor: NaN },
        null,
      ),
    ).toBe('Business Casual');
  });

  it('defensive: string-typed bound (legacy DB write) → typeof gate skips', () => {
    // `typeof '60' === 'string'` so the guard sets the bound to null and
    // the adjustment never fires. Protects against any historical row
    // that was written as a string instead of a number.
    expect(
      resolveOccasionSubmode(
        'work',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { formalityCeiling: '95' as any, formalityFloor: '70' as any },
        null,
      ),
    ).toBe('Business Casual');
  });
});
