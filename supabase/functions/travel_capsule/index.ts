import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

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
  image_path: string;
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

    // Use FULL UUIDs to prevent ID resolution failures
    const wardrobeDescription = Object.entries(byCategory)
      .map(([cat, items]) => {
        const list = items.map(g => {
          const parts = [g.id, g.title, g.color_primary];
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
    const occasionCount = occasions?.length || 2;
    const targetOutfits = Math.min(duration_days * occasionCount, 20);
    const maxItems = Math.min(Math.ceil(duration_days * 2.5), 25);

    // Scale max_tokens based on trip length and outfit count
    const maxTokens = estimateMaxTokens({ outputItems: targetOutfits + maxItems, perItemTokens: 40, baseTokens: 400, cap: 4096 });
    // Use stronger model for longer trips
    const complexity = duration_days > 5 ? "complex" : "standard";

    const systemPrompt = isSv
      ? `Du är en resepackningsexpert och stilist. Din uppgift: välj det MINSTA antalet plagg från användarens garderob som skapar FLEST outfitkombinationer för en resa.

Regler:
- Resa: ${duration_days} dagar till ${destination || "okänd destination"}
- Väder: ${weatherDesc}
- Tillfällen: ${occasionsList}
- Maximera kombinerbarhet
- Max ${maxItems} plagg totalt
- Generera minst ${targetOutfits} outfits som täcker alla tillfällen och dagar
- Varje outfit MÅSTE ha minst 2 plagg

VIKTIGT: Använd de EXAKTA garment ID:na (fullständiga UUID) från garderoben. Kopiera dem exakt.

Svara med giltig JSON:
{
  "capsule_items": ["full-uuid-1", "full-uuid-2", ...],
  "outfits": [{ "day": 1, "occasion": "...", "items": ["full-uuid-1", "full-uuid-2"], "note": "..." }, ...],
  "packing_tips": ["..."],
  "total_combinations": ${targetOutfits},
  "reasoning": "..."
}
Skriv på svenska.`
      : `You are a travel packing expert and stylist. Select the MINIMUM garments for the MOST combinations.

Trip: ${duration_days} days to ${destination || "unknown"}, Weather: ${weatherDesc}, Occasions: ${occasionsList}
Max ${maxItems} items.
Generate at least ${targetOutfits} outfits covering all occasions across all ${duration_days} days.
Each outfit MUST have at least 2 items.

IMPORTANT: Use the EXACT garment IDs (full UUIDs) from the wardrobe. Copy them exactly as shown.

Respond with valid JSON:
{
  "capsule_items": ["full-uuid-1", "full-uuid-2", ...],
  "outfits": [{ "day": 1, "occasion": "...", "items": ["full-uuid-1", "full-uuid-2"], "note": "..." }, ...],
  "packing_tips": ["..."],
  "total_combinations": ${targetOutfits},
  "reasoning": "..."
}
Write in ${localeName}.`;

    let result: any = null;
    let lastError: Error | null = null;

    // Attempt AI call with JSON retry on parse failure
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const messages = attempt === 0
          ? [
              { role: "system", content: systemPrompt },
              { role: "user", content: `User wardrobe:\n${wardrobeDescription}` },
            ]
          : [
              { role: "system", content: "You are a JSON formatter. Fix the following text into valid JSON matching the schema: { capsule_items: string[], outfits: [{day, occasion, items, note}], packing_tips: string[], total_combinations: number, reasoning: string }" },
              { role: "user", content: lastError?.message || "Fix JSON" },
            ];

        const { data: content } = await callBursAI({
          messages,
          complexity: attempt === 0 ? complexity : "trivial",
          max_tokens: maxTokens,
        });

        if (typeof content === "string") {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            lastError = new Error(content.slice(0, 500));
            continue;
          }
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = content;
        }
        break;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt === 1) throw lastError;
      }
    }

    if (!result) throw lastError || new Error("Failed to generate capsule");

    console.log("AI raw capsule_items:", JSON.stringify(result.capsule_items?.slice(0, 5)));
    console.log("AI raw outfits count:", result.outfits?.length);
    console.log("Valid garment IDs sample:", Array.from(validIds).slice(0, 3));

    // Validate and resolve IDs — handles full UUIDs, prefix matches, and title-based fallback
    const validIds = new Set(garments.map(g => g.id));
    const titleIndex = new Map(garments.map(g => [g.title.toLowerCase().trim(), g.id]));

    const resolveId = (id: string): string => {
      if (!id) return "";
      const trimmed = id.trim();
      if (validIds.has(trimmed)) return trimmed;
      // Prefix match (8+ chars)
      if (trimmed.length >= 8) {
        const match = garments.find(g => g.id.startsWith(trimmed) || g.id.includes(trimmed));
        if (match) return match.id;
      }
      // Title-based fallback (AI sometimes returns titles instead of IDs)
      const byTitle = titleIndex.get(trimmed.toLowerCase());
      if (byTitle) return byTitle;
      console.warn("Unresolvable garment ID:", trimmed);
      return trimmed;
    };

    const resolvedItems = (result.capsule_items || []).map(resolveId).filter((id: string) => validIds.has(id));
    const resolvedOutfits = (result.outfits || []).map((o: any) => ({
      ...o,
      items: (o.items || []).map(resolveId).filter((id: string) => validIds.has(id)),
    })).filter((o: any) => o.items.length >= 2);

    console.log("Resolved items:", resolvedItems.length, "Resolved outfits:", resolvedOutfits.length);

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
