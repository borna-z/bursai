import { classifySlot, normalizeSlot } from './burs-slots.ts';

export type CanonicalOutfitSlot =
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'dress'
  | 'outerwear'
  | 'accessory'
  | 'unknown';

export type CanonicalLayerRole = 'base' | 'mid' | 'outer' | 'standalone' | 'unknown';

export interface OutfitRuleGarmentLike {
  title?: string | null;
  category?: string | null;
  subcategory?: string | null;
  layering_role?: string | null;
}

export interface OutfitRuleItem<TGarment extends OutfitRuleGarmentLike = OutfitRuleGarmentLike> {
  slot?: string | null;
  garment?: TGarment | null;
}

export interface ValidateOutfitOptions {
  requireShoes?: boolean;
  allowLayeredTops?: boolean;
}

export interface ValidateOutfitResult {
  isValid: boolean;
  isStandard: boolean;
  isDressBased: boolean;
  missing: Array<'top' | 'bottom' | 'dress' | 'shoes'>;
  presentSlots: CanonicalOutfitSlot[];
  duplicateSlots: CanonicalOutfitSlot[];
  conflictingSlots: CanonicalOutfitSlot[];
  invalidSlots: CanonicalOutfitSlot[];
  duplicateGarmentIds: string[];
  topLayerRoles: CanonicalLayerRole[];
}

const DRESS_TOKENS = ['dress', 'jumpsuit', 'overall', 'fullbody', 'full body', 'romper', 'klanning', 'klänning'];
const SHOES_TOKENS = ['shoes', 'shoe', 'sneakers', 'boots', 'heels', 'sandals', 'loafers', 'footwear', 'skor', 'stovlar', 'stövlar'];
const OUTERWEAR_TOKENS = ['outerwear', 'coat', 'jacket', 'blazer', 'trench', 'parka', 'windbreaker', 'jacka', 'kappa', 'rock'];
const ACCESSORY_TOKENS = ['accessory', 'bag', 'hat', 'belt', 'scarf', 'jewelry', 'smycke', 'vaska', 'väska'];
const BOTTOM_TOKENS = ['bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'chinos', 'leggings', 'culottes', 'byxor', 'kjol'];

const BASE_LAYER_TOKENS = [
  't-shirt',
  'tshirt',
  't_shirt',
  'tee',
  'shirt',
  'dress shirt',
  'dress_shirt',
  'fitted shirt',
  'polo',
  'blouse',
  'tank',
  'tank top',
  'tank_top',
  'cami',
  'camisole',
  'turtleneck',
  'roll neck',
  'roll_neck',
  'crewneck',
  'crew neck',
  'henley',
  'linne',
];

const MID_LAYER_TOKENS = [
  'cardigan',
  'overshirt',
  'hoodie',
  'zip-up',
  'zip up',
  'fleece',
  'chunky knit',
  'shawl collar',
  'open-front',
  'open front',
  'shirt jacket',
  'shacket',
  'sweater',
  'knit',
  'vest',
  'vast',
  'väst',
];

const EXPLICIT_SLOT_MAP: Record<string, CanonicalOutfitSlot> = {
  top: 'top',
  shirt: 'top',
  't-shirt': 'top',
  tshirt: 'top',
  blouse: 'top',
  sweater: 'top',
  hoodie: 'top',
  polo: 'top',
  tank: 'top',
  tank_top: 'top',
  cardigan: 'top',
  troja: 'top',
  tröja: 'top',
  skjorta: 'top',
  knit: 'top',
  bottom: 'bottom',
  pants: 'bottom',
  jeans: 'bottom',
  trousers: 'bottom',
  shorts: 'bottom',
  skirt: 'bottom',
  chinos: 'bottom',
  byxor: 'bottom',
  kjol: 'bottom',
  leggings: 'bottom',
  culottes: 'bottom',
  shoes: 'shoes',
  sneakers: 'shoes',
  boots: 'shoes',
  loafers: 'shoes',
  sandals: 'shoes',
  heels: 'shoes',
  skor: 'shoes',
  stovlar: 'shoes',
  stövlar: 'shoes',
  footwear: 'shoes',
  trainers: 'shoes',
  oxfords: 'shoes',
  mules: 'shoes',
  outerwear: 'outerwear',
  jacket: 'outerwear',
  coat: 'outerwear',
  blazer: 'outerwear',
  parka: 'outerwear',
  windbreaker: 'outerwear',
  jacka: 'outerwear',
  kappa: 'outerwear',
  rock: 'outerwear',
  dress: 'dress',
  jumpsuit: 'dress',
  overall: 'dress',
  fullbody: 'dress',
  full_body: 'dress',
  klanning: 'dress',
  klänning: 'dress',
  accessory: 'accessory',
  bag: 'accessory',
  hat: 'accessory',
  scarf: 'accessory',
  belt: 'accessory',
};

function normalizeTokenValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function includesAnyToken(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

export function inferCanonicalOutfitSlot(
  garment: Pick<OutfitRuleGarmentLike, 'category' | 'subcategory'>,
): CanonicalOutfitSlot {
  return classifySlot(garment.category, garment.subcategory) ?? 'top';
}

export function collectCanonicalOutfitSlots(
  garments: Array<Pick<OutfitRuleGarmentLike, 'category' | 'subcategory'>>,
): CanonicalOutfitSlot[] {
  return Array.from(new Set(garments.map((garment) => inferCanonicalOutfitSlot(garment))));
}

export function hasCompleteOutfitPath(
  garments: Array<Pick<OutfitRuleGarmentLike, 'category' | 'subcategory'>>,
): boolean {
  const slots = new Set(collectCanonicalOutfitSlots(garments));
  const hasSeparates = slots.has('top') && slots.has('bottom') && slots.has('shoes');
  const hasDressPath = slots.has('dress') && slots.has('shoes');
  return hasSeparates || hasDressPath;
}

export function inferCanonicalLayerRole(garment: OutfitRuleGarmentLike): CanonicalLayerRole {
  const explicitRole = normalizeTokenValue(garment.layering_role);
  if (explicitRole === 'base' || explicitRole === 'mid' || explicitRole === 'outer' || explicitRole === 'standalone') {
    return explicitRole;
  }

  const value = [
    normalizeTokenValue(garment.title),
    normalizeTokenValue(garment.category),
    normalizeTokenValue(garment.subcategory),
  ].filter(Boolean).join(' ');

  if (includesAnyToken(value, OUTERWEAR_TOKENS)) return 'outer';
  if (includesAnyToken(value, MID_LAYER_TOKENS)) return 'mid';
  if (includesAnyToken(value, BASE_LAYER_TOKENS)) return 'base';
  return 'standalone';
}

export function normalizeOutfitRuleSlot<TGarment extends OutfitRuleGarmentLike>(
  item: OutfitRuleItem<TGarment>,
): CanonicalOutfitSlot {
  const explicitSlot = normalizeTokenValue(item.slot);
  if (explicitSlot) {
    const normalizedExplicitSlot = normalizeSlot(explicitSlot);
    if (normalizedExplicitSlot) {
      return normalizedExplicitSlot;
    }
  }
  if ('garment' in item) {
    if (item.garment) {
      return inferCanonicalOutfitSlot(item.garment);
    }
    return 'unknown';
  }
  return 'unknown';
}

export function validateOutfitItems<TGarment extends OutfitRuleGarmentLike>(
  items: OutfitRuleItem<TGarment>[],
  options: ValidateOutfitOptions = {},
): ValidateOutfitResult {
  const requireShoes = options.requireShoes ?? true;
  const allowLayeredTops = options.allowLayeredTops ?? true;

  const normalized = items.map((item) => ({
    slot: normalizeOutfitRuleSlot(item),
    layerRole: item.garment ? inferCanonicalLayerRole(item.garment) : 'unknown' as CanonicalLayerRole,
    garmentId: normalizeTokenValue((item.garment as { id?: string } | null | undefined)?.id),
  }));

  const slotCounts = new Map<CanonicalOutfitSlot, number>();
  const garmentIdCounts = new Map<string, number>();

  for (const item of normalized) {
    slotCounts.set(item.slot, (slotCounts.get(item.slot) || 0) + 1);
    if (item.garmentId) {
      garmentIdCounts.set(item.garmentId, (garmentIdCounts.get(item.garmentId) || 0) + 1);
    }
  }

  const presentSlots = Array.from(slotCounts.keys()).filter((slot) => slot !== 'unknown');
  const invalidSlots = slotCounts.has('unknown') ? ['unknown' as const] : [];
  const duplicateGarmentIds = Array.from(garmentIdCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const topCount = slotCounts.get('top') || 0;
  const bottomCount = slotCounts.get('bottom') || 0;
  const shoesCount = slotCounts.get('shoes') || 0;
  const dressCount = slotCounts.get('dress') || 0;
  const outerwearCount = slotCounts.get('outerwear') || 0;
  const accessoryCount = slotCounts.get('accessory') || 0;

  const topLayerRoles = normalized
    .filter((item) => item.slot === 'top')
    .map((item) => item.layerRole);

  const duplicateSlots: CanonicalOutfitSlot[] = [];
  if (bottomCount > 1) duplicateSlots.push('bottom');
  if (shoesCount > 1) duplicateSlots.push('shoes');
  if (dressCount > 1) duplicateSlots.push('dress');
  if (outerwearCount > 1) duplicateSlots.push('outerwear');
  if (accessoryCount > 1) duplicateSlots.push('accessory');

  const baseLikeTopCount = topLayerRoles.filter((role) => role === 'base' || role === 'standalone').length;
  const midTopCount = topLayerRoles.filter((role) => role === 'mid').length;
  const unknownTopCount = topLayerRoles.filter((role) => role === 'unknown').length;
  const layeredTopValid = topCount <= 1
    || (
      allowLayeredTops
      && topCount === 2
      && unknownTopCount === 0
      && baseLikeTopCount === 1
      && midTopCount === 1
    );

  if (topCount > 1 && !layeredTopValid) {
    duplicateSlots.push('top');
  }

  const conflictingSlots: CanonicalOutfitSlot[] = [];
  if (dressCount > 0 && topCount > 0) conflictingSlots.push('top');
  if (dressCount > 0 && bottomCount > 0) conflictingSlots.push('bottom');
  if (conflictingSlots.length > 0) conflictingSlots.unshift('dress');

  const hasDress = dressCount === 1;
  const hasSeparates = topCount > 0 || bottomCount > 0;
  const missing: ValidateOutfitResult['missing'] = [];

  if (hasDress) {
    if (requireShoes && shoesCount === 0) missing.push('shoes');
  } else {
    if (topCount === 0) missing.push('top');
    if (bottomCount === 0) missing.push('bottom');
    if (requireShoes && shoesCount === 0) missing.push('shoes');
  }

  const baseValid = hasDress
    ? !hasSeparates
    : topCount > 0 && bottomCount === 1 && layeredTopValid && dressCount === 0;

  const shoeValid = !requireShoes || shoesCount === 1;

  return {
    isValid: baseValid
      && shoeValid
      && duplicateSlots.length === 0
      && conflictingSlots.length === 0
      && invalidSlots.length === 0
      && duplicateGarmentIds.length === 0,
    isStandard: !hasDress && topCount > 0 && bottomCount === 1 && dressCount === 0,
    isDressBased: hasDress && !hasSeparates,
    missing,
    presentSlots,
    duplicateSlots,
    conflictingSlots,
    invalidSlots,
    duplicateGarmentIds,
    topLayerRoles,
  };
}
