// Style-DNA color samples + name→hex lookup for the swatch row that
// renders `dna.signatureColors`. These are NOT theme tokens — they're a
// fixed dictionary of named wardrobe colors (the V4 quiz / summary
// builder produce strings like 'navy' or 'sage'). Hardcoded hex is
// allowed here per CLAUDE.md's "named color-data constants" exception;
// do not use these for chrome / borders / type — those come from
// `tokens.ts` via `useTokens()`.
//
// Single source of truth for both `ProfileScreen` and
// `SettingsStyleScreen`. The `colorNameToHex` map mirrors the V4 swatch
// vocabulary (lowercased keys) plus a few common synonyms; unknown names
// fall back to a neutral grey so a misspelled color never crashes the
// swatch row.

const COLOR_NAME_TO_HEX: Readonly<Record<string, string>> = {
  // Neutrals
  white: '#FAFAF6',
  cream: '#F4ECDD',
  ivory: '#F5EDD8',
  beige: '#D9C8A8',
  sand: '#C8B89C',
  tan: '#B89D77',
  taupe: '#9B8C7B',
  brown: '#8B6F4E',
  chocolate: '#5C3F26',
  charcoal: '#1D1916',
  black: '#15110E',
  grey: '#8B8C8E',
  gray: '#8B8C8E',
  silver: '#BFC1C4',

  // Cools
  navy: '#2E3B4E',
  blue: '#3F5A7A',
  denim: '#4D6A8A',
  teal: '#2F6E70',
  green: '#3C5C3F',
  olive: '#A8966C',
  sage: '#9DAE8A',
  mint: '#B4D2BC',
  forest: '#2A4A33',

  // Warms
  red: '#A33A2C',
  burgundy: '#5E2A2C',
  rust: '#A8553D',
  orange: '#C9743D',
  yellow: '#D6B860',
  mustard: '#B69544',
  pink: '#D4A0A0',
  blush: '#E0BCB5',
  rose: '#C68A88',
  purple: '#5E3F65',
  lavender: '#B5A5C4',
};

const FALLBACK_SWATCH_HEX = '#9B8C7B';

/** Lowercases + trims input, looks up the hex in the V4 swatch
 * vocabulary, and falls back to a neutral grey on miss. Safe for
 * arbitrary user-generated strings — no null returns. */
export function styleColorToHex(name: string): string {
  const key = name.trim().toLowerCase();
  if (!key) return FALLBACK_SWATCH_HEX;
  return COLOR_NAME_TO_HEX[key] ?? FALLBACK_SWATCH_HEX;
}
