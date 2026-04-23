import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";
import { VOICE_GAP_ANALYSIS } from "../_shared/burs-voice.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";
import {
  computeWardrobeCoverage,
  stratifiedSample,
  intentToCacheKey,
  scanEventHints,
  type WardrobeGapIntent,
  type WardrobeCoverage,
} from "../_shared/retrieval.ts";

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

// Wave 4-B (P21): coverage-aware fallback. Replaces the old Markov-like
// hardcoded candidate ranking with decisions derived from the computed
// coverage object. Same output shape so the response envelope is stable.
function fallbackGapAnalysis(
  garments: any[],
  coverage: WardrobeCoverage,
  locale: string,
  intent?: WardrobeGapIntent,
) {
  const pair = (preferred: string[]) => pickPairingGarmentIds(garments, preferred);

  const total = coverage.total;
  const neutralRatio = total > 0 ? coverage.by_color_family.neutral / total : 0;
  const coolRatio = total > 0 ? coverage.by_color_family.cool / total : 0;
  // If wardrobe is already neutral-heavy, a cool anchor adds depth without
  // shouting. Otherwise a neutral anchor keeps the base versatile.
  const preferAccent = neutralRatio > 0.6;
  const accentColor = preferAccent ? "Olive" : coolRatio < 0.15 ? "Navy" : "Ecru";

  const shoeCount = (coverage.by_category.shoes || 0) + (coverage.by_category.shoe || 0);
  const topCount = (coverage.by_category.top || 0) + (coverage.by_category.tops || 0);
  const bottomCount = (coverage.by_category.bottom || 0) + (coverage.by_category.bottoms || 0);
  const outerwearCount = coverage.by_category.outerwear || 0;
  const accessoryCount = (coverage.by_category.accessory || 0) + (coverage.by_category.accessories || 0);

  const candidates: Array<{
    score: number;
    item: string;
    category: string;
    color: string;
    reason: string;
    new_outfits: number;
    price_range: string;
    search_query: string;
    pairing_garment_ids: string[];
    key_insight: string;
  }> = [];

  if (shoeCount < 2) {
    candidates.push({
      score: 100,
      item: "White low-top leather sneakers",
      category: "shoes",
      color: "White",
      reason: "Limited shoe coverage — one clean pair finishes many more combinations.",
      new_outfits: Math.max(6, Math.min(18, topCount + bottomCount)),
      price_range: localizedPriceRange(locale, "900-1600", "80-150"),
      search_query: "white low top leather sneakers",
      pairing_garment_ids: pair(["top", "bottom", "dress"]),
      key_insight: "A clean shoe anchor makes repeated separates feel intentional instead of improvised.",
    });
  }

  if (bottomCount < 2 || topCount > bottomCount * 2) {
    candidates.push({
      score: 90,
      item: `${accentColor} tailored straight-leg trousers`,
      category: "bottom",
      color: accentColor,
      reason: preferAccent
        ? "Wardrobe leans neutral — a grounded color trouser adds depth without shouting."
        : "Tops need another base that moves between casual and sharper outfits.",
      new_outfits: Math.max(5, Math.min(16, topCount + shoeCount)),
      price_range: localizedPriceRange(locale, "800-1500", "70-140"),
      search_query: `${accentColor.toLowerCase()} tailored straight leg trousers`,
      pairing_garment_ids: pair(["top", "shoes", "outerwear"]),
      key_insight: "A second base silhouette expands the wardrobe without changing its mood.",
    });
  }

  if (topCount < 3 || bottomCount > topCount) {
    candidates.push({
      score: 85,
      item: preferAccent ? "Rust fine-knit crewneck" : "Ecru fine-knit crewneck",
      category: "top",
      color: preferAccent ? "Rust" : "Ecru",
      reason: preferAccent
        ? "A warm-toned knit breaks the neutral dominance without clashing."
        : "A light knit softens darker pieces and adds an easy layer.",
      new_outfits: Math.max(5, Math.min(15, bottomCount + outerwearCount + shoeCount)),
      price_range: localizedPriceRange(locale, "700-1300", "60-120"),
      search_query: preferAccent ? "rust fine knit crewneck sweater" : "ecru fine knit crewneck sweater",
      pairing_garment_ids: pair(["bottom", "shoes", "outerwear"]),
      key_insight: "Texture at the top softens harder pieces below.",
    });
  }

  if (outerwearCount < 1) {
    candidates.push({
      score: 80,
      item: "Light structured jacket",
      category: "outerwear",
      color: accentColor,
      reason: "A flexible outer layer connects simple outfits in transitional weather.",
      new_outfits: Math.max(4, Math.min(14, topCount + bottomCount)),
      price_range: localizedPriceRange(locale, "1200-2400", "110-220"),
      search_query: `${accentColor.toLowerCase()} lightweight structured jacket`,
      pairing_garment_ids: pair(["top", "bottom", "shoes"]),
      key_insight: "The right jacket turns basic combinations into complete looks.",
    });
  }

  if (accessoryCount < 2) {
    candidates.push({
      score: 70,
      item: "Black leather belt",
      category: "accessory",
      color: "Black",
      reason: "A simple finishing piece connects shoes, trousers, and outerwear more consistently.",
      new_outfits: Math.max(4, Math.min(12, bottomCount + shoeCount)),
      price_range: localizedPriceRange(locale, "400-900", "35-80"),
      search_query: "black leather belt minimal",
      pairing_garment_ids: pair(["bottom", "shoes", "top"]),
      key_insight: "Small finishing pieces make the wardrobe look styled rather than just assembled.",
    });
  }

  if (coverage.by_formality.high === 0 && total >= 10) {
    candidates.push({
      score: 65,
      item: "Charcoal unstructured blazer",
      category: "outerwear",
      color: "Charcoal",
      reason: "No formal pieces — this adds polish without feeling stiff.",
      new_outfits: Math.max(4, Math.min(12, topCount + bottomCount)),
      price_range: localizedPriceRange(locale, "1500-3000", "140-280"),
      search_query: "charcoal unstructured blazer",
      pairing_garment_ids: pair(["top", "bottom", "shoes"]),
      key_insight: "Soft tailoring raises the ceiling without replacing the casual base.",
    });
  }

  // Unconditional low-priority baselines (Codex P1 round 3 on PR #664):
  // the conditional pushes above only fire when coverage shows a
  // specific gap. A well-rounded wardrobe can pass every guard and
  // leave `candidates` empty, in which case the endpoint used to
  // return `gaps: []` when Gemini is unreachable — no actionable
  // recommendation. Add versatile baselines with score 20-30 so
  // conditional items still win the top-5 slice on skewed wardrobes,
  // but the response is never empty.
  candidates.push(
    {
      score: 30,
      item: "Dark wash straight-leg jeans",
      category: "bottom",
      color: "Indigo",
      reason: "Versatile dark denim anchors both casual and elevated outfits.",
      new_outfits: Math.max(4, Math.min(12, topCount + shoeCount)),
      price_range: localizedPriceRange(locale, "1000-2000", "90-180"),
      search_query: "dark wash straight leg jeans",
      pairing_garment_ids: pair(["top", "shoes"]),
      key_insight: "A well-fitting dark jean is the backbone of a versatile wardrobe.",
    },
    {
      score: 25,
      item: "White cotton t-shirt",
      category: "top",
      color: "White",
      reason: "A clean white tee layers and anchors nearly every look.",
      new_outfits: Math.max(3, Math.min(10, bottomCount + shoeCount)),
      price_range: localizedPriceRange(locale, "300-800", "25-70"),
      search_query: "white cotton t-shirt premium",
      pairing_garment_ids: pair(["bottom", "shoes", "outerwear"]),
      key_insight: "A high-quality white tee reads elevated, not basic.",
    },
    {
      score: 20,
      item: "Simple leather watch",
      category: "accessory",
      color: "Brown",
      reason: "A classic watch finishes both casual and tailored outfits.",
      new_outfits: Math.max(3, Math.min(10, topCount + outerwearCount)),
      price_range: localizedPriceRange(locale, "1500-3500", "130-300"),
      search_query: "minimal leather watch",
      pairing_garment_ids: pair(["top", "outerwear"]),
      key_insight: "A finishing piece that quietly elevates everything else.",
    },
  );

  const response: { gaps: any[]; shopping_recommendations?: any[] } = {
    gaps: candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score: _score, ...gap }) => gap),
  };

  // Shopping-mode fallback: derive recommendations from the same
  // candidate pool, re-ranked by how well they address the intent.
  // Basic heuristic — AI path is always stronger but this keeps a
  // shopping_recommendations shape when Gemini is unreachable.
  if (intent) {
    const matchesIntent = (c: typeof candidates[number]): number => {
      let score = 0;
      if (intent.formality === "high" && ["outerwear", "top"].includes(c.category) && c.item.toLowerCase().includes("blazer")) score += 2;
      if (intent.formality === "low" && c.category === "shoes") score += 1;
      if (intent.season === "winter" && c.category === "outerwear") score += 2;
      if (intent.season === "summer" && c.category === "top") score += 1;
      if (intent.occasion && c.reason.toLowerCase().includes((intent.occasion || "").toLowerCase())) score += 1;
      return score;
    };
    response.shopping_recommendations = [...candidates]
      .map((c) => ({ c, intentScore: matchesIntent(c) }))
      .sort((a, b) => (b.intentScore - a.intentScore) || (b.c.score - a.c.score))
      .slice(0, 3)
      .map(({ c }, idx) => ({
        priority: idx + 1,
        category: c.category,
        item: c.item,
        reasoning: c.reason,
        fills_gap: true,
        price_range: c.price_range,
        search_query: c.search_query,
      }));
  }

  return response;
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

    // Parse optional locale + optional intent from body
    let locale = "en";
    let intent: WardrobeGapIntent | undefined;
    try {
      const body = await req.json();
      locale = normalizeLocale(body?.locale);
      if (body?.intent && typeof body.intent === "object") {
        intent = body.intent as WardrobeGapIntent;
      }
    } catch { /* empty body is fine */ }

    // Event description hints: if upcoming_events contain keywords like
    // "black tie" or "summer wedding", lift those into the structured
    // intent BEFORE the AI call. Cheap keyword scan, no extra AI.
    if (intent?.upcoming_events) {
      const hints = scanEventHints(intent.upcoming_events);
      intent = {
        ...intent,
        formality: intent.formality ?? hints.formality ?? null,
        season: intent.season ?? hints.season ?? null,
      };
    }

    const { data: garments } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, color_secondary, material, pattern, formality, season_tags, fit, wear_count, last_worn_at, enrichment_status, ai_raw, created_at")
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

    // Wave 4-B (P21): structured coverage math. The AI receives JSON
    // numbers it can reason against — not hand-formatted English text.
    const coverage = computeWardrobeCoverage(garments);
    const sample = stratifiedSample(garments, 25);
    const sampleSerialized = sample.map((g: any) => ({
      id: g.id,
      title: g.title || "",
      category: g.category || "",
      subcategory: g.subcategory || "",
      color: g.color_primary || "",
      material: g.material || "",
      formality: g.formality ?? null,
    }));

    const intentBlock = intent ? `

SHOPPING INTENT (user-provided — rank shopping_recommendations to satisfy this):
${JSON.stringify({
  occasion: intent.occasion || null,
  formality: intent.formality || null,
  season: intent.season || null,
  budget: intent.budget || null,
  upcoming_events: intent.upcoming_events || null,
})}` : "";

    const wardrobeProfile = `WARDROBE COVERAGE (${garments.length} items; structured JSON):
${JSON.stringify(coverage)}

REPRESENTATIVE SAMPLE (${sample.length} items stratified across categories, wear, and recency — use these IDs for pairing_garment_ids):
${JSON.stringify(sampleSerialized)}

User locale/market: ${locale}${intentBlock}`;

    const modeInstructions = intent
      ? `You are in SHOPPING ASSISTANT mode. Return BOTH keys:
- "gaps" (3-5 items): generic garment types that fill structural wardrobe gaps based on the coverage JSON above.
- "shopping_recommendations" (3-5 items): items optimized for the user's SHOPPING INTENT. Set fills_gap=true when the recommendation also closes a wardrobe gap from the coverage.gaps_derived list.`
      : `Identify 3-5 generic garment types that would unlock the most new outfit combinations from this wardrobe.`;

    const prompt = `${VOICE_GAP_ANALYSIS}

${modeInstructions}

${wardrobeProfile}

CRITICAL RULES:
1. ABSOLUTELY NO BRAND NAMES in any field (item, reason, reasoning, search_query). Never mention brands like Nike, Adidas, Levi's, Zara, H&M, Uniqlo, Ralph Lauren, Gucci, etc. Use only generic garment descriptions with color, material, fit and style. Example: "Dark wash slim-fit jeans" NOT "Levi's 501 Original Fit Jeans". "White leather low-top sneakers" NOT "Common Projects Achilles Low".
2. Match the user's style level based on their existing garments
3. The search_query must be a generic Google-searchable string (e.g., "navy slim fit chinos men") — NO brands
4. Consider the user's market/locale (${locale}) for price ranges
5. Focus on versatility — each suggestion should create many new outfit combinations
6. Consider: category gaps, color palette gaps, formality range gaps, seasonal gaps (use the coverage.gaps_derived array as a starting signal)
7. Be specific about color: "Navy" not "Blue", "Ecru" not "White"
8. Include a mix of price ranges when appropriate
9. When possible, include "pairing_garment_ids": an array of 2-3 garment IDs FROM THE REPRESENTATIVE SAMPLE above that would pair best with the suggested item. Use the exact UUIDs shown.
10. When possible, include "key_insight": one sentence of editorial prose explaining the visual or style impact of adding this piece.
11. If wardrobe is already >60% neutral (check coverage.by_color_family.neutral / coverage.total), DO NOT recommend more neutrals — lean into a color or earth-tone anchor.
${intent ? `12. For shopping_recommendations, weight the SHOPPING INTENT above over generic versatility. Return empty array if you cannot satisfy it honestly.` : ""}`;

    let result: any;
    try {
      const aiResponse = await callBursAI({
      complexity: "standard",
      max_tokens: estimateMaxTokens({ inputItems: sample.length, outputItems: intent ? 10 : 5, perItemTokens: 120, baseTokens: 400 }),
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: intent
          ? "Identify the most impactful wardrobe gaps AND shopping recommendations that satisfy my intent."
          : "Identify the most impactful wardrobe gaps with specific product recommendations." },
      ],
      tools: [{
        type: "function",
        function: {
          name: "identify_gaps",
          description: "Return wardrobe gap analysis and (when shopping intent provided) intent-driven shopping recommendations",
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
                      description: "2-3 garment UUIDs from the representative sample that pair best with this item",
                    },
                    key_insight: { type: "string", description: "One-sentence editorial insight about the style impact" },
                  },
                  required: ["item", "category", "color", "reason", "new_outfits", "price_range", "search_query"],
                  additionalProperties: false,
                },
              },
              shopping_recommendations: {
                type: "array",
                description: "Only include when user provided shopping intent; up to 5 items ranked by priority (priority 1 = most urgent)",
                items: {
                  type: "object",
                  properties: {
                    priority: { type: "number", description: "1 = top priority; higher numbers less urgent" },
                    category: { type: "string" },
                    item: { type: "string", description: "Generic garment name (same brand-exclusion rule as gaps.item)" },
                    reasoning: { type: "string", description: "Why this satisfies the shopping intent" },
                    fills_gap: { type: "boolean", description: "Also closes a wardrobe gap from coverage.gaps_derived?" },
                    price_range: { type: "string" },
                    search_query: { type: "string" },
                  },
                  required: ["priority", "category", "item", "reasoning", "fills_gap"],
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
      // P13 + Wave 4-B (P21): user-scope prevents cross-user cache hits,
      // intent hash partitions gap-only vs shopping-mode responses.
      cacheNamespace: `wardrobe_gap_${user.id}_${intentToCacheKey(intent)}`,
      userId: user.id,
      functionName: "wardrobe_gap_analysis",
      }, supabase);
      result = aiResponse.data;
    } catch (aiError) {
      console.warn("wardrobe_gap_analysis AI failed, returning fallback gaps:", aiError);
      result = fallbackGapAnalysis(garments, coverage, locale, intent);
    }

    if (!result || typeof result !== "object" || !Array.isArray(result.gaps)) {
      console.warn("wardrobe_gap_analysis returned malformed AI response, returning fallback gaps");
      result = fallbackGapAnalysis(garments, coverage, locale, intent);
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
    if (result?.shopping_recommendations && Array.isArray(result.shopping_recommendations)) {
      result.shopping_recommendations = result.shopping_recommendations.map((rec: any) => ({
        ...rec,
        item: stripBrands(rec.item || ''),
        reasoning: stripBrands(rec.reasoning || ''),
        search_query: typeof rec.search_query === 'string' ? stripBrands(rec.search_query) : '',
      }));
    }

    // Telemetry: surface retrieval shape in existing ai_usage metadata.
    console.log(JSON.stringify({
      fn: "wardrobe_gap_analysis",
      stage: "retrieval.prefilter",
      user_id: user.id,
      total_garments_available: garments.length,
      sample_size: sample.length,
      gaps_derived_count: coverage.gaps_derived.length,
      intent_provided: Boolean(intent),
      shopping_mode: Boolean(intent),
    }));

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
