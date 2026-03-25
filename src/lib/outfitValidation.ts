import type { Tables } from '@/integrations/supabase/types';

export type BasicGarmentLike = Pick<Tables<'garments'>, 'category' | 'subcategory'> & {
  id?: string;
  title?: string | null;
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

const DRESS_TOKENS = ['dress', 'jumpsuit', 'overall', 'fullbody', 'full body', 'romper', 'klänning'];
const SHOES_TOKENS = ['shoes', 'shoe', 'sneakers', 'boots', 'heels', 'sandals', 'loafers', 'skor', 'stövlar'];
const OUTERWEAR_TOKENS = ['outerwear', 'coat', 'jacket', 'blazer', 'trench', 'jacka', 'kappa'];
const ACCESSORY_TOKENS = ['accessory', 'bag', 'hat', 'belt', 'scarf', 'smycke', 'väska'];
const BOTTOM_TOKENS = ['bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'byxor', 'kjol'];

function normalizeTokenValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function inferOutfitSlotFromGarment(garment: Pick<BasicGarmentLike, 'category' | 'subcategory'>): string {
  const category = normalizeTokenValue(garment.category);
  const subcategory = normalizeTokenValue(garment.subcategory);
  const value = `${category} ${subcategory}`.trim();

  if (DRESS_TOKENS.some((token) => value.includes(token))) return 'dress';
  if (SHOES_TOKENS.some((token) => value.includes(token))) return 'shoes';
  if (OUTERWEAR_TOKENS.some((token) => value.includes(token))) return 'outerwear';
  if (ACCESSORY_TOKENS.some((token) => value.includes(token))) return 'accessory';
  if (BOTTOM_TOKENS.some((token) => value.includes(token))) return 'bottom';
  return 'top';
}

export function normalizeOutfitItemSlot<TGarment extends BasicGarmentLike>(item: OutfitValidationItem<TGarment>): string {
  const explicitSlot = normalizeTokenValue(item.slot);
  if (explicitSlot === 'fullbody' || explicitSlot === 'full_body') return 'dress';
  if (explicitSlot) return explicitSlot;
  if (item.garment) return inferOutfitSlotFromGarment(item.garment);
  return '';
}

export function validateBaseOutfit<TGarment extends BasicGarmentLike>(items: OutfitValidationItem<TGarment>[]): OutfitValidationResult {
  const presentSlots = Array.from(new Set(items.map((item) => normalizeOutfitItemSlot(item)).filter(Boolean)));
  const slots = new Set(presentSlots);
  const hasDressBase = slots.has('dress');
  const hasStandardBase = slots.has('top') && slots.has('bottom');
  const missing: Array<'top' | 'bottom' | 'dress'> = [];

  if (!hasDressBase && !slots.has('top')) missing.push('top');
  if (!hasDressBase && !slots.has('bottom')) missing.push('bottom');
  if (!hasDressBase && !hasStandardBase && missing.length === 0) missing.push('dress');

  return {
    isValid: hasDressBase || hasStandardBase,
    isStandard: hasStandardBase,
    isDressBased: hasDressBase,
    missing,
    presentSlots,
  };
}


function requiresOuterwear(weather?: OutfitWeatherContext): boolean {
  if (!weather) return false;
  const temp = weather.temperature;
  const precipitation = normalizeTokenValue(weather.precipitation);
  const wind = normalizeTokenValue(weather.wind);
  const coldEnough = temp !== undefined && temp < 8;
  const wet = precipitation !== '' && !['none', 'ingen'].includes(precipitation);
  const snowy = precipitation.includes('snow') || precipitation.includes('snö');
  const highWind = wind === 'high' || wind === 'hög';
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
  const baseValidation = validateBaseOutfit(items);
  const slots = new Set(baseValidation.presentSlots);
  const hasShoes = slots.has('shoes');
  const missing: CompleteOutfitValidationResult['missing'] = [...baseValidation.missing];

  if (!hasShoes) missing.push('shoes');

  return {
    ...baseValidation,
    isValid: baseValidation.isValid && hasShoes,
    missing,
  };
}

export function filterValidCompleteOutfits<T extends { outfit_items?: OutfitValidationItem[] | null }>(outfits: T[]): T[] {
  return outfits.filter((outfit) => validateCompleteOutfit(outfit.outfit_items || []).isValid);
}
