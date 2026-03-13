import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { image_base64, locale = "sv" } = await req.json();
    if (!image_base64) throw new Error("Missing image_base64");

    const { data: garments, error: gErr } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, color_secondary, pattern, material, fit, formality")
      .eq("user_id", userId);

    if (gErr) throw gErr;
    if (!garments || garments.length < 3) {
      return new Response(JSON.stringify({ matches: [], gaps: [], description: "Add more garments first." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const garmentList = garments.map(g => {
      const parts = [`ID:${g.id}`, g.title, `cat:${g.category}`, `color:${g.color_primary}`];
      if (g.material) parts.push(`material:${g.material}`);
      if (g.pattern) parts.push(`pattern:${g.pattern}`);
      if (g.fit) parts.push(`fit:${g.fit}`);
      return parts.join(" | ");
    }).join("\n");

    const langName = locale === "sv" ? "svenska" : "English";

    const { data: result } = await callBursAI({
      messages: [
        {
          role: "system",
          content: `You are a fashion visual search engine. Analyze the inspiration image and match garments from the user's wardrobe. Respond in ${langName}.

USER'S WARDROBE:
${garmentList}`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this inspiration image. Identify every garment/piece visible and find the closest matches in my wardrobe. For items with no good match, list them as gaps." },
            { type: "image_url", image_url: { url: image_base64 } },
          ],
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "visual_match",
          description: "Return visual search results matching inspiration to wardrobe",
          parameters: {
            type: "object",
            properties: {
              description: { type: "string", description: "Brief description of the outfit in the image" },
              matches: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    detected_item: { type: "string" },
                    garment_id: { type: "string" },
                    confidence: { type: "number", description: "Match confidence 0-100" },
                    reason: { type: "string" },
                  },
                  required: ["detected_item", "garment_id", "confidence", "reason"],
                  additionalProperties: false,
                },
              },
              gaps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    detected_item: { type: "string" },
                    suggestion: { type: "string" },
                  },
                  required: ["detected_item", "suggestion"],
                  additionalProperties: false,
                },
              },
            },
            required: ["description", "matches", "gaps"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "visual_match" } },
      complexity: "complex",
      max_tokens: estimateMaxTokens({ inputItems: garments.length, outputItems: 5, perItemTokens: 80, baseTokens: 200 }),
    });

    const garmentIdSet = new Set(garments.map(g => g.id));
    result.matches = (result.matches || []).filter((m: any) => garmentIdSet.has(m.garment_id));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("visual_search error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
