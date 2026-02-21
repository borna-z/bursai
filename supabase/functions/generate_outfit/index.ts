import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GarmentRow {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  color_primary: string;
  color_secondary: string | null;
  pattern: string | null;
  material: string | null;
  fit: string | null;
  formality: number | null;
  season_tags: string[] | null;
  wear_count: number | null;
  last_worn_at: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { occasion, style, weather } = await req.json();

    // Fetch garments + profile in parallel
    const [garmentsRes, profileRes] = await Promise.all([
      supabase
        .from("garments")
        .select("id, title, category, subcategory, color_primary, color_secondary, pattern, material, fit, formality, season_tags, wear_count, last_worn_at")
        .eq("user_id", userId)
        .eq("in_laundry", false),
      supabase.from("profiles").select("preferences, height_cm, weight_kg").eq("id", userId).single(),
    ]);

    if (garmentsRes.error) throw garmentsRes.error;
    const garments = garmentsRes.data as GarmentRow[];

    if (!garments || garments.length < 2) {
      return new Response(
        JSON.stringify({ error: "Inte tillräckligt med plagg i garderoben" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profile = profileRes.data;
    const preferences = profile?.preferences as Record<string, any> | null;

    // Build garment list for prompt
    const garmentList = garments
      .map((g) => {
        const parts = [`ID:${g.id}`, g.title, g.category];
        if (g.subcategory) parts.push(g.subcategory);
        parts.push(`färg:${g.color_primary}`);
        if (g.color_secondary) parts.push(`sekundär:${g.color_secondary}`);
        if (g.pattern) parts.push(`mönster:${g.pattern}`);
        if (g.material) parts.push(`material:${g.material}`);
        if (g.fit) parts.push(`passform:${g.fit}`);
        if (g.formality) parts.push(`formalitet:${g.formality}/5`);
        if (g.season_tags?.length) parts.push(`säsong:${g.season_tags.join(",")}`);
        if (g.wear_count !== null) parts.push(`använd:${g.wear_count}ggr`);
        if (g.last_worn_at) parts.push(`senast:${g.last_worn_at}`);
        return parts.join(" | ");
      })
      .join("\n");

    // Build comprehensive style context from styleProfile
    let styleContext = "";
    if (preferences) {
      const sp = preferences.styleProfile as Record<string, any> | undefined;
      if (sp) {
        const lines: string[] = [];
        if (sp.favoriteColors?.length) lines.push(`Favoritfärger: ${sp.favoriteColors.join(", ")}`);
        if (sp.dislikedColors?.length) lines.push(`Undviker färger: ${sp.dislikedColors.join(", ")}`);
        if (sp.colorTone) lines.push(`Färgton: ${sp.colorTone === 'neutral' ? 'neutrala/jordtoner' : 'starka/mättade färger'}`);
        if (sp.patternFeeling) lines.push(`Mönster: ${sp.patternFeeling}`);
        if (sp.likedPatterns?.length) lines.push(`Gillar: ${sp.likedPatterns.join(", ")}`);
        if (sp.fit) lines.push(`Passform: ${sp.fit}`);
        if (sp.topLength) lines.push(`Överdel: ${sp.topLength}`);
        if (sp.bottomLength) lines.push(`Underdel: ${sp.bottomLength}`);
        if (sp.layering) lines.push(`Lagerläggning: ${sp.layering === 'love' ? 'älskar lager' : 'minimalt'}`);
        if (sp.styleWords?.length) lines.push(`Stilord: ${sp.styleWords.join(", ")}`);
        if (sp.styleIcons) lines.push(`Inspireras av: ${sp.styleIcons}`);
        if (sp.adventurousness) lines.push(`Modemodig: ${sp.adventurousness}`);
        if (sp.trendFollowing) lines.push(`Följer trender: ${sp.trendFollowing}`);
        if (sp.genderNeutral) lines.push("Föredrar könsneutrala förslag");
        if (sp.weekdayContext) lines.push(`Vardag: ${sp.weekdayContext}`);
        if (sp.weekendContext) lines.push(`Helg: ${sp.weekendContext}`);
        if (sp.workFormality) lines.push(`Arbetsformality: ${sp.workFormality}`);
        if (sp.comfortVsStyle !== undefined) lines.push(`Komfort vs stil: ${sp.comfortVsStyle}% mot stil`);
        if (sp.frustrations?.length) lines.push(`Frustration: ${sp.frustrations.join(", ")}`);
        if (sp.budgetMindset) lines.push(`Budget: ${sp.budgetMindset}`);
        if (sp.sustainability) lines.push(`Hållbarhet: ${sp.sustainability}`);
        if (sp.ageRange) lines.push(`Ålder: ${sp.ageRange}`);
        if (sp.climate) lines.push(`Klimat: ${sp.climate}`);
        if (sp.styleGoals) lines.push(`Mål: ${sp.styleGoals}`);
        styleContext = lines.join(". ");
      } else {
        // Fallback to legacy fields
        if (preferences.favoriteColors?.length) styleContext += `Favoritfärger: ${(preferences.favoriteColors as string[]).join(", ")}. `;
        if (preferences.dislikedColors?.length) styleContext += `Undviker: ${(preferences.dislikedColors as string[]).join(", ")}. `;
        if (preferences.fitPreference) styleContext += `Passform: ${preferences.fitPreference}. `;
        if (preferences.styleVibe) styleContext += `Stil: ${preferences.styleVibe}. `;
      }
    }

    const currentMonth = new Date().getMonth();
    const seasonHint = currentMonth >= 2 && currentMonth <= 4 ? "vår" :
                       currentMonth >= 5 && currentMonth <= 7 ? "sommar" :
                       currentMonth >= 8 && currentMonth <= 10 ? "höst" : "vinter";

    const systemPrompt = `Du är en världsledande personlig stylist med djup kunskap om mode, trender och färgteori. Skapa den perfekta outfiten.

EXPERTIS:
- Du förstår färghjul, komplementfärger, analogt matchande och ton-i-ton
- Du tänker på proportioner, silhuetter och hur plagg samverkar
- Du känner till aktuella trender för ${seasonHint}en ${new Date().getFullYear()} inom skandinaviskt mode
- Du prioriterar variation – undvik att alltid välja samma plagg

REGLER:
- Välj plagg ENBART från listan nedan (referera med exakt ID)
- Obligatoriska slots: top, bottom, shoes
- Valfria slots: outerwear (om kallt/regn/under 15°C), accessory
- Respektera användarens stilprofil nedan – det är deras personliga smak
- Föredra plagg som inte använts nyligen (variation)
- Ge en personlig förklaring (2-3 meningar) på svenska: varför denna kombination funkar stilmässigt

TILLFÄLLE: ${occasion}
${style ? `ÖNSKAD STIL: ${style}` : ""}
${weather?.temperature !== undefined ? `TEMPERATUR: ${weather.temperature}°C` : ""}
${weather?.precipitation ? `NEDERBÖRD: ${weather.precipitation}` : ""}
${weather?.wind ? `VIND: ${weather.wind}` : ""}
SÄSONG: ${seasonHint}
${styleContext ? `\nANVÄNDARENS STILPROFIL:\n${styleContext}` : ""}
${profile?.height_cm ? `LÄNGD: ${profile.height_cm}cm` : ""}
${profile?.weight_kg ? `VIKT: ${profile.weight_kg}kg` : ""}

GARDEROB:
${garmentList}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
          { role: "user", content: "Skapa en outfit åt mig." },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "select_outfit",
              description: "Select garments for an outfit from the user's wardrobe",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        slot: {
                          type: "string",
                          enum: ["top", "bottom", "shoes", "outerwear", "accessory"],
                        },
                        garment_id: { type: "string", description: "UUID of the garment" },
                      },
                      required: ["slot", "garment_id"],
                      additionalProperties: false,
                    },
                  },
                  explanation: {
                    type: "string",
                    description: "Short explanation in Swedish of why this outfit works",
                  },
                },
                required: ["items", "explanation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "select_outfit" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "För många förfrågningar, försök igen om en stund." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut. Kontakta support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      throw new Error("AI service error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    let parsed: { items: { slot: string; garment_id: string }[]; explanation: string };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Failed to parse AI output");
    }

    // Validate all IDs exist in user's wardrobe
    const garmentIds = new Set(garments.map((g) => g.id));
    const validItems = parsed.items.filter((item) => garmentIds.has(item.garment_id));

    if (validItems.length < 2) {
      throw new Error("AI returned invalid garment selections");
    }

    return new Response(
      JSON.stringify({
        items: validItems,
        explanation: parsed.explanation || "Snygg kombination!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate_outfit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
