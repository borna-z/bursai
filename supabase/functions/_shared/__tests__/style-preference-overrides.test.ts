import { describe, expect, it } from 'vitest';
import { mergeStylePreferenceOverrides } from '../style-preference-overrides';

describe('mergeStylePreferenceOverrides', () => {
  it('adds learned colors without overwriting explicit profile colors', () => {
    const merged = mergeStylePreferenceOverrides(
      {
        styleProfile: {
          favoriteColors: ['navy'],
          dislikedColors: ['orange'],
          styleWords: ['minimal'],
        },
      },
      {
        favoriteColors: ['cream', 'navy'],
        dislikedColors: ['red'],
      },
    );

    expect(merged?.styleProfile.favoriteColors).toEqual(['navy', 'cream']);
    expect(merged?.styleProfile.dislikedColors).toEqual(['orange', 'red']);
    expect(merged?.styleProfile.styleWords).toEqual(['minimal']);
  });

  it('keeps explicit user preferences stronger than contradictory learned overrides', () => {
    const merged = mergeStylePreferenceOverrides(
      {
        styleProfile: {
          favoriteColors: ['black'],
          dislikedColors: ['yellow'],
        },
      },
      {
        favoriteColors: ['yellow'],
        dislikedColors: ['black', 'red'],
      },
    );

    expect(merged?.styleProfile.favoriteColors).toEqual(['black']);
    expect(merged?.styleProfile.dislikedColors).toEqual(['yellow', 'red']);
  });

  it('creates a style profile when only learned overrides exist', () => {
    const merged = mergeStylePreferenceOverrides(null, {
      favoriteColors: ['cream'],
      dislikedColors: ['lime'],
    });

    expect(merged).toEqual({
      styleProfile: {
        favoriteColors: ['cream'],
        dislikedColors: ['lime'],
      },
    });
  });
});
