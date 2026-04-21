import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

const LOCALE_NAMES: Record<string, string> = {
  sv: "Swedish", en: "English", de: "German", fr: "French",
  es: "Spanish", it: "Italian", nl: "Dutch", da: "Danish",
  nb: "Norwegian", fi: "Finnish", pt: "Portuguese",
  ja: "Japanese", ko: "Korean", ar: "Arabic", fa: "Persian",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (checkOverload("suggest_outfit_combinations")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    let locale = "sv";
    try {
      const body = await req.json();
      if (body?.locale && typeof body.locale === "string") locale = body.locale;
    } catch { /* use default */ }
    const lang = LOCALE_NAMES[locale] || "English";

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const user = { id: userData.user.id };

    await enforceRateLimit(serviceClient, user.id, "suggest_outfit_combinations");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    // Parallel DB queries
    const [garmentsRes, profileRes, recentRes] = await Promise.all([
      supabase
        .from("garments")
        .select("id, title, category, subcategory, color_primary, material, formality, last_worn_at, wear_count, image_path")
        .eq("user_id", user.id)
        .eq("in_laundry", false),
      supabase.from("profiles").select("preferences").eq("id", user.id).single(),
      supabase
        .from("outfit_items")
        .select("outfit_id, garment_id, outfits!inner(user_id, generated_at)")
        .eq("outfits.user_id", user.id)
        .order("outfits(generated_at)", { ascending: false })
        .limit(25),
    ]);

    if (garmentsRes.error) throw garmentsRes.error;
    const garments = garmentsRes.data || [];

    if (garments.length < 3) {
      return new Response(JSON.stringify({ suggestions: [], message: "Not enough garments." }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let recentContext = "";
    if (recentRes.data?.length) {
      const outfitMap = new Map<string, string[]>();
      for (const item of recentRes.data) {
        if (!outfitMap.has(item.outfit_id)) outfitMap.set(item.outfit_id, []);
        outfitMap.get(item.outfit_id)!.push(item.garment_id);
      }
      const recentSets = Array.from(outfitMap.values()).slice(0, 5);
      if (recentSets.length > 0) {
        recentContext = `\nRECENT(avoid):\n${recentSets.map((ids, i) => `${i + 1}:${ids.join(",")}`).join("\n")}`;
      }
    }

    const unusedGarments = garments.filter(g => !g.last_worn_at || g.last_worn_at < thirtyDaysAgoStr);
    const preferences = (profileRes.data?.preferences as Record<string, any>) || {};
    const sp = preferences.styleProfile || {};

    const styleContext = [
      sp.gender, sp.ageRange, sp.climate, sp.styleWords?.join(","),
      sp.favoriteColors?.join(","), sp.fit, sp.primaryGoal,
    ].filter(Boolean).join("|");

    const garmentList = garments.map(g =>
      `${g.id}|${g.title}|${g.category}${g.subcategory ? "/" + g.subcategory : ""}|${g.color_primary}|w${g.wear_count || 0}|${g.last_worn_at || "never"}`
    ).join("\n");

    const unusedIds = unusedGarments.map(g => g.id.slice(0, 8)).join(",");

    const { data: result } = await callBursAI({
      complexity: "standard",
      max_tokens: estimateMaxTokens({ outputItems: 3, perItemTokens: 100, baseTokens: 150 }),
      functionName: "suggest_outfit_combinations",
      cacheTtlSeconds: 1800,
      // P14: use the full UUID, not an 8-char slice. With 65k+ users the
      // birthday-collision probability on an 8-hex-char prefix is non-trivial;
      // full UUID guarantees no cross-user hit. userId also populates
      // ai_response_cache.user_id for the GDPR cascade delete.
      cacheNamespace: `suggest_combos_${user.id}`,
      userId: user.id,
      messages: [
        { role: "system", content: `Stylist: rediscover unused garments.
Rules: 2-3 outfits, each top+bottom+shoes(min 3). Prioritize unused IDs:${unusedIds}. Color harmony. Only IDs from list. ${lang}.${styleContext ? `\nStyle:${styleContext}` : ""}${recentContext}
WARDROBE:\n${garmentList}` },
        { role: "user", content: `Create 2-3 outfits using unused garments. ${lang}.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "suggest_outfits",
          description: "Return 2-3 complete outfit suggestions",
          parameters: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    garment_ids: { type: "array", items: { type: "string" } },
                    explanation: { type: "string" },
                    occasion: { type: "string" },
                  },
                  required: ["title", "garment_ids", "explanation", "occasion"],
                  additionalProperties: false,
                },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "suggest_outfits" } },
    }, serviceClient);

    if (!result || typeof result !== "object" || !Array.isArray(result.suggestions)) {
      console.warn("suggest_outfit_combinations: unexpected AI response shape, returning empty");
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const garmentMap = new Map(garments.map(g => [g.id, g]));
    const enrichedSuggestions = (result.suggestions || [])
      .map((s: any) => {
        const validIds = s.garment_ids.filter((id: string) => garmentMap.has(id));
        const garmentDetails = validIds.map((id: string) => garmentMap.get(id)!);
        return { ...s, garment_ids: validIds, garments: garmentDetails };
      })
      .filter((s: any) => s.garment_ids.length >= 3);

    return new Response(JSON.stringify({ suggestions: enrichedSuggestions }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitResponse(error, CORS_HEADERS);
    }
    console.error("Error in suggest_outfit_combinations:", error);
    return bursAIErrorResponse(error, CORS_HEADERS);
  }
});
