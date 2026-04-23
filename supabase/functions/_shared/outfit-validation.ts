import {
  hasCompleteOutfitPath,
  inferCanonicalOutfitSlot,
  normalizeOutfitRuleSlot,
  type OutfitRuleGarmentLike,
  type OutfitRuleItem,
  validateOutfitItems,
} from './outfit-rules.ts';

export type BasicGarmentLike = OutfitRuleGarmentLike & {
  id?: string;
};

export type OutfitValidationItem<TGarment extends BasicGarmentLike = BasicGarmentLike> = {
  slot?: string | null;
  garment?: TGarment | null;
};

export interface OutfitValidationResult {
  isValid: boolean;
  isStandard: boolean;
  isDressBased: boolean;
  missing: Array<'top' | 'bottom' | 'dress'>;
  presentSlots: string[];
}

export interface CompleteOutfitValidationResult extends Omit<OutfitValidationResult, 'missing'> {
  missing: Array<'top' | 'bottom' | 'dress' | 'shoes' | 'outerwear'>;
}

export interface OutfitWeatherContext {
  temperature?: number;
  precipitation?: string | null;
  wind?: string | null;
}

function normalizeTokenValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function inferOutfitSlotFromGarment(garment: Pick<BasicGarmentLike, 'category' | 'subcategory'>): string {
  return inferCanonicalOutfitSlot(garment);
}

export function canBuildCompleteOutfitPath<TGarment extends BasicGarmentLike>(
  garments: Array<Pick<TGarment, 'category' | 'subcategory'>>,
): boolean {
  return hasCompleteOutfitPath(garments as Array<Pick<OutfitRuleGarmentLike, 'category' | 'subcategory'>>);
}

export function normalizeOutfitItemSlot<TGarment extends BasicGarmentLike>(item: OutfitValidationItem<TGarment>): string {
  const slot = normalizeOutfitRuleSlot(item as OutfitRuleItem<TGarment>);
  return slot === 'unknown' ? '' : slot;
}

export function validateBaseOutfit<TGarment extends BasicGarmentLike>(items: OutfitValidationItem<TGarment>[]): OutfitValidationResult {
  const validation = validateOutfitItems(items as OutfitRuleItem<TGarment>[], {
    requireShoes: false,
    allowLayeredTops: true,
  });

  return {
    isValid: validation.isValid,
    isStandard: validation.isStandard,
    isDressBased: validation.isDressBased,
    missing: validation.missing.filter((slot): slot is 'top' | 'bottom' | 'dress' => slot !== 'shoes'),
    presentSlots: validation.presentSlots.filter((slot) => slot !== 'unknown'),
  };
}

function requiresOuterwear(weather?: OutfitWeatherContext): boolean {
  if (!weather) return false;
  const temp = weather.temperature;
  const precipitation = normalizeTokenValue(weather.precipitation);
  const wind = normalizeTokenValue(weather.wind);
  const coldEnough = temp !== undefined && temp < 8;
  const wet = precipitation !== '' && !['none', 'ingen'].includes(precipitation);
  const snowy = precipitation.includes('snow') || precipitation.includes('sno');
  const highWind = wind === 'high' || wind === 'hog' || wind === 'hög';
  return coldEnough || wet || snowy || highWind;
}

export function getVisibleOutfitMissingSlots<TGarment extends BasicGarmentLike>(
  items: OutfitValidationItem<TGarment>[],
  weather?: OutfitWeatherContext,
): CompleteOutfitValidationResult['missing'] {
  const validation = validateCompleteOutfit(items);
  const missing = [...validation.missing];
  const slots = new Set(validation.presentSlots);

  if (requiresOuterwear(weather) && !slots.has('outerwear')) {
    missing.push('outerwear');
  }

  return Array.from(new Set(missing));
}

export function canBuildVisibleOutfit<TGarment extends BasicGarmentLike>(
  items: OutfitValidationItem<TGarment>[],
  weather?: OutfitWeatherContext,
): boolean {
  return getVisibleOutfitMissingSlots(items, weather).length === 0;
}

export function filterValidBaseOutfits<T extends { outfit_items?: OutfitValidationItem[] | null }>(outfits: T[]): T[] {
  return outfits.filter((outfit) => validateBaseOutfit(outfit.outfit_items || []).isValid);
}

export function validateCompleteOutfit<TGarment extends BasicGarmentLike>(items: OutfitValidationItem<TGarment>[]): CompleteOutfitValidationResult {
  const validation = validateOutfitItems(items as OutfitRuleItem<TGarment>[], {
    requireShoes: true,
    allowLayeredTops: true,
  });

  return {
    isValid: validation.isValid,
    isStandard: validation.isStandard,
    isDressBased: validation.isDressBased,
    missing: validation.missing,
    presentSlots: validation.presentSlots.filter((slot) => slot !== 'unknown'),
  };
}

export function filterValidCompleteOutfits<T extends { outfit_items?: OutfitValidationItem[] | null }>(outfits: T[]): T[] {
  return outfits.filter((outfit) => validateCompleteOutfit(outfit.outfit_items || []).isValid);
}
