// BURS — design tokens (pasted from design_handoff_burs_rn/tokens.ts).
// All hex values precomputed; no runtime color-mix.
// Consumed by ThemeProvider.tsx — never import this directly inside a screen.
// Single accent color: warm gold. Light + dark only.

export type ThemeTokens = {
  bg: string;
  bg2: string;
  card: string;
  card2: string;
  fg: string;
  fg2: string;
  fg3: string;
  border: string;
  border2: string;
  accent: string;
  /**
   * Darker companion to `accent`, used as the bottom stop of the FAB gradient
   * (and any future "accent → deeper" gradient). Precomputed because RN can't
   * do CSS `color-mix(oklab, accent 80%, black)` at runtime.
   */
  accentDeep: string;
  accentFg: string;
  accentSoft: string;
  /**
   * Single destructive-action color (delete row, "Sign out", "Cancel subscription"). Warm
   * terracotta/clay-red tuned to sit on the same palette as `accent` rather than a generic
   * system red, to keep the editorial mood.
   */
  destructive: string;
  /**
   * Translucent companion to `destructive` — for soft warning surfaces (e.g. the AI-confidence
   * "Review carefully" badge in AddPieceStep3, destructive-row hover states) that need a
   * destructive-tinted backing without shouting at the user. Mirrors the accent → accentSoft
   * relationship.
   */
  destructiveSoft: string;
  /**
   * Theme-aware backdrop scrim behind sheets / modals — semi-opaque dark overlay.
   * Paired with `scrimFg` (foreground text/icon color rendered on top of a scrim).
   */
  scrimBg: string;
  scrimFg: string;
  /**
   * Theme-invariant near-black scrims for surfaces that need to read cleanly
   * over both light and dark targets (full-bleed coach overlays, side drawers).
   * `scrim` is the lighter wash for side / contextual overlays; `scrimStrong`
   * is the heavier wash for full-modal coach moments. Use these instead of
   * inlining `rgba(0,0,0,X)` in component code.
   */
  scrim: string;
  scrimStrong: string;
  shadowSm: { color: string; offset: { width: number; height: number }; radius: number; opacity: number };
  shadow: { color: string; offset: { width: number; height: number }; radius: number; opacity: number };
};

export const light: ThemeTokens = {
  bg:       '#F4ECDD',
  bg2:      '#EDE3D2',
  card:     '#FBF7EF',
  card2:    '#F1E8D7',
  fg:       '#1D1916',
  fg2:      '#69625B',
  fg3:      '#9A938B',
  border:   '#DDD0BB',
  border2:  '#CFC0A8',
  accent:   '#946C20', // M45 (2026-05-17): darkened from #AD8137 -> #9E7423 (4.29:1, still failed) -> #946C20 (4.75:1) so white-on-accent passes WCAG AA 4.5:1 with margin
  accentDeep: '#6B4E17', // accent darkened ~28% — bottom stop of FAB / "accent → deeper" gradients
  accentFg: '#FFFFFF',
  accentSoft: 'rgba(148,108,32,0.12)',
  destructive:     '#B5432A', // warm clay-red, in-palette with the gold accent
  destructiveSoft: 'rgba(181,67,42,0.12)',
  scrimBg:         'rgba(17,16,14,0.58)', // bg-dark @ 58% — backdrop behind sheets
  scrimFg:         '#FBF7EF',             // matches `card` from the dark theme
  scrim:           'rgba(0,0,0,0.35)',    // theme-invariant — side drawers / contextual overlays
  scrimStrong:     'rgba(0,0,0,0.62)',    // theme-invariant — full-modal coach overlays
  shadowSm: { color: '#1C1917', offset: { width: 0, height: 1 }, radius: 2, opacity: 0.04 },
  shadow:   { color: '#1C1917', offset: { width: 0, height: 8 }, radius: 24, opacity: 0.08 },
};

export const dark: ThemeTokens = {
  bg:       '#11100E',
  bg2:      '#1F1D1A',
  card:     '#1B1916',
  card2:    '#27241F',
  fg:       '#F4ECDD',
  fg2:      '#A99E89',
  fg3:      '#736C61',
  border:   '#2F2C26',
  border2:  '#3F3B33',
  accent:   '#CDA56C',
  accentDeep: '#93764D', // same ~28% darkening recipe applied to dark accent
  accentFg: '#17140F',
  accentSoft: 'rgba(205,165,108,0.14)',
  destructive:     '#D86A52', // lifted clay-red so it reads on the dark bg
  destructiveSoft: 'rgba(216,106,82,0.16)',
  scrimBg:         'rgba(0,0,0,0.72)',    // deeper scrim on dark — fg under it stays readable
  scrimFg:         '#F4ECDD',             // matches `fg` from the dark theme
  scrim:           'rgba(0,0,0,0.35)',    // theme-invariant — side drawers / contextual overlays
  scrimStrong:     'rgba(0,0,0,0.62)',    // theme-invariant — full-modal coach overlays
  shadowSm: { color: '#000000', offset: { width: 0, height: 1 }, radius: 2, opacity: 0.4 },
  shadow:   { color: '#000000', offset: { width: 0, height: 8 }, radius: 24, opacity: 0.4 },
};

export const radii = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 22,
  pill: 999,
} as const;

export const spacing = {
  '0_5': 2,
  '1':   4,
  '1_5': 6,
  '2':   8,
  '2_5': 10,
  '3':   12,
  '3_5': 14,
  '4':   16,
  '4_5': 18,
  '5':   20,
  '6':   24,
  '7':   28,
} as const;

// Font families — these strings MUST match the keys passed to `useFonts({...})` in App.tsx,
// which in turn come from @expo-google-fonts/playfair-display + @expo-google-fonts/dm-sans.
// Mismatch = silent system-font fallback (the old "Italic Playfair not rendering" bug).
//
// `display` is plain italic (regular weight); `displayMedium` is the heavier italic used by
// page titles + large numerals. The DM Sans family covers the rest of the UI.
export const fonts = {
  display:        'PlayfairDisplay_400Regular_Italic',
  displayMedium:  'PlayfairDisplay_500Medium_Italic',
  ui:             'DMSans_400Regular',
  uiMed:          'DMSans_500Medium',
  uiSemi:         'DMSans_600SemiBold',
  uiBold:         'DMSans_700Bold',
} as const;

// Type scale — every screen uses these via the typography components.
export const text = {
  display:     { fontFamily: fonts.displayMedium, fontSize: 28,   lineHeight: 32, letterSpacing: -0.28 },
  pageTitle:   { fontFamily: fonts.displayMedium, fontSize: 28,   lineHeight: 31, letterSpacing: -0.28 },
  pageTitleSm: { fontFamily: fonts.uiSemi,        fontSize: 18,   lineHeight: 22, letterSpacing: -0.2 },
  bodyLg:      { fontFamily: fonts.uiSemi,        fontSize: 14.5, lineHeight: 20, letterSpacing: -0.15 },
  body:        { fontFamily: fonts.uiMed,         fontSize: 13.5, lineHeight: 19, letterSpacing: -0.1 },
  caption:     { fontFamily: fonts.uiMed,         fontSize: 11.5, lineHeight: 16, letterSpacing: 0.4 },
  eyebrow:     { fontFamily: fonts.uiSemi,        fontSize: 10,   lineHeight: 12, letterSpacing: 1.8, textTransform: 'uppercase' as const },
  chipLabel:   { fontFamily: fonts.uiSemi,        fontSize: 10.5, lineHeight: 12, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  numTabular:  { fontFamily: fonts.displayMedium, fontSize: 24,   lineHeight: 24, letterSpacing: -0.25, fontVariant: ['tabular-nums'] as const },
} as const;

export const themes = { light, dark };
export type ThemeName = keyof typeof themes;
