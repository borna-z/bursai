// Style-DNA color samples — these are NOT theme tokens. They represent the user's
// chosen wardrobe palette (cream, sand, brown, black, navy, olive). Hardcoded hex is
// allowed here per CLAUDE.md's "named color-data constants" exception. Do not use these
// for chrome / borders / type — those come from `tokens.ts` via `useTokens()`.
//
// Single source of truth for both `ProfileScreen` and `SettingsStyleScreen`. Codex
// audit P2.1 — was previously duplicated across two screens.
//
// When the live style profile lands, these become the user's actual `favoriteColors`
// from `preferences.styleProfile.favoriteColors` and the constant goes away.

export const FAVORITE_COLOR_SAMPLES = [
  '#F4ECDD', // cream
  '#C8B89C', // sand
  '#8B6F4E', // brown
  '#1D1916', // charcoal
  '#2E3B4E', // navy
  '#A8966C', // olive
] as const;
