import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";
import { VOICE_STYLIST_CHAT } from "../_shared/burs-voice.ts";
import {
  detectStylistChatModeFromSignals,
  resolveStyleChatIntentFromSignals,
  resolveActiveLookStatus,
  resolveStyleCardState,
  resolveStyleCardPolicy,
  resolveStyleResponseKind,
  shouldRenderStyleCardFromPolicy,
  type StyleChatActiveLookInput,
  type StyleChatResponseEnvelope,
  type StylistChatMode,
} from "../_shared/style-chat-contract.ts";
import { buildAuthoritativeOutfitTag, invokeUnifiedStylistEngine, type UnifiedStylistResponse } from "../_shared/unified_stylist_engine.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, recordError, overloadResponse } from "../_shared/scale-guard.ts";
import { buildStyleChatFallbackOutfitIds, isCompleteStyleChatOutfitIds, normalizeStyleChatAssistantReply } from "../_shared/style-chat-normalizer.ts";
import { resolveCompleteOutfitIds } from "../_shared/complete-outfit-ids.ts";
import { logger } from "../_shared/logger.ts";

// ---------- i18n ----------

const LANG_CONFIG: Record<string, { name: string; weatherLabel: string; todayLabel: string; tomorrowLabel: string; seasonNames: [string, string, string, string] }> = {
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

function getLang(locale: string) {
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

async function fetchJsonWithTimeout<T>(input: string, init: RequestInit = {}, timeoutMs = 2500): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- helpers ----------

interface MessageInput {
  role: string;
  content: string | unknown[];
}

interface GarmentRecord {
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

interface RawSignal {
  signal_type: string;
  value: string | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
}

interface AnchorSelection {
  anchor: GarmentRecord | null;
  explicitIds: string[];
  source: string | null;
}

interface RetrievalResult {
  text: string;
  garmentCount: number;
  dominantArchetype: string | null;
  rankedGarments: GarmentRecord[];
  anchor: GarmentRecord | null;
  retrievalSummary: string;
}

interface ActiveLookContext {
  summary: string;
  garmentIds: string[];
  source: string | null;
  garmentLines: string[];
}

interface RefinementIntent {
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

function getMessageText(content: string | unknown[]): string {
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

function normalizeTerm(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

function tokenize(text: string): string[] {
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

const VALID_GARMENT_TAG_RE = /\[\[garment:([a-f0-9-]+)(?:\|([^\]]+))?\]\]/gi;
const VALID_OUTFIT_TAG_RE = /\[\[outfit:([a-f0-9-,]+)\|([^\]]*)\]\]/gi;
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

function getSlotKey(category: string): string {
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

function buildOutfitExplanation(rawText: string, fallbackIds: string[]): string {
  const withoutTags = rawText
    .replace(VALID_OUTFIT_TAG_RE, " ")
    .replace(VALID_GARMENT_TAG_RE, (_match, _id, label) => (label ? String(label).trim() : " "));
  const clean = stripUnknownTagMarkup(withoutTags)
    .replace(/\s+/g, " ")
    .trim();

  const firstSentence = clean.split(/(?<=[.!?])\s+/).find(Boolean) || clean;
  if (firstSentence) return firstSentence.slice(0, 140);
  if (fallbackIds.length >= 2) return "Current active look";
  return "";
}

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

function formatGarmentLine(g: GarmentRecord): string {
  const aiRaw = g.ai_raw && typeof g.ai_raw === "object" ? g.ai_raw : {};
  const e = aiRaw.enrichment || aiRaw;
  const parts = [
    `${g.title} [ID:${g.id}]`,
    `(${g.category}${g.subcategory ? "/" + g.subcategory : ""}`,
    g.color_primary ? `, ${g.color_primary}` : "",
    g.material ? `, ${g.material}` : "",
    g.fit ? `, ${g.fit}` : "",
    g.formality ? `, formality ${g.formality}` : "",
    g.pattern && g.pattern !== "solid" ? `, ${g.pattern}` : "",
    g.season_tags?.length ? `, ${g.season_tags.join("/")}` : "",
    `, worn ${g.wear_count ?? 0}x`,
    g.last_worn_at ? `, last ${g.last_worn_at.slice(0, 10)}` : "",
  ];

  const enrichParts: string[] = [];
  if (e.style_archetype) enrichParts.push(e.style_archetype);
  if (e.silhouette) enrichParts.push(`sil:${e.silhouette}`);
  if (e.visual_weight) enrichParts.push(`weight:${e.visual_weight}`);
  if (e.texture_intensity) enrichParts.push(`texture:${e.texture_intensity}`);
  if (e.drape) enrichParts.push(`drape:${e.drape}`);
  if (e.shoulder_structure) enrichParts.push(`shoulder:${e.shoulder_structure}`);
  if (typeof e.versatility_score === "number") enrichParts.push(`vers:${e.versatility_score}`);
  if (e.layering_role) enrichParts.push(`layer:${e.layering_role}`);
  if (Array.isArray(e.occasion_tags) && e.occasion_tags.length) enrichParts.push(`occ:${e.occasion_tags.slice(0, 4).join(",")}`);
  if (e.color_harmony_notes) enrichParts.push(`color:${String(e.color_harmony_notes).slice(0, 80)}`);
  if (e.stylist_note) enrichParts.push(`note:${String(e.stylist_note).slice(0, 120)}`);
  if (enrichParts.length) parts.push(` | ${enrichParts.join(", ")}`);
  parts.push(")");

  return `• ${parts.join("")}`;
}

function getGarmentSearchText(g: GarmentRecord): string {
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

function rankGarmentForPrompt(g: GarmentRecord, queryTerms: string[], anchor: GarmentRecord | null, explicitIds: Set<string>): { score: number; reasons: string[] } {
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

function detectAnchorGarment(garments: GarmentRecord[], messages: MessageInput[], selectedGarmentIds: string[] = []): AnchorSelection {
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

function buildRankedGarmentSubset(
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

function buildThreadBrief(messages: MessageInput[], anchor: GarmentRecord | null): string {
  const recent = messages.slice(-4);
  const userTurns = recent.filter((m) => m.role === "user").map((m) => getMessageText(m.content)).filter(Boolean);
  const latestUser = userTurns[userTurns.length - 1] || "";
  const priorGoals = userTurns.slice(0, -1).slice(-1);

  const lines = [
    latestUser ? `Latest user ask: ${latestUser}` : "",
    priorGoals.length ? `Recent user goals: ${priorGoals.join(" | ")}` : "",
    anchor ? `Current anchor garment: ${anchor.title} [ID:${anchor.id}]` : "No confirmed anchor garment yet.",
  ].filter(Boolean);

  return lines.length ? `THREAD BRIEF:\n${lines.join("\n")}` : "";
}

function detectRefinementIntent(messages: MessageInput[]): RefinementIntent {
  const latestUser = normalizeTerm(getMessageText(messages.filter((m) => m.role === "user").slice(-1)[0]?.content || ""));
  if (!latestUser) return { mode: "new_look", raw: "" };

  if (/(style this garment|style this piece|style this item)/i.test(latestUser)) {
    return { mode: "targeted_refinement", raw: latestUser };
  }
  if (/(swap|change|switch).{0,20}(shoe|sneaker|boot|loafer|heel|trainer)/i.test(latestUser)) {
    return { mode: "swap_shoes", raw: latestUser };
  }
  if (/(swap|change|switch).{0,20}(layer|jacket|coat|blazer|outerwear|cardigan|hoodie|overshirt)/i.test(latestUser)) {
    return { mode: "swap_layer", raw: latestUser };
  }
  if (/(keep|leave|save|stick with).{0,20}(jacket|coat|blazer|outerwear)/i.test(latestUser)) {
    return { mode: "keep_jacket", raw: latestUser };
  }
  if (/(why this works|explain why this works|why does this work|explain the look|break down the look|what makes this work)/i.test(latestUser)) {
    return { mode: "explain_why", raw: latestUser };
  }
  if (/(use something i wear less|wear less|wear more often|haven't worn|less worn|underused)/i.test(latestUser)) {
    return { mode: "use_less_worn", raw: latestUser };
  }
  if (/(warmer|more warm|add warmth|too cold|colder weather|winterize|warmer version)/i.test(latestUser)) {
    return { mode: "warmer", raw: latestUser };
  }
  if (/(cooler|less warm|lighter version|summerize|summerise|too hot|hotter weather|make it cooler)/i.test(latestUser)) {
    return { mode: "cooler", raw: latestUser };
  }
  if (/(more elegant|elegant version|make it elegant|feel more elegant|elevate for elegance|more premium|more expensive-looking)/i.test(latestUser)) {
    return { mode: "more_elegant", raw: latestUser };
  }
  if (/(less formal|more casual|relax it|dress it down|tone it down|make it easier|relaxed version)/i.test(latestUser)) {
    return { mode: "less_formal", raw: latestUser };
  }
  if (/(more formal|formal version|dressier|black tie|make it formal)/i.test(latestUser)) {
    return { mode: "more_formal", raw: latestUser };
  }
  if (/(more elevated|more polished|dress it up|make it smarter|elevate it|make it more premium|make it more polished)/i.test(latestUser)) {
    return { mode: "more_elevated", raw: latestUser };
  }
  if (/(sharper|sharpen it|cleaner|make it sharper)/i.test(latestUser)) {
    return { mode: "sharper", raw: latestUser };
  }
  if (/(softer|soften it|less sharp|make it softer)/i.test(latestUser)) {
    return { mode: "softer", raw: latestUser };
  }
  if (/(make it simpler|simpler version|strip it back|minimal version|more minimal)/i.test(latestUser)) {
    return { mode: "simpler", raw: latestUser };
  }
  if (/(make it bolder|bolder version|more bold|more daring|push it more)/i.test(latestUser)) {
    return { mode: "bolder", raw: latestUser };
  }
  if (/(for dinner|dinner version|make it dinner|evening version|date night|night out)/i.test(latestUser)) {
    return { mode: "dinner", raw: latestUser };
  }
  if (/(for work|work version|office|meeting|client|professional|boardroom)/i.test(latestUser)) {
    return { mode: "work", raw: latestUser };
  }
  if (/(for weekend|weekend version|off-duty|casual weekend|brunch|errands)/i.test(latestUser)) {
    return { mode: "weekend", raw: latestUser };
  }
  if (/(for travel|travel version|airport|plane|packing|capsule for travel)/i.test(latestUser)) {
    return { mode: "travel", raw: latestUser };
  }
  if (/(swap|change|keep|warmer|cooler|casual|formal|elevated|polished|premium|minimal|refine|adjust|tweak|sharpen|soften|elegant|weekend|work|dinner|travel|simpler|bolder)/i.test(latestUser)) {
    return { mode: "targeted_refinement", raw: latestUser };
  }
  return { mode: "new_look", raw: latestUser };
}

function detectStylistChatMode(params: {
  messages: MessageInput[];
  activeLook: ActiveLookContext;
  anchor: GarmentRecord | null;
  refinementIntent: RefinementIntent;
}): StylistChatMode {
  const latestUser = normalizeTerm(getMessageText(params.messages.filter((m) => m.role === "user").slice(-1)[0]?.content || ""));
  if (!latestUser) return "OUTFIT_GENERATION";

  const hasActiveLook = params.activeLook.garmentIds.length >= 2;
  const hasAnchor = !!params.anchor;

  const SHORT_RE = /^(hi|hey|hello|thanks|thank you|thx|cheers|great|perfect|ok|okay|got it|sounds good|nice|cool|awesome|love it|makes sense|understood|noted|sure|yep|yes|no|nope|not really|maybe|haha|lol|exactly|absolutely|fair enough|interesting|good point|right)[!.,?\s]*$/i;
  if (SHORT_RE.test(latestUser.trim())) return "CONVERSATIONAL";

  const KNOW_RE = /what.s (a |the )?(french tuck|quiet luxury|capsule wardrobe|smart casual|business casual)|tell me about|how to (wear|style|dress|pair)/i;
  if (KNOW_RE.test(latestUser) && !hasActiveLook && !hasAnchor) return "CONVERSATIONAL";

  return detectStylistChatModeFromSignals({
    latestUser,
    hasActiveLook,
    hasAnchor,
    refinementMode: params.refinementIntent.mode,
  });
}

function buildModeContract(mode: StylistChatMode, lang: { name: string }): string {
  const universalRules = [
    `MODE=${mode}. Obey this mode first, then style quality.`,
    "- Do not collapse every request into generic outfit generation.",
    "- Keep output decisive and premium; no generic assistant filler.",
    "- Prefer styling action over abstract analysis whenever the user is clearly asking for a look or a refinement.",
    "- Default styling reply shape: one clear decision, one short visual reason, and one short change note only if a change is relevant.",
    "- If the request is genuinely ambiguous, ask exactly one short clarifying question and stop there.",
    "- Use wardrobe evidence: category balance, wear frequency, layering role, archetype, texture, drape, structure, versatility.",
  ];

  const modeRules: Record<StylistChatMode, string[]> = {
    ACTIVE_LOOK_REFINEMENT: [
      "- Keep continuity with the active look; preserve unchanged pieces unless directly asked to swap.",
      "- Make 1-2 high-leverage edits, then explain visual impact (proportion, texture, formality, color harmony).",
      "- Prioritize edits over full resets.",
      "- Response shape: **What stays** → **What changes** → **Why this improves it**.",
    ],
    GARMENT_FIRST_STYLING: [
      "- Build around the anchor garment first and name why it is the hero.",
      "- Support the anchor with balancing pieces (visual weight, drape/structure, occasion coherence).",
      "- If anchor is weak for the ask, say so and provide the cleanest adjacent option.",
      "- Response shape: **Hero garment** → **Best full look** → **Optional variant**.",
    ],
    OUTFIT_GENERATION: [
      "- Return the strongest complete look first; at most one backup.",
      "- Match occasion/weather/formality and avoid repetition patterns from recent outfits.",
      "- Briefly explain why this look wins versus nearby alternatives.",
      "- Response shape: **Primary look** → **Why it works** → **Optional backup**.",
    ],
    WARDROBE_GAP_ANALYSIS: [
      "- Do NOT lead with a generic outfit card.",
      "- Output in this order with section headers: 1) **Overrepresented**, 2) **Underrepresented**, 3) **Weak links**, 4) **Highest-leverage fixes**, 5) **Stop overbuying**.",
      "- Separate NEED vs NICE-TO-HAVE and explain impact per addition.",
    ],
    PURCHASE_PRIORITIZATION: [
      "- Treat this as shopping strategy, not outfit generation.",
      "- Rank top purchases by impact, versatility, and outfit unlock potential.",
      "- Include why now, budget sensitivity (if inferred), and what each purchase replaces or upgrades.",
      "- Response shape with section headers: **Top priorities (ranked)**, **Why each matters**, **What each unlocks**, **Skip buying more of**.",
    ],
    STYLE_IDENTITY_ANALYSIS: [
      "- Diagnose current style identity from wardrobe evidence, then define a sharper target direction.",
      "- Identify missing identity markers (shape, texture, contrast level, footwear language, outerwear structure).",
      "- Give a short action plan: keep / add / reduce.",
      "- Response shape with section headers: **Current style read**, **What is holding it back**, **Keep / Add / Reduce**.",
    ],
    LOOK_EXPLANATION: [
      "- Explain the look as visual reasoning: silhouette, proportion, contrast, texture, color harmony, occasion fit.",
      "- Do not default to proposing a new outfit unless the current one fails.",
      "- Keep explanation concrete and stylist-level, not generic.",
      "- Response shape with section headers: **Silhouette & proportion**, **Texture & color**, **Formality & occasion fit**.",
    ],
    PLANNING: [
      "- Produce a multi-look plan (days or slots) with clear non-repetitive backbone pieces.",
      "- Reuse intelligently across looks; avoid fatigue from overused items.",
      "- Include quick swap logic for weather/formality changes.",
      "- Response shape: day-by-day or slot-by-slot plan with explicit labels (e.g., Day 1..Day N), then a **Quick swaps** section.",
    ],
    CONVERSATIONAL: [
      "- CONVERSATIONAL MODE: The user is chatting, not asking for an outfit.",
      "- Respond naturally as a knowledgeable stylist in a real conversation.",
      "- For thanks/greetings: reply in 1 sentence maximum. Warm, brief, done.",
      "- For fashion questions: answer the question directly. 2-4 sentences.",
      "- Do NOT generate an outfit card unless the user explicitly asks for a look.",
      "- Do NOT force styling advice onto a casual message.",
    ],
  };

  return [
    `MODE RESPONSE CONTRACT (${lang.name}):`,
    ...universalRules,
    ...(modeRules[mode] || []),
  ].join("\n");
}

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

function buildRefinementContract(intent: RefinementIntent, activeLook: ActiveLookContext): string {
  const activeLookLine = activeLook.summary
    ? `ACTIVE LOOK TO PRESERVE:\n- ${activeLook.summary}\n- Source: ${activeLook.source}${activeLook.garmentLines.length ? `\n${activeLook.garmentLines.join("\n")}` : ""}\n`
    : "ACTIVE LOOK TO PRESERVE:\n- No stable active look confirmed yet.\n";

  const targetedRules = [
    "- If the latest user ask is a refinement, edit the active look instead of restarting from zero.",
    "- Keep unchanged pieces stable unless the user explicitly asks to replace them or the look fails technically.",
    "- Make one strong move, not three weak ones.",
    "- Name the kept piece first, then describe the key swap or styling adjustment.",
    "- Justify changes through silhouette, balance, contrast, texture, visual weight, formality, or color harmony.",
    "- Avoid generic filler. No 'nice', 'great', 'good option', or vague encouragement.",
    "- If explaining the look, explain the current active look rather than inventing a new one.",
    "- Keep replies tight: usually 2-4 sentences, with the rationale compressed into one decisive line.",
    "- Never expose raw [[...]] markup in prose; tags exist only to power UI cards.",
    "- EVERY assistant reply must include exactly one authoritative [[outfit:id1,id2,...|localized explanation]] tag for the current active look.",
    "- That outfit tag must reflect the latest full look snapshot after any refinement, even if only one garment changed.",
    "- Reuse garment IDs for unchanged pieces so the UI can replace the active look instead of leaving stale cards on screen.",
    "- Mention the outfit naturally in prose first, then place the single outfit tag at the end of the message.",
    "- Do not emit partial tags, placeholder IDs, or multiple competing outfit tags.",
  ];

  const modeRuleMap: Record<RefinementIntent["mode"], string[]> = {
    swap_shoes: [
      "- SWAP SHOES: keep the jacket/top/bottom unless there is a direct conflict; only change footwear and explain the effect on formality/proportion.",
    ],
    swap_layer: [
      "- SWAP LAYER: preserve the core look and change only the visible layering piece unless the user asks for a broader reset.",
    ],
    keep_jacket: [
      "- KEEP THE JACKET: preserve the current jacket or outer layer and rebuild only the supporting pieces around it.",
    ],
    less_formal: [
      "- LESS FORMAL: relax fabrication, footwear, or base layer before replacing the hero piece.",
    ],
    more_formal: [
      "- MORE FORMAL: increase polish through cleaner structure, dressier footwear, and less visual noise without breaking continuity.",
    ],
    more_elevated: [
      "- MORE ELEVATED: sharpen structure, cleaner footwear, or sleeker base layers while preserving the active look's core identity.",
    ],
    warmer: [
      "- WARMER: add warmth through layer weight, knit texture, or more closed footwear before changing the outfit's character.",
      "- Protect the vibe while making the look physically warmer.",
    ],
    cooler: [
      "- COOLER: lighten weight, open the silhouette, or swap into easier footwear while keeping the look coherent.",
      "- Protect the vibe while making the outfit feel physically lighter.",
    ],
    sharper: [
      "- SHARPER: clean the line with more structure, cleaner footwear, or tighter contrast. Think precision, not extra formality by default.",
    ],
    softer: [
      "- SOFTER: relax the contrast, drape, or texture so the look feels easier and less severe without turning shapeless.",
    ],
    more_elegant: [
      "- MORE ELEGANT: raise refinement through cleaner lines, richer texture, sleeker shoe choice, or a more deliberate column of color.",
      "- Aim for poised and expensive-looking, not simply more formal.",
    ],
    dinner: [
      "- DINNER SHIFT: keep the backbone of the look, then add evening definition through cleaner shoes, darker grounding pieces, sharper waist/shoulder balance, or richer texture.",
    ],
    work: [
      "- WORK SHIFT: make the look credible for meetings through structure and restraint. Reduce visual noise before replacing hero pieces.",
    ],
    weekend: [
      "- WEEKEND SHIFT: relax the look without making it sloppy. Ease the fabrication, footwear, or outer layer while keeping balance intact.",
    ],
    travel: [
      "- TRAVEL SHIFT: keep the outfit easy to move in, low-friction to pack, and clean enough to survive transit without feeling sloppy.",
    ],
    simpler: [
      "- SIMPLER: remove visual noise first. Fewer statements, cleaner lines, and one clear focal point beat extra styling tricks.",
    ],
    bolder: [
      "- BOLDER: increase impact through contrast, sharper shape, richer texture, or a stronger focal piece without making the outfit chaotic.",
    ],
    use_less_worn: [
      "- USE SOMETHING I WEAR LESS: swap in the strongest underused garment only if it improves or preserves outfit quality. Do not force a weak piece into the look.",
    ],
    explain_why: [
      "- EXPLAIN WHY THIS WORKS: do not propose a new outfit first; explain silhouette, proportion, color harmony, contrast, texture, and occasion fit of the active look in place.",
      "- Sound like a stylist reading the look visually, not a generic explainer listing garments.",
    ],
    targeted_refinement: [
      "- TARGETED REFINEMENT: treat the request as an edit to the active look, not a fresh recommendation.",
      "- Infer whether the user wants elevate, relax, warm up, sharpen, soften, or an occasion shift, then make the cleanest possible move.",
    ],
    new_look: [
      "- NEW LOOK: build the strongest option from the wardrobe subset, but still stay consistent with the thread brief.",
    ],
  };

  return `${activeLookLine}
REFINEMENT MODE: ${intent.mode}
${[...targetedRules, ...(modeRuleMap[intent.mode] || [])].join("\n")}`;
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

function formatGarmentList(garments: GarmentRecord[]): string {
  const titles = garments.map((garment) => garment.title).filter(Boolean);
  if (titles.length <= 1) return titles[0] || "";
  if (titles.length === 2) return `${titles[0]} + ${titles[1]}`;
  return `${titles.slice(0, -1).join(", ")} + ${titles[titles.length - 1]}`;
}

function trimToSentences(text: string, maxSentences = 3): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.match(/[^.!?…]+[.!?…]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [clean];
  return sentences.slice(0, maxSentences).map((sentence) => /[.!?…]$/.test(sentence) ? sentence : `${sentence}.`).join(" ");
}

function buildVisualReasoning(garments: GarmentRecord[], locale: string): string {
  const colors = Array.from(new Set(garments.map((garment) => garment.color_primary).filter(Boolean))).slice(0, 2);
  const materials = Array.from(new Set(garments.map((garment) => garment.material).filter(Boolean))).slice(0, 2);
  const hasOuterwear = garments.some((garment) => getSlotKey(garment.category) === "outerwear");
  if (locale === "sv") {
    const colorLine = colors.length > 0 ? `paletten håller sig till ${colors.join(" och ")}` : "paletten hålls ren";
    const materialLine = materials.length > 0 ? `materialen ${materials.join(" och ")} ger djup` : "texturen ger djup utan att störa linjen";
    return hasOuterwear
      ? `Det ger mer struktur uppåt, ${colorLine}, och ${materialLine}.`
      : `Silhuetten känns ren, ${colorLine}, och ${materialLine}.`;
  }

  const colorLine = colors.length > 0 ? `the palette stays tight around ${colors.join(" and ")}` : "the palette stays tight";
  const materialLine = materials.length > 0 ? `${materials.join(" and ")} add depth without noise` : "the texture adds depth without adding noise";
  return hasOuterwear
    ? `That adds structure up top, ${colorLine}, and ${materialLine}.`
    : `The line stays clean, ${colorLine}, and ${materialLine}.`;
}

function buildCardFirstStylistText(params: {
  locale: string;
  mode: StylistChatMode;
  outfit: UnifiedStylistResponse["outfits"][number] | null;
  outfitGarments: GarmentRecord[];
  activeLookGarments: GarmentRecord[];
  anchor: GarmentRecord | null;
  refinementIntent: RefinementIntent;
}): string {
  const { locale, mode, outfit, outfitGarments, activeLookGarments, anchor, refinementIntent } = params;
  const isSwedish = locale === "sv";
  if (!outfitGarments.length) {
    return isSwedish
      ? "Jag kunde inte låsa en stark komplett look här. Justera önskemålet lite så bygger jag om den."
      : "I couldn't lock a strong complete look here. Nudge the request a little and I'll rebuild it.";
  }

  if (!outfit && outfitGarments.length > 0) {
    const garmentNames = outfitGarments.map(g => g.title).join(', ');
    return `Here's a look built around your wardrobe: ${garmentNames}.`;
  }

  const outfitLine = formatGarmentList(outfitGarments);
  const activeIds = new Set(activeLookGarments.map((garment) => garment.id));
  const changed = outfitGarments.filter((garment) => !activeIds.has(garment.id));
  const kept = outfitGarments.filter((garment) => activeIds.has(garment.id));
  const rationale = trimToSentences(String(outfit?.rationale || ""), 1);
  const visualReasoning = buildVisualReasoning(outfitGarments, locale);
  const limitation = outfit?.limitations?.[0] ? trimToSentences(outfit.limitations[0], 1) : "";

  if (mode === "LOOK_EXPLANATION") {
    const first = isSwedish
      ? `Det här funkar eftersom ${outfitLine} bygger en tydlig och bärbar helhet.`
      : `This works because ${outfitLine} builds a clear, wearable whole.`;
    const third = isSwedish
      ? "Det känns genomtänkt snarare än övertänkt, vilket håller looken stark i verkligheten."
      : "It feels intentional rather than overworked, which is what keeps the look strong in real life.";
    return trimToSentences([first, visualReasoning, third].join(" "), 3);
  }

  if (mode === "ACTIVE_LOOK_REFINEMENT") {
    const first = changed.length > 0
      ? (isSwedish
        ? `Behåll ${kept.length > 0 ? formatGarmentList(kept) : "grunden"} och byt in ${formatGarmentList(changed)}.`
        : `Keep ${kept.length > 0 ? formatGarmentList(kept) : "the core"} and switch in ${formatGarmentList(changed)}.`)
      : (isSwedish
        ? "Jag håller den nuvarande looken intakt och stramar upp den utan att starta om."
        : "I'm keeping the current look intact and tightening it up without restarting it.");
    return trimToSentences([first, rationale || visualReasoning, limitation].filter(Boolean).join(" "), 3);
  }

  if (mode === "GARMENT_FIRST_STYLING" && anchor && outfitGarments.some((garment) => garment.id === anchor.id)) {
    const first = isSwedish
      ? `Bygg looken runt ${anchor.title}: ${outfitLine}.`
      : `Build the look around ${anchor.title}: ${outfitLine}.`;
    return trimToSentences([first, rationale || visualReasoning, limitation].filter(Boolean).join(" "), 3);
  }

  const first = isSwedish
    ? `Gå på ${outfitLine}.`
    : `Go with ${outfitLine}.`;
  const second = rationale || visualReasoning;
  const third = limitation || (isSwedish
    ? "Det här är den renaste starka looken jag kan säkra från garderoben."
    : "This is the cleanest strong look I can secure from the wardrobe.");
  return trimToSentences([first, second, third].join(" "), 3);
}

function buildStyleClarifierText(locale: string, latestUser: string): string {
  const isSwedish = locale === "sv";

  if (/(why|explain|break down|what makes)/i.test(latestUser)) {
    return isSwedish
      ? "Vilken look vill du att jag förklarar?"
      : "Which look do you want me to explain?";
  }

  if (/(change|make it|style this|style it|swap|replace|remove|drop)/i.test(latestUser)) {
    return isSwedish
      ? "Vilket plagg eller vilken look ska jag utgå från?"
      : "Which garment or look should I work from?";
  }

  return isSwedish
    ? "Vilket plagg eller vilken look vill du att jag stylar?"
    : "Which garment or look do you want me to style?";
}

function buildCandidateOutfits(rankedGarments: GarmentRecord[], anchor: GarmentRecord | null): string {
  // Group garments by canonical slot key (not raw category) to avoid cross-slot confusion
  const slots = new Map<string, GarmentRecord[]>();
  for (const garment of rankedGarments) {
    const key = getSlotKey(garment.category);
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key)!.push(garment);
  }

  const anchorSlot = anchor ? getSlotKey(anchor.category) : null;

  // Each slot: if anchor occupies it, anchor leads; otherwise take top-2 from slot pool
  const topCandidates = anchorSlot === "top"
    ? [anchor!]
    : (slots.get("top") || []).slice(0, 2);
  const bottomCandidates = anchorSlot === "bottom"
    ? [anchor!]
    : (slots.get("bottom") || []).slice(0, 2);
  const dressCandidates = anchorSlot === "dress"
    ? [anchor!]
    : (slots.get("dress") || []).slice(0, 2);
  const shoeCandidates = anchorSlot === "shoes"
    ? [anchor!]
    : (slots.get("shoes") || []).slice(0, 2);
  const outerwearCandidates = anchorSlot === "outerwear"
    ? [anchor!]
    : (slots.get("outerwear") || []).slice(0, 2);
  const accessoryCandidates = (slots.get("accessory") || []).slice(0, 2);

  const candidates: string[] = [];
  const hasDressMinimum = (items: GarmentRecord[]) => {
    const slotSet = new Set(items.map((item) => getSlotKey(item.category)));
    return slotSet.has("dress") && slotSet.has("shoes");
  };
  const hasSeparatesMinimum = (items: GarmentRecord[]) => {
    const slotSet = new Set(items.map((item) => getSlotKey(item.category)));
    return slotSet.has("top") && slotSet.has("bottom") && slotSet.has("shoes");
  };
  const hasValidCompleteMinimum = (items: GarmentRecord[]) => hasDressMinimum(items) || hasSeparatesMinimum(items);

  // ── Dress-led candidates ─────────────────────────────────────────────────
  for (const dress of dressCandidates) {
    const shoes = shoeCandidates.find((item) => item.id !== dress.id);
    const outerwear = outerwearCandidates.find((item) => item.id !== dress.id && item.id !== shoes?.id);
    const accessory = accessoryCandidates.find((item) => ![dress.id, shoes?.id, outerwear?.id].includes(item.id));
    const items = [dress, shoes, outerwear, accessory].filter(Boolean) as GarmentRecord[];
    if (hasDressMinimum(items)) {
      candidates.push(`- Candidate ${candidates.length + 1}: ${items.map((item) => `${item.title} [ID:${item.id}]`).join(" + ")} — rationale: dress-led silhouette with enough support pieces to finish the look.`);
    }
    if (candidates.length >= 3) return `PREBUILT OUTFIT CANDIDATES:\n${candidates.join("\n")}`;
  }

  // ── Separates candidates (top + bottom) ─────────────────────────────────
  for (const top of topCandidates) {
    // Only exclude top.id from bottom — anchor CAN be the bottom, it should NOT be excluded
    const bottom = bottomCandidates.find((item) => item.id !== top.id);
    const shoes = shoeCandidates.find((item) => ![top.id, bottom?.id].includes(item.id));
    const outerwear = outerwearCandidates.find((item) => ![top.id, bottom?.id, shoes?.id].includes(item.id));
    const accessory = accessoryCandidates.find((item) => ![top.id, bottom?.id, shoes?.id, outerwear?.id].includes(item.id));
    const items = [top, bottom, shoes, outerwear, accessory].filter(Boolean) as GarmentRecord[];
    // Verify no duplicate slots in this candidate
    const usedSlots = new Set(items.map((item) => getSlotKey(item.category)));
    if (usedSlots.size === items.length && hasSeparatesMinimum(items)) {
      candidates.push(`- Candidate ${candidates.length + 1}: ${items.map((item) => `${item.title} [ID:${item.id}]`).join(" + ")} — rationale: balanced separates with clear proportions and a finished focal point.`);
    }
    if (candidates.length >= 3) break;
  }

  // ── Anchor-only fallback ─────────────────────────────────────────────────
  if (anchor && candidates.length === 0) {
    // Pick support pieces from different slots than anchor
    const anchorSlotKey = getSlotKey(anchor.category);
    const support = rankedGarments
      .filter((item) => item.id !== anchor.id && getSlotKey(item.category) !== anchorSlotKey)
      .filter((item, _i, arr) => {
        // one per slot
        const slot = getSlotKey(item.category);
        return arr.findIndex((x) => getSlotKey(x.category) === slot) === arr.indexOf(item);
      })
      .slice(0, 4);
    const items = [anchor, ...support];
    if (hasValidCompleteMinimum(items)) {
      candidates.push(`- Candidate 1: ${items.map((item) => `${item.title} [ID:${item.id}]`).join(" + ")} — rationale: best available support pieces around the hero garment.`);
    }
  }

  return candidates.length ? `PREBUILT OUTFIT CANDIDATES:\n${candidates.join("\n")}` : "";
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const data = await fetchJsonWithTimeout<Array<{ lat?: string; lon?: string }>>(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
    { headers: { "User-Agent": "BURS-App/1.0" } },
    2500,
  );
  if (data?.[0]) return { lat: parseFloat(data[0].lat || "0"), lon: parseFloat(data[0].lon || "0") };
  return null;
}

async function fetchWeather(lat: number, lon: number, lang: typeof LANG_CONFIG[string]): Promise<string> {
  const weather = await fetchJsonWithTimeout<{ current?: { temperature_2m?: number; wind_speed_10m?: number; precipitation?: number; weather_code?: number } }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,wind_speed_10m,weather_code`,
    {},
    2500,
  );
  const current = weather?.current;
  if (!current) return "";
  return `${lang.weatherLabel}: ${current.temperature_2m}°C, wind ${current.wind_speed_10m} km/h, precipitation ${current.precipitation} mm, code ${current.weather_code}.`;
}

async function getCalendarContext(supabase: ReturnType<typeof createClient>, userId: string, lang: typeof LANG_CONFIG[string]): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("calendar_events")
    .select("title, date, start_time")
    .eq("user_id", userId)
    .gte("date", today)
    .lte("date", tomorrow)
    .order("date")
    .limit(10);
  if (!data?.length) return "";
  const lines = data.map((e: { title: string; date: string; start_time: string | null }) =>
    `- ${e.date === today ? lang.todayLabel : lang.tomorrowLabel}: ${e.title}${e.start_time ? ` ${e.start_time.slice(0, 5)}` : ""}`
  );
  return `\nCalendar events:\n${lines.join("\n")}`;
}

async function getWardrobeContext(supabase: ReturnType<typeof createClient>, userId: string, messages: MessageInput[], selectedGarmentIds: string[] = []): Promise<RetrievalResult> {
  const { data: garments } = await supabase
    .from("garments")
    .select("id, title, category, subcategory, color_primary, color_secondary, material, fit, formality, pattern, season_tags, wear_count, last_worn_at, image_path, ai_raw")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(120);
  if (!garments?.length) {
    return {
      text: "The user has no garments in their wardrobe yet.",
      garmentCount: 0,
      dominantArchetype: null,
      rankedGarments: [],
      anchor: null,
      retrievalSummary: "No garments available.",
    };
  }

  const typedGarments = garments as GarmentRecord[];

  const catCounts: Record<string, number> = {};
  const styleClusters: Record<string, number> = {};
  const materialCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};
  let totalVersatility = 0;
  let versatilityCount = 0;

  for (const g of typedGarments) {
    catCounts[g.category] = (catCounts[g.category] || 0) + 1;
    if (g.color_primary) colorCounts[g.color_primary] = (colorCounts[g.color_primary] || 0) + 1;
    if (g.material) materialCounts[g.material] = (materialCounts[g.material] || 0) + 1;

    const aiRaw = g.ai_raw && typeof g.ai_raw === "object" ? g.ai_raw : {};
    const e = aiRaw.enrichment || aiRaw;
    if (e.style_archetype) styleClusters[e.style_archetype] = (styleClusters[e.style_archetype] || 0) + 1;
    if (typeof e.versatility_score === "number") { totalVersatility += e.versatility_score; versatilityCount++; }
  }

  const summary = Object.entries(catCounts).map(([cat, count]) => `${count} ${cat}`).join(", ");

  const gaps: string[] = [];
  const hasCat = (keyword: string) => Object.keys(catCounts).some((k) => k.toLowerCase().includes(keyword));
  if (!hasCat("shoes") && !hasCat("footwear")) gaps.push("shoes");
  if (!hasCat("outerwear") && !hasCat("jacket") && !hasCat("coat")) gaps.push("outerwear");
  if (!hasCat("bottom") && !hasCat("pants") && !hasCat("jeans")) gaps.push("bottoms");

  const topColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
  const topMaterials = Object.entries(materialCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m);
  const topArchetypes = Object.entries(styleClusters).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a, c]) => `${a} (${c})`);
  const avgVersatility = versatilityCount > 0 ? (totalVersatility / versatilityCount).toFixed(1) : null;

  let compositionBlock = `\nWARDROBE COMPOSITION:`;
  compositionBlock += `\nDominant colors: ${topColors.join(", ")}`;
  if (topMaterials.length) compositionBlock += `\nKey materials: ${topMaterials.join(", ")}`;
  if (topArchetypes.length) compositionBlock += `\nStyle clusters: ${topArchetypes.join(", ")}`;
  if (avgVersatility) compositionBlock += `\nAvg versatility: ${avgVersatility}/10`;
  if (gaps.length) compositionBlock += `\nWardrobe gaps: missing ${gaps.join(", ")}`;

  const sortedByWear = [...typedGarments].sort((a, b) => (b.wear_count ?? 0) - (a.wear_count ?? 0));
  const overused = sortedByWear.slice(0, 3).filter((g) => (g.wear_count ?? 0) >= 10);
  const unworn = typedGarments.filter((g) => (g.wear_count ?? 0) === 0);

  const combinedQuery = messages.map((m) => getMessageText(m.content)).join(" ");
  const queryTerms = tokenize(combinedQuery);
  const anchorSelection = detectAnchorGarment(typedGarments, messages, selectedGarmentIds);
  const explicitIds = new Set(anchorSelection.explicitIds);
  const ranked = [...typedGarments]
    .map((g) => ({ garment: g, ...rankGarmentForPrompt(g, queryTerms, anchorSelection.anchor, explicitIds) }))
    .sort((a, b) => b.score - a.score || (a.garment.title || "").localeCompare(b.garment.title || ""));

  const rankedGarments = buildRankedGarmentSubset(ranked, anchorSelection.anchor);
  const detailPool = rankedGarments.length ? rankedGarments : typedGarments.slice(0, 24);
  const details = detailPool.map(formatGarmentLine).join("\n");

  let insightLines = "";
  if (unworn.length > 0) {
    insightLines += `\nUnworn items (${unworn.length}): ${unworn.slice(0, 5).map((g) => g.title).join(", ")}`;
  }
  if (overused.length > 0) {
    insightLines += `\nMost worn: ${overused.map((g) => `${g.title} (${g.wear_count}x)`).join(", ")}`;
  }

  const dominantArchetype = topArchetypes.length > 0
    ? Object.entries(styleClusters).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const topRetrievalLines = ranked.slice(0, 8).map((entry, index) =>
    `${index + 1}. ${entry.garment.title} [ID:${entry.garment.id}] score ${entry.score}${entry.reasons.length ? ` — ${entry.reasons.slice(0, 4).join(", ")}` : ""}`
  );

  const retrievalSummary = [
    anchorSelection.anchor ? `Anchor garment: ${anchorSelection.anchor.title} [ID:${anchorSelection.anchor.id}] via ${anchorSelection.source}.` : "No anchor garment confirmed.",
    topRetrievalLines.length ? `Top retrieval set:\n${topRetrievalLines.join("\n")}` : "",
  ].filter(Boolean).join("\n");

  return {
    text: `Wardrobe (${typedGarments.length} garments: ${summary}):${compositionBlock}\n\nRETRIEVAL FOCUS:\n${retrievalSummary}\n\nRANKED GARMENT SUBSET FOR THIS CHAT:\n${details}${insightLines}`,
    garmentCount: typedGarments.length,
    dominantArchetype,
    rankedGarments,
    anchor: anchorSelection.anchor,
    retrievalSummary,
  };
}

interface RecentOutfitsResult {
  text: string;
  occasions: string[];
  recentGarmentSets: string[][];
}

async function getRecentOutfitsContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<RecentOutfitsResult> {
  const { data: outfits } = await supabase
    .from("outfits")
    .select("id, occasion, style_vibe, explanation, worn_at, generated_at, outfit_items(slot, garment_id, garments(title, color_primary))")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false })
    .limit(5);
  if (!outfits?.length) return { text: "", occasions: [], recentGarmentSets: [] };

  const occasions = [...new Set(outfits.map((o: any) => o.occasion).filter(Boolean))] as string[];

  const lines = outfits.map((o: any) => {
    const items = (o.outfit_items || []).map((i: any) =>
      `${i.slot}: ${i.garments?.title || 'unknown'} (${i.garments?.color_primary || ''})`
    ).join(" + ");
    const wornStr = o.worn_at ? ` [worn ${o.worn_at.slice(0, 10)}]` : " [not worn]";
    return `- ${o.occasion}${o.style_vibe ? '/' + o.style_vibe : ''}: ${items}${wornStr}`;
  });

  const recentGarmentSets: string[][] = outfits.map((o: any) =>
    (o.outfit_items || []).map((i: any) => i.garment_id).filter(Boolean)
  ).filter((ids: string[]) => ids.length > 0);

  return { text: `\nRecent outfits:\n${lines.join("\n")}`, occasions, recentGarmentSets };
}

async function getRejectionsContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ text: string; raw: RawSignal[] }> {
  const { data: signals } = await supabase
    .from("feedback_signals")
    .select("signal_type, value, metadata, created_at")
    .eq("user_id", userId)
    .in("signal_type", ["swap", "reject", "dislike", "thumbs_down"])
    .order("created_at", { ascending: false })
    .limit(8);
  if (!signals?.length) return { text: "", raw: [] };

  const lines = signals.map((s: any) => {
    const meta = s.metadata || {};
    const parts = [s.signal_type];
    if (s.value) parts.push(s.value);
    if (meta.slot) parts.push(`slot:${meta.slot}`);
    if (meta.reason) parts.push(`reason:${meta.reason}`);
    if (meta.swapped_garment_title) parts.push(`swapped:${meta.swapped_garment_title}`);
    if (meta.replacement_title) parts.push(`→${meta.replacement_title}`);
    return `- ${parts.join(' | ')} (${s.created_at?.slice(0, 10) || ''})`;
  });

  return {
    text: `\nRECENT REJECTIONS/SWAPS (avoid repeating these patterns):\n${lines.join("\n")}`,
    raw: signals as RawSignal[],
  };
}

function buildTasteMemoryBlock(
  rawSignals: RawSignal[],
  garments: GarmentRecord[],
  dna: { archetype: string | null; formalityCenter: number | null },
): string {
  const insights: string[] = [];

  // 1. Slot swap/reject frequency — slot appearing 2+ times
  const slotCounts: Record<string, number> = {};
  for (const s of rawSignals) {
    const slot = s.metadata?.slot as string | undefined;
    if (slot) slotCounts[slot] = (slotCounts[slot] ?? 0) + 1;
  }
  const repeatedSlot = Object.entries(slotCounts)
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count >= 2);
  if (repeatedSlot) {
    insights.push(
      `User repeatedly swaps out ${repeatedSlot[0]} — avoid leading with low-formality ${repeatedSlot[0]} options`,
    );
  }

  // 2. Color avoidance — 3+ unworn garments share the same color_primary
  const colorCounts: Record<string, number> = {};
  for (const g of garments) {
    if ((g.wear_count ?? 0) === 0 && g.color_primary) {
      colorCounts[g.color_primary] = (colorCounts[g.color_primary] ?? 0) + 1;
    }
  }
  const avoidedColor = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count >= 3);
  if (avoidedColor) {
    insights.push(
      `User rejects ${avoidedColor[0]} items — avoid unless anchored by a strong request`,
    );
  }

  // 3. Signature archetype from DNA
  if (dna.archetype) {
    insights.push(`Signature move: ${dna.archetype} — lean into this pattern`);
  }

  // 4. Formality centre — casual lean if average worn-garment formality < 2.5
  if (dna.formalityCenter !== null && dna.formalityCenter < 2.5) {
    insights.push(
      `User consistently dresses casual — structured suggestions need strong justification`,
    );
  }

  return insights.slice(0, 4).join("\n");
}

function buildSuggestionChips(
  stylistMode: StylistChatMode,
  hasOutfitTag: boolean,
  locale: string,
): string[] {
  const lang = getLang(locale);
  const isSwedish = locale === "sv";
  const isEnglish = locale === "en" || !LANG_CONFIG[locale];

  // Refinement chips when an outfit is shown
  if (hasOutfitTag) {
    if (isSwedish) return ["Gör det mer avslappnat", "Byt skor", "Varmare variant", "Ny look"];
    return ["Make it more casual", "Swap the shoes", "Warmer version", "New look"];
  }

  // Mode-specific chips
  switch (stylistMode) {
    case "OUTFIT_GENERATION":
    case "GARMENT_FIRST_STYLING":
      if (isSwedish) return ["Mer formellt", "Helgvariant", "Varför fungerar detta?"];
      return ["More formal", "Weekend version", "Why does this work?"];
    case "WARDROBE_GAP_ANALYSIS":
      if (isSwedish) return ["Vad ska jag köpa först?", "Visa mig en outfit"];
      return ["What should I buy first?", "Show me an outfit"];
    case "PURCHASE_PRIORITIZATION":
      if (isSwedish) return ["Visa mig en outfit", "Analysera min stil"];
      return ["Show me an outfit", "Analyze my style"];
    case "STYLE_IDENTITY_ANALYSIS":
      if (isSwedish) return ["Klä mig idag", "Vad saknas i garderoben?"];
      return ["Style me today", "What's missing in my wardrobe?"];
    case "LOOK_EXPLANATION":
      if (isSwedish) return ["Gör det mer avslappnat", "Middagsversion"];
      return ["Make it more casual", "Dinner version"];
    case "PLANNING":
      if (isSwedish) return ["Lägg till i planen", "Visa alternativ"];
      return ["Add to plan", "Show alternatives"];
    case "CONVERSATIONAL":
      if (isSwedish) return ["Klä mig idag", "Analysera min stil", "Vad saknas?"];
      return ["Style me today", "Analyze my style", "What's missing?"];
    default:
      if (isSwedish) return ["Klä mig idag", "Analysera min stil", "Vad saknas?"];
      return ["Style me today", "Analyze my style", "What's missing?"];
  }
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

    const [profileRes, calendarCtx, recentOutfitsCtx, rejectionsCtx, wardrobeCtx, pairMemoryRes] = await Promise.all([
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

    const threadBrief = buildThreadBrief(safeMessages as MessageInput[], wardrobeCtx.anchor);
    const activeLook = buildActiveLookContext(safeMessages as MessageInput[], wardrobeCtx.rankedGarments, selectedGarmentIds, explicitActiveLook);
    const latestUser = normalizeTerm(getMessageText(safeMessages.filter((message: any) => message.role === "user").slice(-1)[0]?.content || ""));
    const refinementIntent = detectRefinementIntent(safeMessages as MessageInput[]);
    const styleIntent = resolveStyleChatIntentFromSignals({
      latestUser,
      hasActiveLook: activeLook.garmentIds.length >= 2,
      hasAnchor: Boolean(wardrobeCtx.anchor),
      refinementMode: refinementIntent.mode,
    });
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
    const stylistMode = detectStylistChatMode({
      messages: safeMessages as MessageInput[],
      activeLook,
      anchor: wardrobeCtx.anchor,
      refinementIntent,
    });
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
    const shouldUseStructuredStylistText = canUseCardFirstText && (
      shouldCallUnifiedEngine
      || (stylistMode === "LOOK_EXPLANATION" && hasStableActiveLook)
      || (authoritativeOutfitIds.length > 0 && !validatedUnifiedOutfitIds.length)
    );

    const systemPrompt = `${VOICE_STYLIST_CHAT}

LANGUAGE: Respond ONLY in ${lang.name}. Every word.

Season context: ${seasonHint} ${new Date().getFullYear()}

${profile?.display_name ? `Client: ${profile.display_name}` : ""}${profile?.home_city ? ` (${profile.home_city})` : ""}${bodyContext}

USER IDENTITY:
${identityBlock}
${styleLines ? `\nSTYLE PROFILE:\n${styleLines}` : ""}

${threadBrief ? `${threadBrief}\n\n` : ""}${wardrobeCtx.text}
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

${refinementContract}`;

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

    let rawAssistantText = shouldAskClarifyingQuestion
      ? buildStyleClarifierText(locale, latestUser)
      : shouldUseStructuredStylistText
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

    if (!shouldAskClarifyingQuestion && (!shouldUseStructuredStylistText || !rawAssistantText.trim())) {
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

    // c. Trim overly long non-outfit replies — language-safe sentence splitting
    rawAssistantText = trimToSentences(rawAssistantText, shouldPreserveStyleCard ? 3 : 5);

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
    const renderOutfitCard = renderOutfitCardBase
      || (isStylingTurn && normalizedReply.outfitIds.length > 0)
      || (isStylingTurn && authoritativeOutfitIds.length > 0);
    const resolvedOutfitIds = renderOutfitCard
      ? (normalizedReply.outfitIds.length > 0 ? normalizedReply.outfitIds : authoritativeOutfitIds)
      : [];
    const activeLookStatus = resolveActiveLookStatus(validatedActiveLookIds, resolvedOutfitIds);
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
    const chips = buildSuggestionChips(
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
      active_look: {
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
