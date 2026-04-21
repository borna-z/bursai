/**
 * Shared garment-category classifier for the render pipeline.
 *
 * Wave 3-B fix 10 (Codex P2 round 7) extracted this from
 * `render_garment_image/index.ts` into a shared module so both the prompt
 * builder and the output validator (`_shared/render-eligibility.ts`) use
 * the SAME routing decision. Before the extract, the validator's unknown-
 * category branch fell through to the accessory prompt while the prompt
 * builder's unknown-category branch defaulted to ghost-mannequin —
 * non-canonical `garments.category` values produced systematic
 * `reject_wrong_category` rejections on otherwise-valid renders.
 *
 * Consumers:
 *   - supabase/functions/render_garment_image/index.ts (prompt routing)
 *   - supabase/functions/_shared/render-eligibility.ts (validation routing)
 *
 * Keep imports on both sides pinned to this module. If a new consumer
 * needs the classification, import from here rather than re-implementing.
 */

export type CategoryClass =
  | 'ghost_mannequin'
  | 'shoes'
  | 'bag'
  | 'flat_lay'
  | 'jewelry'
  | 'accessory_generic';

export const GHOST_MANNEQUIN_CATEGORIES = new Set<string>([
  'top', 'tops', 'bottom', 'bottoms', 'dress', 'dresses', 'outerwear',
]);

export const SHOE_CATEGORIES = new Set<string>([
  'shoes', 'shoe', 'footwear',
]);

export const BAG_SUBCATEGORY_HINTS = [
  'bag', 'handbag', 'backpack', 'tote', 'clutch', 'satchel',
];
export const FLAT_LAY_SUBCATEGORY_HINTS = [
  'scarf', 'hat', 'beanie', 'cap', 'gloves', 'belt', 'tie',
];
export const JEWELRY_SUBCATEGORY_HINTS = [
  'jewelry', 'jewellery', 'watch', 'ring', 'necklace', 'bracelet', 'earring',
];

/**
 * Map (category, subcategory) to one of 6 presentation classes.
 *
 * Branch order:
 *   1. Known wearable category (tops/bottoms/dresses/outerwear) → ghost_mannequin
 *   2. Known shoe category (shoes/shoe/footwear)                 → shoes
 *   3. Explicit 'accessory'/'accessories' category               → routed by subcategory
 *   4. Anything else (unknown)                                   → ghost_mannequin (safe default)
 *
 * The unknown-category fallback matches the pre-Wave-3-B historical
 * behavior (every garment rendered as ghost-mannequin). Choosing anything
 * else would produce false rejections for garments that happen to be
 * mis-tagged or have legacy category strings.
 */
export function classifyCategory(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): CategoryClass {
  const cat = (category ?? '').toLowerCase();
  const sub = (subcategory ?? '').toLowerCase();

  if (GHOST_MANNEQUIN_CATEGORIES.has(cat)) return 'ghost_mannequin';
  if (SHOE_CATEGORIES.has(cat)) return 'shoes';
  if (cat === 'accessory' || cat === 'accessories') {
    if (BAG_SUBCATEGORY_HINTS.some((hint) => sub.includes(hint))) return 'bag';
    if (JEWELRY_SUBCATEGORY_HINTS.some((hint) => sub.includes(hint))) return 'jewelry';
    if (FLAT_LAY_SUBCATEGORY_HINTS.some((hint) => sub.includes(hint))) return 'flat_lay';
    return 'accessory_generic';
  }
  // Unknown category → ghost mannequin (historical default).
  return 'ghost_mannequin';
}
