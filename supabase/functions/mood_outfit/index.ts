import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, compactGarment, estimateMaxTokens } from "../_shared/burs-ai.ts";

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
    if (!garments || garments.length < 3) {
      return new Response(JSON.stringify({ error: "Need at least 3 garments" }), {
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
        { role: "system", content: `Mood-based stylist. Mood:"${mood}" Dir:${moodParams.formality}|${moodParams.colors}|${moodParams.vibe}
${weather?.temperature !== undefined ? `Weather:${weather.temperature}°C` : ""}
Rules: top+bottom+shoes(or dress+shoes). Only IDs from list. Prioritize less-worn. ${langName}.
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
            },
            required: ["items", "explanation", "mood_match_score"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "select_mood_outfit" } },
    }, serviceClient);

    if (!result) throw new Error("AI did not return structured result");
    const garmentIdSet = new Set(garments.map(g => g.id));
    result.items = (result.items || []).filter((i: any) => garmentIdSet.has(i.garment_id));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mood_outfit error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
