import {
  inferOutfitSlotFromGarment,
  validateBaseOutfit,
  type BasicGarmentLike,
} from './outfitValidation.ts';

export type OutfitIdGarment = BasicGarmentLike & {
  id?: string | null;
  title?: string | null;
  layering_role?: string | null;
};

export function resolveCompleteOutfitIds<TGarment extends OutfitIdGarment>(
  ids: string[],
  garmentById: Map<string, TGarment>,
): string[] {
  const filteredIds = ids.filter((id): id is string => typeof id === 'string' && garmentById.has(id));
  if (filteredIds.length < 2) return [];

  const seenSlots = new Set<string>();
  for (const id of filteredIds) {
    const garment = garmentById.get(id);
    if (!garment) continue;
    const slot = inferOutfitSlotFromGarment(garment);
    if (!slot) continue;
    if (seenSlots.has(slot)) return [];
    seenSlots.add(slot);
  }

  // Use validateBaseOutfit (requireShoes: false) — outfits without shoes still
  // render a card. The card itself shows a "missing shoes" warning if needed.
  const validation = validateBaseOutfit(
    filteredIds.map((id) => ({
      garment: garmentById.get(id) || null,
    })),
  );

  return validation.isValid ? filteredIds : [];
}
