// Pure helpers + constants extracted from SettingsStyleScreen.tsx (N13).
// No React hooks; safe to unit-test directly.

import {
  defaultStyleProfileV4,
  parseStyleProfileV4,
  type FitOverall,
  type PaletteVibe,
  type PatternComfort,
  type StyleProfileV4,
} from '../lib/styleProfileV4';

// ─── Limits (web parity) ────────────────────────────────────────────────────

export const ARCHETYPE_MIN = 3;
export const ARCHETYPE_MAX = 5;
export const FAVORITE_COLORS_MAX = 3;
export const DISLIKED_COLORS_MAX = 3;

// Single-select option lists. The `as const` on the source arrays in
// styleProfileV4.ts keeps these readonly literal-union typed.
export const FIT_OVERALLS: readonly FitOverall[] = [
  'fitted',
  'regular',
  'relaxed',
  'oversized',
  'mixed',
] as const;
export const PALETTE_VIBES: readonly PaletteVibe[] = [
  'neutrals',
  'bold',
  'dark',
  'pastels',
  'earth',
  'mixed',
] as const;
export const PATTERN_COMFORTS: readonly PatternComfort[] = [
  'love',
  'some',
  'minimal',
  'solids_only',
] as const;

// Ordered ids for the section list. Each value is also the i18n key fragment
// (`settingsStyle.section.<id>.title` / `.summary`).
export const SECTION_IDS = [
  'archetype',
  'formality',
  'palette',
  'fits',
  'occasions',
  'vibes',
  'pattern',
  'disliked',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** "Updated Nh ago" — minimal bucket logic, no date-fns dependency.
 * Returns null when the timestamp is missing or unparseable so the
 * caller can hide the freshness caption rather than show "just now"
 * for a row that's actually decades stale. */
export function formatUpdatedAgo(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return 'Updated just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

/** Pull the current V4 profile from AuthContext-cached preferences. Falls
 * back to defaults when no quiz has been answered yet — this lets a user
 * who skipped onboarding land on SettingsStyle and start picking values. */
export function readCurrentV4FromProfile(prefs: unknown): StyleProfileV4 {
  if (!prefs || typeof prefs !== 'object') return defaultStyleProfileV4();
  const obj = prefs as Record<string, unknown>;
  const raw = obj['style_profile_v4_jsonb'] ?? obj['style_profile_v4'];
  if (!raw) return defaultStyleProfileV4();
  return parseStyleProfileV4(raw);
}

export type DirtyMap = Record<SectionId, boolean>;

export const EMPTY_DIRTY_MAP: DirtyMap = {
  archetype: false,
  formality: false,
  palette: false,
  fits: false,
  occasions: false,
  vibes: false,
  pattern: false,
  disliked: false,
};
