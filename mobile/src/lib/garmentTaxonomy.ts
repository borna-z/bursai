// Wave R-C.3 — shared taxonomy used by AddPieceStep3's pickers. Mirrors the
// constants embedded in `EditGarmentScreen.tsx` so both surfaces present the
// same vocabulary; that screen keeps its inline copies as-is to limit blast
// radius (refactoring it is scope creep on this PR). When EditGarmentScreen
// migrates next, this module is the single source of truth.
//
// Values are TitleCase to match what users see and what the row insert writes
// (analyzer output normalizes to lowercase via the case-insensitive match
// below; on save we emit the TitleCase chip value so wardrobe filters stay
// consistent with EditGarmentScreen-saved rows).

export const CATEGORIES = ['Top', 'Bottom', 'Shoes', 'Outer', 'Dress', 'Accessory'] as const;
export const MATERIALS = [
  'Cotton',
  'Linen',
  'Wool',
  'Cashmere',
  'Silk',
  'Leather',
  'Denim',
  'Synthetic',
] as const;
export const FITS = ['Slim', 'Regular', 'Loose', 'Oversized'] as const;
export const PATTERNS = ['Solid', 'Striped', 'Checked', 'Floral', 'Other'] as const;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export type Category = typeof CATEGORIES[number];
export type Material = typeof MATERIALS[number];
export type Fit = typeof FITS[number];
export type Pattern = typeof PATTERNS[number];
export type Season = typeof SEASONS[number];

// Formality 3-stop selector that anchors onto the canonical 1..5 scale used
// across analyze_garment, `formalityLabel` (1→casual, 3→smart-casual, 5→formal)
// and `formalityToBand` (1-2 low, 3 mid, 4-5 high). The chip values land on
// the meaningful endpoints + midpoint of that scale so an explicit "Formal"
// pick persists as 5 (high band, label "formal") rather than 3 (mid band,
// label "smart-casual"). Codex R3 P2.
export const FORMALITY_OPTIONS: { value: 1 | 3 | 5; key: string }[] = [
  { value: 1, key: 'addpiece.step3.formality.casual' },
  { value: 3, key: 'addpiece.step3.formality.smart' },
  { value: 5, key: 'addpiece.step3.formality.formal' },
];

// Hex swatches matching `EditGarmentScreen.tsx` — the `id` is the column
// value, the `label` is the user-facing copy (Title Case). Duplicate kept in
// sync manually until EditGarmentScreen migrates here.
export const COLOR_SWATCHES: { id: string; label: string; color: string }[] = [
  { id: 'cream',     label: 'Cream',     color: '#F5EBD8' },
  { id: 'beige',     label: 'Beige',     color: '#D9C9A6' },
  { id: 'camel',     label: 'Camel',     color: '#B98E5A' },
  { id: 'rust',      label: 'Rust',      color: '#A85432' },
  { id: 'brown',     label: 'Brown',     color: '#5C3F2C' },
  { id: 'olive',     label: 'Olive',     color: '#6B6B3F' },
  { id: 'forest',    label: 'Forest',    color: '#2F4F33' },
  { id: 'sage',      label: 'Sage',      color: '#A4B89A' },
  { id: 'mustard',   label: 'Mustard',   color: '#C9A227' },
  { id: 'gold',      label: 'Gold',      color: '#C9A445' },
  { id: 'terracotta',label: 'Terracotta',color: '#C25B45' },
  { id: 'red',       label: 'Red',       color: '#9B2D26' },
  { id: 'pink',      label: 'Pink',      color: '#E1B5B0' },
  { id: 'rose',      label: 'Rose',      color: '#C58085' },
  { id: 'plum',      label: 'Plum',      color: '#5A3E5C' },
  { id: 'lavender',  label: 'Lavender',  color: '#B7A4C8' },
  { id: 'navy',      label: 'Navy',      color: '#1F2D4A' },
  { id: 'blue',      label: 'Blue',      color: '#3D5A80' },
  { id: 'sky',       label: 'Sky',       color: '#9CC0DD' },
  { id: 'teal',      label: 'Teal',      color: '#2E6E6B' },
  { id: 'mint',      label: 'Mint',      color: '#B6D7C2' },
  { id: 'slate',     label: 'Slate',     color: '#7A8089' },
  { id: 'charcoal',  label: 'Charcoal',  color: '#2A2622' },
  { id: 'black',     label: 'Black',     color: '#111111' },
  { id: 'white',     label: 'White',     color: '#F8F4EE' },
  { id: 'silver',    label: 'Silver',    color: '#C9C9C9' },
  { id: 'denim',     label: 'Denim',     color: '#3A4F66' },
  { id: 'mocha',     label: 'Mocha',     color: '#6B4F3B' },
  { id: 'sand',      label: 'Sand',      color: '#D7C4A1' },
  { id: 'ochre',     label: 'Ochre',     color: '#B0742F' },
];

/**
 * Case-insensitive match of an analyzer value (often lowercase) against a
 * TitleCase chip list. Returns the canonical chip value if it matches, or
 * the raw value unchanged when not in the list (preserves any custom
 * subcategory-ish output the analyzer occasionally emits).
 */
export function matchCanonical<T extends string>(
  value: string | null | undefined,
  options: readonly T[],
): T | string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  const hit = options.find((o) => o.toLowerCase() === lower);
  return hit ?? value;
}
