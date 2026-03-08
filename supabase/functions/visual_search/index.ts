import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    // Fetch user's wardrobe
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

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
                      detected_item: { type: "string", description: "What was detected in the image" },
                      garment_id: { type: "string", description: "UUID of best matching wardrobe item" },
                      confidence: { type: "number", description: "Match confidence 0-100" },
                      reason: { type: "string", description: "Why this matches" },
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
                      detected_item: { type: "string", description: "Item from image with no match" },
                      suggestion: { type: "string", description: "What to look for when shopping" },
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
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("AI error:", resp.status, t);
      throw new Error("AI service error");
    }

    const aiData = await resp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result: any = null;
    if (toolCall?.function?.arguments) {
      try { result = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }
    }
    if (!result) throw new Error("AI did not return structured result");

    // Validate garment IDs
    const garmentIdSet = new Set(garments.map(g => g.id));
    result.matches = (result.matches || []).filter((m: any) => garmentIdSet.has(m.garment_id));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("visual_search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
