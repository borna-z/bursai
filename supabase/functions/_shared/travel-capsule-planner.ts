export type TravelCapsuleSlot =
  | 'dress'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'outerwear'
  | 'accessory'
  | 'other';

export type TravelCapsuleCoreSlot = 'dress' | 'top' | 'bottom' | 'shoes';

export type TravelCapsuleOutfitKind = 'trip_day' | 'travel_outbound' | 'travel_return';

export interface TravelCapsuleGarmentLike {
  id?: string;
  title?: string | null;
  category?: string | null;
  subcategory?: string | null;
}

export interface TravelCapsuleOutfitLike {
  items?: string[] | null;
}

export interface TravelCapsuleCoverageGap {
  code:
    | 'missing_shoes'
    | 'missing_top'
    | 'missing_bottom'
    | 'missing_dress_or_separates'
    | 'insufficient_complete_outfits'
    // `ai_empty_fallback` is used when the AI returns zero complete outfits
    // and we show a friendlier "built 1 of N" message in place of the
    // generic insufficient_complete_outfits gap. Surfaced by deno-check on
    // PR #659 — pre-existing literal that wasn't in the union.
    | 'ai_empty_fallback';
  message: string;
  missing_slots?: TravelCapsuleCoreSlot[];
  uncovered_outfits?: number;
}

export interface TravelCapsuleOutfitValidation {
  isComplete: boolean;
  outfitKind: 'separates' | 'dress' | 'invalid';
  presentSlots: TravelCapsuleSlot[];
  missingCoreSlots: TravelCapsuleCoreSlot[];
  duplicateCoreSlots: TravelCapsuleCoreSlot[];
}

export interface TravelCapsulePlanSlot {
  day: number;
  date: string;
  kind: TravelCapsuleOutfitKind;
  slotIndex: number;
}

export interface TravelCapsulePlanSummary {
  tripDays: number;
  tripNights: number;
  requiredOutfits: number;
  slots: TravelCapsulePlanSlot[];
}

const DRESS_TOKENS = [
  'dress', 'jumpsuit', 'overall', 'fullbody', 'full body', 'romper',
  // Swedish
  'klanning', 'klänning',
  // Norwegian / Danish
  'kjole',
  // Finnish
  'mekko',
  // German
  'kleid',
  // French
  'robe',
  // Spanish / Portuguese
  'vestido',
  // Italian
  'vestito', 'abito',
  // Dutch
  'jurk',
  // Polish
  'sukienka',
  // Arabic
  'فستان',
];
const SHOES_TOKENS = [
  'shoes', 'shoe', 'sneakers', 'boots', 'heels', 'sandals', 'loafers', 'footwear',
  // Swedish (ascii forms because input is accent-stripped before matching)
  'skor', 'stovlar', 'stövlar',
  // Norwegian / Danish
  'sko', 'stovler', 'støvler',
  // Finnish
  'kengat', 'kengät', 'saappaat',
  // German
  'schuhe', 'stiefel',
  // French
  'chaussures', 'bottes', 'baskets',
  // Spanish
  'zapatos', 'botas', 'zapatillas',
  // Italian
  'scarpe', 'stivali',
  // Portuguese
  'sapatos', 'sapato', 'tenis', 'tênis',
  // Dutch
  'schoenen', 'laarzen',
  // Polish
  'buty', 'trampki',
  // Arabic
  'حذاء', 'أحذية',
  // Persian / Farsi
  'کفش', 'چکمه',
];
const OUTERWEAR_TOKENS = [
  'outerwear', 'coat', 'jacket', 'blazer', 'trench', 'parka',
  // Swedish
  'jacka', 'kappa',
  // Norwegian
  'jakke', 'frakk',
  // Danish
  'frakke',
  // Finnish
  'takki',
  // German
  'jacke', 'mantel',
  // French
  'manteau', 'veste',
  // Spanish
  'chaqueta', 'abrigo',
  // Italian
  'giacca', 'cappotto',
  // Portuguese
  'jaqueta', 'casaco',
  // Dutch
  'jas',
  // Polish
  'kurtka', 'plaszcz', 'płaszcz',
  // Arabic
  'سترة', 'معطف',
  // Persian / Farsi
  'کت', 'پالتو',
];
const ACCESSORY_TOKENS = [
  'accessory', 'accessories', 'bag', 'hat', 'belt', 'scarf', 'jewelry', 'jewellery',
  // Swedish (ascii pairs needed; input is accent-stripped at match time)
  'smycke', 'vaska', 'väska', 'halsduk', 'mossa', 'mössa', 'balte', 'bälte',
  // Norwegian
  'veske', 'skjerf', 'belte',
  // Danish
  'taske', 'torklaede', 'tørklæde', 'baelte', 'bælte',
  // Finnish
  'laukku', 'huivi', 'vyo', 'vyö', 'hattu',
  // German
  'tasche', 'schal', 'gurtel', 'gürtel', 'mutze', 'mütze',
  // French
  'sac', 'echarpe', 'écharpe', 'ceinture', 'chapeau',
  // Spanish
  'bolso', 'bufanda', 'cinturon', 'cinturón', 'sombrero',
  // Italian
  'borsa', 'sciarpa', 'cintura', 'cappello',
  // Portuguese
  'bolsa', 'lenco', 'lenço', 'cinto', 'chapeu', 'chapéu', 'cachecol',
  // Dutch
  'tas', 'sjaal', 'riem', 'hoed',
  // Polish
  'torba', 'szalik', 'pasek', 'kapelusz',
  // Arabic
  'حقيبة', 'وشاح', 'حزام', 'قبعة',
  // Persian / Farsi
  'کیف', 'شال', 'کمربند', 'کلاه',
];
const BOTTOM_TOKENS = [
  'bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'chinos', 'leggings',
  // Swedish
  'byxor', 'kjol',
  // Norwegian
  'bukse', 'bukser', 'skjort', 'skjørt',
  // Danish
  'nederdel',
  // Finnish
  'housut', 'hame',
  // German
  'hose', 'hosen',
  // French
  'pantalon', 'jupe',
  // Spanish
  'pantalones', 'falda',
  // Italian
  'pantaloni', 'gonna',
  // Portuguese
  'calca', 'calça', 'calcas', 'calças', 'saia',
  // Dutch
  'broek',
  // Polish
  'spodnie', 'spodnica', 'spódnica',
  // Arabic
  'بنطلون', 'تنورة',
  // Persian / Farsi
  'شلوار', 'دامن',
];

function normalizeTokenValue(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function classifyTravelCapsuleSlot(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): TravelCapsuleSlot {
  const value = `${normalizeTokenValue(category)} ${normalizeTokenValue(subcategory)}`.trim();

  if (DRESS_TOKENS.some((token) => value.includes(token))) return 'dress';
  if (SHOES_TOKENS.some((token) => value.includes(token))) return 'shoes';
  if (OUTERWEAR_TOKENS.some((token) => value.includes(token))) return 'outerwear';
  if (ACCESSORY_TOKENS.some((token) => value.includes(token))) return 'accessory';
  if (BOTTOM_TOKENS.some((token) => value.includes(token))) return 'bottom';
  if (value.length === 0) return 'other';
  return 'top';
}

export function validateTravelCapsuleOutfitGarments(
  garments: TravelCapsuleGarmentLike[],
): TravelCapsuleOutfitValidation {
  const slotCounts: Record<TravelCapsuleSlot, number> = {
    dress: 0,
    top: 0,
    bottom: 0,
    shoes: 0,
    outerwear: 0,
    accessory: 0,
    other: 0,
  };

  for (const garment of garments) {
    const slot = classifyTravelCapsuleSlot(garment.category, garment.subcategory);
    slotCounts[slot] += 1;
  }

  const presentSlots = (Object.keys(slotCounts) as TravelCapsuleSlot[]).filter((slot) => slotCounts[slot] > 0);
  const duplicateCoreSlots = (['dress', 'top', 'bottom', 'shoes'] as TravelCapsuleCoreSlot[]).filter(
    (slot) => slotCounts[slot] > 1,
  );

  const hasDressBase = slotCounts.dress === 1;
  const hasSeparatesBase = slotCounts.top === 1 && slotCounts.bottom === 1;
  const hasShoes = slotCounts.shoes === 1;
  const hasConflictingBase = slotCounts.dress > 0 && (slotCounts.top > 0 || slotCounts.bottom > 0);

  if (duplicateCoreSlots.length > 0 || hasConflictingBase) {
    return {
      isComplete: false,
      outfitKind: 'invalid',
      presentSlots,
      missingCoreSlots: [],
      duplicateCoreSlots,
    };
  }

  if (hasDressBase) {
    return {
      isComplete: hasShoes,
      outfitKind: hasShoes ? 'dress' : 'invalid',
      presentSlots,
      missingCoreSlots: hasShoes ? [] : ['shoes'],
      duplicateCoreSlots,
    };
  }

  const missingCoreSlots: TravelCapsuleCoreSlot[] = [];
  if (slotCounts.top === 0) missingCoreSlots.push('top');
  if (slotCounts.bottom === 0) missingCoreSlots.push('bottom');
  if (!hasShoes) missingCoreSlots.push('shoes');

  return {
    isComplete: hasSeparatesBase && hasShoes,
    outfitKind: hasSeparatesBase && hasShoes ? 'separates' : 'invalid',
    presentSlots,
    missingCoreSlots,
    duplicateCoreSlots,
  };
}

export function isCompleteTravelCapsuleOutfitGarments(garments: TravelCapsuleGarmentLike[]): boolean {
  return validateTravelCapsuleOutfitGarments(garments).isComplete;
}

export function isCompleteTravelCapsuleOutfitIds(
  ids: string[],
  garmentById: Map<string, TravelCapsuleGarmentLike>,
): boolean {
  const garments = ids.map((id) => garmentById.get(id)).filter((garment): garment is TravelCapsuleGarmentLike => Boolean(garment));
  if (garments.length !== ids.length) return false;
  return isCompleteTravelCapsuleOutfitGarments(garments);
}

export function filterCompleteTravelCapsuleOutfits<T extends TravelCapsuleOutfitLike>(
  outfits: T[],
  garmentById: Map<string, TravelCapsuleGarmentLike>,
): T[] {
  return outfits.filter((outfit) => isCompleteTravelCapsuleOutfitIds(outfit.items || [], garmentById));
}

export function buildTravelCapsulePlanSummary(
  startDate: string,
  endDate: string,
  outfitsPerDay: number,
  includeTravelDays: boolean,
): TravelCapsulePlanSummary {
  const safeOutfitsPerDay = Math.max(1, Math.min(4, Math.trunc(outfitsPerDay || 1)));
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  const tripNights = Math.max(0, diffDays);
  const tripDays = tripNights + 1;
  const slots: TravelCapsulePlanSlot[] = [];

  for (let day = 1; day <= tripDays; day += 1) {
    const date = formatIsoDate(addUtcDays(start, day - 1));
    for (let slotIndex = 0; slotIndex < safeOutfitsPerDay; slotIndex += 1) {
      slots.push({
        day,
        date,
        kind: 'trip_day',
        slotIndex,
      });
    }
  }

  if (includeTravelDays) {
    const firstDate = formatIsoDate(start);
    const lastDate = formatIsoDate(end);
    slots.push({
      day: 1,
      date: firstDate,
      kind: 'travel_outbound',
      slotIndex: safeOutfitsPerDay,
    });
    slots.push({
      day: tripDays,
      date: lastDate,
      kind: 'travel_return',
      slotIndex: safeOutfitsPerDay + 1,
    });
  }

  return {
    tripDays,
    tripNights,
    requiredOutfits: slots.length,
    slots,
  };
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function formatIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}
