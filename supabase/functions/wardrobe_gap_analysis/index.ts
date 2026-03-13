import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: garments } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, material, pattern, formality, season_tags")
      .eq("user_id", user.id);

    if (!garments || garments.length < 5) {
      return new Response(JSON.stringify({ gaps: [], message: "Need more garments for analysis" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categories: Record<string, number> = {};
    const colors: Record<string, number> = {};
    const materials: Record<string, number> = {};
    garments.forEach((g: any) => {
      categories[g.category] = (categories[g.category] || 0) + 1;
      colors[g.color_primary] = (colors[g.color_primary] || 0) + 1;
      if (g.material) materials[g.material] = (materials[g.material] || 0) + 1;
    });

    const wardrobeProfile = `WARDROBE PROFILE (${garments.length} items):
Categories: ${Object.entries(categories).map(([k, v]) => `${k}: ${v}`).join(", ")}
Colors: ${Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}: ${v}`).join(", ")}
Materials: ${Object.entries(materials).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}: ${v}`).join(", ")}`;

    const prompt = `You are a wardrobe gap analyst for a premium styling app. Analyze this wardrobe and identify 3-5 missing pieces that would unlock the most new outfit combinations.

${wardrobeProfile}

Focus on:
1. Category gaps (e.g., missing neutral bottoms, no versatile shoes)
2. Color gaps (e.g., no neutral base colors, missing accent colors)
3. Versatility gaps (pieces that would bridge casual and formal)
4. Seasonal gaps

For each gap, estimate how many new outfits it would unlock.`;

    const { data: result } = await callBursAI({
      complexity: "standard",
      max_tokens: estimateMaxTokens({ inputItems: garments.length, outputItems: Math.ceil(garments.length / 10), perItemTokens: 80, baseTokens: 200 }),
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Identify wardrobe gaps." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "identify_gaps",
          description: "Return wardrobe gap analysis",
          parameters: {
            type: "object",
            properties: {
              gaps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    item: { type: "string", description: "Suggested item to add (e.g., 'White sneakers')" },
                    category: { type: "string", description: "Category: tops, bottoms, shoes, accessories, outerwear" },
                    reason: { type: "string", description: "Why this fills a gap" },
                    new_outfits: { type: "number", description: "Estimated new outfits unlocked" },
                  },
                  required: ["item", "category", "reason", "new_outfits"],
                  additionalProperties: false,
                },
              },
            },
            required: ["gaps"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "identify_gaps" } },
      cacheTtlSeconds: 3600,
      cacheNamespace: "wardrobe_gap",
    }, supabase);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wardrobe_gap_analysis error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
