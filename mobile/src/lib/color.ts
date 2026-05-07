// Shared color helpers for onboarding swatch grids.
//
// Extracted (M26 review) so AccentColorStep and StyleQuizV4Step share a
// single definition rather than maintaining drifting copies.

/**
 * Perceptual-luminance threshold: returns true when a swatch is light enough
 * that a dark icon overlay reads better than a light one. Uses the standard
 * Rec. 601 weights; threshold 200/255 is empirically tuned against the
 * curated palettes used across onboarding.
 *
 * Returns false for malformed hex input (defensive — the curated palettes
 * are static, but the helper is exported and may be fed user-derived input
 * in future surfaces).
 */
export function isLightSwatch(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return r * 0.299 + g * 0.587 + b * 0.114 > 200;
}
