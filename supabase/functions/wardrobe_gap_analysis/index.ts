import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
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
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");
    const user = { id: claimsData.claims.sub as string };

    // Parse optional locale from body
    let locale = "en";
    try {
      const body = await req.json();
      if (body?.locale) locale = body.locale;
    } catch { /* empty body is fine */ }

    const { data: garments } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, color_secondary, material, pattern, formality, season_tags, fit")
      .eq("user_id", user.id);

    if (!garments || garments.length < 5) {
      return new Response(JSON.stringify({ gaps: [], message: "Need more garments for analysis" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categories: Record<string, number> = {};
    const colors: Record<string, number> = {};
    const materials: Record<string, number> = {};
    const subcategories: Record<string, number> = {};
    const fits: Record<string, number> = {};
    let formalitySum = 0;
    let formalityCount = 0;

    garments.forEach((g: any) => {
      categories[g.category] = (categories[g.category] || 0) + 1;
      colors[g.color_primary] = (colors[g.color_primary] || 0) + 1;
      if (g.color_secondary) colors[g.color_secondary] = (colors[g.color_secondary] || 0) + 1;
      if (g.material) materials[g.material] = (materials[g.material] || 0) + 1;
      if (g.subcategory) subcategories[g.subcategory] = (subcategories[g.subcategory] || 0) + 1;
      if (g.fit) fits[g.fit] = (fits[g.fit] || 0) + 1;
      if (g.formality != null) { formalitySum += g.formality; formalityCount++; }
    });

    const avgFormality = formalityCount > 0 ? (formalitySum / formalityCount).toFixed(1) : "unknown";

    const wardrobeProfile = `WARDROBE PROFILE (${garments.length} items):
Categories: ${Object.entries(categories).map(([k, v]) => `${k}: ${v}`).join(", ")}
Subcategories: ${Object.entries(subcategories).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}: ${v}`).join(", ")}
Colors: ${Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}: ${v}`).join(", ")}
Materials: ${Object.entries(materials).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}: ${v}`).join(", ")}
Fits: ${Object.entries(fits).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(", ")}
Average formality: ${avgFormality}/5
User locale/market: ${locale}

SAMPLE GARMENT TITLES (to understand style level):
${garments.slice(0, 15).map((g: any) => `- ${g.title} (${g.category}, ${g.color_primary}${g.material ? ', ' + g.material : ''})`).join("\n")}`;

    const prompt = `You are an elite wardrobe gap analyst for a premium styling app. Your job is to identify 3-5 generic garment types that would unlock the most new outfit combinations from this wardrobe.

${wardrobeProfile}

CRITICAL RULES:
1. Do NOT include brand names. Use generic garment descriptions with color, material, and style. Example: "Navy slim-fit chinos" NOT "Dockers Alpha Khaki Navy"
2. Match the user's style level based on their existing garments
3. The search_query must be a generic Google-searchable string (e.g., "navy slim fit chinos men")
4. Consider the user's market/locale (${locale}) for price ranges
5. Focus on versatility — each suggestion should create many new outfit combinations
6. Consider: category gaps, color palette gaps, formality range gaps, seasonal gaps
7. Be specific about color: "Navy" not "Blue", "Ecru" not "White"
8. Include a mix of price ranges when appropriate`;

    const { data: result } = await callBursAI({
      complexity: "standard",
      max_tokens: estimateMaxTokens({ inputItems: garments.length, outputItems: 5, perItemTokens: 120, baseTokens: 300 }),
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Identify the most impactful wardrobe gaps with specific product recommendations." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "identify_gaps",
          description: "Return wardrobe gap analysis with specific product recommendations",
          parameters: {
            type: "object",
            properties: {
              gaps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    item: { type: "string", description: "Specific product name with brand, model, and color (e.g., 'Nike Air Force 1 07 Triple White')" },
                    brand: { type: "string", description: "Brand name (e.g., 'Nike')" },
                    category: { type: "string", description: "Category: tops, bottoms, shoes, accessories, outerwear" },
                    color: { type: "string", description: "Specific color (e.g., 'Navy', 'Ecru', 'Olive')" },
                    reason: { type: "string", description: "Why this fills a gap — reference what's missing and what it pairs with" },
                    new_outfits: { type: "number", description: "Estimated new outfits unlocked" },
                    price_range: { type: "string", description: "Price range like '$50-80' or '€40-70'" },
                    search_query: { type: "string", description: "Exact Google search query to find this product (e.g., 'Nike Air Force 1 07 triple white buy')" },
                  },
                  required: ["item", "brand", "category", "color", "reason", "new_outfits", "price_range", "search_query"],
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
