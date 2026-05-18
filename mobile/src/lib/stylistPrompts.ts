// Stylist prompt rotation.
//
// The Home → "Ask the stylist" CTA shows a rotating example prompt so
// users see a different conversation starter each time they open the
// home screen — without this, returning users see the same line every
// session and the surface feels static. Tapping the row navigates to
// StyleChat with the currently displayed prompt as `initialDraft`, so
// what the user sees in the home card is exactly what lands in the
// composer (no jarring switch between teaser-copy and what gets sent).
//
// Rotation is per-mount (HomeScreen unmounts when the user navigates
// away, mounts again on return) — frequent enough that returning users
// see fresh prompts, stable enough that the chip doesn't shuffle while
// they're looking at it. `useStylistPromptKey()` wraps the random pick
// in `useMemo([])` so the chosen key is stable for one mount.
//
// Localization: each prompt has a dedicated i18n key with the literal
// `home.askStylist.prompts.<n>` shape. Locales that haven't received a
// translation yet fall back to the key string at the `t()` layer (the
// existing i18n loader behavior). For now en + sv carry the full set.

import { useMemo } from 'react';

/**
 * i18n keys for the home prompt rotation pool. Order is the canonical
 * launch order; rotation picks one uniformly at random per HomeScreen
 * mount. Each key resolves to a short, concrete prompt a user can tap
 * to seed the StyleChat composer.
 */
export const STYLIST_PROMPT_KEYS = [
  'home.askStylist.prompts.0',
  'home.askStylist.prompts.1',
  'home.askStylist.prompts.2',
  'home.askStylist.prompts.3',
  'home.askStylist.prompts.4',
  'home.askStylist.prompts.5',
] as const;

export type StylistPromptKey = (typeof STYLIST_PROMPT_KEYS)[number];

/**
 * Pick a fresh prompt key for this mount. The choice is stable across
 * re-renders of the same HomeScreen instance via `useMemo([])`, and
 * re-rolled the next time HomeScreen mounts (i.e. when the user comes
 * back to home from another screen, or relaunches the app).
 */
export function useStylistPromptKey(): StylistPromptKey {
  return useMemo<StylistPromptKey>(() => {
    const idx = Math.floor(Math.random() * STYLIST_PROMPT_KEYS.length);
    return STYLIST_PROMPT_KEYS[idx] ?? STYLIST_PROMPT_KEYS[0];
  }, []);
}
