import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";
import { VOICE_GAP_ANALYSIS } from "../_shared/burs-voice.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

function categoryCount(categories: Record<string, number>, names: string[]): number {
  return names.reduce((sum, name) => sum + (categories[name] || 0), 0);
}

function hasColor(colors: Record<string, number>, color: string): boolean {
  const target = color.toLowerCase();
  return Object.keys(colors).some((name) => name.toLowerCase() === target);
}

function normalizeLocale(locale: unknown): string {
  return typeof locale === "string" && locale.trim() ? locale.trim() : "en";
}

function localizedPriceRange(locale: unknown, sekRange: string, usdRange: string): string {
  return normalizeLocale(locale).toLowerCase().startsWith("sv") ? `${sekRange} SEK` : `$${usdRange}`;
}

function pickPairingGarmentIds(garments: any[], preferredCategories: string[]): string[] {
  const preferred = new Set(preferredCategories);
  return garments
    .filter((g) => typeof g?.id === "string")
    .sort((a, b) => {
      const aPreferred = preferred.has(String(a.category || ""));
      const bPreferred = preferred.has(String(b.category || ""));
      if (aPreferred === bPreferred) return 0;
      return aPreferred ? -1 : 1;
    })
    .slice(0, 3)
    .map((g) => g.id);
}

function fallbackGapAnalysis(
  garments: any[],
  categories: Record<string, number>,
  colors: Record<string, number>,
  avgFormality: string,
  locale: string,
) {
  const topCount = categoryCount(categories, ["top", "tops"]);
  const bottomCount = categoryCount(categories, ["bottom", "bottoms"]);
  const shoeCount = categoryCount(categories, ["shoes", "shoe"]);
  const outerwearCount = categoryCount(categories, ["outerwear"]);
  const accessoryCount = categoryCount(categories, ["accessory", "accessories"]);
  const formality = Number.parseFloat(avgFormality);
  const neutralColor = !hasColor(colors, "navy") ? "Navy" : !hasColor(colors, "charcoal") ? "Charcoal" : "Ecru";

  const candidates = [
    {
      score: shoeCount < 2 ? 100 : 25,
      item: "White low-top leather sneakers",
      category: "shoes",
      color: "White",
      reason: "Your wardrobe has limited shoe coverage, so one clean pair can finish more top and bottom combinations.",
      new_outfits: Math.max(6, Math.min(18, topCount + bottomCount)),
      price_range: localizedPriceRange(locale, "900-1600", "80-150"),
      search_query: "white low top leather sneakers",
      pairing_garment_ids: pickPairingGarmentIds(garments, ["top", "bottom", "dress"]),
      key_insight: "A clean shoe anchor makes repeated separates feel intentional instead of improvised.",
    },
    {
      score: bottomCount < 2 || topCount > bottomCount * 2 ? 90 : 35,
      item: `${neutralColor} tailored straight-leg trousers`,
      category: "bottom",
      color: neutralColor,
      reason: "Your tops need another neutral base that can move between casual and sharper outfits.",
      new_outfits: Math.max(5, Math.min(16, topCount + shoeCount)),
      price_range: localizedPriceRange(locale, "800-1500", "70-140"),
      search_query: `${neutralColor.toLowerCase()} tailored straight leg trousers`,
      pairing_garment_ids: pickPairingGarmentIds(garments, ["top", "shoes", "outerwear"]),
      key_insight: "A sharper neutral trouser gives the wardrobe a second base silhouette without changing its mood.",
    },
    {
      score: topCount < 3 || bottomCount > topCount ? 85 : 30,
      item: "Ecru fine-knit crewneck",
      category: "top",
      color: "Ecru",
      reason: "A light knit softens darker pieces and adds an easy layer for repeatable outfits.",
      new_outfits: Math.max(5, Math.min(15, bottomCount + outerwearCount + shoeCount)),
      price_range: localizedPriceRange(locale, "700-1300", "60-120"),
      search_query: "ecru fine knit crewneck sweater",
      pairing_garment_ids: pickPairingGarmentIds(garments, ["bottom", "shoes", "outerwear"]),
      key_insight: "A pale knit creates contrast and makes the wardrobe read more considered.",
    },
    {
      score: outerwearCount < 1 ? 80 : 20,
      item: "Light structured jacket",
      category: "outerwear",
      color: neutralColor,
      reason: "Your wardrobe needs a flexible outer layer that can connect simple outfits in transitional weather.",
      new_outfits: Math.max(4, Math.min(14, topCount + bottomCount)),
      price_range: localizedPriceRange(locale, "1200-2400", "110-220"),
      search_query: `${neutralColor.toLowerCase()} lightweight structured jacket`,
      pairing_garment_ids: pickPairingGarmentIds(garments, ["top", "bottom", "shoes"]),
      key_insight: "The right jacket turns basic combinations into complete looks.",
    },
    {
      score: accessoryCount < 2 ? 70 : 15,
      item: "Black leather belt",
      category: "accessory",
      color: "Black",
      reason: "A simple finishing piece helps connect shoes, trousers, and outerwear more consistently.",
      new_outfits: Math.max(4, Math.min(12, bottomCount + shoeCount)),
      price_range: localizedPriceRange(locale, "400-900", "35-80"),
      search_query: "black leather belt minimal",
      pairing_garment_ids: pickPairingGarmentIds(garments, ["bottom", "shoes", "top"]),
      key_insight: "Small finishing pieces make the wardrobe look styled rather than just assembled.",
    },
    {
      score: Number.isFinite(formality) && formality < 2.7 ? 65 : 10,
      item: "Charcoal unstructured blazer",
      category: "outerwear",
      color: "Charcoal",
      reason: "Your wardrobe leans casual, and this adds polish without feeling formal or stiff.",
      new_outfits: Math.max(4, Math.min(12, topCount + bottomCount)),
      price_range: localizedPriceRange(locale, "1500-3000", "140-280"),
      search_query: "charcoal unstructured blazer",
      pairing_garment_ids: pickPairingGarmentIds(garments, ["top", "bottom", "shoes"]),
      key_insight: "Soft tailoring raises the ceiling of the wardrobe without replacing its casual base.",
    },
  ];

  return {
    gaps: candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score: _score, ...gap }) => gap),
  };
}

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
      locale = normalizeLocale(body?.locale);
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

SAMPLE GARMENT TITLES WITH IDs (use these IDs when recommending pairings):
${garments.slice(0, 25).map((g: any) => `- [${g.id}] ${g.title} (${g.category}, ${g.color_primary}${g.material ? ', ' + g.material : ''})`).join("\n")}`;

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

    let result: any;
    try {
      const aiResponse = await callBursAI({
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
      cacheNamespace: "wardrobe_gap",
      functionName: "wardrobe_gap_analysis",
      }, supabase);
      result = aiResponse.data;
    } catch (aiError) {
      console.warn("wardrobe_gap_analysis AI failed, returning fallback gaps:", aiError);
      result = fallbackGapAnalysis(garments, categories, colors, avgFormality, locale);
    }

    if (!result || typeof result !== "object" || !Array.isArray(result.gaps)) {
      console.warn("wardrobe_gap_analysis returned malformed AI response, returning fallback gaps");
      result = fallbackGapAnalysis(garments, categories, colors, avgFormality, locale);
    }

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

    const validGarmentIds = new Set(garments.map((g: any) => g.id));
    if (result?.gaps && Array.isArray(result.gaps)) {
      result.gaps = result.gaps.map((gap: any) => ({
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
