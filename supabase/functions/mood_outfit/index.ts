import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map moods to styling parameters
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { mood, weather, locale = "sv" } = await req.json();
    if (!mood) throw new Error("Missing mood");

    const moodParams = MOOD_MAP[mood] || MOOD_MAP.confident;

    const { data: garments, error: gErr } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, color_secondary, pattern, material, fit, formality, season_tags, wear_count, last_worn_at")
      .eq("user_id", userId)
      .eq("in_laundry", false);

    if (gErr) throw gErr;
    if (!garments || garments.length < 3) {
      return new Response(JSON.stringify({ error: "Need at least 3 garments" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const garmentList = garments.map(g => {
      const parts = [`ID:${g.id}`, g.title, `cat:${g.category}`, `color:${g.color_primary}`];
      if (g.material) parts.push(`material:${g.material}`);
      if (g.formality) parts.push(`formality:${g.formality}/5`);
      if (g.pattern) parts.push(`pattern:${g.pattern}`);
      return parts.join(" | ");
    }).join("\n");

    const langName = locale === "sv" ? "svenska" : "English";

    const systemPrompt = `You are a mood-based personal stylist. Create an outfit that matches the user's current mood.

MOOD: "${mood}"
MOOD STYLING DIRECTION:
- Formality: ${moodParams.formality}
- Colors to favor: ${moodParams.colors}
- Materials to favor: ${moodParams.materials}
- Overall vibe: ${moodParams.vibe}

${weather?.temperature !== undefined ? `WEATHER: ${weather.temperature}°C, ${weather.precipitation || "clear"}` : ""}

RULES:
1. Every outfit MUST include: top + bottom + shoes (or dress + shoes)
2. ONLY use garment IDs from the wardrobe list
3. Match the mood direction as closely as possible with available garments
4. Prioritize less-worn items when multiple options match equally

Write explanation in ${langName}.

WARDROBE:
${garmentList}`;

    const { data: result } = await callBursAI({
      complexity: "standard",
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `I'm feeling ${mood} today. Create an outfit that matches.` },
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
              explanation: { type: "string", description: "Why this outfit matches the mood" },
              mood_match_score: { type: "number", description: "How well this matches the mood 0-100" },
            },
            required: ["items", "explanation", "mood_match_score"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "select_mood_outfit" } },
    });

    if (!result) throw new Error("AI did not return structured result");

    // Validate IDs
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
