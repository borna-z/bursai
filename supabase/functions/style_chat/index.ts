import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";
import { VOICE_STYLIST_CHAT } from "../_shared/burs-voice.ts";
import {
  resolveActiveLookStatus,
  resolveStyleCardState,
  resolveStyleCardPolicy,
  resolveStyleResponseKind,
  shouldRenderStyleCardFromPolicy,
  mapClassifierToMode,
  CLASSIFIER_FALLBACK,
  type StyleChatActiveLookInput,
  type StyleChatResponseEnvelope,
  type StylistChatMode,
  type ClassifierResult,
} from "../_shared/style-chat-contract.ts";
import { classifyIntent, type ClassifierInput } from "../_shared/style-chat-classifier.ts";
import { buildAuthoritativeOutfitTag, invokeUnifiedStylistEngine, type UnifiedStylistResponse } from "../_shared/unified_stylist_engine.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, recordError, overloadResponse } from "../_shared/scale-guard.ts";
import { buildStyleChatFallbackOutfitIds, isCompleteStyleChatOutfitIds, normalizeStyleChatAssistantReply } from "../_shared/style-chat-normalizer.ts";
import { resolveCompleteOutfitIds } from "../_shared/complete-outfit-ids.ts";
import { logger } from "../_shared/logger.ts";


// Split module imports
import {
  getWardrobeContext,
  getRecentOutfitsContext,
  getRejectionsContext,
  buildTasteMemoryBlock,
  getCalendarContext,
  geocodeCity,
  fetchWeather,
} from "./wardrobe-context.ts";
import type { RecentOutfitsResult } from "./wardrobe-context.ts";
import {
  buildModeContract,
  buildRefinementContract,
  buildCandidateOutfits,
  buildCardFirstStylistText,
  buildStyleClarifierText,
  buildSuggestionChips,
  buildThreadBrief,
  buildVisualReasoning,
  buildOutfitExplanation,
  formatGarmentLine,
  formatGarmentList,
  trimToSentences,
} from "./prompt-builder.ts";

// ---------- i18n ----------

export const LANG_CONFIG: Record<string, { name: string; weatherLabel: string; todayLabel: string; tomorrowLabel: string; seasonNames: [string, string, string, string] }> = {
  sv: { name: "svenska", weatherLabel: "Väder just nu", todayLabel: "Idag", tomorrowLabel: "Imorgon", seasonNames: ["vår", "sommar", "höst", "vinter"] },
  en: { name: "English", weatherLabel: "Current weather", todayLabel: "Today", tomorrowLabel: "Tomorrow", seasonNames: ["spring", "summer", "autumn", "winter"] },
  no: { name: "norsk", weatherLabel: "Vær nå", todayLabel: "I dag", tomorrowLabel: "I morgen", seasonNames: ["vår", "sommer", "høst", "vinter"] },
  da: { name: "dansk", weatherLabel: "Vejr nu", todayLabel: "I dag", tomorrowLabel: "I morgen", seasonNames: ["forår", "sommer", "efterår", "vinter"] },
  fi: { name: "suomi", weatherLabel: "Sää nyt", todayLabel: "Tänään", tomorrowLabel: "Huomenna", seasonNames: ["kevät", "kesä", "syksy", "talvi"] },
  de: { name: "Deutsch", weatherLabel: "Wetter aktuell", todayLabel: "Heute", tomorrowLabel: "Morgen", seasonNames: ["Frühling", "Sommer", "Herbst", "Winter"] },
  fr: { name: "français", weatherLabel: "Météo actuelle", todayLabel: "Aujourd'hui", tomorrowLabel: "Demain", seasonNames: ["printemps", "été", "automne", "hiver"] },
  es: { name: "español", weatherLabel: "Clima actual", todayLabel: "Hoy", tomorrowLabel: "Mañana", seasonNames: ["primavera", "verano", "otoño", "invierno"] },
  it: { name: "italiano", weatherLabel: "Meteo attuale", todayLabel: "Oggi", tomorrowLabel: "Domani", seasonNames: ["primavera", "estate", "autunno", "inverno"] },
  pt: { name: "português", weatherLabel: "Clima atual", todayLabel: "Hoje", tomorrowLabel: "Amanhã", seasonNames: ["primavera", "verão", "outono", "inverno"] },
  nl: { name: "Nederlands", weatherLabel: "Weer nu", todayLabel: "Vandaag", tomorrowLabel: "Morgen", seasonNames: ["lente", "zomer", "herfst", "winter"] },
  pl: { name: "polski", weatherLabel: "Pogoda teraz", todayLabel: "Dziś", tomorrowLabel: "Jutro", seasonNames: ["wiosna", "lato", "jesień", "zima"] },
  ar: { name: "العربية", weatherLabel: "الطقس الحالي", todayLabel: "اليوم", tomorrowLabel: "غدًا", seasonNames: ["ربيع", "صيف", "خريف", "شتاء"] },
  fa: { name: "فارسی", weatherLabel: "آب‌و‌هوای فعلی", todayLabel: "امروز", tomorrowLabel: "فردا", seasonNames: ["بهار", "تابستان", "پاییز", "زمستان"] },
};

export function getLang(locale: string) {
  return LANG_CONFIG[locale] || LANG_CONFIG["en"];
}

const log = logger("style_chat");

function createRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `style-chat-${Date.now()}`;
  }
}


// ---------- helpers ----------

export interface MessageInput {
  role: string;
  content: string | unknown[];
}

export interface GarmentRecord {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  material: string | null;
  fit: string | null;
  formality: number | null;
  pattern: string | null;
  season_tags: string[] | null;
  wear_count: number | null;
  last_worn_at: string | null;
  image_path: string | null;
  ai_raw: Record<string, any> | null;
}

export interface RawSignal {
  signal_type: string;
  value: string | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
}

export interface AnchorSelection {
  anchor: GarmentRecord | null;
  explicitIds: string[];
  source: string | null;
}

export interface RetrievalResult {
  text: string;
  garmentCount: number;
  dominantArchetype: string | null;
  rankedGarments: GarmentRecord[];
  anchor: GarmentRecord | null;
  retrievalSummary: string;
}

export interface ActiveLookContext {
  summary: string;
  garmentIds: string[];
  source: string | null;
  garmentLines: string[];
}

export interface RefinementIntent {
  mode:
    | "swap_shoes"
    | "swap_layer"
    | "keep_jacket"
    | "cooler"
    | "less_formal"
    | "more_formal"
    | "more_elevated"
    | "warmer"
    | "sharper"
    | "softer"
    | "more_elegant"
    | "dinner"
    | "work"
    | "weekend"
    | "travel"
    | "simpler"
    | "bolder"
    | "use_less_worn"
    | "explain_why"
    | "targeted_refinement"
    | "new_look";
  raw: string;
}

interface StyleChatWeatherOverride {
  temperature?: number;
  precipitation?: string;
  wind?: string;
}

interface StructuredRefinementPlan {
  occasion: string;
  style: string | null;
  weather?: StyleChatWeatherOverride;
  lockedGarmentIds: string[];
  anchorLocked: boolean;
  anchorGarmentId: string | null;
  requestedEditSlots: string[];
  excludeGarmentIds: string[];
  preferGarmentIds: string[];
}

export function getMessageText(content: string | unknown[]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part: any) => {
      if (typeof part === "string") return part;
      if (part?.type === "text" && typeof part.text === "string") return part.text;
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

export function normalizeTerm(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

export function tokenize(text: string): string[] {
  return Array.from(new Set(
    normalizeTerm(text)
      .split(/[^a-z0-9åäöæøçéèüß]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  ));
}

function parseTaggedGarmentIds(text: string): string[] {
  return Array.from(text.matchAll(/\[\[garment:([a-f0-9-]{8,})(?:\|[^\]]+)?\]\]/gi)).map((m) => m[1]);
}

function parseTaggedOutfitIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(/\[\[outfit:([a-f0-9-,]+)\|[^\]]*\]\]/gi)) {
    match[1].split(",").map((id) => id.trim()).filter(Boolean).forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

export const VALID_GARMENT_TAG_RE = /\[\[garment:([a-f0-9-]+)(?:\|([^\]]+))?\]\]/gi;
export const VALID_OUTFIT_TAG_RE = /\[\[outfit:([a-f0-9-,]+)\|([^\]]*)\]\]/gi;
const ANY_DOUBLE_BRACKET_TAG_RE = /\[\[[\s\S]*?\]\]/g;
const PARTIAL_TAG_START_RE = /\[\[(?:garment|outfit):/i;
const PARTIAL_TAG_CHAR_RE = /[a-z0-9,\-|]/i;

interface NormalizedAssistantReply {
  text: string;
  outfitIds: string[];
  outfitTag: string | null;
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

export function stripUnknownTagMarkup(text: string): string {
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

function pickOutfitIdsFromText(
  text: string,
  garmentById: Map<string, GarmentRecord>,
): { ids: string[]; explanation: string } | null {
  let outfitMatch: RegExpExecArray | null;
  VALID_OUTFIT_TAG_RE.lastIndex = 0;
  let lastValidOutfit: { ids: string[]; explanation: string } | null = null;
  while ((outfitMatch = VALID_OUTFIT_TAG_RE.exec(text)) !== null) {
    const ids = resolveCompleteOutfitIds(
      outfitMatch[1].split(",").map((id) => id.trim()),
      garmentById,
    );
    if (ids.length > 0) lastValidOutfit = { ids, explanation: outfitMatch[2].trim() };
  }
  if (lastValidOutfit) return lastValidOutfit;

  const garmentIds = resolveCompleteOutfitIds(
    parseTaggedGarmentIds(text).filter((id) => garmentById.has(id)),
    garmentById,
  );
  if (garmentIds.length > 0) return { ids: garmentIds.slice(0, 5), explanation: "" };

  return null;
}

function buildFallbackOutfitIds(rankedGarments: GarmentRecord[], anchor: GarmentRecord | null, activeLook: ActiveLookContext): string[] {
  const garmentById = new Map(rankedGarments.map((garment) => [garment.id, garment]));
  if (activeLook.garmentIds.length > 0) return activeLook.garmentIds.slice(0, 5);

  // Group by canonical slot key so "jeans"/"pants"/"trousers" all map to "bottom" etc.
  const slots = new Map<string, GarmentRecord[]>();
  for (const garment of rankedGarments) {
    const key = getSlotKey(garment.category);
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key)!.push(garment);
  }

  const chosen: GarmentRecord[] = [];
  const usedSlots = new Set<string>();
  const pushUnique = (garment?: GarmentRecord | null) => {
    if (!garment) return;
    if (chosen.some((item) => item.id === garment.id)) return;
    const slot = getSlotKey(garment.category);
    if (usedSlots.has(slot)) return; // one per slot
    usedSlots.add(slot);
    chosen.push(garment);
  };

  if (anchor) pushUnique(anchor);
  if (chosen.length === 0) pushUnique((slots.get("dress") || [])[0]);
  if (chosen.length === 0) pushUnique((slots.get("top") || [])[0]);
  pushUnique((slots.get("bottom") || [])[0]);
  pushUnique((slots.get("shoes") || [])[0]);
  pushUnique((slots.get("outerwear") || [])[0]);

  return resolveCompleteOutfitIds(
    chosen.map((item) => item.id).slice(0, 5),
    garmentById,
  );
}

// ── Slot deduplication ──────────────────────────────────────────────────────

const SLOT_MAP: Record<string, string> = {
  // tops
  top: "top", shirt: "top", "t-shirt": "top", tshirt: "top", blouse: "top",
  sweater: "top", hoodie: "top", polo: "top", tank: "top", tank_top: "top",
  cardigan: "top", tröja: "top", skjorta: "top", knit: "top",
  // bottoms
  bottom: "bottom", pants: "bottom", jeans: "bottom", trousers: "bottom",
  shorts: "bottom", skirt: "bottom", chinos: "bottom", byxor: "bottom",
  kjol: "bottom", leggings: "bottom", culottes: "bottom",
  // shoes
  shoes: "shoes", sneakers: "shoes", boots: "shoes", loafers: "shoes",
  sandals: "shoes", heels: "shoes", skor: "shoes", stövlar: "shoes",
  footwear: "shoes", trainers: "shoes", oxfords: "shoes", mules: "shoes",
  // outerwear
  outerwear: "outerwear", jacket: "outerwear", coat: "outerwear",
  blazer: "outerwear", parka: "outerwear", windbreaker: "outerwear",
  jacka: "outerwear", kappa: "outerwear", rock: "outerwear",
  // dress / one-piece
  dress: "dress", jumpsuit: "dress", overall: "dress", klänning: "dress",
  // accessory
  accessory: "accessory", bag: "accessory", hat: "accessory",
  scarf: "accessory", belt: "accessory",
};

export function getSlotKey(category: string): string {
  const normalized = normalizeTerm(category);
  return SLOT_MAP[normalized] || normalized;
}

/**
 * Ensure the outfit contains at most one garment per slot.
 * The anchor garment always wins its slot. Order is preserved.
 */
function deduplicateOutfitBySlot(
  ids: string[],
  garments: GarmentRecord[],
  anchor: GarmentRecord | null,
): string[] {
  const garmentById = new Map(garments.map((g) => [g.id, g]));
  const seenSlots = new Set<string>();
  const result: string[] = [];

  // Anchor earns priority — place it first and claim its slot
  if (anchor && ids.includes(anchor.id)) {
    result.push(anchor.id);
    seenSlots.add(getSlotKey(anchor.category));
  }

  for (const id of ids) {
    if (anchor && id === anchor.id) continue; // already placed above
    const g = garmentById.get(id);
    if (!g) continue;
    const slot = getSlotKey(g.category);
    if (seenSlots.has(slot)) continue; // slot already claimed — skip duplicate
    seenSlots.add(slot);
    result.push(id);
  }

  return result;
}

/**
 * Remove raw [ID:uuid] patterns that occasionally leak from the AI's
 * wardrobe context into its prose output.
 */
function stripRawIdReferences(text: string): string {
  return text
    .replace(/\s*\[ID:[a-f0-9-]{8,}[^\]]*\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// ────────────────────────────────────────────────────────────────────────────


function normalizeAssistantReply(params: {
  rawText: string;
  validGarmentIds: Set<string>;
  rankedGarments: GarmentRecord[];
  anchor: GarmentRecord | null;
  activeLook: ActiveLookContext;
  placeOutfitTagFirst?: boolean;
  includeOutfitTag?: boolean;
}): NormalizedAssistantReply {
  const garmentById = new Map(
    params.rankedGarments
      .filter((garment) => params.validGarmentIds.has(garment.id))
      .map((garment) => [garment.id, garment] as const),
  );
  const candidate = pickOutfitIdsFromText(params.rawText, garmentById);
  const fallbackIds = buildFallbackOutfitIds(params.rankedGarments, params.anchor, params.activeLook);
  const rawIds = (candidate?.ids?.length ? candidate.ids : fallbackIds).slice(0, 6);
  // Deduplicate by slot — never emit two bottoms, two jackets, etc.
  const outfitIds = deduplicateOutfitBySlot(rawIds, params.rankedGarments, params.anchor).slice(0, 5);
  const explanation = (candidate?.explanation || buildOutfitExplanation(params.rawText, outfitIds)).replace(/[\[\]\n\r|]+/g, " ").trim();
  // Strip outfit tags then remove any leaked [ID:uuid] references from the prose
  const prose = stripRawIdReferences(stripUnknownTagMarkup(params.rawText.replace(VALID_OUTFIT_TAG_RE, "")));
  const shouldIncludeOutfitTag = params.includeOutfitTag ?? true;
  const outfitTag = shouldIncludeOutfitTag && outfitIds.length >= 2
    ? `[[outfit:${outfitIds.join(",")}|${explanation || "Current active look"}]]`
    : null;
  // Outfit tag is sent as priorityChunk by createSseTextResponse.
  // Never embed it in prose — prevents double-rendering on the frontend.
  const finalText = prose;

  return {
    text: finalText,
    outfitIds,
    outfitTag,
  };
}

function createSseTextResponse(envelope: StyleChatResponseEnvelope): Response {
  const encoder = new TextEncoder();
  const chunks = (envelope.assistant_text.match(/.{1,180}(?:\s|$)|\S+/g) || []).map((chunk) => chunk.trim()).filter(Boolean);

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "stylist_response", payload: envelope })}\n\n`));
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
      }
      if (envelope.suggestion_chips.length) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "suggestions", chips: envelope.suggestion_chips })}\n\n`));
      }
      if (envelope.truncated) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "metadata", truncated: true })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}


export function getGarmentSearchText(g: GarmentRecord): string {
  const aiRaw = g.ai_raw && typeof g.ai_raw === "object" ? g.ai_raw : {};
  const e = aiRaw.enrichment || aiRaw;
  return [
    g.title,
    g.category,
    g.subcategory,
    g.color_primary,
    g.color_secondary,
    g.material,
    g.fit,
    g.pattern,
    ...(g.season_tags || []),
    e.style_archetype,
    e.silhouette,
    ...(Array.isArray(e.occasion_tags) ? e.occasion_tags : []),
  ].filter(Boolean).join(" ");
}

export function rankGarmentForPrompt(g: GarmentRecord, queryTerms: string[], anchor: GarmentRecord | null, explicitIds: Set<string>): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const haystack = normalizeTerm(getGarmentSearchText(g));

  if (explicitIds.has(g.id)) {
    score += 100;
    reasons.push("explicit-anchor");
  }

  if (anchor && g.id === anchor.id) {
    score += 120;
    reasons.push("hero-piece");
  }

  if (anchor && g.id !== anchor.id) {
    if (normalizeTerm(g.color_primary) && normalizeTerm(g.color_primary) === normalizeTerm(anchor.color_primary)) {
      score += 10;
      reasons.push("shared-color");
    }
    if ((g.formality ?? 0) > 0 && (anchor.formality ?? 0) > 0) {
      const diff = Math.abs((g.formality ?? 0) - (anchor.formality ?? 0));
      score += Math.max(0, 8 - diff * 2);
      if (diff <= 1) reasons.push("matched-formality");
    }
    const aiRaw = g.ai_raw && typeof g.ai_raw === "object" ? g.ai_raw : {};
    const anchorRaw = anchor.ai_raw && typeof anchor.ai_raw === "object" ? anchor.ai_raw : {};
    const gStyle = normalizeTerm((aiRaw.enrichment || aiRaw).style_archetype);
    const anchorStyle = normalizeTerm((anchorRaw.enrichment || anchorRaw).style_archetype);
    if (gStyle && gStyle === anchorStyle) {
      score += 8;
      reasons.push("shared-archetype");
    }
  }

  for (const term of queryTerms) {
    if (haystack.includes(term)) {
      score += term.length >= 5 ? 6 : 4;
      reasons.push(`matched:${term}`);
    }
  }

  if ((g.wear_count ?? 0) === 0) {
    score += 4;
    reasons.push("fresh-piece");
  }

  const lastWorn = g.last_worn_at ? Date.parse(g.last_worn_at) : Number.NaN;
  if (!Number.isNaN(lastWorn)) {
    const daysAgo = (Date.now() - lastWorn) / 86400000;
    if (daysAgo > 21) {
      score += 3;
      reasons.push("not-recently-worn");
    }
  }

  return { score, reasons };
}

export function detectAnchorGarment(garments: GarmentRecord[], messages: MessageInput[], selectedGarmentIds: string[] = []): AnchorSelection {
  const garmentById = new Map(garments.map((g) => [g.id, g]));
  const explicitIds = selectedGarmentIds.filter((id) => garmentById.has(id));
  if (explicitIds.length > 0) {
    return { anchor: garmentById.get(explicitIds[0]) || null, explicitIds, source: "selected_garment_ids" };
  }

  const recentMessages = [...messages].slice(-6).reverse();
  for (const message of recentMessages) {
    const text = getMessageText(message.content);
    const taggedIds = parseTaggedGarmentIds(text).filter((id) => garmentById.has(id));
    if (taggedIds.length > 0) {
      return { anchor: garmentById.get(taggedIds[0]) || null, explicitIds: taggedIds, source: `message-tags:${message.role}` };
    }
  }

  const combinedText = recentMessages.map((message) => getMessageText(message.content)).join(" ");
  const anchorIntent = /(style around|build around|wear around|pair with|match with|use this|this piece|hero piece|starting with|anchor on)/i.test(combinedText);
  if (!anchorIntent) return { anchor: null, explicitIds: [], source: null };

  const scored = garments.map((g) => {
    const search = normalizeTerm(getGarmentSearchText(g));
    let score = 0;
    if (search && combinedText && normalizeTerm(combinedText).includes(normalizeTerm(g.title))) score += 10;
    if (g.color_primary && normalizeTerm(combinedText).includes(normalizeTerm(g.color_primary))) score += 4;
    if (g.subcategory && normalizeTerm(combinedText).includes(normalizeTerm(g.subcategory))) score += 4;
    if (normalizeTerm(combinedText).includes(normalizeTerm(g.category))) score += 3;
    return { garment: g, score };
  }).sort((a, b) => b.score - a.score);

  if ((scored[0]?.score || 0) > 0) {
    return { anchor: scored[0].garment, explicitIds: [scored[0].garment.id], source: "message-text-match" };
  }

  return { anchor: null, explicitIds: [], source: null };
}

function didUserExplicitlyReleaseAnchor(messages: MessageInput[], anchor: GarmentRecord | null, selectedGarmentIds: string[] = []): boolean {
  if (!anchor || !selectedGarmentIds.includes(anchor.id)) return false;

  const latestUser = normalizeTerm(getMessageText(messages.filter((message) => message.role === "user").slice(-1)[0]?.content || ""));
  if (!latestUser) return false;
  if (!/(remove|replace|swap out|change|drop|without|not this|don't use|do not use)/i.test(latestUser)) {
    return false;
  }

  const anchorTerms = [
    normalizeTerm(anchor.title),
    normalizeTerm(anchor.category),
    normalizeTerm(anchor.subcategory),
    "selected garment",
    "selected piece",
    "anchor",
    "hero piece",
  ].filter(Boolean);

  return anchorTerms.some((term) => term && latestUser.includes(term));
}

export function buildRankedGarmentSubset(
  ranked: Array<{ garment: GarmentRecord; score: number }>,
  anchor: GarmentRecord | null,
): GarmentRecord[] {
  const slotTargets = new Map<string, number>([
    ["top", 4],
    ["bottom", 4],
    ["shoes", 4],
    ["dress", 2],
    ["outerwear", 3],
    ["accessory", 2],
  ]);
  const selected: GarmentRecord[] = [];
  const selectedIds = new Set<string>();
  const selectedSlotCounts = new Map<string, number>();

  const pushGarment = (garment: GarmentRecord | null | undefined) => {
    if (!garment || selectedIds.has(garment.id)) return;
    selected.push(garment);
    selectedIds.add(garment.id);
    const slot = getSlotKey(garment.category);
    selectedSlotCounts.set(slot, (selectedSlotCounts.get(slot) || 0) + 1);
  };

  pushGarment(anchor);

  for (const entry of ranked) {
    const slot = getSlotKey(entry.garment.category);
    const target = slotTargets.get(slot);
    if (!target) continue;
    if ((selectedSlotCounts.get(slot) || 0) >= target) continue;
    pushGarment(entry.garment);
  }

  for (const entry of ranked) {
    if (selected.length >= 24) break;
    pushGarment(entry.garment);
  }

  return selected;
}

function resolveValidatedOutfitIds(
  ids: string[],
  garments: GarmentRecord[],
  lockedGarmentIds: string[],
): string[] {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 5);
  if (!uniqueIds.length) return [];
  if (!isCompleteStyleChatOutfitIds(uniqueIds, garments)) return [];
  if (lockedGarmentIds.some((id) => !uniqueIds.includes(id))) return [];
  return uniqueIds;
}


// detectRefinementIntent removed — replaced by AI classifier (classifyIntent)

// detectStylistChatMode removed — replaced by AI classifier (classifyIntent)


function buildActiveLookContext(
  messages: MessageInput[],
  garments: GarmentRecord[],
  explicitGarmentIds: string[] = [],
  explicitActiveLook: StyleChatActiveLookInput | null = null,
): ActiveLookContext {
  const garmentById = new Map(garments.map((g) => [g.id, g]));
  const explicitActiveLookIds = resolveCompleteOutfitIds(
    Array.isArray(explicitActiveLook?.garment_ids) ? explicitActiveLook.garment_ids.filter((id): id is string => typeof id === "string") : [],
    garmentById,
  );
  if (explicitActiveLookIds.length > 0) {
    const garmentsInLook = explicitActiveLookIds
      .map((id) => garmentById.get(id))
      .filter(Boolean) as GarmentRecord[];
    return {
      summary: garmentsInLook.map((item) => `${item.title} [ID:${item.id}]`).join(" + "),
      garmentIds: garmentsInLook.map((item) => item.id),
      source: explicitActiveLook?.source || "frontend_active_look",
      garmentLines: garmentsInLook.map(formatGarmentLine),
    };
  }

  const explicitLookIds = resolveCompleteOutfitIds(explicitGarmentIds, garmentById);
  if (explicitLookIds.length > 0) {
    const garmentsInLook = explicitLookIds
      .map((id) => garmentById.get(id))
      .filter(Boolean) as GarmentRecord[];
    return {
      summary: garmentsInLook.map((item) => `${item.title} [ID:${item.id}]`).join(" + "),
      garmentIds: garmentsInLook.map((item) => item.id),
      source: "selected_garment_ids",
      garmentLines: garmentsInLook.map(formatGarmentLine),
    };
  }

  const assistantMessages = messages.filter((m) => m.role === "assistant").slice(-4).reverse();

  for (const message of assistantMessages) {
    const text = getMessageText(message.content);
    const taggedOutfitIds = resolveCompleteOutfitIds(
      Array.from(new Set(parseTaggedOutfitIds(text).filter((id) => garmentById.has(id)))).slice(0, 5),
      garmentById,
    );
    const taggedGarmentIds = resolveCompleteOutfitIds(
      Array.from(new Set(parseTaggedGarmentIds(text).filter((id) => garmentById.has(id)))).slice(0, 5),
      garmentById,
    );
    const ids = taggedOutfitIds.length > 0 ? taggedOutfitIds : taggedGarmentIds;
    if (!ids.length) continue;
    const garmentsInLook = ids.map((id) => garmentById.get(id)).filter(Boolean) as GarmentRecord[];
    const summary = garmentsInLook
      .map((item) => `${item.title} [ID:${item.id}]`)
      .join(" + ");

    return {
      summary,
      garmentIds: garmentsInLook.map((item) => item.id),
      source: taggedOutfitIds.length > 0 ? "assistant_outfit_tag" : "assistant_garment_tags",
      garmentLines: garmentsInLook.map(formatGarmentLine),
    };
  }

  return { summary: "", garmentIds: [], source: null, garmentLines: [] };
}


function getRefinementEditableSlots(intent: RefinementIntent, activeLookGarments: GarmentRecord[]): string[] {
  const activeSlots = new Set(activeLookGarments.map((garment) => getSlotKey(garment.category)));
  const baseTopSlot = activeSlots.has("dress") ? "dress" : "top";

  switch (intent.mode) {
    case "swap_shoes":
      return ["shoes"];
    case "swap_layer":
      return activeSlots.has("outerwear") ? ["outerwear"] : [baseTopSlot];
    case "keep_jacket":
      return ["shoes", baseTopSlot, "bottom", "dress", "accessory"];
    case "warmer":
    case "cooler":
    case "less_formal":
    case "more_formal":
    case "more_elevated":
    case "more_elegant":
    case "sharper":
    case "softer":
    case "dinner":
    case "work":
    case "weekend":
    case "travel":
    case "simpler":
    case "bolder":
    case "targeted_refinement":
      return Array.from(new Set(["shoes", "outerwear", baseTopSlot, "accessory"]));
    case "use_less_worn":
      return Array.from(new Set([baseTopSlot, "bottom", "dress", "shoes", "outerwear", "accessory"]));
    default:
      return [];
  }
}

function buildStructuredRefinementPlan(params: {
  intent: RefinementIntent;
  activeLook: ActiveLookContext;
  rankedGarments: GarmentRecord[];
  anchor: GarmentRecord | null;
  dominantArchetype: string | null;
  selectedGarmentIds: string[];
  anchorReleased: boolean;
}): StructuredRefinementPlan {
  const garmentById = new Map(params.rankedGarments.map((garment) => [garment.id, garment]));
  const activeLookGarments = params.activeLook.garmentIds
    .map((id) => garmentById.get(id))
    .filter(Boolean) as GarmentRecord[];
  const editableSlots = getRefinementEditableSlots(params.intent, activeLookGarments);
  const editableSlotSet = new Set(editableSlots);
  const activeSlotMap = new Map(activeLookGarments.map((garment) => [getSlotKey(garment.category), garment]));

  const lockedGarmentIds = activeLookGarments
    .filter((garment) => !editableSlotSet.has(getSlotKey(garment.category)))
    .map((garment) => garment.id);
  const anchorLocked = Boolean(params.anchor && params.selectedGarmentIds.includes(params.anchor.id) && !params.anchorReleased);
  if (anchorLocked && params.anchor && !lockedGarmentIds.includes(params.anchor.id)) {
    lockedGarmentIds.unshift(params.anchor.id);
  }

  const excludeGarmentIds: string[] = [];
  if (params.intent.mode === "swap_shoes") {
    const currentShoes = activeSlotMap.get("shoes");
    if (currentShoes) excludeGarmentIds.push(currentShoes.id);
  }
  if (params.intent.mode === "swap_layer") {
    const currentLayer = activeSlotMap.get("outerwear") || activeSlotMap.get("top") || activeSlotMap.get("dress");
    if (currentLayer) excludeGarmentIds.push(currentLayer.id);
  }

  const occasionMap: Partial<Record<RefinementIntent["mode"], string>> = {
    less_formal: "casual",
    more_formal: "formal",
    dinner: "dinner",
    work: "work",
    weekend: "weekend",
    travel: "travel",
  };
  const styleMap: Partial<Record<RefinementIntent["mode"], string>> = {
    less_formal: "casual",
    more_formal: "sharp",
    more_elevated: "sharp",
    sharper: "sharp",
    softer: "soft",
    more_elegant: "elegant",
    simpler: "minimal",
    travel: "minimal",
    bolder: "bold",
  };
  const weatherMap: Partial<Record<RefinementIntent["mode"], StyleChatWeatherOverride>> = {
    warmer: { temperature: 5, precipitation: "none", wind: "medium" },
    cooler: { temperature: 26, precipitation: "none", wind: "low" },
  };

  const preferGarmentIds = Array.from(new Set(
    [
      ...params.activeLook.garmentIds,
      ...(params.anchor ? [params.anchor.id] : []),
    ].filter((id) => !excludeGarmentIds.includes(id)),
  ));

  return {
    occasion: occasionMap[params.intent.mode] || "everyday",
    style: styleMap[params.intent.mode] || params.dominantArchetype,
    weather: weatherMap[params.intent.mode],
    lockedGarmentIds: Array.from(new Set(lockedGarmentIds)),
    anchorLocked,
    anchorGarmentId: params.anchor?.id || null,
    requestedEditSlots: editableSlots,
    excludeGarmentIds,
    preferGarmentIds,
  };
}
















function chooseChatComplexity(messages: MessageInput[], anchor: GarmentRecord | null): "standard" | "complex" {
  const latestUserTurn = getMessageText(messages.filter((m) => m.role === "user").slice(-1)[0]?.content || "");
  const hardAsk = /(capsule|wedding|interview|client dinner|date night|trip|travel|pack|formal|black tie|presentation|multiple looks|three looks|5 looks|why|explain|compare|elevate|style around|build around|anchor)/i.test(latestUserTurn);
  if (anchor || hardAsk || latestUserTurn.length > 180) return "complex";
  return "standard";
}

function isRefinementTurn(intent: RefinementIntent, activeLook: ActiveLookContext): boolean {
  return intent.mode !== "new_look" && activeLook.garmentIds.length >= 2;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const requestId = createRequestId();
    const requestStartedAt = Date.now();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    log.info("request.start", { requestId, userId: user.id });

    const {
      messages,
      locale: rawLocale,
      selected_garment_ids,
      active_look,
      garmentCount: _clientGarmentCount,
      archetype: _clientArchetype,
      locked_slots,
    } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const locale = (typeof rawLocale === "string" && LANG_CONFIG[rawLocale]) ? rawLocale : "sv";
    const lang = getLang(locale);
    const explicitActiveLook = active_look && typeof active_look === "object" ? active_look as StyleChatActiveLookInput : null;
    const selectedGarmentIds = Array.from(new Set([
      ...(Array.isArray(selected_garment_ids) ? selected_garment_ids.filter((id) => typeof id === "string") : []),
      ...(explicitActiveLook?.anchor_locked && typeof explicitActiveLook.anchor_garment_id === "string"
        ? [explicitActiveLook.anchor_garment_id]
        : []),
    ]));

    // Guard: trim excessively long conversations
    const MAX_MESSAGES = 30;
    const trimmedMessages = Array.isArray(messages) && messages.length > MAX_MESSAGES
      ? [...messages.slice(0, 2), ...messages.slice(-18)]
      : messages;
    const safeMessages = trimmedMessages.map((m: any) => {
      if (typeof m.content === "string" && m.content.length > 8000) {
        return { ...m, content: m.content.slice(0, 8000) + "\u2026" };
      }
      return m;
    });

    // ── Scale guard: rate limit + overload protection ──
    if (checkOverload("style_chat")) {
      return overloadResponse(CORS_HEADERS);
    }
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await enforceRateLimit(serviceClient, user.id, "style_chat");

    // ── Fast path: skip expensive DB queries for trivial conversational turns ──
    const safeMessagesQuick = (Array.isArray(messages) ? messages : []).slice(-3);
    const latestUserQuick = safeMessagesQuick
      .filter((m: any) => m.role === "user")
      .slice(-1)[0];
    const latestUserText = typeof latestUserQuick?.content === "string"
      ? latestUserQuick.content.trim()
      : "";

    const SHORT_RE_QUICK = /^(hi|hey|hello|thanks|thank you|thx|ty|cheers|great|perfect|ok|okay|got it|sounds good|nice|cool|awesome|love it|makes sense|understood|noted|sure|yep|yes|no|nope|not really|maybe|haha|lol|exactly|absolutely|fair enough|interesting|good point|right|good|alright|sweet|neat|bet|word|will do|ah|oh|wow)[!.,?\s]*$/i;

    const isQuickConversational = SHORT_RE_QUICK.test(latestUserText)
      && !selected_garment_ids?.length
      && !explicitActiveLook?.anchor_garment_id;

    if (isQuickConversational) {
      const quickReply = await callBursAI({
        functionName: "style_chat",
        messages: [
          {
            role: "system",
            content: `You are a warm personal stylist assistant. The user is chatting casually. Reply naturally in 1-2 sentences maximum in ${lang.name}. Do not mention outfits or clothing unless directly asked.`,
          },
          { role: "user", content: latestUserText },
        ],
        complexity: "trivial",
        cacheTtlSeconds: 0,
        cacheNamespace: "style_chat_quick",
      });

      const quickText = typeof quickReply.data === "string" ? quickReply.data : "Hey! How can I help you today?";

      const quickActiveLook = explicitActiveLook && typeof explicitActiveLook === "object"
        ? explicitActiveLook
        : null;

      const quickEnvelope: StyleChatResponseEnvelope = {
        kind: "stylist_response",
        mode: "CONVERSATIONAL",
        response_kind: "analysis",
        card_policy: "optional",
        card_state: "unavailable",
        assistant_text: quickText,
        outfit_ids: [],
        outfit_explanation: "",
        garment_mentions: [],
        suggestion_chips: [],
        truncated: false,
        active_look_status: quickActiveLook?.garment_ids?.length ? "preserved" : "unavailable",
        active_look: quickActiveLook?.garment_ids?.length
          ? {
              garment_ids: quickActiveLook.garment_ids,
              explanation: quickActiveLook.explanation ?? null,
              source: "preserved_conversational",
              status: "preserved",
              card_state: "preserved",
              anchor_garment_id: quickActiveLook.anchor_garment_id ?? null,
              anchor_locked: quickActiveLook.anchor_locked ?? false,
            }
          : { garment_ids: [], explanation: null, source: null, status: "unavailable", card_state: "unavailable", anchor_garment_id: null, anchor_locked: false },
        fallback_used: false,
        degraded_reason: null,
        render_outfit_card: false,
        clear_active_look: false,
      };

      log.info("request.complete", { requestId, userId: user.id, stage: "quick_conversational", durationMs: Date.now() - requestStartedAt });
      return createSseTextResponse(quickEnvelope);
    }

    // ── Intent classification (Pass 1) ──
    const hasActiveLookForClassifier = Array.isArray(explicitActiveLook?.garment_ids) && explicitActiveLook.garment_ids.length >= 2;
    const hasAnchorForClassifier = Array.isArray(selected_garment_ids) && selected_garment_ids.length > 0;
    const garmentCountNum = typeof _clientGarmentCount === "number" ? _clientGarmentCount : 0;
    let classifierResult: ClassifierResult;

    // NOTE: garmentCountNum is client-supplied and may be 0 while the
    // React Query count is still loading.  We always run the classifier
    // and defer the empty-wardrobe override to AFTER the DB queries
    // where we have the authoritative wardrobeCtx.garmentCount.
    {
      const lastTwoMessages = safeMessagesQuick
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .slice(-2)
        .map((m: any) => ({
          role: m.role as string,
          text: typeof m.content === "string" ? m.content.slice(0, 150) : "",
        }));

      const classifierInput: ClassifierInput = {
        userMessage: latestUserText,
        hasActiveLook: hasActiveLookForClassifier,
        hasAnchor: hasAnchorForClassifier,
        garmentCount: garmentCountNum,
        lastMessages: lastTwoMessages,
        lockedSlots: Array.isArray(locked_slots) ? locked_slots : [],
      };

      const classifierPromise = classifyIntent(classifierInput, async (msgs, complexity) => {
        const resp = await callBursAI({
          functionName: "style_chat",
          messages: msgs.map((m) => ({ role: m.role as "system" | "user", content: m.content })),
          complexity: complexity as "trivial",
          cacheTtlSeconds: 0,
          cacheNamespace: "style_chat_classifier",
        });
        return typeof resp.data === "string" ? resp.data : "";
      });

      // Timeout fallback: use conversation + needs_more_context=false so
      // clear requests aren't blocked. The AI call will handle it naturally.
      // (CLASSIFIER_FALLBACK has needs_more_context=true which would force
      // a clarifying question even for "put together a work outfit".)
      const TIMEOUT_FALLBACK: ClassifierResult = {
        intent: "conversation",
        needs_more_context: false,
        refinement_hint: null,
        locked_slots: null,
        clear_active_look: false,
      };
      const timeoutPromise = new Promise<ClassifierResult>((resolve) =>
        setTimeout(() => resolve(TIMEOUT_FALLBACK), 3000)
      );

      classifierResult = await Promise.race([classifierPromise, timeoutPromise]);
    }

    const specialtyModes = new Set(["PURCHASE_PRIORITIZATION", "WARDROBE_GAP_ANALYSIS", "PLANNING", "STYLE_IDENTITY_ANALYSIS"]);
    // needs_more_context forces CONVERSATIONAL — the AI will ask follow-ups
    // instead of generating an outfit with insufficient context.
    const classifiedMode: StylistChatMode = classifierResult.needs_more_context
      ? "CONVERSATIONAL"
      : specialtyModes.has(classifierResult.intent as string)
        ? classifierResult.intent as StylistChatMode
        : mapClassifierToMode(classifierResult, hasAnchorForClassifier);

    const [profileRes, calendarCtx, recentOutfitsCtx, rejectionsCtx, wardrobeCtx, pairMemoryRes, negPairMemoryRes] = await Promise.all([
      supabase.from("profiles").select("display_name, preferences, home_city, height_cm, weight_kg").eq("id", user.id).single(),
      getCalendarContext(supabase, user.id, lang),
      getRecentOutfitsContext(supabase, user.id),
      getRejectionsContext(supabase, user.id),
      getWardrobeContext(supabase, user.id, safeMessages as MessageInput[], selectedGarmentIds),
      supabase
        .from('garment_pair_memory')
        .select('garment_a_id, garment_b_id, positive_count, negative_count')
        .eq('user_id', user.id)
        .order('positive_count', { ascending: false })
        .limit(50),
      supabase
        .from('garment_pair_memory')
        .select('garment_a_id, garment_b_id, positive_count, negative_count')
        .eq('user_id', user.id)
        .gt('negative_count', 0)
        .order('negative_count', { ascending: false })
        .limit(20),
    ]);

    // --- Taste memory ---
    const wornCount = wardrobeCtx.rankedGarments.filter(g => (g.wear_count ?? 0) > 0).length;
    const formalityValues = wardrobeCtx.rankedGarments
      .filter(g => g.formality != null && (g.wear_count ?? 0) > 0)
      .map(g => g.formality as number);
    const formalityCenter = formalityValues.length >= 3
      ? formalityValues.reduce((a, b) => a + b, 0) / formalityValues.length
      : null;
    const dna = { archetype: wardrobeCtx.dominantArchetype, formalityCenter };
    const rawSignals = rejectionsCtx.raw;
    const shouldIncludeTasteMemory =
      (rawSignals.filter((s: any) => s.signal_type === 'reject').length >= 1) ||
      (rawSignals.filter((s: any) => s.signal_type === 'wear').length >= 3) ||
      !!(dna?.archetype || (dna as any)?.signatureColors?.length);
    const tasteMemoryBlock = shouldIncludeTasteMemory
      ? buildTasteMemoryBlock(rejectionsCtx.raw, wardrobeCtx.rankedGarments, dna)
      : "";

    // --- Pair memory ---
    let pairMemoryText = '';
    const pairRows = pairMemoryRes?.data || [];
    if (pairRows.length >= 2) {
      const gById = new Map(wardrobeCtx.rankedGarments.map((g: any) => [g.id, g]));
      const pos = pairRows
        .filter((r: any) => r.positive_count > (r.negative_count ?? 0))
        .slice(0, 5)
        .map((r: any) => {
          const a = gById.get(r.garment_a_id)?.title;
          const b = gById.get(r.garment_b_id)?.title;
          return a && b ? `${a} + ${b}` : null;
        })
        .filter(Boolean);
      if (pos.length) {
        pairMemoryText = `\nLEARNED PAIRINGS (user saved these before):\n${pos.map((p: any) => `+ ${p}`).join('\n')}`;
      }

      const negRows = negPairMemoryRes?.data || [];
      const neg = negRows
        .filter((r: any) => r.negative_count >= 2 && r.negative_count > (r.positive_count ?? 0))
        .slice(0, 4)
        .map((r: any) => {
          const a = gById.get(r.garment_a_id)?.title;
          const b = gById.get(r.garment_b_id)?.title;
          return a && b ? `${a} + ${b}` : null;
        })
        .filter(Boolean);

      if (neg.length) {
        pairMemoryText += `\nAVOID THESE COMBINATIONS (user rejected these before):\n${neg.map((p: any) => `✗ ${p}`).join('\n')}`;
      }
    }

    const profile = profileRes.data;

    let weatherCtx = "";
    if (profile?.home_city) {
      const coords = await geocodeCity(profile.home_city);
      if (coords) {
        weatherCtx = await fetchWeather(coords.lat, coords.lon, lang);
        if (!weatherCtx) {
          log.warn("weather.degraded", { requestId, userId: user.id, stage: "weather_unavailable" });
        }
      } else {
        log.warn("weather.degraded", { requestId, userId: user.id, stage: "geocode_unavailable" });
      }
    }

    const heightCm = profile?.height_cm;
    const weightKg = profile?.weight_kg;
    let bodyContext = "";
    if (heightCm) {
      bodyContext = `\nBody: ${heightCm} cm${weightKg ? `, ${weightKg} kg` : ""}`;
    }

    const preferences = profile?.preferences as Record<string, unknown> || {};
    const sp = preferences.styleProfile as Record<string, any> | undefined;
    let styleLines = "";
    if (sp) {
      const parts: string[] = [];
      if (sp.gender) parts.push(`Gender: ${sp.gender}`);
      if (sp.ageRange) parts.push(`Age: ${sp.ageRange}`);
      if (sp.climate) parts.push(`Climate: ${sp.climate}`);
      if (sp.weekdayLife) parts.push(`Weekday: ${sp.weekdayLife}`);
      if (sp.workFormality) parts.push(`Work formality: ${sp.workFormality}`);
      if (sp.weekendLife) parts.push(`Weekend: ${sp.weekendLife}`);
      if (sp.styleWords?.length) parts.push(`Style words: ${sp.styleWords.join(", ")}`);
      if (sp.comfortVsStyle !== undefined) parts.push(`Comfort vs style: ${sp.comfortVsStyle}/100`);
      if (sp.adventurousness) parts.push(`Adventurousness: ${sp.adventurousness}`);
      if (sp.trendFollowing) parts.push(`Trend following: ${sp.trendFollowing}`);
      if (sp.genderNeutral) parts.push("Gender-neutral styling");
      if (sp.fit) parts.push(`Fit: ${sp.fit}`);
      if (sp.layering) parts.push(`Layering: ${sp.layering}`);
      if (sp.topFit) parts.push(`Top fit: ${sp.topFit}`);
      if (sp.bottomLength) parts.push(`Bottom length: ${sp.bottomLength}`);
      if (sp.favoriteColors?.length) parts.push(`Favorite colors: ${sp.favoriteColors.join(", ")}`);
      if (sp.dislikedColors?.length) parts.push(`Avoids: ${sp.dislikedColors.join(", ")}`);
      if (sp.paletteVibe) parts.push(`Palette vibe: ${sp.paletteVibe}`);
      if (sp.patternFeeling) parts.push(`Pattern: ${sp.patternFeeling}`);
      if (sp.shoppingMindset) parts.push(`Shopping: ${sp.shoppingMindset}`);
      if (sp.sustainability) parts.push(`Sustainability: ${sp.sustainability}`);
      if (sp.capsuleWardrobe) parts.push(`Capsule wardrobe: ${sp.capsuleWardrobe}`);
      if (sp.wardrobeFrustrations?.length) parts.push(`Frustrations: ${sp.wardrobeFrustrations.join(", ")}`);
      if (sp.styleIcons) parts.push(`Inspired by: ${sp.styleIcons}`);
      if (sp.hardestOccasions?.length) parts.push(`Hardest to dress for: ${sp.hardestOccasions.join(", ")}`);
      if (sp.fabricFeel) parts.push(`Favorite fabric: ${sp.fabricFeel}`);
      if (sp.signaturePieces) parts.push(`Signature pieces: ${sp.signaturePieces}`);
      if (sp.primaryGoal) parts.push(`Primary goal: ${sp.primaryGoal}`);
      if (sp.morningTime) parts.push(`Morning routine: ${sp.morningTime}`);
      if (sp.freeNote) parts.push(`Personal note: ${sp.freeNote}`);
      styleLines = parts.join(". ");
    } else {
      styleLines = [
        (preferences.favoriteColors as string[])?.length ? `Favorite colors: ${(preferences.favoriteColors as string[]).join(", ")}` : "",
        (preferences.dislikedColors as string[])?.length ? `Dislikes: ${(preferences.dislikedColors as string[]).join(", ")}` : "",
        preferences.fitPreference ? `Fit: ${preferences.fitPreference}` : "",
        preferences.styleVibe ? `Style: ${preferences.styleVibe}` : "",
      ].filter(Boolean).join(". ");
    }

    const currentMonth = new Date().getMonth();
    const seasonIdx = currentMonth >= 2 && currentMonth <= 4 ? 0 : currentMonth >= 5 && currentMonth <= 7 ? 1 : currentMonth >= 8 && currentMonth <= 10 ? 2 : 3;
    const seasonHint = lang.seasonNames[seasonIdx];

    const identityParts: string[] = [];
    identityParts.push(`This user's wardrobe has ${wardrobeCtx.garmentCount} garments.`);
    if (wardrobeCtx.dominantArchetype) {
      identityParts.push(`Their dominant style is ${wardrobeCtx.dominantArchetype}.`);
    }
    if (recentOutfitsCtx.occasions.length > 0) {
      identityParts.push(`Recent outfit occasions: ${recentOutfitsCtx.occasions.join(", ")}.`);
    }
    if (wardrobeCtx.anchor) {
      identityParts.push(`Current hero garment: ${wardrobeCtx.anchor.title} [ID:${wardrobeCtx.anchor.id}].`);
    }
    const identityBlock = identityParts.join("\n");

    const activeLook = buildActiveLookContext(safeMessages as MessageInput[], wardrobeCtx.rankedGarments, selectedGarmentIds, explicitActiveLook);
    const latestUser = normalizeTerm(getMessageText(safeMessages.filter((message: any) => message.role === "user").slice(-1)[0]?.content || ""));
    const mapHintToRefinementMode = (hint: string | null, intent: string): RefinementIntent["mode"] => {
      // When the classifier says "refine" but gives no specific hint,
      // default to targeted_refinement (permissive) not new_look (locks everything).
      if (!hint) return intent === "refine_outfit" ? "targeted_refinement" : "new_look";
      const direct: Record<string, RefinementIntent["mode"]> = {
        warmer: "warmer", cooler: "cooler", more_formal: "more_formal", less_formal: "less_formal",
        swap_shoes: "swap_shoes", use_less_worn: "use_less_worn",
        swap_outerwear: "swap_layer", swap_top: "targeted_refinement",
        swap_bottom: "targeted_refinement", different_style: "targeted_refinement",
      };
      return direct[hint] ?? "targeted_refinement";
    };
    const refinementIntent: RefinementIntent = {
      mode: mapHintToRefinementMode(classifierResult.refinement_hint, classifierResult.intent),
      raw: latestUser,
    };
    const threadBrief = buildThreadBrief(safeMessages as MessageInput[], wardrobeCtx.anchor, activeLook, refinementIntent);
    // needs_more_context MUST be checked first — it overrides intent.
    // "I have a wedding today" → intent=generate_outfit + needs_more_context=true → clarify (ask follow-ups)
    const styleIntent: StyleChatIntentKind =
      classifierResult.needs_more_context ? "clarify"
      : classifierResult.intent === "generate_outfit" ? "create"
      : classifierResult.intent === "refine_outfit" ? "refine"
      : classifierResult.intent === "explain_outfit" ? "explain"
      : "create";
    const anchorReleased = didUserExplicitlyReleaseAnchor(safeMessages as MessageInput[], wardrobeCtx.anchor, selectedGarmentIds);
    const refinementPlan = buildStructuredRefinementPlan({
      intent: refinementIntent,
      activeLook,
      rankedGarments: wardrobeCtx.rankedGarments,
      anchor: wardrobeCtx.anchor,
      dominantArchetype: wardrobeCtx.dominantArchetype,
      selectedGarmentIds,
      anchorReleased,
    });

    // Merge user-provided tap-to-lock IDs into the canonical lock set so
    // ALL downstream consumers (engine call, validation, rescue) respect them.
    if (Array.isArray(locked_slots) && locked_slots.length > 0) {
      const wardrobeIds = new Set(wardrobeCtx.rankedGarments.map((g: any) => g.id));
      const validLocks = locked_slots.filter((id: string) => wardrobeIds.has(id));
      const existing = new Set(refinementPlan.lockedGarmentIds);
      for (const id of validLocks) {
        if (!existing.has(id)) {
          refinementPlan.lockedGarmentIds.push(id);
        }
      }
    }

    const stylistMode = classifiedMode;
    const refinementContract = buildRefinementContract(refinementIntent, activeLook);
    const modeContract = buildModeContract(stylistMode, lang);
    const chatComplexity = stylistMode === "CONVERSATIONAL"
      ? "trivial" as const
      : chooseChatComplexity(safeMessages as MessageInput[], wardrobeCtx.anchor);
    const refinementTurn = stylistMode === "ACTIVE_LOOK_REFINEMENT" && isRefinementTurn(refinementIntent, activeLook);

    const hasStableActiveLook = activeLook.garmentIds.length >= 2;
    const shouldAskClarifyingQuestion = styleIntent === "clarify";
    const resolvedCardPolicy = resolveStyleCardPolicy({
      mode: stylistMode,
      hasActiveLook: hasStableActiveLook,
      hasAnchor: refinementPlan.anchorLocked || Boolean(wardrobeCtx.anchor),
    });
    const cardPolicy = shouldAskClarifyingQuestion
      ? (hasStableActiveLook ? "preserve_if_exists" : "optional")
      : resolvedCardPolicy;
    const shouldPreserveStyleCard = cardPolicy !== "optional";

    const taggingContract = shouldPreserveStyleCard
      ? `GARMENT TAGS:
- The current active look is rendered from structured response metadata first.
- Only use garment tags sparingly if they genuinely clarify a specific garment reference.
- Never rely on raw outfit tag prose as the only source of outfit truth.`
      : `GARMENT TAGS:
- Do NOT emit outfit tags in this mode unless the user explicitly asks for one concrete outfit.
- You may still use [[garment:ID]] tags sparingly where they improve clarity.
- Prioritize mode-specific analysis structure over card markup in this mode.`;

    const shouldCallUnifiedEngine = cardPolicy === "required" && !shouldAskClarifyingQuestion;
    const candidateOutfits = (!shouldAskClarifyingQuestion && !shouldCallUnifiedEngine && stylistMode !== "WARDROBE_GAP_ANALYSIS" && stylistMode !== "PURCHASE_PRIORITIZATION" && stylistMode !== "STYLE_IDENTITY_ANALYSIS" && stylistMode !== "CONVERSATIONAL")
      ? buildCandidateOutfits(wardrobeCtx.rankedGarments, wardrobeCtx.anchor)
      : "";

    const unifiedRequestMode = stylistMode === "ACTIVE_LOOK_REFINEMENT"
      ? (refinementIntent.mode === "swap_shoes" ? "swap" : "refine")
      : "generate";
    let unified: UnifiedStylistResponse | null = null;
    let unifiedFailureReason: string | null = null;
    if (shouldCallUnifiedEngine) {
      try {
        unified = await invokeUnifiedStylistEngine({
          authToken: token,
          request: {
            mode: unifiedRequestMode,
            generator_mode: "stylist",
            occasion: refinementPlan.occasion,
            style: refinementPlan.style,
            weather: refinementPlan.weather,
            locale,
            prefer_garment_ids: refinementPlan.preferGarmentIds,
            exclude_garment_ids: refinementPlan.excludeGarmentIds,
            active_look_garment_ids: activeLook.garmentIds,
            locked_garment_ids: [
              ...refinementPlan.lockedGarmentIds,
              ...(refinementPlan.anchorLocked && refinementPlan.anchorGarmentId
                ? [refinementPlan.anchorGarmentId]
                : []),
              // tap-to-lock IDs already merged into refinementPlan.lockedGarmentIds above
            ],
            requested_edit_slots: refinementPlan.requestedEditSlots,
            output_count: 1,
            explanation_mode: "short",
          },
        });
      } catch (error) {
        unifiedFailureReason = error instanceof Error ? error.message : String(error);
        log.warn("unified_engine.degraded", {
          requestId,
          userId: user.id,
          stage: "unified_engine_failed",
          error: unifiedFailureReason,
        });
      }
    }
    const unifiedOutfit = unified?.outfits[0] || null;
    const refinementDeltaBlock = (() => {
      const delta = (unifiedOutfit as any)?.refinement_delta;
      if (!delta || stylistMode !== 'ACTIVE_LOOK_REFINEMENT') return '';
      const kept = delta.kept?.join(', ');
      const swapped = delta.swapped?.map((s: any) => `${s.from} → ${s.to}`).join(', ');
      const parts: string[] = [];
      if (kept) parts.push(`Kept: ${kept}`);
      if (swapped) parts.push(`Swapped: ${swapped}`);
      return parts.length ? `REFINEMENT CHANGES:\n${parts.join('\n')}` : '';
    })();
    const activeLookGarments = activeLook.garmentIds
      .map((id) => wardrobeCtx.rankedGarments.find((garment) => garment.id === id))
      .filter(Boolean) as GarmentRecord[];
    const validatedActiveLookIds = resolveValidatedOutfitIds(
      activeLook.garmentIds,
      wardrobeCtx.rankedGarments,
      refinementPlan.anchorLocked && refinementPlan.anchorGarmentId ? [refinementPlan.anchorGarmentId] : [],
    );
    const validatedUnifiedOutfitIds = resolveValidatedOutfitIds(
      unifiedOutfit?.garment_ids || [],
      wardrobeCtx.rankedGarments,
      refinementPlan.lockedGarmentIds,
    );
    const deterministicRescueOutfitIds = shouldPreserveStyleCard
      ? buildStyleChatFallbackOutfitIds(
        wardrobeCtx.rankedGarments,
        wardrobeCtx.anchor,
        activeLook,
        {
          lockedGarmentIds: refinementPlan.lockedGarmentIds,
          requestedEditSlots: refinementPlan.requestedEditSlots,
          preferGarmentIds: refinementPlan.preferGarmentIds,
        },
      )
      : [];
    const authoritativeOutfitIds = shouldAskClarifyingQuestion
      ? (shouldPreserveStyleCard ? validatedActiveLookIds : [])
      : validatedUnifiedOutfitIds.length > 0
        ? validatedUnifiedOutfitIds
        : deterministicRescueOutfitIds.length > 0
          ? deterministicRescueOutfitIds
          : shouldPreserveStyleCard
            ? validatedActiveLookIds
            : [];
    const authoritativeOutfitTag = buildAuthoritativeOutfitTag(
      authoritativeOutfitIds,
      unifiedOutfit?.rationale || "",
    );
    const unifiedCandidateLine = authoritativeOutfitTag
      ? `\nUNIFIED OUTFIT DECISION (authoritative): ${authoritativeOutfitTag}`
      : "";
    const authoritativeOutfitGarments = authoritativeOutfitIds
      .map((id) => wardrobeCtx.rankedGarments.find((garment) => garment.id === id))
      .filter(Boolean) as GarmentRecord[];
    const canUseCardFirstText = stylistMode === "OUTFIT_GENERATION"
      || stylistMode === "GARMENT_FIRST_STYLING"
      || stylistMode === "ACTIVE_LOOK_REFINEMENT"
      || stylistMode === "LOOK_EXPLANATION";

    // Use server-derived garment count (not client-supplied) for authoritative check
    const serverGarmentCount = wardrobeCtx.garmentCount ?? wardrobeCtx.rankedGarments?.length ?? 0;

    // Disable structured fast path when wardrobe is empty — the AI call
    // has the emptyWardrobeHint in its system prompt and will give proper guidance.
    const shouldUseStructuredStylistText = serverGarmentCount > 0 && canUseCardFirstText && (
      shouldCallUnifiedEngine
      || (stylistMode === "LOOK_EXPLANATION" && hasStableActiveLook)
      || (authoritativeOutfitIds.length > 0 && !validatedUnifiedOutfitIds.length)
    );

    const lockedSlotsInfo = Array.isArray(locked_slots) && locked_slots.length > 0
      ? `\nThe user has LOCKED these garments (do NOT swap them): ${locked_slots.join(", ")}. Only swap unlocked garments.`
      : "";

    const emptyWardrobeHint = serverGarmentCount === 0
      ? "\nThe user's wardrobe is empty. Tell them to add garments first. Do NOT attempt outfit generation."
      : serverGarmentCount <= 4
        ? "\nThe user has very few garments. Mention they should add more for better combinations."
        : "";

    const systemPrompt = `${VOICE_STYLIST_CHAT}

LANGUAGE: Respond ONLY in ${lang.name}. Every word.

Season context: ${seasonHint} ${new Date().getFullYear()}

${profile?.display_name ? `Client: ${profile.display_name}` : ""}${profile?.home_city ? ` (${profile.home_city})` : ""}${bodyContext}

USER IDENTITY:
${identityBlock}
${styleLines ? `\nSTYLE PROFILE:\n${styleLines}` : ""}

${threadBrief ? `${threadBrief}\n\n` : ""}${refinementDeltaBlock ? `${refinementDeltaBlock}\n\n` : ""}${wardrobeCtx.text}
${candidateOutfits ? `\n\n${candidateOutfits}` : ""}${unifiedCandidateLine}
${recentOutfitsCtx.text}
${recentOutfitsCtx.recentGarmentSets && recentOutfitsCtx.recentGarmentSets.length > 0 ? `\nRECENT OUTFIT COMBINATIONS — DO NOT REPEAT THESE EXACT GARMENT COMBINATIONS:\n${recentOutfitsCtx.recentGarmentSets.slice(0, 5).map((ids: string[], i: number) => `Outfit ${i+1}: ${ids.join(", ")}`).join("\n")}\nEach new outfit MUST include at least 2 garments not in the previous suggestion.` : ""}
${rejectionsCtx.text}
${tasteMemoryBlock ? `\nTASTE MEMORY (learned from behavior — reference this naturally in replies):\n${tasteMemoryBlock}` : ""}
${pairMemoryText}
${calendarCtx}
${weatherCtx}

STYLIST OPERATING CONTRACT:
- Primary operating mode for this user turn: ${stylistMode}
- Card policy for this turn: ${cardPolicy}
- Act like a premium stylist, not a general assistant.
- Think in this order: current live look -> locked anchor -> create/update/explain intent -> next valid outfit card -> prose.
- If this turn is styling-related, the card is the primary output and the prose is secondary.
- If the user is clearly asking for styling, resolve it as create a look, update the current look, or explain the current look. Do not drift into abstract style commentary.
- If the ask is genuinely ambiguous, ask exactly one short clarifying question. Preserve the current card if one is already valid.
- If a selected garment is locked as the anchor, it must remain in the outfit unless the user explicitly asks to remove or replace it.
- Ground every recommendation in the ranked wardrobe subset first; only mention missing pieces when the wardrobe truly lacks them.
- In OUTFIT_GENERATION and ACTIVE_LOOK_REFINEMENT, default to complete looks whenever the wardrobe allows it (separates need top + bottom + shoes; dress-led needs dress + shoes).
- Do not normalize incomplete outfits as the ideal outcome.
- If shoes are truly missing from the wardrobe, label the look as incomplete and recommend adding shoes; otherwise include shoes in the look.
- If there is an anchor garment, build around it explicitly before offering alternatives.
- Think silently in 2-3 outfit candidates first, then answer with the strongest option and at most one backup.
- Make clear tradeoffs. Say what stays, what changes, and what effect that creates.
- Explain silhouette, proportion, balance, color harmony, contrast, texture, visual weight, and occasion fit in concrete terms.
- Distinguish clearly between elevate, relax, warm up, sharpen, soften, and occasion shifts.
- Preserve continuity with the thread brief; do not reset the user's goal each turn.
- Treat the active look as the default working look for refinements.
- If the user asks for styling advice rather than a full outfit, still reference specific garments from the wardrobe subset.
- Keep the tone editorial, concise, and premium. No generic helper phrasing.
- Default to 2-3 short sentences: one decision, one visual reason, one short change note if needed.
- 'Why this works' should read like a stylist's visual rationale, not a generic explainer.
${modeContract}
${taggingContract}

${refinementPlan.anchorLocked && refinementPlan.anchorGarmentId ? `ANCHOR OVERRIDE — ABSOLUTE RULE: Every outfit you suggest MUST contain garment ID ${refinementPlan.anchorGarmentId}. Any outfit tag missing this ID is invalid. The user has locked this as their anchor piece.` : ""}
OUTFIT SLOT RULES — CRITICAL:
- An outfit must have AT MOST ONE garment per slot: top · bottom · shoes · outerwear · dress
- A dress REPLACES top + bottom — never combine dress + pants or dress + jeans
- NEVER include two bottoms, two jackets, two tops, or two shoes in one outfit tag
- The anchor garment claims its slot — all remaining IDs in the tag must come from DIFFERENT slots
- [ID:...] notation that appears in the wardrobe listing is INTERNAL REFERENCE ONLY — you must NEVER write [ID:...] patterns in your prose sentences; refer to garments by name or [[garment:ID]] tag only

${refinementContract}${lockedSlotsInfo}${emptyWardrobeHint}`;

    const preparedMessages = (safeMessages as MessageInput[]).map((m) => {
      if (typeof m.content === "string") {
        try {
          const parsed = JSON.parse(m.content);
          if (Array.isArray(parsed)) return { role: m.role, content: parsed };
        } catch { /* keep as string */ }
      }
      return m;
    });

    log.info("stylist.mode", {
      requestId,
      userId: user.id,
      stage: "mode_resolved",
      stylistMode,
      refinementMode: refinementIntent.mode,
      hasActiveLook: activeLook.garmentIds.length > 0,
      usedUnifiedEngine: shouldCallUnifiedEngine,
    });

    let rawAssistantText = shouldUseStructuredStylistText
      ? buildCardFirstStylistText({
        locale,
        mode: stylistMode,
        outfit: unifiedOutfit,
        outfitGarments: authoritativeOutfitGarments,
        activeLookGarments,
        anchor: wardrobeCtx.anchor,
        refinementIntent,
      })
      : "";
    let aiFinishReason: string | undefined;

    // Clarifying question: use a lightweight AI call to ask smart follow-ups
    // instead of the old hardcoded buildStyleClarifierText which was generic.
    if (shouldAskClarifyingQuestion) {
      try {
        const clarifierResponse = await callBursAI({
          functionName: "style_chat",
          messages: [
            {
              role: "system",
              content: `You are a warm personal stylist assistant. The user wants outfit help but hasn't given enough detail. Ask 1-2 short, friendly follow-up questions to understand what they need. Ask about the missing pieces: dress code, venue, weather, formality, time of day, or personal preference. Do NOT generate an outfit yet. Respond ONLY in ${lang.name}. Keep it to 1-3 sentences.`,
            },
            { role: "user", content: latestUser },
          ],
          complexity: "standard",
          cacheTtlSeconds: 0,
          cacheNamespace: "style_chat_clarifier",
        });
        rawAssistantText = typeof clarifierResponse.data === "string" && clarifierResponse.data.trim()
          ? clarifierResponse.data
          : buildStyleClarifierText(locale, latestUser);
      } catch {
        rawAssistantText = buildStyleClarifierText(locale, latestUser);
      }
    } else if (!shouldUseStructuredStylistText || !rawAssistantText.trim()) {
      const aiResponse = await callBursAI({
        messages: [
          { role: "system", content: systemPrompt },
          ...preparedMessages,
        ],
        complexity: chatComplexity,
        max_tokens: stylistMode === "CONVERSATIONAL" ? 180 : chatComplexity === "complex" ? 800 : 420,
        functionName: "style_chat",
      });

      rawAssistantText = typeof aiResponse.data === "string" ? aiResponse.data : String(aiResponse.data ?? "");
      aiFinishReason = aiResponse.finish_reason;
    }

    // ── Empty response guard ─────────────────────────────────────
    if (!rawAssistantText.trim()) {
      console.warn("style_chat: AI returned empty response, using fallback");
      const isSwedish = locale === "sv";
      rawAssistantText = isSwedish
        ? "Jag kunde inte sätta ihop ett svar just nu. Försök igen eller omformulera din fråga."
        : "I couldn't put together a response right now. Try again or rephrase your question.";
    }

    // ── Truncation detection ─────────────────────────────────────
    let truncatedByTokenLimit = false;
    if (aiFinishReason === "length") {
      console.warn("style_chat: response truncated by output token limit (finish_reason=length)");
      truncatedByTokenLimit = true;
      rawAssistantText = trimToSentences(rawAssistantText, 4);
    }

    // ── Post-processing validation ──────────────────────────────
    // Skip post-processing checks for clarifying question turns — the reply
    // is asking follow-ups, not presenting garments, so these checks are irrelevant.
    if (!shouldAskClarifyingQuestion) {
      // a. Check for garment name reference
      const garmentNames = wardrobeCtx.rankedGarments.map((g: any) => g.title?.toLowerCase()).filter(Boolean);
      const replyLower = rawAssistantText.toLowerCase();
      const mentionsGarment = garmentNames.some((name: string) => replyLower.includes(name));
      if (!mentionsGarment && garmentNames.length > 0) {
        console.warn("style_chat: reply missing garment reference");
      }

      // b. Check for banned phrases
      const BANNED = ["great choice", "nice pick", "goes well with", "versatile piece", "i recommend", "i suggest"];
      for (const phrase of BANNED) {
        if (replyLower.includes(phrase)) {
          console.warn("style_chat: banned phrase detected:", phrase);
        }
      }
    }

    // c. Trim overly long non-outfit replies — language-safe sentence splitting
    rawAssistantText = trimToSentences(
      rawAssistantText,
      shouldAskClarifyingQuestion ? 6 : stylistMode === 'ACTIVE_LOOK_REFINEMENT' ? 5 : shouldPreserveStyleCard ? 3 : 5,
    );

    const normalizedReply = normalizeStyleChatAssistantReply({
      rawText: rawAssistantText,
      validGarmentIds: new Set(wardrobeCtx.rankedGarments.map((garment) => garment.id)),
      rankedGarments: wardrobeCtx.rankedGarments,
      anchor: wardrobeCtx.anchor,
      activeLook,
      placeOutfitTagFirst: refinementTurn,
      includeOutfitTag: false,
      authoritativeOutfitIds: shouldPreserveStyleCard ? authoritativeOutfitIds : [],
      authoritativeExplanation: shouldAskClarifyingQuestion
        ? explicitActiveLook?.explanation || null
        : unifiedOutfit?.rationale || null,
      fallbackOutfitIds: shouldPreserveStyleCard ? authoritativeOutfitIds : [],
    });

    const cardState = resolveStyleCardState(validatedActiveLookIds, normalizedReply.outfitIds);
    const renderOutfitCardBase = shouldRenderStyleCardFromPolicy({
      cardPolicy,
      cardState,
      outfitIds: normalizedReply.outfitIds,
    });
    const isStylingTurn = stylistMode === "ACTIVE_LOOK_REFINEMENT"
      || stylistMode === "GARMENT_FIRST_STYLING"
      || stylistMode === "OUTFIT_GENERATION"
      || stylistMode === "LOOK_EXPLANATION";
    const renderOutfitCard =
      stylistMode !== "CONVERSATIONAL" && (
        renderOutfitCardBase
        || (isStylingTurn && normalizedReply.outfitIds.length > 0)
        || (isStylingTurn && authoritativeOutfitIds.length > 0)
      );
    const resolvedOutfitIds = renderOutfitCard
      ? (normalizedReply.outfitIds.length > 0 ? normalizedReply.outfitIds : authoritativeOutfitIds)
      : [];
    const activeLookStatus = stylistMode === "CONVERSATIONAL" && activeLook.garmentIds.length > 0
      ? "preserved" as const
      : resolveActiveLookStatus(validatedActiveLookIds, resolvedOutfitIds);
    const usedDeterministicRescue = !validatedUnifiedOutfitIds.length
      && deterministicRescueOutfitIds.length > 0
      && deterministicRescueOutfitIds.length === authoritativeOutfitIds.length
      && deterministicRescueOutfitIds.every((id, index) => id === authoritativeOutfitIds[index]);
    const preservedExistingLook = !validatedUnifiedOutfitIds.length
      && validatedActiveLookIds.length > 0
      && validatedActiveLookIds.length === authoritativeOutfitIds.length
      && validatedActiveLookIds.every((id, index) => id === authoritativeOutfitIds[index]);
    const fallbackUsed = !shouldAskClarifyingQuestion
      && shouldPreserveStyleCard
      && !validatedUnifiedOutfitIds.length
      && authoritativeOutfitIds.length > 0;
    const degradedReason = shouldAskClarifyingQuestion
      ? null
      : unifiedOutfit?.limitations?.[0]
        || unifiedFailureReason
        || (shouldPreserveStyleCard && !authoritativeOutfitIds.length ? "no_valid_outfit_card" : null);
    const responseKind = shouldAskClarifyingQuestion
      ? (renderOutfitCard ? "style_result" : "analysis")
      : resolveStyleResponseKind({
        mode: stylistMode,
        cardState,
        fallbackUsed,
        degradedReason,
      });
    const chips = shouldAskClarifyingQuestion
      ? (locale === "sv"
        ? ["Formellt", "Avslappnat", "Smart casual", "Utomhus"]
        : ["Formal", "Casual", "Smart casual", "Outdoor"])
      : buildSuggestionChips(
        stylistMode,
        renderOutfitCard,
        locale,
      );
    const envelope: StyleChatResponseEnvelope = {
      kind: "stylist_response",
      mode: stylistMode,
      response_kind: responseKind,
      card_policy: cardPolicy,
      card_state: cardState,
      assistant_text: normalizedReply.text,
      outfit_ids: resolvedOutfitIds,
      outfit_explanation: normalizedReply.outfitExplanation,
      garment_mentions: normalizedReply.garmentMentionIds,
      suggestion_chips: chips,
      truncated: truncatedByTokenLimit,
      active_look_status: activeLookStatus,
      active_look: stylistMode === "CONVERSATIONAL" && activeLook.garmentIds.length > 0
        ? {
            garment_ids: activeLook.garmentIds,
            explanation: activeLook.summary || null,
            source: activeLook.source ?? "preserved_conversational",
            status: "preserved" as const,
            card_state: "preserved" as const,
            anchor_garment_id: refinementPlan.anchorGarmentId,
            anchor_locked: refinementPlan.anchorLocked,
          }
        : {
            garment_ids: resolvedOutfitIds,
            explanation: normalizedReply.outfitExplanation || null,
            source: resolvedOutfitIds.length > 0
              ? validatedUnifiedOutfitIds.length > 0
                ? "unified_stylist_engine"
                : usedDeterministicRescue
                  ? "deterministic_rescue"
                  : preservedExistingLook
                    ? (activeLook.source || "preserved_active_look")
                    : "style_chat_normalizer"
              : null,
            status: activeLookStatus,
            card_state: cardState,
            anchor_garment_id: refinementPlan.anchorGarmentId,
            anchor_locked: refinementPlan.anchorLocked,
          },
      fallback_used: fallbackUsed,
      degraded_reason: degradedReason,
      render_outfit_card: renderOutfitCard,
      clear_active_look: classifierResult.clear_active_look,
    };

    log.info("request.complete", {
      requestId,
      userId: user.id,
      stage: "response_ready",
      durationMs: Date.now() - requestStartedAt,
      degraded: Boolean(unifiedOutfit?.limitations.length),
      usedUnifiedEngine: shouldCallUnifiedEngine,
      hasOutfitTag: Boolean(envelope.outfit_ids.length),
      truncated: truncatedByTokenLimit,
    });

    return createSseTextResponse(envelope);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }
    recordError("style_chat");
    log.exception("request.failed", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
