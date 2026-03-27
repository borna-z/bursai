export interface StyleChatGarmentLike {
  id: string;
  title: string;
  category: string;
}

export interface StyleChatActiveLookContext {
  summary: string;
  garmentIds: string[];
  source: string | null;
  garmentLines: string[];
}

export interface NormalizedStyleChatAssistantReply {
  text: string;
  outfitIds: string[];
  outfitTag: string | null;
}

const VALID_GARMENT_TAG_RE = /\[\[garment:([a-f0-9-]+)(?:\|([^\]]+))?\]\]/gi;
const VALID_OUTFIT_TAG_RE = /\[\[outfit:([a-f0-9-,]+)\|([^\]]*)\]\]/gi;
const ANY_DOUBLE_BRACKET_TAG_RE = /\[\[[\s\S]*?\]\]/g;
const PARTIAL_TAG_START_RE = /\[\[(?:garment|outfit):/i;
const PARTIAL_TAG_CHAR_RE = /[a-z0-9,\-|]/i;

const SLOT_MAP: Record<string, string> = {
  top: "top",
  shirt: "top",
  "t-shirt": "top",
  tshirt: "top",
  blouse: "top",
  sweater: "top",
  hoodie: "top",
  polo: "top",
  tank: "top",
  tank_top: "top",
  cardigan: "top",
  "tröja": "top",
  skjorta: "top",
  knit: "top",
  bottom: "bottom",
  pants: "bottom",
  jeans: "bottom",
  trousers: "bottom",
  shorts: "bottom",
  skirt: "bottom",
  chinos: "bottom",
  byxor: "bottom",
  kjol: "bottom",
  leggings: "bottom",
  culottes: "bottom",
  shoes: "shoes",
  sneakers: "shoes",
  boots: "shoes",
  loafers: "shoes",
  sandals: "shoes",
  heels: "shoes",
  skor: "shoes",
  "stövlar": "shoes",
  footwear: "shoes",
  trainers: "shoes",
  oxfords: "shoes",
  mules: "shoes",
  outerwear: "outerwear",
  jacket: "outerwear",
  coat: "outerwear",
  blazer: "outerwear",
  parka: "outerwear",
  windbreaker: "outerwear",
  jacka: "outerwear",
  kappa: "outerwear",
  rock: "outerwear",
  dress: "dress",
  jumpsuit: "dress",
  overall: "dress",
  "klänning": "dress",
  accessory: "accessory",
  bag: "accessory",
  hat: "accessory",
  scarf: "accessory",
  belt: "accessory",
};

const ALLOWED_OUTFIT_SLOTS = new Set(["top", "bottom", "shoes", "dress", "outerwear", "accessory"]);

function normalizeTerm(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

export function getStyleChatSlotKey(category: string): string {
  const normalized = normalizeTerm(category);
  return SLOT_MAP[normalized] || normalized;
}

export function parseStyleChatGarmentIds(text: string): string[] {
  return Array.from(text.matchAll(/\[\[garment:([a-f0-9-]{8,})(?:\|[^\]]+)?\]\]/gi)).map((match) => match[1]);
}

export function parseStyleChatOutfitIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(/\[\[outfit:([a-f0-9-,]+)\|[^\]]*\]\]/gi)) {
    match[1]
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function isCompleteStyleChatOutfitIds<TGarment extends StyleChatGarmentLike>(
  ids: string[],
  garments: TGarment[],
): boolean {
  if (!ids.length) return false;

  const garmentById = new Map(garments.map((garment) => [garment.id, garment]));
  const seenIds = new Set<string>();
  const seenSlots = new Set<string>();

  for (const id of ids) {
    if (seenIds.has(id)) return false;
    seenIds.add(id);

    const garment = garmentById.get(id);
    if (!garment) return false;

    const slot = getStyleChatSlotKey(garment.category);
    if (!ALLOWED_OUTFIT_SLOTS.has(slot)) return false;
    if (seenSlots.has(slot)) return false;
    seenSlots.add(slot);
  }

  if (seenSlots.has("dress")) {
    if (seenSlots.has("top") || seenSlots.has("bottom")) return false;
    return seenSlots.has("shoes");
  }

  return seenSlots.has("top") && seenSlots.has("bottom") && seenSlots.has("shoes");
}

function stripPartialTagStarts(text: string): string {
  let output = "";
  let index = 0;

  while (index < text.length) {
    const nextStart = text.indexOf("[[", index);
    if (nextStart === -1) {
      output += text.slice(index);
      break;
    }

    output += text.slice(index, nextStart);
    const remainder = text.slice(nextStart);
    if (!PARTIAL_TAG_START_RE.test(remainder)) {
      output += "[[";
      index = nextStart + 2;
      continue;
    }

    const closeIndex = text.indexOf("]]", nextStart + 2);
    if (closeIndex !== -1) {
      output += text.slice(nextStart, closeIndex + 2);
      index = closeIndex + 2;
      continue;
    }

    let cursor = nextStart + 2;
    while (cursor < text.length && text[cursor] !== ":") cursor += 1;
    if (cursor < text.length && text[cursor] === ":") cursor += 1;
    while (cursor < text.length && PARTIAL_TAG_CHAR_RE.test(text[cursor])) {
      cursor += 1;
    }
    index = cursor;
  }

  return output;
}

function stripUnknownTagMarkup(text: string): string {
  return stripPartialTagStarts(
    text.replace(ANY_DOUBLE_BRACKET_TAG_RE, (match) => {
      VALID_GARMENT_TAG_RE.lastIndex = 0;
      VALID_OUTFIT_TAG_RE.lastIndex = 0;
      if (VALID_GARMENT_TAG_RE.test(match) || VALID_OUTFIT_TAG_RE.test(match)) return match;
      return "";
    }),
  )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

export function pickStyleChatOutfitIdsFromText<TGarment extends StyleChatGarmentLike>(
  text: string,
  validGarmentIds: Set<string>,
  garments: TGarment[],
): { ids: string[]; explanation: string } | null {
  let outfitMatch: RegExpExecArray | null;
  VALID_OUTFIT_TAG_RE.lastIndex = 0;
  let lastValidOutfit: { ids: string[]; explanation: string } | null = null;

  while ((outfitMatch = VALID_OUTFIT_TAG_RE.exec(text)) !== null) {
    const ids = uniqueIds(
      outfitMatch[1]
        .split(",")
        .map((id) => id.trim())
        .filter((id) => validGarmentIds.has(id)),
    ).slice(0, 5);

    if (isCompleteStyleChatOutfitIds(ids, garments)) {
      lastValidOutfit = { ids, explanation: outfitMatch[2].trim() };
    }
  }

  if (lastValidOutfit) return lastValidOutfit;

  const garmentIds = uniqueIds(
    parseStyleChatGarmentIds(text).filter((id) => validGarmentIds.has(id)),
  ).slice(0, 5);

  if (isCompleteStyleChatOutfitIds(garmentIds, garments)) {
    return { ids: garmentIds, explanation: "" };
  }

  return null;
}

export function deduplicateStyleChatOutfitBySlot<TGarment extends StyleChatGarmentLike>(
  ids: string[],
  garments: TGarment[],
  anchor: TGarment | null,
): string[] {
  const garmentById = new Map(garments.map((garment) => [garment.id, garment]));
  const seenSlots = new Set<string>();
  const result: string[] = [];

  if (anchor && ids.includes(anchor.id)) {
    result.push(anchor.id);
    seenSlots.add(getStyleChatSlotKey(anchor.category));
  }

  for (const id of ids) {
    if (anchor && id === anchor.id) continue;
    const garment = garmentById.get(id);
    if (!garment) continue;
    const slot = getStyleChatSlotKey(garment.category);
    if (seenSlots.has(slot)) continue;
    seenSlots.add(slot);
    result.push(id);
  }

  return result;
}

function groupGarmentsBySlot<TGarment extends StyleChatGarmentLike>(garments: TGarment[]): Map<string, TGarment[]> {
  const slots = new Map<string, TGarment[]>();

  for (const garment of garments) {
    const slot = getStyleChatSlotKey(garment.category);
    if (!slots.has(slot)) slots.set(slot, []);
    slots.get(slot)!.push(garment);
  }

  return slots;
}

function firstAvailableGarment<TGarment extends StyleChatGarmentLike>(
  slot: string,
  slots: Map<string, TGarment[]>,
  usedIds: Set<string>,
): TGarment | null {
  return (slots.get(slot) || []).find((garment) => !usedIds.has(garment.id)) || null;
}

function buildFallbackCandidate<TGarment extends StyleChatGarmentLike>(
  requiredSlots: string[],
  slots: Map<string, TGarment[]>,
  anchor: TGarment | null,
): string[] {
  const chosen: TGarment[] = [];
  const usedIds = new Set<string>();
  const usedSlots = new Set<string>();
  const anchorSlot = anchor ? getStyleChatSlotKey(anchor.category) : null;

  const pushGarment = (garment: TGarment | null | undefined) => {
    if (!garment || usedIds.has(garment.id)) return;
    const slot = getStyleChatSlotKey(garment.category);
    if (usedSlots.has(slot)) return;
    usedIds.add(garment.id);
    usedSlots.add(slot);
    chosen.push(garment);
  };

  for (const slot of requiredSlots) {
    if (anchor && anchorSlot === slot) {
      pushGarment(anchor);
      continue;
    }
    pushGarment(firstAvailableGarment(slot, slots, usedIds));
  }

  if (anchor && anchorSlot && !requiredSlots.includes(anchorSlot) && (anchorSlot === "outerwear" || anchorSlot === "accessory")) {
    pushGarment(anchor);
  }

  if (!usedSlots.has("outerwear")) {
    pushGarment(firstAvailableGarment("outerwear", slots, usedIds));
  }
  if (!usedSlots.has("accessory")) {
    pushGarment(firstAvailableGarment("accessory", slots, usedIds));
  }

  return chosen.map((garment) => garment.id).slice(0, 5);
}

export function buildStyleChatFallbackOutfitIds<TGarment extends StyleChatGarmentLike>(
  rankedGarments: TGarment[],
  anchor: TGarment | null,
  activeLook: StyleChatActiveLookContext,
): string[] {
  const stableActiveLookIds = uniqueIds(activeLook.garmentIds).slice(0, 5);
  if (isCompleteStyleChatOutfitIds(stableActiveLookIds, rankedGarments)) {
    return stableActiveLookIds;
  }

  const slots = groupGarmentsBySlot(rankedGarments);
  const anchorSlot = anchor ? getStyleChatSlotKey(anchor.category) : null;
  const candidateOrders = !anchor
    ? [["dress", "shoes"], ["top", "bottom", "shoes"]]
    : anchorSlot === "dress"
      ? [["dress", "shoes"]]
      : anchorSlot === "top" || anchorSlot === "bottom"
        ? [["top", "bottom", "shoes"]]
        : anchorSlot === "shoes"
          ? [["top", "bottom", "shoes"], ["dress", "shoes"]]
          : [["top", "bottom", "shoes"], ["dress", "shoes"]];

  for (const requiredSlots of candidateOrders) {
    const candidateIds = buildFallbackCandidate(requiredSlots, slots, anchor);
    if (isCompleteStyleChatOutfitIds(candidateIds, rankedGarments)) {
      return candidateIds;
    }
  }

  return [];
}

function stripRawIdReferences(text: string): string {
  return text
    .replace(/\s*\[ID:[a-f0-9-]{8,}[^\]]*\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildOutfitExplanation(rawText: string, fallbackIds: string[]): string {
  const withoutTags = rawText
    .replace(VALID_OUTFIT_TAG_RE, " ")
    .replace(VALID_GARMENT_TAG_RE, (_match, _id, label) => (label ? String(label).trim() : " "));
  const clean = stripUnknownTagMarkup(withoutTags)
    .replace(/\s+/g, " ")
    .trim();

  const firstSentence = clean.split(/(?<=[.!?])\s+/).find(Boolean) || clean;
  if (firstSentence) return firstSentence.slice(0, 140);
  if (fallbackIds.length > 0) return "Current active look";
  return "";
}

export function normalizeStyleChatAssistantReply<TGarment extends StyleChatGarmentLike>(params: {
  rawText: string;
  validGarmentIds: Set<string>;
  rankedGarments: TGarment[];
  anchor: TGarment | null;
  activeLook: StyleChatActiveLookContext;
  placeOutfitTagFirst?: boolean;
  includeOutfitTag?: boolean;
}): NormalizedStyleChatAssistantReply {
  const candidate = pickStyleChatOutfitIdsFromText(
    params.rawText,
    params.validGarmentIds,
    params.rankedGarments,
  );
  const fallbackIds = buildStyleChatFallbackOutfitIds(
    params.rankedGarments,
    params.anchor,
    params.activeLook,
  );
  const rawIds = (candidate?.ids.length ? candidate.ids : fallbackIds).slice(0, 5);
  const deduplicatedIds = deduplicateStyleChatOutfitBySlot(rawIds, params.rankedGarments, params.anchor).slice(0, 5);
  const outfitIds = isCompleteStyleChatOutfitIds(deduplicatedIds, params.rankedGarments)
    ? deduplicatedIds
    : [];
  const explanation = (candidate?.explanation || buildOutfitExplanation(params.rawText, outfitIds))
    .replace(/[\[\]\n\r|]+/g, " ")
    .trim();
  const prose = stripRawIdReferences(stripUnknownTagMarkup(params.rawText.replace(VALID_OUTFIT_TAG_RE, "")));
  const shouldIncludeOutfitTag = params.includeOutfitTag ?? true;
  const outfitTag = shouldIncludeOutfitTag && outfitIds.length > 0
    ? `[[outfit:${outfitIds.join(",")}|${explanation || "Current active look"}]]`
    : null;
  const finalText = outfitTag
    ? params.placeOutfitTagFirst
      ? `${outfitTag}\n\n${prose}`.trim()
      : `${prose}\n\n${outfitTag}`.trim()
    : prose;

  return {
    text: finalText,
    outfitIds,
    outfitTag,
  };
}
