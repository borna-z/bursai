import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";
import { VOICE_MOOD_OUTFIT } from "../_shared/burs-voice.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, recordError, overloadResponse } from "../_shared/scale-guard.ts";
import { classifySlot } from "../_shared/burs-slots.ts";
import { canBuildCompleteOutfitPath, validateCompleteOutfit } from "../_shared/outfit-validation.ts";
import { logger } from "../_shared/logger.ts";

const log = logger("mood_outfit");

const AI_TIMEOUT_MS = 26000;

function normalizeValue(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

const MOOD_MAP: Record<string, { formality: string; colors: string; materials: string; vibe: string }> = {
  cozy: { formality: "casual, low", colors: "warm earth tones, cream, beige, soft browns", materials: "knit, fleece, cashmere, cotton", vibe: "soft, comfortable, enveloping" },
  confident: { formality: "smart-casual to formal", colors: "strong, saturated - black, red, navy, white", materials: "structured fabrics, leather, tailored wool", vibe: "powerful, sharp, put-together" },
  creative: { formality: "relaxed, expressive", colors: "unexpected combos, bold accents, patterns", materials: "mixed textures, statement pieces", vibe: "artistic, unique, eye-catching" },
  invisible: { formality: "neutral, blending", colors: "muted neutrals, grey, navy, black, white", materials: "standard, unremarkable", vibe: "understated, minimal, no-attention" },
  romantic: { formality: "soft elegant", colors: "pastels, blush, soft white, dusty rose", materials: "silk, lace, flowing fabrics", vibe: "gentle, feminine, dreamy" },
  energetic: { formality: "casual, sporty-chic", colors: "bright, vibrant - yellow, orange, electric blue", materials: "lightweight, breathable", vibe: "active, upbeat, fun" },
  grounded: { formality: "casual, relaxed", colors: "olive, khaki, tan, warm brown, sage", materials: "cotton, linen, canvas, suede", vibe: "earthy, authentic, natural" },
  sharp: { formality: "formal, tailored", colors: "black, charcoal, cream, gold accents", materials: "tailored wool, crisp cotton, structured fabrics", vibe: "precise, polished, intentional" },
  soft: { formality: "casual-elegant, low contrast", colors: "powder blue, lavender, light grey, off-white", materials: "cashmere, soft knit, silk blend", vibe: "muted, gentle, calming" },
  bold: { formality: "statement, high-impact", colors: "red, deep black, white, high contrast", materials: "leather, structured fabrics, bold textures", vibe: "maximum, unapologetic, attention-commanding" },
  editorial: { formality: "avant-garde, fashion-forward", colors: "navy, gold, deep teal, monochrome", materials: "architectural fabrics, unusual cuts, layering", vibe: "magazine-ready, conceptual, curated" },
  playful: { formality: "casual, fun", colors: "pink, orange, purple, unexpected color combos", materials: "mixed prints, playful textures", vibe: "fun, spontaneous, joyful" },
};

function inferSlotFromGarment(garment: { category?: string | null; subcategory?: string | null }): string {
  return classifySlot(garment.category, garment.subcategory) || "top";
}

const MOOD_OUTFIT_SLOTS = new Set(["top", "bottom", "shoes", "outerwear", "accessory", "dress"]);

function normalizeMoodOutfitSlot(slot: unknown): string | null {
  const normalized = normalizeValue(slot);
  return MOOD_OUTFIT_SLOTS.has(normalized) ? normalized : null;
}

function requiresOuterwear(weather?: { temperature?: number; precipitation?: string | null }): boolean {
  const temp = weather?.temperature;
  const precipitation = normalizeValue(weather?.precipitation);
  const coldEnough = temp !== undefined && temp < 8;
  const wet = precipitation !== "" && !["none", "ingen"].includes(precipitation);
  const snowy = precipitation.includes("snow") || precipitation.includes("sno");
  return coldEnough || wet || snowy;
}

function isWeatherSuitableOptionalGarment(
  slot: "shoes" | "outerwear",
  garment: { category?: string | null; subcategory?: string | null },
  weather?: { temperature?: number; precipitation?: string | null },
): boolean {
  const temp = weather?.temperature;
  const precipitation = normalizeValue(weather?.precipitation);
  const text = `${normalizeValue(garment.category)} ${normalizeValue(garment.subcategory)}`.trim();
  const isWet = precipitation.includes("rain") || precipitation.includes("snow") || precipitation.includes("regn") || precipitation.includes("sno");
  const isCold = temp !== undefined && temp < 10;
  const isHot = temp !== undefined && temp > 24;

  if (slot === "shoes") {
    if (isWet || isCold) return !text.includes("sandal");
    if (isHot && text.includes("boot")) return false;
  }

  if (slot === "outerwear") {
    if (!requiresOuterwear(weather)) return true;
    if (isWet) return ["rain", "trench", "coat", "jacket", "jacka", "kappa"].some((token) => text.includes(token));
    if (isCold) return ["coat", "jacket", "parka", "jacka", "kappa"].some((token) => text.includes(token));
  }

  return true;
}

function chooseBestOptionalGarment<T extends { wear_count?: number | null; category?: string | null; subcategory?: string | null }>(
  garments: T[],
  slot: "shoes" | "outerwear",
  weather?: { temperature?: number; precipitation?: string | null },
): T | null {
  if (garments.length === 0) return null;
  const weatherReady = garments.filter((garment) => isWeatherSuitableOptionalGarment(slot, garment, weather));
  const pool = weatherReady.length > 0 ? weatherReady : garments;
  return [...pool].sort((a, b) => {
    const aWear = a.wear_count ?? 0;
    const bWear = b.wear_count ?? 0;
    return aWear - bWear;
  })[0] || null;
}

function chooseBestCoreGarment<T extends { wear_count?: number | null }>(garments: T[]): T | null {
  if (garments.length === 0) return null;
  return [...garments].sort((a, b) => {
    const aWear = a.wear_count ?? 0;
    const bWear = b.wear_count ?? 0;
    return aWear - bWear;
  })[0] || null;
}

function enrichMoodOutfitItems(
  items: { slot: string; garment_id: string }[],
  garments: Array<{ id: string; category?: string | null; subcategory?: string | null; wear_count?: number | null }>,
  weather?: { temperature?: number; precipitation?: string | null },
): { slot: string; garment_id: string }[] {
  const enriched = [...items];
  const garmentIds = new Set(enriched.map((item) => item.garment_id));
  const slots = new Set(enriched.map((item) => item.slot));

  const addBestCoreSlot = (slot: "top" | "bottom" | "dress") => {
    if (slots.has(slot)) return;
    const garment = chooseBestCoreGarment(
      garments.filter((candidate) => !garmentIds.has(candidate.id) && inferSlotFromGarment(candidate) === slot),
    );
    if (!garment) return;
    enriched.push({ slot, garment_id: garment.id });
    garmentIds.add(garment.id);
    slots.add(slot);
  };

  const hasDress = slots.has("dress");
  const hasTop = slots.has("top");
  const hasBottom = slots.has("bottom");

  if (!hasDress && !hasTop && !hasBottom) {
    addBestCoreSlot("dress");
    if (!slots.has("dress")) {
      addBestCoreSlot("top");
      addBestCoreSlot("bottom");
    }
  } else if (!hasDress) {
    if (!hasTop) addBestCoreSlot("top");
    if (!hasBottom) addBestCoreSlot("bottom");
  }

  if (!slots.has("shoes")) {
    const shoe = chooseBestOptionalGarment(
      garments.filter((garment) => !garmentIds.has(garment.id) && inferSlotFromGarment(garment) === "shoes"),
      "shoes",
      weather,
    );
    if (shoe) {
      enriched.push({ slot: "shoes", garment_id: shoe.id });
      garmentIds.add(shoe.id);
      slots.add("shoes");
    }
  }

  if (requiresOuterwear(weather) && !slots.has("outerwear")) {
    const outerwear = chooseBestOptionalGarment(
      garments.filter((garment) => !garmentIds.has(garment.id) && inferSlotFromGarment(garment) === "outerwear"),
      "outerwear",
      weather,
    );
    if (outerwear) {
      enriched.push({ slot: "outerwear", garment_id: outerwear.id });
    }
  }

  return enriched;
}

function buildMoodLimitationNote(
  items: { slot: string }[],
  weather?: { temperature?: number; precipitation?: string | null },
): string | null {
  const slots = new Set(items.map((item) => item.slot));
  const notes: string[] = [];
  if (requiresOuterwear(weather) && !slots.has("outerwear")) {
    notes.push("No weather-appropriate outerwear was available, so add a jacket or keep this look indoors");
  }
  return notes.length ? notes.join("; ") : null;
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const reason = signal.reason;
  if (reason instanceof Error) throw reason;
  throw new Error(typeof reason === "string" ? reason : "Request aborted");
}

async function readMoodOutfitToolResult(response: Response, signal: AbortSignal): Promise<any> {
  if (!response.body) throw new Error("AI stream did not include a response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;
  const toolCalls = new Map<number, { id?: string; name?: string; arguments: string }>();
  let messageContent = "";

  try {
    let streamClosed = false;
    while (!streamClosed) {
      throwIfAborted(signal);

      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        streamClosed = true;
      } else {
        buffer += decoder.decode(value, { stream: true });
      }

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") {
          sawDone = true;
          continue;
        }

        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        const message = choice?.delta ?? choice?.message ?? {};
        const toolCallChunks = Array.isArray(message.tool_calls) ? message.tool_calls : [];

        toolCallChunks.forEach((chunk: any, index: number) => {
          const key = typeof chunk?.index === "number" ? chunk.index : index;
          const existing = toolCalls.get(key) ?? { arguments: "" };
          if (chunk?.id) existing.id = chunk.id;
          if (chunk?.function?.name) existing.name = chunk.function.name;
          if (typeof chunk?.function?.arguments === "string") {
            existing.arguments += chunk.function.arguments;
          }
          toolCalls.set(key, existing);
        });

        if (typeof message.content === "string") {
          messageContent += message.content;
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore shutdown errors.
    }
  }

  const primaryToolCall = [...toolCalls.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, toolCall]) => toolCall)
    .find((toolCall) => toolCall.arguments.trim().length > 0);

  if (primaryToolCall) {
    return JSON.parse(primaryToolCall.arguments);
  }

  if (messageContent.trim().length > 0) {
    return JSON.parse(messageContent);
  }

  if (!sawDone) throw new Error("AI stream closed before completion");
  throw new Error("AI did not return structured result");
}

async function generateMoodOutfitPayload(
  req: Request,
  signal: AbortSignal,
  requestId: string,
): Promise<Record<string, unknown>> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  throwIfAborted(signal);
  if (userError || !user) {
    return { error: "Unauthorized" };
  }
  const userId = user.id;
  log.info("request.start", { requestId, userId });

  await enforceRateLimit(serviceClient, userId, "mood_outfit");
  throwIfAborted(signal);

  const { mood, weather, locale = "sv" } = await req.json();
  if (!mood) throw new Error("Missing mood");
  const moodParams = MOOD_MAP[mood] || MOOD_MAP.confident;

  const { data: garments, error: gErr } = await supabase
    .from("garments")
    .select("id, title, category, subcategory, color_primary, material, formality, pattern, wear_count")
    .eq("user_id", userId)
    .or("in_laundry.is.null,in_laundry.eq.false")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  throwIfAborted(signal);
  if (gErr) throw gErr;
  if (!garments || garments.length === 0) {
    return { error: "Need garments in your wardrobe" };
  }
  if (!canBuildCompleteOutfitPath(garments)) {
    return {
      error: "You need either top + bottom + shoes, or dress + shoes, to create a mood outfit",
    };
  }

  const garmentList = garments.map((g) => `${g.id}|${g.title}|${g.category}|${g.color_primary}|${g.material || "?"}|f${g.formality || 3}`).join("\n");
  const langName = locale === "sv" ? "svenska" : "English";

  const aiResponse = await callBursAI({
    stream: true,
    complexity: "complex",
    timeout: AI_TIMEOUT_MS,
    max_tokens: estimateMaxTokens({ outputItems: 5, perItemTokens: 40, baseTokens: 120 }),
    functionName: "mood_outfit",
    cacheTtlSeconds: 900,
    cacheNamespace: `mood_${mood}_${userId?.slice(0, 8)}`,
    messages: [
      { role: "system", content: `${VOICE_MOOD_OUTFIT}

Mood:"${mood}" - Direction: ${moodParams.formality} | Colors: ${moodParams.colors} | Vibe: ${moodParams.vibe}
${weather?.temperature !== undefined ? `Weather: ${weather.temperature}C` : ""}
Rules: return a complete, wearable outfit only. Valid cores are top+bottom+shoes or dress+shoes. If weather-appropriate outerwear exists and the weather calls for it, include outerwear. Never return a base outfit without shoes. Only IDs from list. Prioritize less-worn. Respond in ${langName}.
WARDROBE:\n${garmentList}` },
      { role: "user", content: `Feeling ${mood}. Create outfit.` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "select_mood_outfit",
        description: "Select garments matching the mood",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slot: { type: "string", enum: ["top", "bottom", "shoes", "outerwear", "accessory", "dress"] },
                  garment_id: { type: "string" },
                },
                required: ["slot", "garment_id"],
                additionalProperties: false,
              },
            },
            explanation: { type: "string" },
            mood_match_score: { type: "number" },
            limitation_note: { type: ["string", "null"] },
          },
          required: ["items", "explanation", "mood_match_score"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "select_mood_outfit" } },
  }, serviceClient);

  throwIfAborted(signal);
  const result = await readMoodOutfitToolResult(aiResponse.data as Response, signal);
  if (!result) throw new Error("AI did not return structured result");

  const garmentsById = new Map(garments.map((g) => [g.id, g]));
  const normalizedItems = enrichMoodOutfitItems(
    (result.items || [])
      .filter((i: any) => garmentsById.has(i.garment_id))
      .map((i: any) => {
        const explicitSlot = normalizeMoodOutfitSlot(i.slot);
        if (!explicitSlot) return null;
        return { slot: explicitSlot, garment_id: i.garment_id };
      })
      .filter((item: { slot: string; garment_id: string } | null): item is { slot: string; garment_id: string } => Boolean(item)),
    garments,
    weather,
  );

  const completeValidation = validateCompleteOutfit(
    normalizedItems.map((item) => ({
      slot: item.slot,
    })),
  );
  if (!completeValidation.isValid) {
    const limitationNote = result.limitation_note || buildMoodLimitationNote(normalizedItems, weather);
    return {
      error: `Not enough garments to build a complete mood outfit. Missing: ${completeValidation.missing.join(", ")}`,
      missing_slots: completeValidation.missing,
      mood_match_score: result.mood_match_score ?? null,
      limitation_note: limitationNote,
    };
  }

  const limitationNote = result.limitation_note || buildMoodLimitationNote(normalizedItems, weather);

  log.info("request.complete", {
    requestId,
    userId,
    stage: "response_ready",
    itemCount: normalizedItems.length,
    degraded: Boolean(limitationNote),
  });

  return {
    ...result,
    items: normalizedItems,
    limitation_note: limitationNote,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (checkOverload("mood_outfit")) return overloadResponse(CORS_HEADERS);

  const abortController = new AbortController();
  const requestId = crypto.randomUUID();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error("Mood outfit request timed out"));
  }, 28000) as unknown as number;

  try {
    const payload = await generateMoodOutfitPayload(req, abortController.signal, requestId);
    return new Response(JSON.stringify(payload), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }

    recordError("mood_outfit");
    log.exception("request.failed", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  } finally {
    clearTimeout(timeoutId);
  }
});
