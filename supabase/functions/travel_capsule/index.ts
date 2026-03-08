import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse } from "../_shared/burs-ai.ts";

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

    const { data: garments, error: gError } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, color_secondary, material, pattern, fit, formality, season_tags, in_laundry, image_path")
      .eq("user_id", user.id)
      .or("in_laundry.is.null,in_laundry.eq.false");

    if (gError) throw gError;
    if (!garments || garments.length < 5) {
      throw new Error("Need at least 5 garments to build a capsule");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single();

    const LOCALE_NAMES: Record<string, string> = {
      sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "finska",
      de: "Deutsch", fr: "français", es: "español",
    };
    const localeName = LOCALE_NAMES[locale] || "English";
    const isSv = locale === "sv";

    const byCategory: Record<string, GarmentRow[]> = {};
    for (const g of garments) {
      if (!byCategory[g.category]) byCategory[g.category] = [];
      byCategory[g.category].push(g);
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

    const occasionsList = occasions?.length > 0 ? occasions.join(", ") : "mixed casual/semi-formal";

    const systemPrompt = isSv
      ? `Du är en resepackningsexpert och stilist. Din uppgift: välj det MINSTA antalet plagg från användarens garderob som skapar FLEST outfitkombinatoner för en resa.

Regler:
- Resa: ${duration_days} dagar till ${destination || "okänd destination"}
- Väder: ${weatherDesc}
- Tillfällen: ${occasionsList}
- Maximera kombinerbarhet
- Max ${Math.min(Math.ceil(duration_days * 2.5), 25)} plagg totalt

Svara med giltig JSON:
{
  "capsule_items": ["garment_id_1", ...],
  "outfits": [{ "day": 1, "occasion": "...", "items": ["..."], "note": "..." }],
  "packing_tips": ["..."],
  "total_combinations": 12,
  "reasoning": "..."
}
Skriv på svenska.`
      : `You are a travel packing expert and stylist. Select the MINIMUM garments for the MOST combinations.

Trip: ${duration_days} days to ${destination || "unknown"}, Weather: ${weatherDesc}, Occasions: ${occasionsList}
Max ${Math.min(Math.ceil(duration_days * 2.5), 25)} items.

Respond with valid JSON:
{
  "capsule_items": ["garment_id_1", ...],
  "outfits": [{ "day": 1, "occasion": "...", "items": ["..."], "note": "..." }],
  "packing_tips": ["..."],
  "total_combinations": 12,
  "reasoning": "..."
}
Write in ${localeName}.`;

    const { data: content } = await callBursAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `User wardrobe:\n${wardrobeDescription}` },
      ],
    });

    let result: any;
    if (typeof content === "string") {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in AI response");
      result = JSON.parse(jsonMatch[0]);
    } else {
      result = content;
    }

    // Validate and resolve IDs
    const validIds = new Set(garments.map(g => g.id));

    const resolveId = (id: string) => {
      if (validIds.has(id)) return id;
      const match = garments.find(g => g.id.startsWith(id));
      return match?.id || id;
    };

    const resolvedItems = (result.capsule_items || []).map(resolveId).filter((id: string) => validIds.has(id));
    const resolvedOutfits = (result.outfits || []).map((o: any) => ({
      ...o,
      items: (o.items || []).map(resolveId),
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
  } catch (e) {
    console.error("travel_capsule error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
