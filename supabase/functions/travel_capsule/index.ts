import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODELS = [
  "google/gemini-2.5-flash",
  "openai/gpt-5-mini",
  "google/gemini-2.5-flash-lite",
];

interface GarmentRow {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  color_primary: string;
  color_secondary: string | null;
  material: string | null;
  pattern: string | null;
  fit: string | null;
  formality: number | null;
  season_tags: string[] | null;
  in_laundry: boolean | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { duration_days, destination, weather, occasions, locale = "sv" } = await req.json();

    if (!duration_days || duration_days < 1 || duration_days > 30) {
      throw new Error("duration_days must be 1-30");
    }

    // Fetch user's wardrobe (exclude laundry)
    const { data: garments, error: gError } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, color_secondary, material, pattern, fit, formality, season_tags, in_laundry, image_path")
      .eq("user_id", user.id)
      .or("in_laundry.is.null,in_laundry.eq.false");

    if (gError) throw gError;
    if (!garments || garments.length < 5) {
      throw new Error("Need at least 5 garments to build a capsule");
    }

    // Fetch profile for style prefs
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single();

    const prefs = profile?.preferences as Record<string, any> | null;

    const LOCALE_NAMES: Record<string, string> = {
      sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "finska",
      de: "Deutsch", fr: "français", es: "español",
    };
    const localeName = LOCALE_NAMES[locale] || "English";
    const isSv = locale === "sv";

    // Categorize garments for the prompt
    const byCategory: Record<string, GarmentRow[]> = {};
    for (const g of garments) {
      const cat = g.category;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(g);
    }

    const wardrobeDescription = Object.entries(byCategory)
      .map(([cat, items]) => {
        const list = items.map(g => {
          const parts = [g.id.slice(0, 8), g.title, g.color_primary];
          if (g.material) parts.push(g.material);
          if (g.formality) parts.push(`F${g.formality}`);
          if (g.season_tags?.length) parts.push(`[${g.season_tags.join(",")}]`);
          return parts.join(" | ");
        }).join("\n  ");
        return `${cat.toUpperCase()} (${items.length}):\n  ${list}`;
      })
      .join("\n\n");

    const weatherDesc = weather
      ? `${weather.temperature_min}–${weather.temperature_max}°C, ${weather.condition || "mixed"}`
      : "unknown";

    const occasionsList = occasions?.length > 0
      ? occasions.join(", ")
      : "mixed casual/semi-formal";

    const systemPrompt = isSv
      ? `Du är en resepackningsexpert och stilist. Din uppgift: välj det MINSTA antalet plagg från användarens garderob som skapar FLEST outfitkombinatoner för en resa.

Regler:
- Resa: ${duration_days} dagar till ${destination || "okänd destination"}
- Väder: ${weatherDesc}
- Tillfällen: ${occasionsList}
- Maximera kombinerbarhet — varje plagg ska fungera i minst 2 outfits
- Välj neutrala basplagg + några accentplagg
- Inkludera: minst 1 top per dag (kan återanvändas), bottoms kan bäras 2+ dagar, 1-2 skor, relevanta accessoarer
- Max ${Math.min(Math.ceil(duration_days * 2.5), 25)} plagg totalt
- Tänk på väder och sesong vid val av material

Svara med giltig JSON:
{
  "capsule_items": ["garment_id_1", "garment_id_2", ...],
  "outfits": [
    {
      "day": 1,
      "occasion": "jobb|vardag|fest|dejt|träning",
      "items": ["garment_id_top", "garment_id_bottom", "garment_id_shoes"],
      "note": "Kort beskrivning"
    }
  ],
  "packing_tips": ["Tips 1", "Tips 2"],
  "total_combinations": 12,
  "reasoning": "Kort förklaring av valet"
}

Skriv på svenska.`
      : `You are a travel packing expert and stylist. Your task: select the MINIMUM number of garments from the user's wardrobe that create the MOST outfit combinations for a trip.

Rules:
- Trip: ${duration_days} days to ${destination || "unknown destination"}
- Weather: ${weatherDesc}
- Occasions: ${occasionsList}
- Maximize mix-and-match — each garment should work in at least 2 outfits
- Pick neutral base pieces + a few accent pieces
- Include: at least 1 top per day (can rewear), bottoms can be worn 2+ days, 1-2 shoes, relevant accessories
- Max ${Math.min(Math.ceil(duration_days * 2.5), 25)} items total
- Consider weather and season when selecting materials

Respond with valid JSON:
{
  "capsule_items": ["garment_id_1", "garment_id_2", ...],
  "outfits": [
    {
      "day": 1,
      "occasion": "work|casual|party|date|workout",
      "items": ["garment_id_top", "garment_id_bottom", "garment_id_shoes"],
      "note": "Short description"
    }
  ],
  "packing_tips": ["Tip 1", "Tip 2"],
  "total_combinations": 12,
  "reasoning": "Brief explanation of choices"
}

Write in ${localeName}.`;

    const userPrompt = `User wardrobe:\n${wardrobeDescription}`;

    // Try models with fallback
    let lastError = "";
    for (const model of MODELS) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (response.status === 429 || response.status === 402) {
          return new Response(
            JSON.stringify({ error: response.status === 429 ? "Rate limit" : "Payment required" }),
            { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!response.ok) {
          lastError = `${model}: ${response.status}`;
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          lastError = `${model}: no JSON`;
          continue;
        }

        const result = JSON.parse(jsonMatch[0]);

        // Validate that capsule_items reference real garment IDs
        const validIds = new Set(garments.map(g => g.id));
        const validCapsuleItems = (result.capsule_items || []).filter((id: string) =>
          validIds.has(id) || garments.some(g => g.id.startsWith(id))
        );

        // Resolve short IDs to full IDs
        const resolvedItems = validCapsuleItems.map((id: string) => {
          if (validIds.has(id)) return id;
          const match = garments.find(g => g.id.startsWith(id));
          return match?.id || id;
        });

        // Also resolve outfit item IDs
        const resolvedOutfits = (result.outfits || []).map((o: any) => ({
          ...o,
          items: (o.items || []).map((id: string) => {
            if (validIds.has(id)) return id;
            const match = garments.find(g => g.id.startsWith(id));
            return match?.id || id;
          }),
        }));

        return new Response(JSON.stringify({
          capsule_items: resolvedItems,
          outfits: resolvedOutfits,
          packing_tips: result.packing_tips || [],
          total_combinations: result.total_combinations || resolvedOutfits.length,
          reasoning: result.reasoning || "",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        lastError = `${model}: ${err}`;
        continue;
      }
    }

    console.error("All models failed:", lastError);
    return new Response(
      JSON.stringify({ error: "All AI models failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("travel_capsule error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
