import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";
import { VOICE_STYLIST_CHAT } from "../_shared/burs-voice.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
}

interface RefinementIntent {
  mode:
    | "swap_shoes"
    | "keep_jacket"
    | "less_formal"
    | "more_elevated"
    | "warmer"
    | "use_less_worn"
    | "explain_why"
    | "targeted_refinement"
    | "new_look";
  raw: string;
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

function pickOutfitIdsFromText(text: string, validGarmentIds: Set<string>): { ids: string[]; explanation: string } | null {
  let outfitMatch: RegExpExecArray | null;
  VALID_OUTFIT_TAG_RE.lastIndex = 0;
  let lastValidOutfit: { ids: string[]; explanation: string } | null = null;
  while ((outfitMatch = VALID_OUTFIT_TAG_RE.exec(text)) !== null) {
    const ids = outfitMatch[1].split(",").map((id) => id.trim()).filter((id) => validGarmentIds.has(id));
    if (ids.length >= 2) lastValidOutfit = { ids: Array.from(new Set(ids)), explanation: outfitMatch[2].trim() };
  }
  if (lastValidOutfit) return lastValidOutfit;

  const garmentIds = Array.from(new Set(parseTaggedGarmentIds(text).filter((id) => validGarmentIds.has(id))));
  if (garmentIds.length >= 2) return { ids: garmentIds.slice(0, 5), explanation: "" };

  return null;
}

function buildFallbackOutfitIds(rankedGarments: GarmentRecord[], anchor: GarmentRecord | null, activeLook: ActiveLookContext): string[] {
  if (activeLook.garmentIds.length >= 2) return activeLook.garmentIds.slice(0, 5);

  const slots = new Map<string, GarmentRecord[]>();
  for (const garment of rankedGarments) {
    const key = normalizeTerm(garment.category);
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key)!.push(garment);
  }

  const chosen: GarmentRecord[] = [];
  const pushUnique = (garment?: GarmentRecord | null) => {
    if (!garment) return;
    if (chosen.some((item) => item.id === garment.id)) return;
    chosen.push(garment);
  };

  if (anchor) pushUnique(anchor);
  if (chosen.length === 0) pushUnique((slots.get("dress") || [])[0]);
  if (chosen.length === 0) pushUnique((slots.get("top") || [])[0]);
  pushUnique((slots.get("bottom") || []).find((item) => item.id !== chosen[0]?.id) || null);
  pushUnique((slots.get("shoes") || []).find((item) => !chosen.some((existing) => existing.id === item.id)) || null);
  pushUnique((slots.get("outerwear") || []).find((item) => !chosen.some((existing) => existing.id === item.id)) || null);

  if (chosen.length < 2) {
    for (const garment of rankedGarments) {
      pushUnique(garment);
      if (chosen.length >= 3) break;
    }
  }

  return chosen.map((item) => item.id).slice(0, 5);
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
}): NormalizedAssistantReply {
  const candidate = pickOutfitIdsFromText(params.rawText, params.validGarmentIds);
  const fallbackIds = buildFallbackOutfitIds(params.rankedGarments, params.anchor, params.activeLook);
  const outfitIds = (candidate?.ids?.length ? candidate.ids : fallbackIds).slice(0, 5);
  const explanation = (candidate?.explanation || buildOutfitExplanation(params.rawText, outfitIds)).replace(/[\[\]\n\r|]+/g, " ").trim();
  const prose = stripUnknownTagMarkup(params.rawText.replace(VALID_OUTFIT_TAG_RE, ""));
  const outfitTag = outfitIds.length >= 2
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

function createSseTextResponse(text: string, priorityChunk?: string | null): Response {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  const normalizedPriorityChunk = priorityChunk?.trim();
  const remainingText = normalizedPriorityChunk && text.startsWith(normalizedPriorityChunk)
    ? text.slice(normalizedPriorityChunk.length).trimStart()
    : text;

  if (normalizedPriorityChunk) chunks.push(normalizedPriorityChunk);
  chunks.push(...(remainingText.match(/.{1,180}(?:\s|$)|\S+/g) || []));

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
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
  if (typeof e.versatility_score === "number") enrichParts.push(`vers:${e.versatility_score}`);
  if (e.layering_role) enrichParts.push(`layer:${e.layering_role}`);
  if (Array.isArray(e.occasion_tags) && e.occasion_tags.length) enrichParts.push(`occ:${e.occasion_tags.slice(0, 3).join(",")}`);
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

function buildThreadBrief(messages: MessageInput[], anchor: GarmentRecord | null): string {
  const recent = messages.slice(-6);
  const userTurns = recent.filter((m) => m.role === "user").map((m) => getMessageText(m.content)).filter(Boolean);
  const assistantTurns = recent.filter((m) => m.role === "assistant").map((m) => getMessageText(m.content)).filter(Boolean);
  const latestUser = userTurns[userTurns.length - 1] || "";
  const priorGoals = userTurns.slice(0, -1).slice(-2);

  const lines = [
    latestUser ? `Latest user ask: ${latestUser}` : "",
    priorGoals.length ? `Recent user goals: ${priorGoals.join(" | ")}` : "",
    assistantTurns.length ? `Recent assistant commitments: ${assistantTurns.slice(-2).join(" | ")}` : "",
    anchor ? `Current anchor garment: ${anchor.title} [ID:${anchor.id}]` : "No confirmed anchor garment yet.",
  ].filter(Boolean);

  return lines.length ? `THREAD BRIEF:\n${lines.join("\n")}` : "";
}

function detectRefinementIntent(messages: MessageInput[]): RefinementIntent {
  const latestUser = normalizeTerm(getMessageText(messages.filter((m) => m.role === "user").slice(-1)[0]?.content || ""));
  if (!latestUser) return { mode: "new_look", raw: "" };

  if (/(swap|change|switch).{0,20}(shoe|sneaker|boot|loafer|heel|trainer)/i.test(latestUser)) {
    return { mode: "swap_shoes", raw: latestUser };
  }
  if (/(keep|leave|save|stick with).{0,20}(jacket|coat|blazer|outerwear)/i.test(latestUser)) {
    return { mode: "keep_jacket", raw: latestUser };
  }
  if (/(less formal|more casual|relax it|dress it down)/i.test(latestUser)) {
    return { mode: "less_formal", raw: latestUser };
  }
  if (/(more elevated|more polished|sharper|dress it up|make it smarter)/i.test(latestUser)) {
    return { mode: "more_elevated", raw: latestUser };
  }
  if (/(warmer|more warm|add warmth|too cold|colder weather)/i.test(latestUser)) {
    return { mode: "warmer", raw: latestUser };
  }
  if (/(wear less|wear more often|haven't worn|use something i wear less|less worn|underused)/i.test(latestUser)) {
    return { mode: "use_less_worn", raw: latestUser };
  }
  if (/(explain why this works|why does this work|why this works|explain the look)/i.test(latestUser)) {
    return { mode: "explain_why", raw: latestUser };
  }
  if (/(swap|change|keep|warmer|cooler|casual|formal|elevated|polished|refine|adjust|tweak)/i.test(latestUser)) {
    return { mode: "targeted_refinement", raw: latestUser };
  }
  return { mode: "new_look", raw: latestUser };
}

function buildActiveLookContext(messages: MessageInput[], garments: GarmentRecord[]): ActiveLookContext {
  const garmentById = new Map(garments.map((g) => [g.id, g]));
  const assistantMessages = messages.filter((m) => m.role === "assistant").slice(-4).reverse();

  for (const message of assistantMessages) {
    const text = getMessageText(message.content);
    const outfitIds = parseTaggedOutfitIds(text).filter((id) => garmentById.has(id));
    const garmentIds = parseTaggedGarmentIds(text).filter((id) => garmentById.has(id));
    const ids = Array.from(new Set([...(outfitIds.length ? outfitIds : []), ...garmentIds])).slice(0, 5);
    if (!ids.length) continue;
    const garmentsInLook = ids.map((id) => garmentById.get(id)).filter(Boolean) as GarmentRecord[];
    const categories = new Set(garmentsInLook.map((item) => normalizeTerm(item.category)));
    if (garmentsInLook.length < 2 && !categories.has("outerwear")) continue;

    const summary = garmentsInLook
      .map((item) => `${item.title} [ID:${item.id}]`)
      .join(" + ");

    return {
      summary,
      garmentIds: garmentsInLook.map((item) => item.id),
      source: outfitIds.length ? "assistant_outfit_tag" : "assistant_garment_tags",
    };
  }

  return { summary: "", garmentIds: [], source: null };
}

function buildRefinementContract(intent: RefinementIntent, activeLook: ActiveLookContext): string {
  const activeLookLine = activeLook.summary
    ? `ACTIVE LOOK TO PRESERVE:\n- ${activeLook.summary}\n- Source: ${activeLook.source}\n`
    : "ACTIVE LOOK TO PRESERVE:\n- No stable active look confirmed yet.\n";

  const targetedRules = [
    "- If the latest user ask is a refinement, edit the active look instead of restarting from zero.",
    "- Keep unchanged pieces stable unless the user explicitly asks to replace them or the look fails technically.",
    "- Name the kept piece first, then describe the single most important swap or adjustment.",
    "- Never expose raw [[...]] markup in prose; tags exist only to power UI cards.",
    "- If explaining the look, explain the current active look rather than inventing a new one.",
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
    keep_jacket: [
      "- KEEP THE JACKET: preserve the current jacket or outer layer and rebuild only the supporting pieces around it.",
    ],
    less_formal: [
      "- LESS FORMAL: relax fabrication, footwear, or base layer before replacing the hero piece.",
    ],
    more_elevated: [
      "- MORE ELEVATED: sharpen structure, cleaner footwear, or sleeker base layers while preserving the active look's core identity.",
    ],
    warmer: [
      "- WARMER: add insulation or heavier textures by modifying as little as possible; keep the silhouette coherent.",
    ],
    use_less_worn: [
      "- USE SOMETHING I WEAR LESS: swap in the best underused garment from the wardrobe while keeping the rest of the active look stable.",
    ],
    explain_why: [
      "- EXPLAIN WHY THIS WORKS: do not propose a new outfit first; explain silhouette, color, texture, and occasion logic of the active look in place.",
    ],
    targeted_refinement: [
      "- TARGETED REFINEMENT: treat the request as an edit to the active look, not a fresh recommendation.",
    ],
    new_look: [
      "- NEW LOOK: build the strongest option from the wardrobe subset, but still stay consistent with the thread brief.",
    ],
  };

  return `${activeLookLine}
REFINEMENT MODE: ${intent.mode}
${[...targetedRules, ...(modeRuleMap[intent.mode] || [])].join("\n")}`;
}

function buildCandidateOutfits(rankedGarments: GarmentRecord[], anchor: GarmentRecord | null): string {
  const slots = new Map<string, GarmentRecord[]>();
  for (const garment of rankedGarments) {
    const key = normalizeTerm(garment.category);
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key)!.push(garment);
  }

  const topCandidates = anchor && normalizeTerm(anchor.category) === "top"
    ? [anchor]
    : (slots.get("top") || []).slice(0, 2);
  const bottomCandidates = anchor && normalizeTerm(anchor.category) === "bottom"
    ? [anchor]
    : (slots.get("bottom") || []).slice(0, 2);
  const dressCandidates = anchor && normalizeTerm(anchor.category) === "dress"
    ? [anchor]
    : (slots.get("dress") || []).slice(0, 2);
  const shoeCandidates = anchor && normalizeTerm(anchor.category) === "shoes"
    ? [anchor]
    : (slots.get("shoes") || []).slice(0, 2);
  const outerwearCandidates = anchor && normalizeTerm(anchor.category) === "outerwear"
    ? [anchor]
    : (slots.get("outerwear") || []).slice(0, 2);
  const accessoryCandidates = (slots.get("accessory") || []).slice(0, 2);

  const candidates: string[] = [];

  for (const dress of dressCandidates) {
    const shoes = shoeCandidates.find((item) => item.id !== dress.id);
    const outerwear = outerwearCandidates.find((item) => item.id !== dress.id && item.id !== shoes?.id);
    const accessory = accessoryCandidates.find((item) => ![dress.id, shoes?.id, outerwear?.id].includes(item.id));
    const items = [dress, shoes, outerwear, accessory].filter(Boolean) as GarmentRecord[];
    if (items.length >= 2) {
      candidates.push(`- Candidate ${candidates.length + 1}: ${items.map((item) => `${item.title} [ID:${item.id}]`).join(" + ")} — rationale: dress-led silhouette with enough support pieces to finish the look.`);
    }
    if (candidates.length >= 3) return `PREBUILT OUTFIT CANDIDATES:\n${candidates.join("\n")}`;
  }

  for (const top of topCandidates) {
    const bottom = bottomCandidates.find((item) => item.id !== top.id && item.id !== anchor?.id);
    const shoes = shoeCandidates.find((item) => ![top.id, bottom?.id].includes(item.id));
    const outerwear = outerwearCandidates.find((item) => ![top.id, bottom?.id, shoes?.id].includes(item.id));
    const accessory = accessoryCandidates.find((item) => ![top.id, bottom?.id, shoes?.id, outerwear?.id].includes(item.id));
    const items = [top, bottom, shoes, outerwear, accessory].filter(Boolean) as GarmentRecord[];
    if (items.length >= 3) {
      candidates.push(`- Candidate ${candidates.length + 1}: ${items.map((item) => `${item.title} [ID:${item.id}]`).join(" + ")} — rationale: balanced separates with clear proportions and a finished focal point.`);
    }
    if (candidates.length >= 3) break;
  }

  if (anchor && candidates.length === 0) {
    const support = rankedGarments.filter((item) => item.id !== anchor.id).slice(0, 3);
    const items = [anchor, ...support].filter(Boolean);
    if (items.length >= 2) {
      candidates.push(`- Candidate 1: ${items.map((item) => `${item.title} [ID:${item.id}]`).join(" + ")} — rationale: best available support pieces around the hero garment.`);
    }
  }

  return candidates.length ? `PREBUILT OUTFIT CANDIDATES:\n${candidates.join("\n")}` : "";
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      { headers: { "User-Agent": "BURS-App/1.0" } }
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { /* ignore */ }
  return null;
}

async function fetchWeather(lat: number, lon: number, lang: typeof LANG_CONFIG[string]): Promise<string> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,wind_speed_10m,weather_code`
    );
    const d = await res.json();
    const c = d?.current;
    if (!c) return "";
    return `${lang.weatherLabel}: ${c.temperature_2m}°C, wind ${c.wind_speed_10m} km/h, precipitation ${c.precipitation} mm, code ${c.weather_code}.`;
  } catch { return ""; }
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

  const rankedGarments = ranked.slice(0, 18).map((entry) => entry.garment);
  const detailPool = rankedGarments.length ? rankedGarments : typedGarments.slice(0, 18);
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
}

async function getRecentOutfitsContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<RecentOutfitsResult> {
  const { data: outfits } = await supabase
    .from("outfits")
    .select("id, occasion, style_vibe, explanation, worn_at, generated_at, outfit_items(slot, garment_id, garments(title, color_primary))")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false })
    .limit(5);
  if (!outfits?.length) return { text: "", occasions: [] };

  const occasions = [...new Set(outfits.map((o: any) => o.occasion).filter(Boolean))] as string[];

  const lines = outfits.map((o: any) => {
    const items = (o.outfit_items || []).map((i: any) =>
      `${i.slot}: ${i.garments?.title || 'unknown'} (${i.garments?.color_primary || ''})`
    ).join(" + ");
    const wornStr = o.worn_at ? ` [worn ${o.worn_at.slice(0, 10)}]` : " [not worn]";
    return `- ${o.occasion}${o.style_vibe ? '/' + o.style_vibe : ''}: ${items}${wornStr}`;
  });

  return { text: `\nRecent outfits:\n${lines.join("\n")}`, occasions };
}

async function getRejectionsContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: signals } = await supabase
    .from("feedback_signals")
    .select("signal_type, value, metadata, created_at")
    .eq("user_id", userId)
    .in("signal_type", ["swap", "reject", "dislike", "thumbs_down"])
    .order("created_at", { ascending: false })
    .limit(8);
  if (!signals?.length) return "";

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

  return `\nRECENT REJECTIONS/SWAPS (avoid repeating these patterns):\n${lines.join("\n")}`;
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, locale: rawLocale, selected_garment_ids, garmentCount: _clientGarmentCount, archetype: _clientArchetype } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const locale = (typeof rawLocale === "string" && LANG_CONFIG[rawLocale]) ? rawLocale : "sv";
    const lang = getLang(locale);
    const selectedGarmentIds = Array.isArray(selected_garment_ids) ? selected_garment_ids.filter((id) => typeof id === "string") : [];

    const [profileRes, calendarCtx, recentOutfitsCtx, rejectionsCtx, wardrobeCtx] = await Promise.all([
      supabase.from("profiles").select("display_name, preferences, home_city, height_cm, weight_kg").eq("id", user.id).single(),
      getCalendarContext(supabase, user.id, lang),
      getRecentOutfitsContext(supabase, user.id),
      getRejectionsContext(supabase, user.id),
      getWardrobeContext(supabase, user.id, messages as MessageInput[], selectedGarmentIds),
    ]);

    const profile = profileRes.data;

    let weatherCtx = "";
    if (profile?.home_city) {
      const coords = await geocodeCity(profile.home_city);
      if (coords) weatherCtx = await fetchWeather(coords.lat, coords.lon, lang);
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

    const threadBrief = buildThreadBrief(messages as MessageInput[], wardrobeCtx.anchor);
    const activeLook = buildActiveLookContext(messages as MessageInput[], wardrobeCtx.rankedGarments);
    const refinementIntent = detectRefinementIntent(messages as MessageInput[]);
    const refinementContract = buildRefinementContract(refinementIntent, activeLook);
    const candidateOutfits = buildCandidateOutfits(wardrobeCtx.rankedGarments, wardrobeCtx.anchor);
    const chatComplexity = chooseChatComplexity(messages as MessageInput[], wardrobeCtx.anchor);
    const refinementTurn = isRefinementTurn(refinementIntent, activeLook);

    const systemPrompt = `${VOICE_STYLIST_CHAT}

LANGUAGE: Respond ONLY in ${lang.name}. Every word.

Season context: ${seasonHint} ${new Date().getFullYear()}

${profile?.display_name ? `Client: ${profile.display_name}` : ""}${profile?.home_city ? ` (${profile.home_city})` : ""}${bodyContext}

USER IDENTITY:
${identityBlock}
${styleLines ? `\nSTYLE PROFILE:\n${styleLines}` : ""}

${threadBrief ? `${threadBrief}\n\n` : ""}${wardrobeCtx.text}
${candidateOutfits ? `\n\n${candidateOutfits}` : ""}
${recentOutfitsCtx.text}
${rejectionsCtx}
${calendarCtx}
${weatherCtx}

STYLIST OPERATING CONTRACT:
- Act like a premium stylist, not a general assistant.
- Ground every recommendation in the ranked wardrobe subset first; only mention missing pieces when the wardrobe truly lacks them.
- If there is an anchor garment, build around it explicitly before offering alternatives.
- Think silently in 2-3 outfit candidates first, then answer with the strongest option and at most one backup.
- Explain silhouette, color harmony, texture, visual weight, and occasion fit in concrete terms.
- Preserve continuity with the thread brief; do not reset the user's goal each turn.
- Treat the active look as the default working look for refinements.
- If the user asks for styling advice rather than a full outfit, still reference specific garments from the wardrobe subset.
- Keep the tone editorial, concise, and premium. No generic helper phrasing.

GARMENT TAGS:
- When mentioning a garment from the wardrobe, tag it: [[garment:ID]] after its name
- For the active outfit snapshot, use exactly one [[outfit:id1,id2,id3|Why this works]] tag in every reply
- The explanation after | must be in ${lang.name}
- ALWAYS return the outfit tag, including refinement turns, so the UI can update the active look card
- Garment tags are optional support detail; the single outfit tag is mandatory and authoritative
- Tags must appear only after the natural-language mention, never as raw bracketed prose on their own.

${refinementContract}`;

    const preparedMessages = (messages as MessageInput[]).map((m) => {
      if (typeof m.content === "string") {
        try {
          const parsed = JSON.parse(m.content);
          if (Array.isArray(parsed)) return { role: m.role, content: parsed };
        } catch { /* keep as string */ }
      }
      return m;
    });

    const aiResponse = await callBursAI({
      messages: [
        { role: "system", content: systemPrompt },
        ...preparedMessages,
      ],
      complexity: chatComplexity,
      max_tokens: chatComplexity === "complex" ? 1200 : 1000,
      functionName: "style_chat",
    });

    const rawAssistantText = typeof aiResponse.data === "string" ? aiResponse.data : String(aiResponse.data ?? "");
    const normalizedReply = normalizeAssistantReply({
      rawText: rawAssistantText,
      validGarmentIds: new Set(wardrobeCtx.rankedGarments.map((garment) => garment.id)),
      rankedGarments: wardrobeCtx.rankedGarments,
      anchor: wardrobeCtx.anchor,
      activeLook,
      placeOutfitTagFirst: refinementTurn,
    });

    return createSseTextResponse(
      normalizedReply.text,
      refinementTurn ? normalizedReply.outfitTag : null,
    );
  } catch (e) {
    console.error("style_chat error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
