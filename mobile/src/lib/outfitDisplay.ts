// Display helpers for outfits. Centralised so HomeScreen / PlanScreen /
// OutfitsScreen / OutfitDetail / MonthCalendar all derive the same name and
// gradient hue from a given row — keeps the visual rhythm consistent across
// the app and means a future schema change to the display-name source list
// only touches one place.
//
// Name resolution order: occasion → style_vibe → family_label → explanation
// (truncated). The `outfits` schema doesn't carry a single canonical
// human-readable name, so we walk a fallback chain. `explanation` is the
// AI-generated long-form description so we cap it at 40 chars to avoid
// cards filled with prose.
//
// `outfitGradientHue` mirrors the djb2 hash used in GarmentCard's id-based
// fallback so an outfit and its garments share the same colour family when
// no real photo is loaded yet.

import { inferOutfitSlotFromGarment } from './outfitValidation';
import type { OutfitItemWithGarment } from '../types/outfit';

type OutfitDisplaySource = {
  occasion?: string | null;
  style_vibe?: string | null;
  family_label?: string | null;
  explanation?: string | null;
} | null | undefined;

export function outfitDisplayName(outfit: OutfitDisplaySource, fallback = 'Outfit'): string {
  if (!outfit) return fallback;
  const occasion = outfit.occasion?.trim();
  if (occasion) return occasion;
  const vibe = outfit.style_vibe?.trim();
  if (vibe) return vibe;
  const family = outfit.family_label?.trim();
  if (family) return family;
  const explanation = outfit.explanation?.trim();
  if (explanation) return explanation.length > 40 ? `${explanation.slice(0, 40)}…` : explanation;
  return fallback;
}

export function outfitGradientHue(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

// Local-date YYYY-MM-DD. Mirrors the helper inlined in PlanScreen / MonthCalendar
// — exported here so the hook layer can use it without each screen redeclaring.
// `Date.prototype.toISOString().slice(0,10)` converts to UTC first, so a local
// midnight in CET (UTC+1) returns yesterday's date — wrong for hydrating
// queries against the day the user actually sees.
export function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── M37 — slot composition helpers ──────────────────────────────────────
// Mobile's OutfitDetailScreen used to render outfit_items as a flat horizontal
// strip. Web shows them slotted (TOP / LAYER / BOTTOM / DRESS / SHOES /
// OUTERWEAR / ACCESSORY) with per-slot Swap / Anchor / Remove actions. This
// helper bucketizes a row's outfit_items into the visual order the screen
// renders, honouring M13's `inferOutfitSlotFromGarment` so the same canonical
// rules drive both the engine path AND the display path.

export type DisplaySlot =
  | 'top'
  | 'layer'
  | 'bottom'
  | 'dress'
  | 'shoes'
  | 'outerwear'
  | 'accessory';

export const DISPLAY_SLOT_ORDER: DisplaySlot[] = [
  'top',
  'layer',
  'bottom',
  'dress',
  'shoes',
  'outerwear',
  'accessory',
];

export interface DisplaySlotGroup {
  slot: DisplaySlot;
  items: OutfitItemWithGarment[];
}

// Resolve a `top`-bucketed item to either `top` (base layer) or `layer`
// (mid layer worn over a base). The garments schema doesn't carry a
// persisted `layering_role`, so the bucket is ordinal: the first `top` we
// encounter wins the base slot, subsequent tops roll into `layer`. Outerwear
// is its own slot and never reaches this branch.
function resolveTopBucket(topBaseSeen: boolean): 'top' | 'layer' {
  return topBaseSeen ? 'layer' : 'top';
}

/**
 * Group an outfit's items into visual display slots. Ports web's slot
 * composition for OutfitDetail to mobile.
 *
 * Resolution rules (in priority order):
 *   1) An explicit `outfit_items.slot` value that matches a display slot is
 *      honoured directly. The engine writes lowercase canonical slots, so
 *      this covers the common case.
 *   2) Otherwise the item's garment is run through `inferOutfitSlotFromGarment`
 *      (M13's canonical inference) and the result is bucketed.
 *   3) `top` items split into `top` vs `layer` via `resolveTopBucket`.
 *
 * Items are grouped without dropping anything — an unknown slot falls back
 * to `accessory` so the user can still see + remove an orphan piece.
 */
export function groupGarmentsBySlot(
  items: OutfitItemWithGarment[] | null | undefined,
): DisplaySlotGroup[] {
  const buckets = new Map<DisplaySlot, OutfitItemWithGarment[]>();
  for (const slot of DISPLAY_SLOT_ORDER) buckets.set(slot, []);
  let topBaseSeen = false;

  for (const item of items ?? []) {
    const explicit = (item.slot ?? '').toString().toLowerCase().trim();
    let display: DisplaySlot;

    if (explicit === 'layer') {
      display = 'layer';
    } else if (
      explicit === 'top'
      || explicit === 'bottom'
      || explicit === 'dress'
      || explicit === 'shoes'
      || explicit === 'outerwear'
      || explicit === 'accessory'
    ) {
      display = explicit as DisplaySlot;
    } else {
      const inferred = inferOutfitSlotFromGarment(item.garment ?? {});
      display = (inferred === 'unknown' ? 'accessory' : inferred) as DisplaySlot;
    }

    if (display === 'top') {
      const resolved = resolveTopBucket(topBaseSeen);
      buckets.get(resolved)!.push(item);
      if (resolved === 'top') topBaseSeen = true;
    } else {
      buckets.get(display)!.push(item);
    }
  }

  return DISPLAY_SLOT_ORDER
    .map((slot) => ({ slot, items: buckets.get(slot) ?? [] }))
    .filter((group) => group.items.length > 0);
}
