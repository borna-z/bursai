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
//   1. Non-work occasion → null (early return)
//   2. Meeting occasion → 'Formal Office' regardless of profile (occasion signal)
//   3. Plain `work` + V3-native profile (no V4 fields) → 'Business Casual' (occasion midpoint = 3)
//   4. Plain `work` + V4 default profile (floor=30, ceiling=60) → 'Business Casual' (no adjustment fires)
//   5. Plain `work` + V4 formal-leaning profile (floor=70, ceiling=95) → 'Formal Office' (push up)
//   6. Plain `work` + V4 comfort-leaning profile (floor=10, ceiling=30) → 'Relaxed Office' (push down)
//   7. Plain `work` + styleVector formalityCenter override → uses vector value
//   8. Plain `work` + only one of floor/ceiling present → no V4 adjustment (incomplete signal)

import { describe, expect, it } from 'vitest';
import { resolveOccasionSubmode } from '../outfit-scoring.ts';

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
    // styleVector center = 4.5 → no V4 adjustment, target = 4.5 → 'Formal Office'
    expect(
      resolveOccasionSubmode('work', null, {
        formalityCenter: 4.5,
        // remaining StyleVector fields are unused by resolveOccasionSubmode
      } as never),
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
});
