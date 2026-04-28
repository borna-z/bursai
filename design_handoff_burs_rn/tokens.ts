// Burs design tokens — paste into your RN project, e.g. src/theme/tokens.ts
// All hex values are precomputed (no runtime color-mix).
// Use via a small ThemeProvider that swaps `light` / `dark`.

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
  accentFg: string;
  accentSoft: string; // rgba — translucent gold tint
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
  accent:   '#AD8137',
  accentFg: '#FFFFFF',
  accentSoft: 'rgba(173,129,55,0.12)',
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
  accentFg: '#17140F',
  accentSoft: 'rgba(205,165,108,0.14)',
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

export const fonts = {
  display: 'PlayfairDisplay-Italic',  // load via expo-font / linking
  displayMedium: 'PlayfairDisplay-MediumItalic',
  ui:    'DMSans-Regular',
  uiMed: 'DMSans-Medium',
  uiSemi: 'DMSans-SemiBold',
  uiBold: 'DMSans-Bold',
  // RN: pass these via Text style.fontFamily after linking ttf files
} as const;

export const text = {
  display:     { fontFamily: fonts.displayMedium, fontSize: 28, lineHeight: 32, letterSpacing: -0.28 },
  pageTitle:   { fontFamily: fonts.displayMedium, fontSize: 28, lineHeight: 31, letterSpacing: -0.28 },
  pageTitleSm: { fontFamily: fonts.uiSemi,        fontSize: 18, lineHeight: 22, letterSpacing: -0.2 },
  bodyLg:      { fontFamily: fonts.uiSemi,        fontSize: 14.5, lineHeight: 20, letterSpacing: -0.15 },
  body:        { fontFamily: fonts.uiMed,         fontSize: 13.5, lineHeight: 19, letterSpacing: -0.1 },
  caption:     { fontFamily: fonts.uiMed,         fontSize: 11.5, lineHeight: 16, letterSpacing: 0.4 },
  eyebrow:     { fontFamily: fonts.uiSemi,        fontSize: 10,   lineHeight: 12, letterSpacing: 1.8, textTransform: 'uppercase' as const },
  chipLabel:   { fontFamily: fonts.uiSemi,        fontSize: 10.5, lineHeight: 12, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  numTabular:  { fontFamily: fonts.displayMedium, fontSize: 24, lineHeight: 24, letterSpacing: -0.25, fontVariant: ['tabular-nums'] as any },
};

// Convenience: pick theme by mode
export const themes = { light, dark };
export type ThemeName = keyof typeof themes;
