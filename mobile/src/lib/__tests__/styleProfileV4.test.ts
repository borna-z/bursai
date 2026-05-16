// Phase 4 — Tests for the split styleProfileV4 modules. Imports go through
// the barrel so the test also pins the public surface that screens / hooks
// rely on.

import {
  defaultStyleProfileV4,
  migrateV4ToV3Compat,
  parseStyleProfileV4,
  STYLE_PROFILE_V4_VERSION,
  type StyleProfileV4,
  type StyleProfileV4Touched,
} from '../styleProfileV4';

describe('STYLE_PROFILE_V4_VERSION', () => {
  it('is 4', () => {
    expect(STYLE_PROFILE_V4_VERSION).toBe(4);
  });
});

describe('defaultStyleProfileV4', () => {
  it('returns a v4-versioned record with neutral defaults', () => {
    const d = defaultStyleProfileV4();
    expect(d.version).toBe(4);
    expect(d.gender).toBe('prefer_not');
    expect(d.height_cm).toBe(170);
    expect(d.archetypes).toEqual([]);
    expect(d.favoriteColors).toEqual([]);
    expect(d.lifestyle).toEqual({
      work: 20,
      social: 20,
      casual: 20,
      sport: 20,
      evening: 20,
    });
  });

  it('returns a fresh object on each call', () => {
    const a = defaultStyleProfileV4();
    const b = defaultStyleProfileV4();
    expect(a).not.toBe(b);
    expect(a.archetypes).not.toBe(b.archetypes);
  });
});

describe('parseStyleProfileV4 — validator', () => {
  it('returns defaults for non-object input', () => {
    expect(parseStyleProfileV4(null).version).toBe(4);
    expect(parseStyleProfileV4(undefined).version).toBe(4);
    expect(parseStyleProfileV4('garbage').version).toBe(4);
    expect(parseStyleProfileV4(42).version).toBe(4);
  });

  it('round-trips valid input', () => {
    const valid: StyleProfileV4 = {
      ...defaultStyleProfileV4(),
      gender: 'feminine',
      height_cm: 175,
      build: 'athletic',
      ageRange: '35-44',
      archetypes: ['minimal', 'scandi'],
      favoriteColors: ['black', 'white'],
      paletteVibe: 'neutrals',
      patternComfort: 'minimal',
      fitOverall: 'fitted',
      formalityCeiling: 80,
      formalityFloor: 20,
      occasions: ['work', 'casual'],
      primaryGoal: 'curate_capsule',
    };
    const parsed = parseStyleProfileV4(valid);
    expect(parsed).toEqual(valid);
  });

  it('drops unknown fields silently', () => {
    const input = {
      ...defaultStyleProfileV4(),
      gender: 'feminine',
      bogusField: 'should-not-survive',
      anotherUnknown: { nested: true },
    };
    const parsed = parseStyleProfileV4(input);
    expect(parsed.gender).toBe('feminine');
    expect((parsed as unknown as Record<string, unknown>).bogusField).toBeUndefined();
    expect((parsed as unknown as Record<string, unknown>).anotherUnknown).toBeUndefined();
  });

  it('coerces malformed enum to default', () => {
    const input = {
      gender: 'banana',
      paletteVibe: 'invalid-vibe',
      fitOverall: 999,
      primaryGoal: null,
    };
    const parsed = parseStyleProfileV4(input);
    const base = defaultStyleProfileV4();
    expect(parsed.gender).toBe(base.gender);
    expect(parsed.paletteVibe).toBe(base.paletteVibe);
    expect(parsed.fitOverall).toBe(base.fitOverall);
    expect(parsed.primaryGoal).toBe(base.primaryGoal);
  });

  it('rejects out-of-range height as 0 sentinel', () => {
    expect(parseStyleProfileV4({ height_cm: 50 }).height_cm).toBe(0);
    expect(parseStyleProfileV4({ height_cm: 300 }).height_cm).toBe(0);
    expect(parseStyleProfileV4({ height_cm: 'tall' }).height_cm).toBe(0);
    expect(parseStyleProfileV4({ height_cm: 175 }).height_cm).toBe(175);
  });

  it('deduplicates and caps array fields', () => {
    const parsed = parseStyleProfileV4({
      archetypes: ['minimal', 'minimal', 'scandi', 'classic', 'street', 'preppy', 'edgy'],
    });
    expect(parsed.archetypes).toEqual(['minimal', 'scandi', 'classic', 'street', 'preppy']);
  });

  it('drops invalid array entries', () => {
    const parsed = parseStyleProfileV4({
      favoriteColors: ['black', 'NOT_A_COLOR', 42, null, 'white'],
    });
    expect(parsed.favoriteColors).toEqual(['black', 'white']);
  });

  it('clamps lifestyle percents to 0-100', () => {
    const parsed = parseStyleProfileV4({
      lifestyle: { work: -10, social: 150, casual: 'x', sport: 50, evening: 25 },
    });
    expect(parsed.lifestyle.work).toBe(0);
    expect(parsed.lifestyle.social).toBe(100);
    expect(parsed.lifestyle.sport).toBe(50);
    expect(parsed.lifestyle.evening).toBe(25);
  });
});

describe('migrateV4ToV3Compat — compat shim', () => {
  it('produces a populated V3-shaped object from a V4 sample', () => {
    const v4: StyleProfileV4 = {
      ...defaultStyleProfileV4(),
      gender: 'feminine',
      climate: 'nordic',
      paletteVibe: 'neutrals',
      primaryGoal: 'curate_capsule',
      layering: 'love',
      fitOverall: 'fitted',
      archetypes: ['minimal', 'scandi'],
      occasions: ['work', 'casual'],
      height_cm: 170,
      formalityFloor: 30,
      formalityCeiling: 70,
    };
    const merged = migrateV4ToV3Compat(v4);
    const rec = merged as unknown as Record<string, unknown>;
    expect(rec.gender).toBe('female');
    expect(rec.climate).toBe('cold');
    expect(rec.paletteVibe).toBe('neutral');
    expect(rec.bursGoal).toBe('wardrobe_org');
    expect(rec.layering).toBe('loves');
    expect(rec.fit).toBe('slim');
    expect(rec.height).toBe('170');
    expect(rec.styleWords).toEqual(['minimal', 'scandi']);
    expect(rec.hardestOccasions).toEqual(['work', 'casual']);
    expect(rec.comfortVsStyle).toBe(50);
    expect(rec.version).toBe(4);
  });

  it('omits untouched scalar mirrors when touched flags are supplied', () => {
    const v4 = defaultStyleProfileV4();
    const touched: StyleProfileV4Touched = {
      gender: true,
      // everything else left undefined → omitted
    };
    const merged = migrateV4ToV3Compat(v4, touched) as unknown as Record<string, unknown>;
    expect(merged.gender).toBeDefined();
    expect(merged.climate).toBeUndefined();
    expect(merged.paletteVibe).toBeUndefined();
    expect(merged.patternFeeling).toBeUndefined();
    expect(merged.fit).toBeUndefined();
    expect(merged.layering).toBeUndefined();
    expect(merged.bursGoal).toBeUndefined();
    expect(merged.primaryGoal).toBeUndefined();
    expect(merged.comfortVsStyle).toBeUndefined();
    expect(merged.height).toBeUndefined();
  });

  it('keeps array / free-text mirrors regardless of touched flags', () => {
    const v4: StyleProfileV4 = {
      ...defaultStyleProfileV4(),
      archetypes: ['minimal'],
      occasions: ['work'],
    };
    const merged = migrateV4ToV3Compat(v4, {}) as unknown as Record<string, unknown>;
    expect(merged.archetypes).toEqual(['minimal']);
    expect(merged.occasions).toEqual(['work']);
    expect(merged.styleWords).toEqual(['minimal']);
    expect(merged.hardestOccasions).toEqual(['work']);
  });
});
