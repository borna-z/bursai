/**
 * Tests for the V4 ↔ V3 style-profile compat layer.
 *
 * Audit finding #9 (PR #688) — `migrateV4ToV3Compat` previously finished with
 * `{ ...compat, ...v4 }` which let raw V4 enum values overwrite the
 * V3-vocab compat object on every same-name collision (gender, climate,
 * layering, paletteVibe, primaryGoal, fit-via-fitOverall). Five legacy edge
 * readers couldn't parse V4 vocab and silently degraded outfit ranking, chat
 * replies, and outfit scoring. These tests lock the V3 vocab on the
 * persisted record + cover the bidirectional translators.
 */

import { describe, expect, it } from 'vitest';
import {
  createEmptyStyleProfileV4,
  migrateV3ToV4,
  migrateV4ToV3Compat,
  v3ClimateToV4,
  v3FitToV4,
  v3GenderToV4,
  v3LayeringToV4,
  v3PaletteVibeToV4,
  v3PrimaryGoalToV4,
  v4ClimateToV3,
  v4FitToV3,
  v4GenderToV3,
  v4LayeringToV3,
  v4PaletteVibeToV3,
  v4PrimaryGoalToV3,
  STYLE_PROFILE_VERSION,
} from '../styleProfile';

// ─── Per-field translator coverage ───

describe('v4GenderToV3', () => {
  it('feminine → female', () => expect(v4GenderToV3('feminine')).toBe('female'));
  it('masculine → male', () => expect(v4GenderToV3('masculine')).toBe('male'));
  it('neutral → nonbinary', () => expect(v4GenderToV3('neutral')).toBe('nonbinary'));
  it('prefer_not passes through', () => expect(v4GenderToV3('prefer_not')).toBe('prefer_not'));
});

describe('v3GenderToV4', () => {
  it('female → feminine', () => expect(v3GenderToV4('female')).toBe('feminine'));
  it('male → masculine', () => expect(v3GenderToV4('male')).toBe('masculine'));
  it('nonbinary → neutral', () => expect(v3GenderToV4('nonbinary')).toBe('neutral'));
  it('prefer_not passes through', () => expect(v3GenderToV4('prefer_not')).toBe('prefer_not'));
  it('returns null on unknown input', () => expect(v3GenderToV4('xyz')).toBeNull());
});

describe('v4FitToV3', () => {
  it('fitted → slim', () => expect(v4FitToV3('fitted')).toBe('slim'));
  it('relaxed → loose', () => expect(v4FitToV3('relaxed')).toBe('loose'));
  it('mixed → regular', () => expect(v4FitToV3('mixed')).toBe('regular'));
  it('regular passes through', () => expect(v4FitToV3('regular')).toBe('regular'));
  it('oversized passes through', () => expect(v4FitToV3('oversized')).toBe('oversized'));
});

describe('v3FitToV4', () => {
  it('slim → fitted', () => expect(v3FitToV4('slim')).toBe('fitted'));
  it('loose → relaxed', () => expect(v3FitToV4('loose')).toBe('relaxed'));
  it('regular passes through', () => expect(v3FitToV4('regular')).toBe('regular'));
  it('oversized passes through', () => expect(v3FitToV4('oversized')).toBe('oversized'));
  it('returns null on unknown input', () => expect(v3FitToV4('xyz')).toBeNull());
});

describe('v4ClimateToV3', () => {
  it('nordic → cold', () => expect(v4ClimateToV3('nordic')).toBe('cold'));
  it('mediterranean → warm', () => expect(v4ClimateToV3('mediterranean')).toBe('warm'));
  it('desert → warm', () => expect(v4ClimateToV3('desert')).toBe('warm'));
  it('varies → mixed', () => expect(v4ClimateToV3('varies')).toBe('mixed'));
  it('temperate passes through', () => expect(v4ClimateToV3('temperate')).toBe('temperate'));
  it('tropical passes through', () => expect(v4ClimateToV3('tropical')).toBe('tropical'));
});

describe('v3ClimateToV4', () => {
  it('cold → nordic', () => expect(v3ClimateToV4('cold')).toBe('nordic'));
  it('warm → mediterranean', () => expect(v3ClimateToV4('warm')).toBe('mediterranean'));
  it('mixed → varies', () => expect(v3ClimateToV4('mixed')).toBe('varies'));
  it('temperate passes through', () => expect(v3ClimateToV4('temperate')).toBe('temperate'));
  it('tropical passes through', () => expect(v3ClimateToV4('tropical')).toBe('tropical'));
  it('returns null on unknown input', () => expect(v3ClimateToV4('xyz')).toBeNull());
});

describe('v4LayeringToV3', () => {
  it('some → moderate', () => expect(v4LayeringToV3('some')).toBe('moderate'));
  it('love → loves', () => expect(v4LayeringToV3('love')).toBe('loves'));
  it('minimal passes through', () => expect(v4LayeringToV3('minimal')).toBe('minimal'));
});

describe('v3LayeringToV4', () => {
  it('moderate → some', () => expect(v3LayeringToV4('moderate')).toBe('some'));
  it('loves → love', () => expect(v3LayeringToV4('loves')).toBe('love'));
  it('minimal passes through', () => expect(v3LayeringToV4('minimal')).toBe('minimal'));
  it('returns null on unknown input', () => expect(v3LayeringToV4('xyz')).toBeNull());
});

describe('v4PaletteVibeToV3', () => {
  it('neutrals → neutral', () => expect(v4PaletteVibeToV3('neutrals')).toBe('neutral'));
  it('pastels → muted', () => expect(v4PaletteVibeToV3('pastels')).toBe('muted'));
  it('earth → muted', () => expect(v4PaletteVibeToV3('earth')).toBe('muted'));
  it('dark → monochrome', () => expect(v4PaletteVibeToV3('dark')).toBe('monochrome'));
  it('mixed → monochrome', () => expect(v4PaletteVibeToV3('mixed')).toBe('monochrome'));
  it('bold passes through', () => expect(v4PaletteVibeToV3('bold')).toBe('bold'));
});

describe('v3PaletteVibeToV4', () => {
  it('neutral → neutrals', () => expect(v3PaletteVibeToV4('neutral')).toBe('neutrals'));
  it('muted → pastels', () => expect(v3PaletteVibeToV4('muted')).toBe('pastels'));
  it('monochrome → dark', () => expect(v3PaletteVibeToV4('monochrome')).toBe('dark'));
  it('bold passes through', () => expect(v3PaletteVibeToV4('bold')).toBe('bold'));
  it('returns null on unknown input', () => expect(v3PaletteVibeToV4('xyz')).toBeNull());
});

describe('v4PrimaryGoalToV3', () => {
  it('reduce_decisions → save_time', () =>
    expect(v4PrimaryGoalToV3('reduce_decisions')).toBe('save_time'));
  it('discover_style → better_style', () =>
    expect(v4PrimaryGoalToV3('discover_style')).toBe('better_style'));
  it('professional_polish → better_style', () =>
    expect(v4PrimaryGoalToV3('professional_polish')).toBe('better_style'));
  it('fun_experimenting → better_style', () =>
    expect(v4PrimaryGoalToV3('fun_experimenting')).toBe('better_style'));
  it('curate_capsule → wardrobe_org', () =>
    expect(v4PrimaryGoalToV3('curate_capsule')).toBe('wardrobe_org'));
  it('sustainability → reduce_waste', () =>
    expect(v4PrimaryGoalToV3('sustainability')).toBe('reduce_waste'));
  it('special_events → plan_outfits', () =>
    expect(v4PrimaryGoalToV3('special_events')).toBe('plan_outfits'));
});

describe('v3PrimaryGoalToV4', () => {
  it('save_time → reduce_decisions', () =>
    expect(v3PrimaryGoalToV4('save_time')).toBe('reduce_decisions'));
  it('better_style → discover_style', () =>
    expect(v3PrimaryGoalToV4('better_style')).toBe('discover_style'));
  it('wardrobe_org → curate_capsule', () =>
    expect(v3PrimaryGoalToV4('wardrobe_org')).toBe('curate_capsule'));
  it('reduce_waste → sustainability', () =>
    expect(v3PrimaryGoalToV4('reduce_waste')).toBe('sustainability'));
  it('plan_outfits → special_events', () =>
    expect(v3PrimaryGoalToV4('plan_outfits')).toBe('special_events'));
  it('returns null on unknown input', () => expect(v3PrimaryGoalToV4('xyz')).toBeNull());
});

// ─── migrateV4ToV3Compat — the audit-finding fix ───

describe('migrateV4ToV3Compat — V3 vocab wins on collision keys (audit finding #9)', () => {
  function makeV4WithV4Vocab() {
    return {
      ...createEmptyStyleProfileV4(),
      gender: 'feminine' as const,
      climate: 'nordic' as const,
      layering: 'love' as const,
      paletteVibe: 'neutrals' as const,
      primaryGoal: 'discover_style' as const,
      fitOverall: 'fitted' as const,
    };
  }

  it('persists V3 gender vocab (female) on V4 input gender=feminine', () => {
    const out = migrateV4ToV3Compat(makeV4WithV4Vocab());
    expect((out as { gender: string }).gender).toBe('female');
  });

  it('persists V3 climate vocab (cold) on V4 input climate=nordic', () => {
    const out = migrateV4ToV3Compat(makeV4WithV4Vocab());
    expect((out as { climate: string }).climate).toBe('cold');
  });

  it('persists V3 layering vocab (loves) on V4 input layering=love', () => {
    const out = migrateV4ToV3Compat(makeV4WithV4Vocab());
    expect((out as { layering: string }).layering).toBe('loves');
  });

  it('persists V3 paletteVibe vocab (neutral) on V4 input paletteVibe=neutrals', () => {
    const out = migrateV4ToV3Compat(makeV4WithV4Vocab());
    expect((out as { paletteVibe: string }).paletteVibe).toBe('neutral');
  });

  it('persists V3 primaryGoal vocab (better_style) on V4 input primaryGoal=discover_style', () => {
    const out = migrateV4ToV3Compat(makeV4WithV4Vocab());
    expect((out as { primaryGoal: string }).primaryGoal).toBe('better_style');
  });

  it('persists V3 fit vocab (slim) translated from V4 fitOverall=fitted', () => {
    const out = migrateV4ToV3Compat(makeV4WithV4Vocab());
    expect((out as { fit: string }).fit).toBe('slim');
  });

  it('preserves V4-only canonical fields untouched', () => {
    const v4 = makeV4WithV4Vocab();
    const out = migrateV4ToV3Compat(v4);
    expect(out.version).toBe(STYLE_PROFILE_VERSION);
    expect(out.fitOverall).toBe('fitted');
    expect(out.formalityCeiling).toBe(v4.formalityCeiling);
    expect(out.formalityFloor).toBe(v4.formalityFloor);
    expect(out.lifestyle).toEqual(v4.lifestyle);
    expect(out.height_cm).toBe(v4.height_cm);
  });

  it('populates V3-mirror-only fields with derived/defaulted values', () => {
    const v4 = makeV4WithV4Vocab();
    const out = migrateV4ToV3Compat(v4);
    // String mirror of height
    expect((out as { height: string }).height).toBe(String(v4.height_cm));
    // comfortVsStyle = 100 - formalityCeiling
    expect((out as { comfortVsStyle: number }).comfortVsStyle).toBe(100 - v4.formalityCeiling);
    // styleWords mirrored from archetypes
    expect((out as { styleWords: string[] }).styleWords).toEqual(v4.archetypes.slice(0, 5));
    // V3 dead fields default to ''/[]
    expect((out as { weekdayLife: string }).weekdayLife).toBe('');
    expect((out as { wardrobeFrustrations: string[] }).wardrobeFrustrations).toEqual([]);
  });

  it('genderNeutral mirror reflects V4 gender=neutral', () => {
    const v4 = { ...createEmptyStyleProfileV4(), gender: 'neutral' as const };
    const out = migrateV4ToV3Compat(v4);
    expect((out as { genderNeutral: string }).genderNeutral).toBe('yes');
  });

  it('genderNeutral mirror is empty for non-neutral gender', () => {
    const v4 = { ...createEmptyStyleProfileV4(), gender: 'feminine' as const };
    const out = migrateV4ToV3Compat(v4);
    expect((out as { genderNeutral: string }).genderNeutral).toBe('');
  });

  it('round-trip: V3 → V4 → V3-compat preserves V3 vocab on collision keys', () => {
    // Start with a V3-shaped record (legacy onboarding).
    const v3 = {
      gender: 'female',
      ageRange: '25-34',
      climate: 'temperate',
      fit: 'regular',
      paletteVibe: 'neutrals', // V3 readers wrote both spellings historically
      patternFeeling: 'some',
      bursGoal: 'better_wardrobe',
      styleWords: ['minimal', 'classic'],
      favoriteColors: ['black', 'white'],
      dislikedColors: ['neon'],
      hardestOccasions: ['work'],
      styleIcons: 'Scandinavian',
      freeText: 'love linen',
      height: '170',
    };
    const v4 = migrateV3ToV4(v3);
    const compat = migrateV4ToV3Compat(v4);

    // Collision keys re-emit V3 vocab.
    expect((compat as { gender: string }).gender).toBe('female');
    expect((compat as { climate: string }).climate).toBe('temperate');
    // V4 fit defaults to 'regular' on unknown V3 fit input → V3 fit='regular'.
    expect((compat as { fit: string }).fit).toBe('regular');
    // Same string fields preserve via array spread.
    expect((compat as { favoriteColors: string[] }).favoriteColors).toEqual(['black', 'white']);
  });

  it('translates default-empty profile cleanly', () => {
    const v4 = createEmptyStyleProfileV4();
    const out = migrateV4ToV3Compat(v4);
    // Default V4 'prefer_not' → V3 'prefer_not'.
    expect((out as { gender: string }).gender).toBe('prefer_not');
    // Default V4 'temperate' → V3 'temperate' (passthrough).
    expect((out as { climate: string }).climate).toBe('temperate');
    // Default V4 'some' → V3 'moderate'.
    expect((out as { layering: string }).layering).toBe('moderate');
    // Default V4 'mixed' → V3 'monochrome'.
    expect((out as { paletteVibe: string }).paletteVibe).toBe('monochrome');
    // Default V4 'reduce_decisions' → V3 'save_time'.
    expect((out as { primaryGoal: string }).primaryGoal).toBe('save_time');
    // Default V4 fitOverall='regular' → V3 fit='regular'.
    expect((out as { fit: string }).fit).toBe('regular');
    expect(out.version).toBe(STYLE_PROFILE_VERSION);
  });
});
