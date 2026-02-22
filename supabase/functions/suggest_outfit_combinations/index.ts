import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch garments, profile, and recent outfits in parallel
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
      return new Response(JSON.stringify({ 
        suggestions: [],
        message: "Inte tillräckligt med plagg för att skapa förslag." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build recent outfits context
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

    // Prioritize unused garments but include all for complete outfits
    const unusedGarments = garments.filter(g => !g.last_worn_at || g.last_worn_at < thirtyDaysAgoStr);

    const preferences = (profileRes.data?.preferences as Record<string, any>) || {};
    const sp = preferences.styleProfile || {};

    // Build comprehensive style context from quiz v3
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
${recentContext}
${styleContext}

WARDROBE:
${garmentList}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Create 2-3 complete outfit suggestions using my unused garments." },
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
                      title: { type: "string", description: "Short descriptive title in Swedish" },
                      garment_ids: { type: "array", items: { type: "string" }, description: "Array of garment UUIDs" },
                      explanation: { type: "string", description: "Why this combination works (2 sentences, in Swedish)" },
                      occasion: { type: "string", description: "Suitable occasion in Swedish (e.g. Vardag, Jobb, Dejt)" },
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
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI-tjänsten är överbelastad. Försök igen senare." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut. Kontakta support." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured AI response");
    }

    let parsed: { suggestions: { title: string; garment_ids: string[]; explanation: string; occasion: string }[] };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Failed to parse AI suggestions");
    }

    // Validate and enrich
    const garmentMap = new Map(garments.map(g => [g.id, g]));
    const enrichedSuggestions = (parsed.suggestions || [])
      .map(s => {
        const validIds = s.garment_ids.filter(id => garmentMap.has(id));
        const garmentDetails = validIds.map(id => garmentMap.get(id)!);
        return { ...s, garment_ids: validIds, garments: garmentDetails };
      })
      .filter(s => s.garment_ids.length >= 3); // Must be complete outfit

    return new Response(JSON.stringify({ suggestions: enrichedSuggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in suggest_outfit_combinations:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
