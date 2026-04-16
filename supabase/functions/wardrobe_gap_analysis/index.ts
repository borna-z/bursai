import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";
import { VOICE_GAP_ANALYSIS } from "../_shared/burs-voice.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (checkOverload("wardrobe_gap_analysis")) {
    return overloadResponse(CORS_HEADERS);
  }

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
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) throw new Error("Unauthorized");
    const user = { id: userData.user.id };

    await enforceRateLimit(supabase, user.id, "wardrobe_gap_analysis");

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
      return new Response(
        JSON.stringify({
          error: "minimum_garments",
          required: 5,
          current: garments?.length ?? 0,
          gaps: [],
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const categories: Record<string, number> = {};
    const colors: Record<string, number> = {};
    const materials: Record<string, number> = {};
    const subcategories: Record<string, number> = {};
    const fits: Record<string, number> = {};
    let formalitySum = 0;
    let formalityCount = 0;

    interface GarmentRow {
      id: string;
      title: string;
      category: string;
      subcategory: string | null;
      color_primary: string;
      color_secondary: string | null;
      material: string | null;
      pattern: string | null;
      formality: number | null;
      season_tags: string[] | null;
      fit: string | null;
    }

    garments.forEach((g: GarmentRow) => {
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

SAMPLE GARMENT TITLES WITH IDs (use these IDs when recommending pairings):
${garments.slice(0, 25).map((g: GarmentRow) => `- [${g.id}] ${g.title} (${g.category}, ${g.color_primary}${g.material ? ', ' + g.material : ''})`).join("\n")}`;

    const prompt = `${VOICE_GAP_ANALYSIS}

Identify 3-5 generic garment types that would unlock the most new outfit combinations from this wardrobe.

${wardrobeProfile}

CRITICAL RULES:
1. ABSOLUTELY NO BRAND NAMES in any field (item, reason, search_query). Never mention brands like Nike, Adidas, Levi's, Zara, H&M, Uniqlo, Ralph Lauren, Gucci, etc. Use only generic garment descriptions with color, material, fit and style. Example: "Dark wash slim-fit jeans" NOT "Levi's 501 Original Fit Jeans". "White leather low-top sneakers" NOT "Common Projects Achilles Low".
2. Match the user's style level based on their existing garments
3. The search_query must be a generic Google-searchable string (e.g., "navy slim fit chinos men") — NO brands
4. Consider the user's market/locale (${locale}) for price ranges
5. Focus on versatility — each suggestion should create many new outfit combinations
6. Consider: category gaps, color palette gaps, formality range gaps, seasonal gaps
7. Be specific about color: "Navy" not "Blue", "Ecru" not "White"
8. Include a mix of price ranges when appropriate
9. When possible, include "pairing_garment_ids": an array of 2-3 garment IDs FROM THE WARDROBE LIST ABOVE that would pair best with the suggested item. Use the exact UUIDs shown in square brackets.
10. When possible, include "key_insight": one sentence of editorial prose explaining the visual or style impact of adding this piece.`;

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
                    item: { type: "string", description: "Generic garment name with color and style (e.g., 'Navy slim-fit chinos', 'White low-top canvas sneakers')" },
                    category: { type: "string", description: "Category: tops, bottoms, shoes, accessories, outerwear" },
                    color: { type: "string", description: "Specific color (e.g., 'Navy', 'Ecru', 'Olive')" },
                    reason: { type: "string", description: "Why this fills a gap — reference what's missing and what it pairs with" },
                    new_outfits: { type: "number", description: "Estimated new outfits unlocked" },
                    price_range: { type: "string", description: "Price range like '$50-80' or '€40-70'" },
                    search_query: { type: "string", description: "Generic Google search query (e.g., 'navy slim fit chinos men buy')" },
                    pairing_garment_ids: {
                      type: "array",
                      items: { type: "string" },
                      description: "2-3 garment UUIDs from the wardrobe list that pair best with this item",
                    },
                    key_insight: { type: "string", description: "One-sentence editorial insight about the style impact" },
                  },
                  required: ["item", "category", "color", "reason", "new_outfits", "price_range", "search_query"],
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
      cacheNamespace: `wardrobe_gap_${user.id}`,
      functionName: "wardrobe_gap_analysis",
    }, supabase);

    // Post-process: strip any brand names the AI may have included
    const BRAND_NAMES = [
      "Nike", "Adidas", "Puma", "Reebok", "New Balance", "Converse", "Vans",
      "Levi's", "Levis", "Levi", "Wrangler", "Lee", "Diesel",
      "Zara", "H&M", "HM", "Uniqlo", "Mango", "COS", "Arket", "& Other Stories",
      "Ralph Lauren", "Polo", "Tommy Hilfiger", "Calvin Klein", "Hugo Boss", "Boss",
      "Gucci", "Prada", "Balenciaga", "Louis Vuitton", "Burberry", "Versace",
      "Common Projects", "Acne Studios", "A.P.C.", "APC", "Sandro", "AMI",
      "The North Face", "Patagonia", "Arc'teryx", "Columbia", "Canada Goose",
      "Timberland", "Dr. Martens", "Doc Martens", "Birkenstock", "Clarks",
      "Dockers", "Gap", "Old Navy", "Massimo Dutti", "J.Crew", "J Crew",
      "Under Armour", "Champion", "Carhartt", "Dickies", "Fjällräven",
      "Ray-Ban", "Oakley", "Lacoste", "Fred Perry", "Stone Island",
      "Barbour", "Gant", "Tiger of Sweden", "Filippa K", "Nudie Jeans",
    ];
    const brandPattern = new RegExp(
      `\\b(${BRAND_NAMES.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})('s)?\\b\\s*`,
      'gi'
    );
    const stripBrands = (s: string) => s.replace(brandPattern, '').replace(/\s{2,}/g, ' ').trim();

    interface GapItem {
      item: string;
      category: string;
      color: string;
      reason: string;
      new_outfits: number;
      price_range: string;
      search_query: string;
      pairing_garment_ids?: string[];
      key_insight?: string;
    }

    const validGarmentIds = new Set(garments.map((g: GarmentRow) => g.id));
    if (result?.gaps && Array.isArray(result.gaps)) {
      result.gaps = result.gaps.map((gap: GapItem) => ({
        ...gap,
        item: stripBrands(gap.item || ''),
        reason: stripBrands(gap.reason || ''),
        search_query: stripBrands(gap.search_query || ''),
        pairing_garment_ids: Array.isArray(gap.pairing_garment_ids)
          ? gap.pairing_garment_ids.filter((id: unknown) => typeof id === 'string' && validGarmentIds.has(id)).slice(0, 3)
          : [],
        key_insight: typeof gap.key_insight === 'string' ? stripBrands(gap.key_insight) : '',
      }));
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }
    console.error("wardrobe_gap_analysis error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
