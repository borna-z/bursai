import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";
import { VOICE_MOOD_OUTFIT } from "../_shared/burs-voice.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function validateMoodOutfitBase(items: { slot: string }[]): { valid: boolean; missing: string[] } {
  const slots = new Set(items.map((item) => item.slot));
  const hasDress = slots.has("dress");
  const hasStandardBase = slots.has("top") && slots.has("bottom");
  const valid = hasDress || hasStandardBase;
  const missing: string[] = [];

  if (!valid) {
    if (!hasDress && !slots.has("top")) missing.push("top");
    if (!hasDress && !slots.has("bottom")) missing.push("bottom");
    if (!hasDress && missing.length === 0) missing.push("dress");
  }

  return { valid, missing };
}

function buildMoodLimitationNote(
  items: { slot: string }[],
  weather?: { temperature?: number; precipitation?: string | null },
): string | null {
  const slots = new Set(items.map((item) => item.slot));
  const notes: string[] = [];
  if (!slots.has("shoes")) notes.push("missing shoes, so this is a base outfit only");
  if (requiresOuterwear(weather) && !slots.has("outerwear")) {
    notes.push("missing weather-appropriate outerwear, so this is a base outfit only");
  }
  return notes.length ? notes.join('; ') : null;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
Rules: return a usable base outfit first. Standard base outfit = top+bottom. Dress is also allowed when it suits the mood. Shoes and outerwear are optional additions, not hard requirements. If shoes or weather-ready outerwear are unavailable, still return the best base outfit. Only IDs from list. Prioritize less-worn. Respond in ${langName}.
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
    const normalizedItems = (result.items || [])
      .filter((i: any) => garmentsById.has(i.garment_id))
      .map((i: any) => {
        const garment = garmentsById.get(i.garment_id);
        const inferredSlot = garment ? inferSlotFromGarment(garment) : i.slot;
        return { slot: inferredSlot, garment_id: i.garment_id };
      });

    const baseValidation = validateMoodOutfitBase(normalizedItems);
    if (!baseValidation.valid) {
      return new Response(JSON.stringify({
        error: `Not enough garments to build a mood outfit base. Missing: ${baseValidation.missing.join(', ')}`,
        missing_slots: baseValidation.missing,
      }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limitationNote = result.limitation_note || buildMoodLimitationNote(normalizedItems, weather);

    return new Response(JSON.stringify({
      ...result,
      items: normalizedItems,
      limitation_note: limitationNote,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mood_outfit error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
