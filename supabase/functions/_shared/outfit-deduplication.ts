/**
 * outfit-deduplication.ts — Outfit identity helpers.
 *
 * Phase 5b. The audit identified three dedup edge cases the engine handles
 * around the variety log:
 *
 *   1. Exact match — same garment id-set. The hash collision is what the
 *      `style_engine_suggestion_log` row writes look up against.
 *   2. Color swap — same slot+subcategory+fit, only the colors differ.
 *      Two outfits that share silhouette+role should count as "the same
 *      look in a different palette" when measuring rotation.
 *   3. Silhouette swap — same slot+subcategory+colors, only the fits
 *      differ. "The same palette in a different cut" — also counts as
 *      visually adjacent, even though id-sets diverge.
 *
 * These helpers are pure: no DB access, no time-dependent inputs.
 */

import type { ComboItem } from "./outfit-scoring.ts";

/**
 * Canonical string fingerprint for a set of garment ids. Sorted lexically
 * and joined with `|` so an identical set hashes identically regardless of
 * insertion order. This must stay byte-stable — the orchestrator's
 * `style_engine_suggestion_log.outfit_hash` writes compare against the
 * same shape on later requests.
 */
export function hashOutfit(itemIds: string[]): string {
  return [...itemIds].sort().join("|");
}

/**
 * Two outfits are an exact match when their garment id-sets are equal.
 */
export function isExactMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return hashOutfit(a) === hashOutfit(b);
}

interface ItemFingerprint {
  slot: string;
  subcategory: string;
  fit: string;
  color: string;
}

function fingerprint(item: ComboItem): ItemFingerprint {
  return {
    slot: item.slot,
    subcategory: (item.garment.subcategory || item.garment.category || "").toLowerCase(),
    fit: (item.garment.fit || "").toLowerCase(),
    color: (item.garment.color_primary || "").toLowerCase(),
  };
}

/**
 * Sort by the invariant keys for whichever swap we're testing. The
 * "variable" axis (color for a color swap, fit for a silhouette swap)
 * must NOT participate in the sort — otherwise two outfits that swap
 * the variable axis between matching-invariant items get paired by the
 * variable axis instead of the invariants, and the comparison spuriously
 * fails. E.g. `slim/red + oversized/blue` vs `slim/blue + oversized/red`
 * is a true color swap, but sorting by color would pair slim-red with
 * oversized-red and report a fit mismatch.
 */
function sortByInvariants(
  items: ComboItem[],
  tiebreaker: "fit" | "color",
): ItemFingerprint[] {
  return [...items].map(fingerprint).sort((x, y) => {
    if (x.slot !== y.slot) return x.slot.localeCompare(y.slot);
    if (x.subcategory !== y.subcategory) return x.subcategory.localeCompare(y.subcategory);
    return x[tiebreaker].localeCompare(y[tiebreaker]);
  });
}

function sameLength<T>(a: T[], b: T[]): boolean {
  return a.length === b.length;
}

/**
 * Two outfits are a "color swap" when the slot + subcategory + fit
 * vectors match item-for-item but at least one color differs. This
 * captures variants that are visually the same look in a different
 * palette — they should still register as low-variety repeats.
 */
export function isColorSwap(a: ComboItem[], b: ComboItem[]): boolean {
  if (!sameLength(a, b) || a.length === 0) return false;
  // Sort by the invariant keys (slot, subcategory, fit). Color is the
  // axis allowed to differ, so it must not be a sort key.
  const fa = sortByInvariants(a, "fit");
  const fb = sortByInvariants(b, "fit");
  let colorDiff = 0;
  for (let i = 0; i < fa.length; i++) {
    if (fa[i].slot !== fb[i].slot) return false;
    if (fa[i].subcategory !== fb[i].subcategory) return false;
    if (fa[i].fit !== fb[i].fit) return false;
    if (fa[i].color !== fb[i].color) colorDiff++;
  }
  return colorDiff > 0;
}

/**
 * Two outfits are a "silhouette swap" when slot + subcategory + color
 * vectors match item-for-item but at least one fit differs. This
 * captures the "same palette in a different cut" case the variety
 * tracker should not treat as wholly new.
 */
export function isSilhouetteSwap(a: ComboItem[], b: ComboItem[]): boolean {
  if (!sameLength(a, b) || a.length === 0) return false;
  // Sort by the invariant keys (slot, subcategory, color). Fit is the
  // axis allowed to differ, so it must not be a sort key.
  const fa = sortByInvariants(a, "color");
  const fb = sortByInvariants(b, "color");
  let fitDiff = 0;
  for (let i = 0; i < fa.length; i++) {
    if (fa[i].slot !== fb[i].slot) return false;
    if (fa[i].subcategory !== fb[i].subcategory) return false;
    if (fa[i].color !== fb[i].color) return false;
    if (fa[i].fit !== fb[i].fit) fitDiff++;
  }
  return fitDiff > 0;
}
