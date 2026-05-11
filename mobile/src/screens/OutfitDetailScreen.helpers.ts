// Pure helpers + constants extracted from OutfitDetailScreen.tsx (N13).
// No React hooks; safe to unit-test directly.

// M37 — anchor persistence. The `outfits` table has no `anchor_garment_id`
// column and the per-PR rules forbid running a migration without explicit
// user direction, so the lock state lives in AsyncStorage keyed by user +
// outfit. The anchor is fundamentally a regeneration-time concept (passed
// to the engine via `prefer_garment_ids`); persisting locally is enough to
// satisfy the wave's "reopen → anchor still shown" gate while keeping the
// surface migration-free.
export const ANCHOR_STORAGE_PREFIX = 'm37:outfitAnchor:';

export function anchorStorageKey(userId: string, outfitId: string): string {
  return `${ANCHOR_STORAGE_PREFIX}${userId}:${outfitId}`;
}
