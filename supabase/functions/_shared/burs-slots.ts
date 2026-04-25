/**
 * burs-slots.ts — Canonical slot definitions and normalization for outfit items.
 *
 * Every edge function that handles outfit slots should import from here
 * instead of maintaining its own token lists.
 */

// ── Canonical types ──────────────────────────────────────────

export const CANONICAL_SLOTS = [
  "top",
  "bottom",
  "shoes",
  "outerwear",
  "dress",
  "accessory",
] as const;

export type SlotName = (typeof CANONICAL_SLOTS)[number];

// ── Category mapping ─────────────────────────────────────────

/** Maps each canonical slot to its primary garment category. */
export const SLOT_CATEGORIES: Record<SlotName, string> = {
  top: "top",
  bottom: "bottom",
  shoes: "shoes",
  outerwear: "outerwear",
  dress: "dress",
  accessory: "accessory",
};

// ── Token lists (superset from burs_style_engine + mood_outfit + travel_capsule) ──

const TOP_TOKENS: readonly string[] = [
  "top", "shirt", "t-shirt", "blouse", "sweater", "hoodie", "polo",
  "tank_top", "tank", "cardigan", "camisole",
  // Swedish
  "tröja", "skjorta",
  // Norwegian
  "genser", "skjorte",
  // Danish
  "trøje", "troje",
  // Finnish
  "paita", "neule",
  // German
  "hemd", "pullover", "pulli",
  // French
  "chemise", "chemisier", "pull",
  // Spanish
  "camisa", "camiseta", "blusa", "jersey",
  // Italian
  "camicia", "camicetta", "maglione", "maglietta",
  // Portuguese (camisa/camiseta/blusa shared with es; add unique pt)
  "camisola",
  // Dutch
  "trui",
  // Polish
  "koszula", "koszulka", "sweter", "bluzka",
  // Arabic
  "قميص", "بلوزة",
  // Persian / Farsi
  "پیراهن", "بلوز",
];

const BOTTOM_TOKENS: readonly string[] = [
  "bottom", "pants", "jeans", "trousers", "shorts", "skirt", "chinos",
  "leggings",
  // Swedish
  "byxor", "kjol",
  // Norwegian (omitted "skjort" no-ø — substring of "skjorte" (no/da shirt)
  // and normalizeSlot() checks BOTTOM before TOP. "skjørt" with-ø is safe
  // because U+00F8 stays a single codepoint through NFD strip.)
  "bukse", "bukser", "skjørt",
  // Danish (bukser shared with no; add unique da)
  "nederdel",
  // Finnish
  "housut", "hame",
  // German
  "hose", "hosen",
  // French
  "pantalon", "jupe",
  // Spanish
  "pantalones", "falda",
  // Italian
  "pantaloni", "gonna",
  // Portuguese
  "calça", "calca", "calças", "calcas", "saia",
  // Dutch
  "broek",
  // Polish
  "spodnie", "spódnica", "spodnica",
  // Arabic
  "بنطلون", "تنورة",
  // Persian / Farsi
  "شلوار", "دامن",
];

const SHOES_TOKENS: readonly string[] = [
  "shoes", "shoe", "sneakers", "boots", "loafers", "sandals", "heels",
  "footwear",
  // Swedish
  "skor", "stövlar",
  // Norwegian / Danish
  "sko", "støvler", "stovler",
  // Finnish
  "kengät", "kengat", "saappaat",
  // German
  "schuhe", "stiefel",
  // French
  "chaussures", "bottes", "baskets",
  // Spanish
  "zapatos", "botas", "zapatillas",
  // Italian
  "scarpe", "stivali",
  // Portuguese
  "sapatos", "sapato", "tênis", "tenis",
  // Dutch
  "schoenen", "laarzen",
  // Polish
  "buty", "trampki",
  // Arabic — أحذية (boots-plural) needs NFD-form variant because the input
  // pipeline runs `.normalize('NFD')`. The NFC "أ" (U+0623) decomposes into
  // "ا" (U+0627) + combining hamza-above (U+0654), and U+0654 is OUTSIDE the
  // U+0300-U+036F strip range — so the NFC token never matches NFD input.
  // Adding both forms keeps NFC inputs matching too.
  "حذاء", "أحذية", "أحذية",
  // Persian / Farsi
  "کفش", "چکمه",
];

const OUTERWEAR_TOKENS: readonly string[] = [
  "outerwear", "jacket", "coat", "blazer", "parka", "windbreaker",
  "trench", "vest",
  // Swedish
  "jacka", "kappa", "rock", "väst",
  // Norwegian
  "jakke", "frakk",
  // Danish
  "frakke",
  // Finnish
  "takki",
  // German
  "jacke", "mantel",
  // French
  "manteau", "veste",
  // Spanish
  "chaqueta", "abrigo",
  // Italian
  "giacca", "cappotto",
  // Portuguese
  "jaqueta", "casaco",
  // Dutch
  "jas",
  // Polish
  "kurtka", "płaszcz", "plaszcz",
  // Arabic
  "سترة", "معطف",
  // Persian / Farsi
  "کت", "پالتو",
];

const DRESS_TOKENS: readonly string[] = [
  "dress", "jumpsuit", "overall", "romper", "fullbody", "full body",
  // Swedish
  "klänning",
  // Norwegian / Danish
  "kjole",
  // Finnish
  "mekko",
  // German
  "kleid",
  // French
  "robe",
  // Spanish
  "vestido",
  // Italian
  "vestito", "abito",
  // Portuguese (vestido shared with es)
  // Dutch
  "jurk",
  // Polish
  "sukienka",
  // Arabic
  "فستان",
];

const ACCESSORY_TOKENS: readonly string[] = [
  "accessory", "accessories", "scarf", "hat", "belt", "bag", "watch",
  "jewelry", "jewellery",
  // Swedish
  "halsduk", "mössa", "bälte", "väska", "smycke",
  // Norwegian
  "veske", "skjerf", "belte",
  // Danish
  "taske", "tørklæde", "torklaede", "bælte", "baelte",
  // Finnish
  "laukku", "huivi", "vyö", "vyo", "hattu",
  // German
  "tasche", "schal", "gürtel", "gurtel", "mütze", "mutze",
  // French
  // omitted "sac" — 3-char French "bag" substring of Spanish "saco" (jacket)
  "écharpe", "echarpe", "ceinture", "chapeau",
  // Spanish
  "bolso", "bufanda", "cinturón", "cinturon", "sombrero",
  // Italian
  "borsa", "sciarpa", "cintura", "cappello",
  // Portuguese
  "bolsa", "lenço", "lenco", "cinto", "chapéu", "chapeu", "cachecol",
  // Dutch (omitted "tas" — 3-char Dutch "bag" is substring of Spanish
  // "botas" (boots), would hijack ACCESSORY classification ahead of SHOES)
  "sjaal", "riem", "hoed",
  // Polish
  "torba", "szalik", "pasek", "kapelusz",
  // Arabic
  "حقيبة", "وشاح", "حزام", "قبعة",
  // Persian / Farsi
  "کیف", "شال", "کمربند", "کلاه",
];

// ── Direct alias map (exact slot-string synonyms) ────────────

const DIRECT_ALIASES: Record<string, SlotName> = {
  shoe: "shoes",
  outer: "outerwear",
  layer: "outerwear",
  layering: "outerwear",
};

// ── Normalisation helpers ────────────────────────────────────

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize a raw slot string to a canonical SlotName.
 * Handles direct aliases ("shoe" → "shoes") and falls back to
 * token-list matching (same priority order used by burs_style_engine).
 *
 * Returns `null` for unrecognisable input.
 */
export function normalizeSlot(s: string): SlotName | null {
  if (!s) return null;
  const raw = stripAccents(s.trim().toLowerCase());

  // 1. Already canonical?
  if ((CANONICAL_SLOTS as readonly string[]).includes(raw)) {
    return raw as SlotName;
  }

  // 2. Direct alias?
  if (raw in DIRECT_ALIASES) {
    return DIRECT_ALIASES[raw];
  }

  // 3. Token-list matching (dress first — same priority as burs_style_engine)
  if (DRESS_TOKENS.some((t) => raw.includes(stripAccents(t)))) return "dress";
  if (OUTERWEAR_TOKENS.some((t) => raw.includes(stripAccents(t)))) return "outerwear";
  if (ACCESSORY_TOKENS.some((t) => raw.includes(stripAccents(t)))) return "accessory";
  if (SHOES_TOKENS.some((t) => raw.includes(stripAccents(t)))) return "shoes";
  if (BOTTOM_TOKENS.some((t) => raw.includes(stripAccents(t)))) return "bottom";
  if (TOP_TOKENS.some((t) => raw.includes(stripAccents(t)))) return "top";

  return null;
}

/** Type guard — returns true when `s` is a canonical slot name. */
export function isValidSlot(s: string): s is SlotName {
  return (CANONICAL_SLOTS as readonly string[]).includes(s);
}

/**
 * Classify a garment's category + subcategory into a canonical slot.
 * Drop-in replacement for the `categorizeSlot()` and `inferSlotFromGarment()`
 * functions scattered across edge functions.
 *
 * Returns `null` if no slot could be inferred.
 */
export function classifySlot(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): SlotName | null {
  const cat = stripAccents((category || "").toLowerCase());
  const sub = stripAccents((subcategory || "").toLowerCase());
  const both = `${cat} ${sub}`;

  if (DRESS_TOKENS.some((t) => both.includes(stripAccents(t)))) return "dress";
  if (OUTERWEAR_TOKENS.some((t) => both.includes(stripAccents(t)))) return "outerwear";
  if (ACCESSORY_TOKENS.some((t) => both.includes(stripAccents(t)))) return "accessory";
  if (TOP_TOKENS.some((t) => both.includes(stripAccents(t)))) return "top";
  if (BOTTOM_TOKENS.some((t) => both.includes(stripAccents(t)))) return "bottom";
  if (SHOES_TOKENS.some((t) => both.includes(stripAccents(t)))) return "shoes";

  return null;
}
