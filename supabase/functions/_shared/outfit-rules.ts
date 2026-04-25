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
  // Swedish
  'skor', 'stovlar', 'stövlar',
  // Norwegian / Danish
  'sko', 'stovler', 'støvler',
  // Finnish
  'kengät', 'kengat', 'saappaat',
  // German
  'schuhe', 'stiefel',
  // French
  'chaussures', 'bottes', 'baskets',
  // Spanish
  'zapatos', 'botas', 'zapatillas',
  // Italian
  'scarpe', 'stivali',
  // Portuguese
  'sapatos', 'sapato', 'tênis', 'tenis',
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
  'outerwear', 'coat', 'jacket', 'blazer', 'trench', 'parka', 'windbreaker',
  // Swedish
  'jacka', 'kappa', 'rock',
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
  'kurtka', 'płaszcz', 'plaszcz',
  // Arabic
  'سترة', 'معطف',
  // Persian / Farsi
  'کت', 'پالتو',
];
const ACCESSORY_TOKENS = [
  'accessory', 'bag', 'hat', 'belt', 'scarf', 'jewelry',
  // Swedish
  'smycke', 'vaska', 'väska', 'halsduk', 'mossa', 'mössa', 'balte', 'bälte',
  // Norwegian
  'veske', 'skjerf', 'belte',
  // Danish
  'taske', 'tørklæde', 'torklaede', 'bælte', 'baelte',
  // Finnish
  'laukku', 'huivi', 'vyö', 'vyo', 'hattu',
  // German
  'tasche', 'schal', 'gürtel', 'gurtel', 'mütze', 'mutze',
  // French
  'sac', 'écharpe', 'echarpe', 'ceinture', 'chapeau',
  // Spanish
  'bolso', 'bufanda', 'cinturón', 'cinturon', 'sombrero',
  // Italian
  'borsa', 'sciarpa', 'cintura', 'cappello',
  // Portuguese
  'bolsa', 'lenço', 'lenco', 'cinto', 'chapéu', 'chapeu', 'cachecol',
  // Dutch (omitted "tas" — substring collision with "botas" boots)
  'sjaal', 'riem', 'hoed',
  // Polish
  'torba', 'szalik', 'pasek', 'kapelusz',
  // Arabic
  'حقيبة', 'وشاح', 'حزام', 'قبعة',
  // Persian / Farsi
  'کیف', 'شال', 'کمربند', 'کلاه',
];
const BOTTOM_TOKENS = [
  'bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'chinos', 'leggings', 'culottes',
  // Swedish
  'byxor', 'kjol',
  // Norwegian
  'bukse', 'bukser', 'skjørt',
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
  'calça', 'calca', 'calças', 'calcas', 'saia',
  // Dutch
  'broek',
  // Polish
  'spodnie', 'spódnica', 'spodnica',
  // Arabic
  'بنطلون', 'تنورة',
  // Persian / Farsi
  'شلوار', 'دامن',
];

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
  // German
  'hemd',
  // French
  'chemise',
  'chemisier',
  'débardeur',
  'debardeur',
  // Spanish
  'camisa',
  'camiseta',
  'blusa',
  // Italian
  'camicia',
  'camicetta',
  'maglietta',
  'canotta',
  // Portuguese
  'camisola',
  // Polish
  'koszula',
  'koszulka',
  'bluzka',
  // Norwegian / Danish (skjorte = shirt)
  'skjorte',
  // Finnish
  'paita',
  // Arabic
  'قميص',
  'بلوزة',
  // Persian / Farsi
  'پیراهن',
  'بلوز',
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
  // German
  'pullover',
  'pulli',
  'kapuzenpullover',
  // French
  'pull',
  'sweat',
  'gilet',
  // Spanish (cárdigan accent-strips to existing 'cardigan')
  'jersey',
  'cárdigan',
  'sudadera',
  'chaleco',
  // Italian
  'maglione',
  'maglia',
  'felpa',
  // Portuguese
  'suéter',
  'sueter',
  'moletom',
  // Dutch
  'trui',
  // Polish
  'sweter',
  'bluza',
  'kamizelka',
  // Norwegian
  'genser',
  'hettegenser',
  // Danish
  'trøje',
  'troje',
  // Finnish
  'neule',
  'villapaita',
  'huppari',
  'liivi',
  // Arabic
  'كنزة',
  // Persian / Farsi
  'سویشرت',
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
  // Outerwear in 12 additional locales
  jakke: 'outerwear', // no
  frakk: 'outerwear', // no
  frakke: 'outerwear', // da
  takki: 'outerwear', // fi
  jacke: 'outerwear', // de
  mantel: 'outerwear', // de
  manteau: 'outerwear', // fr
  veste: 'outerwear', // fr
  chaqueta: 'outerwear', // es
  abrigo: 'outerwear', // es
  giacca: 'outerwear', // it
  cappotto: 'outerwear', // it
  jaqueta: 'outerwear', // pt
  casaco: 'outerwear', // pt
  jas: 'outerwear', // nl
  kurtka: 'outerwear', // pl
  plaszcz: 'outerwear', // pl (ascii)
  'płaszcz': 'outerwear', // pl
  dress: 'dress',
  jumpsuit: 'dress',
  overall: 'dress',
  fullbody: 'dress',
  full_body: 'dress',
  klanning: 'dress',
  klänning: 'dress',
  // Dress in 12 additional locales
  kjole: 'dress', // no, da
  mekko: 'dress', // fi
  kleid: 'dress', // de
  robe: 'dress', // fr
  vestido: 'dress', // es, pt
  vestito: 'dress', // it
  abito: 'dress', // it
  jurk: 'dress', // nl
  sukienka: 'dress', // pl
  // Top in 12 additional locales (exact-alias forms)
  genser: 'top', // no
  skjorte: 'top', // no, da
  trøje: 'top', // da
  troje: 'top', // da (ascii)
  paita: 'top', // fi
  neule: 'top', // fi
  hemd: 'top', // de
  pullover: 'top', // de
  pulli: 'top', // de
  chemise: 'top', // fr
  chemisier: 'top', // fr
  pull: 'top', // fr
  camisa: 'top', // es, pt
  camiseta: 'top', // es, pt
  blusa: 'top', // es, pt
  jersey: 'top', // es
  camicia: 'top', // it
  camicetta: 'top', // it
  maglione: 'top', // it
  maglietta: 'top', // it
  camisola: 'top', // pt
  trui: 'top', // nl
  koszula: 'top', // pl
  koszulka: 'top', // pl
  sweter: 'top', // pl
  bluzka: 'top', // pl
  // Bottom in 12 additional locales (exact-alias forms)
  bukse: 'bottom', // no
  bukser: 'bottom', // no, da
  'skjørt': 'bottom', // no
  nederdel: 'bottom', // da
  housut: 'bottom', // fi
  hame: 'bottom', // fi
  hose: 'bottom', // de
  hosen: 'bottom', // de
  pantalon: 'bottom', // fr
  jupe: 'bottom', // fr
  pantalones: 'bottom', // es
  falda: 'bottom', // es
  pantaloni: 'bottom', // it
  gonna: 'bottom', // it
  'calça': 'bottom', // pt
  calca: 'bottom', // pt (ascii)
  saia: 'bottom', // pt
  broek: 'bottom', // nl
  spodnie: 'bottom', // pl
  'spódnica': 'bottom', // pl
  spodnica: 'bottom', // pl (ascii)
  // Shoes in 12 additional locales (exact-alias forms)
  sko: 'shoes', // no, da
  'støvler': 'shoes', // no, da
  stovler: 'shoes', // no, da (ascii)
  'kengät': 'shoes', // fi
  kengat: 'shoes', // fi (ascii)
  saappaat: 'shoes', // fi
  schuhe: 'shoes', // de
  stiefel: 'shoes', // de
  chaussures: 'shoes', // fr
  bottes: 'shoes', // fr
  baskets: 'shoes', // fr
  zapatos: 'shoes', // es
  botas: 'shoes', // es
  zapatillas: 'shoes', // es
  scarpe: 'shoes', // it
  stivali: 'shoes', // it
  sapatos: 'shoes', // pt
  sapato: 'shoes', // pt
  'tênis': 'shoes', // pt
  tenis: 'shoes', // pt (ascii)
  schoenen: 'shoes', // nl
  laarzen: 'shoes', // nl
  buty: 'shoes', // pl
  trampki: 'shoes', // pl
  accessory: 'accessory',
  bag: 'accessory',
  hat: 'accessory',
  scarf: 'accessory',
  belt: 'accessory',
  // Accessory in 12 additional locales (exact-alias forms)
  veske: 'accessory', // no
  skjerf: 'accessory', // no
  belte: 'accessory', // no
  taske: 'accessory', // da
  'tørklæde': 'accessory', // da
  torklaede: 'accessory', // da (ascii)
  'bælte': 'accessory', // da
  baelte: 'accessory', // da (ascii)
  laukku: 'accessory', // fi
  huivi: 'accessory', // fi
  'vyö': 'accessory', // fi
  vyo: 'accessory', // fi (ascii)
  hattu: 'accessory', // fi
  tasche: 'accessory', // de
  schal: 'accessory', // de
  'gürtel': 'accessory', // de
  gurtel: 'accessory', // de (ascii)
  'mütze': 'accessory', // de
  mutze: 'accessory', // de (ascii)
  sac: 'accessory', // fr
  'écharpe': 'accessory', // fr
  echarpe: 'accessory', // fr (ascii)
  ceinture: 'accessory', // fr
  chapeau: 'accessory', // fr
  bolso: 'accessory', // es
  bufanda: 'accessory', // es
  'cinturón': 'accessory', // es
  cinturon: 'accessory', // es (ascii)
  sombrero: 'accessory', // es
  borsa: 'accessory', // it
  sciarpa: 'accessory', // it
  cintura: 'accessory', // it
  cappello: 'accessory', // it
  bolsa: 'accessory', // pt
  'lenço': 'accessory', // pt
  lenco: 'accessory', // pt (ascii)
  cinto: 'accessory', // pt
  'chapéu': 'accessory', // pt
  chapeu: 'accessory', // pt (ascii)
  cachecol: 'accessory', // pt
  tas: 'accessory', // nl
  sjaal: 'accessory', // nl
  riem: 'accessory', // nl
  hoed: 'accessory', // nl
  torba: 'accessory', // pl
  szalik: 'accessory', // pl
  pasek: 'accessory', // pl
  kapelusz: 'accessory', // pl
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
  const category = normalizeTokenValue(garment.category);
  const subcategory = normalizeTokenValue(garment.subcategory);
  const value = `${category} ${subcategory}`.trim();

  if (includesAnyToken(value, DRESS_TOKENS)) return 'dress';
  if (includesAnyToken(value, SHOES_TOKENS)) return 'shoes';
  if (includesAnyToken(value, OUTERWEAR_TOKENS)) return 'outerwear';
  if (includesAnyToken(value, ACCESSORY_TOKENS)) return 'accessory';
  if (includesAnyToken(value, BOTTOM_TOKENS)) return 'bottom';
  return 'top';
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
  if ('garment' in item) {
    if (item.garment) {
      return inferCanonicalOutfitSlot(item.garment);
    }
    return 'unknown';
  }
  if (explicitSlot && EXPLICIT_SLOT_MAP[explicitSlot]) {
    return EXPLICIT_SLOT_MAP[explicitSlot];
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
