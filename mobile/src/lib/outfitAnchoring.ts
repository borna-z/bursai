// Outfit anchor locking — keeps a chosen garment "locked" across regenerations.
//
// Web's `src/lib/outfitAnchoring.ts` exposes only the preferred-IDs helpers
// (`normalizePreferredGarmentIds`, `hasPreferredGarmentMatch`). Mobile reuses
// those for the `prefer_garment_ids` payload to `burs_style_engine`, and
// adds the post-response enforcement helpers below — the wave promises
// "anchor stays in every result" but the engine only honours `prefer_*` as
// a soft preference, so the client has to verify and report drift.
//
// Pure functions — no React, no network. Used by useGenerateOutfit
// (anchorGarmentId pass-through + post-validate) and by the screens to
// surface "Anchor locked: X" status.

import {
  inferCanonicalOutfitSlot,
  type CanonicalOutfitSlot,
  type OutfitRuleGarmentLike,
} from './outfitRules';

// ─── Web-parity helpers ──────────────────────────────────────────────────────
// Identical to web's `src/lib/outfitAnchoring.ts`. Do not drift.

export function normalizePreferredGarmentIds(ids: Iterable<string | null | undefined>): string[] {
  const uniqueIds = new Set<string>();

  for (const value of ids) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    uniqueIds.add(trimmed);
  }

  return Array.from(uniqueIds);
}

export function hasPreferredGarmentMatch(
  garmentIds: Iterable<string | null | undefined>,
  preferredGarmentIds: Iterable<string | null | undefined>,
): boolean {
  const preferredIds = new Set(normalizePreferredGarmentIds(preferredGarmentIds));
  if (preferredIds.size === 0) return true;

  for (const garmentId of garmentIds) {
    if (typeof garmentId !== 'string') continue;
    if (preferredIds.has(garmentId.trim())) return true;
  }

  return false;
}

// ─── Mobile-only anchor enforcement ──────────────────────────────────────────
// The wave's "anchor stays" UX promise lives here. The engine treats
// prefer_garment_ids as a soft hint; the client verifies the response actually
// includes the anchor and surfaces a drift signal so the screen can warn
// (or auto-regenerate, depending on caller policy).

export type LockedSlots = Partial<Record<CanonicalOutfitSlot, string>>;

/**
 * Build a {slot: garmentId} map from a list of garments + a chosen anchor.
 * The slot is inferred from the anchor garment's category/subcategory; this
 * is the structure the engine consumes when client-side rules want to
 * pre-declare "this slot is taken".
 */
export function applyAnchor<TGarment extends OutfitRuleGarmentLike & { id?: string }>(
  garments: TGarment[],
  anchorId: string | null | undefined,
): LockedSlots {
  const trimmed = (anchorId ?? '').trim();
  if (!trimmed) return {};
  const anchor = garments.find((g) => (g.id ?? '').trim() === trimmed);
  if (!anchor) return {};
  const slot = inferCanonicalOutfitSlot(anchor);
  if (slot === 'unknown') return {};
  return { [slot]: trimmed };
}

/**
 * After the engine returns, confirm the anchor garment id appears in the
 * generated items. Returns false when the anchor was requested but the
 * engine ignored the preference — caller decides whether to retry, warn,
 * or proceed.
 */
export function isAnchorPresent(
  itemGarmentIds: Iterable<string | null | undefined>,
  anchorId: string | null | undefined,
): boolean {
  const trimmed = (anchorId ?? '').trim();
  if (!trimmed) return true;
  for (const id of itemGarmentIds) {
    if (typeof id === 'string' && id.trim() === trimmed) return true;
  }
  return false;
}
