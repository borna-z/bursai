import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOCALE_NAMES: Record<string, string> = {
  sv: "Swedish", en: "English", de: "German", fr: "French",
  es: "Spanish", it: "Italian", nl: "Dutch", da: "Danish",
  nb: "Norwegian", fi: "Finnish", pt: "Portuguese",
  ja: "Japanese", ko: "Korean", ar: "Arabic", fa: "Persian",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let locale = "sv";
    try {
      const body = await req.json();
      if (body?.locale && typeof body.locale === "string") {
        locale = body.locale;
      }
    } catch { /* use default */ }
    const lang = LOCALE_NAMES[locale] || "English";

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: data.claims.sub as string };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const [garmentsRes, profileRes, recentRes] = await Promise.all([
      supabase
        .from("garments")
        .select("id, title, category, subcategory, color_primary, color_secondary, material, pattern, formality, season_tags, last_worn_at, wear_count, image_path")
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
      return new Response(JSON.stringify({ suggestions: [], message: "Not enough garments to create suggestions." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        recentContext = `\nRECENT OUTFITS (avoid repeating):\n${recentSets.map((ids, i) => `${i + 1}: ${ids.join(", ")}`).join("\n")}`;
      }
    }

    const unusedGarments = garments.filter(g => !g.last_worn_at || g.last_worn_at < thirtyDaysAgoStr);
    const preferences = (profileRes.data?.preferences as Record<string, any>) || {};
    const sp = preferences.styleProfile || {};

    const styleContextParts: string[] = [];
    if (sp.gender) styleContextParts.push(`Gender: ${sp.gender}`);
    if (sp.ageRange) styleContextParts.push(`Age: ${sp.ageRange}`);
    if (sp.climate) styleContextParts.push(`Climate: ${sp.climate}`);
    if (sp.styleWords?.length) styleContextParts.push(`Style words: ${sp.styleWords.join(", ")}`);
    if (sp.favoriteColors?.length) styleContextParts.push(`Favorite colors: ${sp.favoriteColors.join(", ")}`);
    if (sp.dislikedColors?.length) styleContextParts.push(`Avoids colors: ${sp.dislikedColors.join(", ")}`);
    if (sp.paletteVibe) styleContextParts.push(`Palette vibe: ${sp.paletteVibe}`);
    if (sp.patternFeeling) styleContextParts.push(`Patterns: ${sp.patternFeeling}`);
    if (sp.fit) styleContextParts.push(`Fit: ${sp.fit}`);
    if (sp.layering) styleContextParts.push(`Layering: ${sp.layering}`);
    if (sp.topFit) styleContextParts.push(`Top fit: ${sp.topFit}`);
    if (sp.bottomLength) styleContextParts.push(`Bottom length: ${sp.bottomLength}`);
    if (sp.adventurousness) styleContextParts.push(`Adventurousness: ${sp.adventurousness}`);
    if (sp.trendFollowing) styleContextParts.push(`Trends: ${sp.trendFollowing}`);
    if (sp.genderNeutral) styleContextParts.push("Open to gender-neutral suggestions");
    if (sp.fabricFeel) styleContextParts.push(`Favorite fabrics: ${sp.fabricFeel}`);
    if (sp.primaryGoal) styleContextParts.push(`Goal: ${sp.primaryGoal}`);
    if (sp.weekdayLife) styleContextParts.push(`Weekday: ${sp.weekdayLife}`);
    if (sp.workFormality) styleContextParts.push(`Work formality: ${sp.workFormality}`);
    if (sp.weekendLife) styleContextParts.push(`Weekend: ${sp.weekendLife}`);
    if (sp.freeNote) styleContextParts.push(`Personal note: ${sp.freeNote}`);
    const styleContext = styleContextParts.length > 0 ? `\nUSER STYLE PROFILE:\n${styleContextParts.join(". ")}` : "";

    const garmentList = garments.map(g =>
      `ID:${g.id} | ${g.title} | cat:${g.category}${g.subcategory ? "/" + g.subcategory : ""} | color:${g.color_primary} | worn:${g.wear_count || 0}x | last:${g.last_worn_at || "never"}`
    ).join("\n");

    const unusedIds = new Set(unusedGarments.map(g => g.id));

    const systemPrompt = `You are a world-class personal stylist helping a user rediscover unused garments in their wardrobe.

RULES:
1. Create 2-3 COMPLETE outfit suggestions
2. Each outfit MUST include: top + bottom + shoes (minimum 3 items)
3. Exception: a dress/jumpsuit replaces top+bottom, but shoes are still mandatory
4. PRIORITIZE garments marked as unused (not worn in 30+ days) — these IDs: ${Array.from(unusedIds).join(", ")}
5. But you MAY include recently worn garments to complete an outfit (e.g., shoes)
6. Consider color harmony, formality matching, and seasonal appropriateness
7. Each suggestion needs a different style/occasion
8. ONLY use garment IDs from the list
9. ALL text output (titles, explanations, occasions) MUST be in ${lang}
${recentContext}
${styleContext}

WARDROBE:
${garmentList}`;

    const { data: result } = await callBursAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create 2-3 complete outfit suggestions using my unused garments. Respond in ${lang}.` },
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
                    title: { type: "string", description: `Short descriptive title in ${lang}` },
                    garment_ids: { type: "array", items: { type: "string" }, description: "Array of garment UUIDs" },
                    explanation: { type: "string", description: `Why this combination works (2 sentences, in ${lang})` },
                    occasion: { type: "string", description: `Suitable occasion in ${lang}` },
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
    });

    // Validate and enrich
    const garmentMap = new Map(garments.map(g => [g.id, g]));
    const enrichedSuggestions = (result.suggestions || [])
      .map((s: any) => {
        const validIds = s.garment_ids.filter((id: string) => garmentMap.has(id));
        const garmentDetails = validIds.map((id: string) => garmentMap.get(id)!);
        return { ...s, garment_ids: validIds, garments: garmentDetails };
      })
      .filter((s: any) => s.garment_ids.length >= 3);

    return new Response(JSON.stringify({ suggestions: enrichedSuggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in suggest_outfit_combinations:", error);
    return bursAIErrorResponse(error, corsHeaders);
  }
});
