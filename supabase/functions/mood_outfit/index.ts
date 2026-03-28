import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";
import { VOICE_MOOD_OUTFIT } from "../_shared/burs-voice.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
function hasCompleteOutfit(items: Array<{ slot: string }>): boolean {
  const slots = new Set(items.map(i => i.slot.toLowerCase()));
  return slots.has('shoes') && (slots.has('dress') || (slots.has('top') && slots.has('bottom')));
}

function validateCompleteOutfitInline(items: Array<{ slot: string }>): { isValid: boolean; missing: string[] } {
  const slots = new Set(items.map(i => i.slot.toLowerCase()));
  const missing: string[] = [];
  if (!slots.has('shoes')) missing.push('shoes');
  const hasDress = slots.has('dress');
  const hasTopBottom = slots.has('top') && slots.has('bottom');
  if (!hasDress && !hasTopBottom) {
    if (!slots.has('top')) missing.push('top');
    if (!slots.has('bottom')) missing.push('bottom');
  }
  return { isValid: missing.length === 0, missing };
}

const MOOD_MAP: Record<string, { formality: string; colors: string; materials: string; vibe: string }> = {
  cozy: { formality: "casual, low", colors: "warm earth tones, cream, beige, soft browns", materials: "knit, fleece, cashmere, cotton", vibe: "soft, comfortable, enveloping" },
  confident: { formality: "smart-casual to formal", colors: "strong, saturated — black, red, navy, white", materials: "structured fabrics, leather, tailored wool", vibe: "powerful, sharp, put-together" },
  creative: { formality: "relaxed, expressive", colors: "unexpected combos, bold accents, patterns", materials: "mixed textures, statement pieces", vibe: "artistic, unique, eye-catching" },
  invisible: { formality: "neutral, blending", colors: "muted neutrals, grey, navy, black, white", materials: "standard, unremarkable", vibe: "understated, minimal, no-attention" },
  romantic: { formality: "soft elegant", colors: "pastels, blush, soft white, dusty rose", materials: "silk, lace, flowing fabrics", vibe: "gentle, feminine, dreamy" },
  energetic: { formality: "casual, sporty-chic", colors: "bright, vibrant — yellow, orange, electric blue", materials: "lightweight, breathable", vibe: "active, upbeat, fun" },
};


const SHOES_TOKENS = ["shoes", "shoe", "sneakers", "boots", "heels", "sandals", "loafers", "skor", "stövlar"];
const OUTERWEAR_TOKENS = ["outerwear", "coat", "jacket", "blazer", "trench", "jacka", "kappa"];
const DRESS_TOKENS = ["dress", "jumpsuit", "overall", "klänning"];
const BOTTOM_TOKENS = ["bottom", "pants", "jeans", "trousers", "shorts", "skirt", "byxor", "kjol"];

function normalizeValue(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function inferSlotFromGarment(garment: { category?: string | null; subcategory?: string | null }): string {
  const value = `${normalizeValue(garment.category)} ${normalizeValue(garment.subcategory)}`.trim();
  if (DRESS_TOKENS.some((token) => value.includes(token))) return "dress";
  if (SHOES_TOKENS.some((token) => value.includes(token))) return "shoes";
  if (OUTERWEAR_TOKENS.some((token) => value.includes(token))) return "outerwear";
  if (BOTTOM_TOKENS.some((token) => value.includes(token))) return "bottom";
  return "top";
}

function requiresOuterwear(weather?: { temperature?: number; precipitation?: string | null }): boolean {
  const temp = weather?.temperature;
  const precipitation = normalizeValue(weather?.precipitation);
  const coldEnough = temp !== undefined && temp < 8;
  const wet = precipitation !== "" && !["none", "ingen"].includes(precipitation);
  const snowy = precipitation.includes("snow") || precipitation.includes("snö");
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

function enrichMoodOutfitItems(
  items: { slot: string; garment_id: string }[],
  garments: Array<{ id: string; category?: string | null; subcategory?: string | null; wear_count?: number | null }>,
  weather?: { temperature?: number; precipitation?: string | null },
): { slot: string; garment_id: string }[] {
  const enriched = [...items];
  const garmentIds = new Set(enriched.map((item) => item.garment_id));
  const slots = new Set(enriched.map((item) => item.slot));

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
  return notes.length ? notes.join('; ') : null;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { mood, weather, locale = "sv" } = await req.json();
    if (!mood) throw new Error("Missing mood");
    const moodParams = MOOD_MAP[mood] || MOOD_MAP.confident;

    const { data: garments, error: gErr } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, material, formality, pattern, wear_count")
      .eq("user_id", userId)
      .eq("in_laundry", false);

    if (gErr) throw gErr;
    if (!garments || garments.length === 0) {
      return new Response(JSON.stringify({ error: "Need garments in your wardrobe" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!hasCompleteOutfit(garments.map(g => ({ slot: inferSlotFromGarment(g) })))) {
      return new Response(JSON.stringify({
        error: "You need either top + bottom + shoes, or dress + shoes, to create a mood outfit",
      }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const garmentList = garments.map(g => `${g.id}|${g.title}|${g.category}|${g.color_primary}|${g.material || "?"}|f${g.formality || 3}`).join("\n");
    const langName = locale === "sv" ? "svenska" : "English";

    const { data: result } = await callBursAI({
      complexity: "standard",
      max_tokens: estimateMaxTokens({ outputItems: 5, perItemTokens: 40, baseTokens: 120 }),
      functionName: "mood_outfit",
      cacheTtlSeconds: 900,
      cacheNamespace: `mood_${mood}_${userId?.slice(0, 8)}`,
      messages: [
        { role: "system", content: `${VOICE_MOOD_OUTFIT}

Mood:"${mood}" — Direction: ${moodParams.formality} | Colors: ${moodParams.colors} | Vibe: ${moodParams.vibe}
${weather?.temperature !== undefined ? `Weather: ${weather.temperature}°C` : ""}
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

    if (!result) throw new Error("AI did not return structured result");
    const garmentsById = new Map(garments.map((g) => [g.id, g]));
    const normalizedItems = enrichMoodOutfitItems(
      (result.items || [])
        .filter((i: any) => garmentsById.has(i.garment_id))
        .map((i: any) => {
          const garment = garmentsById.get(i.garment_id);
          const inferredSlot = garment ? inferSlotFromGarment(garment) : i.slot;
          return { slot: inferredSlot, garment_id: i.garment_id };
        }),
      garments,
      weather,
    );

    const completeValidation = validateCompleteOutfitInline(normalizedItems);
    if (!completeValidation.isValid) {
      return new Response(JSON.stringify({
        error: `Not enough garments to build a complete mood outfit. Missing: ${completeValidation.missing.join(', ')}`,
        missing_slots: completeValidation.missing,
      }), {
        status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const limitationNote = result.limitation_note || buildMoodLimitationNote(normalizedItems, weather);

    return new Response(JSON.stringify({
      ...result,
      items: normalizedItems,
      limitation_note: limitationNote,
    }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mood_outfit error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
