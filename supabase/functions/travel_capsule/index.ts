import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";

import { allowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
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

    const { duration_days, destination, weather, occasions, locale = "sv", outfits_per_day = 1, must_have_items = [] } = await req.json();

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
    const outfitsPerDay = Math.max(1, Math.min(4, outfits_per_day || 1));
    const targetOutfits = Math.min(duration_days * outfitsPerDay, 20);
    const maxItems = Math.min(Math.ceil(duration_days * 2.5), 25);

    // Build valid ID set and lookup structures early
    const validIds = new Set(garments.map(g => g.id));
    const titleIndex = new Map(garments.map(g => [g.title.toLowerCase().trim(), g.id]));

    // Must-have items filtering
    const mustHaveIds: string[] = (must_have_items || []).filter((id: string) => validIds.has(id));

    // Scale max_tokens based on trip length and outfit count
    const maxTokens = estimateMaxTokens({ outputItems: targetOutfits + maxItems, perItemTokens: 40, baseTokens: 400, cap: 4096 });
    // Use stronger model for longer trips
    const complexity = duration_days > 5 ? "complex" : "standard";

    const mustHavePromptSv = mustHaveIds.length > 0
      ? `\n- OBLIGATORISKA plagg som MÅSTE inkluderas i capsule_items: ${mustHaveIds.join(", ")}`
      : "";
    const mustHavePromptEn = mustHaveIds.length > 0
      ? `\nMUST-HAVE items that MUST be included in capsule_items: ${mustHaveIds.join(", ")}`
      : "";

    const systemPrompt = isSv
      ? `Du är en resepackningsexpert och stilist. Din uppgift: välj det MINSTA antalet plagg från användarens garderob som skapar FLEST outfitkombinationer för en resa.

Regler:
- Resa: ${duration_days} dagar till ${destination || "okänd destination"}
- Väder: ${weatherDesc}
- Tillfällen: ${occasionsList}
- ${outfitsPerDay} outfit(s) per dag
- Maximera kombinerbarhet
- Max ${maxItems} plagg totalt
- Generera minst ${targetOutfits} outfits som täcker alla tillfällen och dagar
- Varje outfit MÅSTE ha minst 2 plagg${mustHavePromptSv}

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
${outfitsPerDay} outfit(s) per day.
Max ${maxItems} items.
Generate at least ${targetOutfits} outfits covering all occasions across all ${duration_days} days.
Each outfit MUST have at least 2 items.${mustHavePromptEn}

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

    // Use tool calling for guaranteed structured output
    const tools = [{
      type: "function",
      function: {
        name: "create_travel_capsule",
        description: "Create a travel capsule wardrobe with packing list and daily outfits",
        parameters: {
          type: "object",
          properties: {
            capsule_items: {
              type: "array",
              items: { type: "string" },
              description: "Array of garment UUIDs selected for the capsule"
            },
            outfits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "number" },
                  occasion: { type: "string" },
                  items: { type: "array", items: { type: "string" }, description: "Garment UUIDs for this outfit" },
                  note: { type: "string" }
                },
                required: ["day", "occasion", "items", "note"]
              }
            },
            packing_tips: { type: "array", items: { type: "string" } },
            total_combinations: { type: "number" },
            reasoning: { type: "string" }
          },
          required: ["capsule_items", "outfits", "packing_tips", "total_combinations", "reasoning"]
        }
      }
    }];

    let result: any = null;
    let lastError: Error | null = null;

    const buildDeterministicFallback = () => {
      const tops = garments.filter(g => g.category === "top").slice(0, 6);
      const bottoms = garments.filter(g => g.category === "bottom").slice(0, 4);
      const shoes = garments.filter(g => g.category === "shoes").slice(0, 3);
      const outerwear = garments.filter(g => g.category === "outerwear").slice(0, 2);
      const accessories = garments.filter(g => g.category === "accessory" || g.category === "accessories" || g.category === "bag").slice(0, 2);

      const capsuleItems = Array.from(new Set([
        ...mustHaveIds,
        ...tops.map(g => g.id),
        ...bottoms.map(g => g.id),
        ...shoes.map(g => g.id),
        ...outerwear.map(g => g.id),
        ...accessories.map(g => g.id),
      ])).slice(0, maxItems);

      const daysToGenerate = Math.min(duration_days, Math.max(3, Math.min(targetOutfits, duration_days * Math.max(1, occasionCount))));
      const outfits = Array.from({ length: daysToGenerate }).map((_, i) => {
        const items = [
          tops[i % Math.max(tops.length, 1)]?.id,
          bottoms[i % Math.max(bottoms.length, 1)]?.id,
          shoes[i % Math.max(shoes.length, 1)]?.id,
        ].filter(Boolean) as string[];

        if ((weather?.temperature_min ?? 15) <= 12 && outerwear.length > 0) {
          items.push(outerwear[i % outerwear.length].id);
        }

        if (items.length < 2) {
          items.push(...capsuleItems.slice(0, Math.max(0, 2 - items.length)));
        }

        return {
          day: i + 1,
          occasion: occasions?.[i % Math.max(occasions?.length || 0, 1)] || (isSv ? "vardag" : "casual"),
          items: Array.from(new Set(items)).slice(0, 4),
          note: isSv ? "En flexibel baslook för resedagen." : "A flexible core look for travel day.",
        };
      }).filter((o) => o.items.length >= 2);

      return {
        capsule_items: capsuleItems,
        outfits,
        packing_tips: isSv
          ? [
              "Välj plagg som fungerar i lager.",
              "Håll dig till en enhetlig färgpalett för fler kombinationer.",
              "Packa ett extra par skor för variation och komfort.",
            ]
          : [
              "Choose pieces that layer well.",
              "Keep a cohesive color palette for more combinations.",
              "Pack one backup pair of shoes for comfort and variation.",
            ],
        total_combinations: outfits.length,
        reasoning: isSv
          ? "Automatisk fallback användes för att säkerställa en komplett kapsel från din garderob."
          : "Automatic fallback was used to guarantee a complete capsule from your wardrobe.",
      };
    };

    console.log("travel_capsule v3 start", { duration_days, garment_count: garments.length, targetOutfits, maxItems });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data: content } = await callBursAI({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `User wardrobe:\n${wardrobeDescription}` },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "create_travel_capsule" } },
          complexity: attempt === 0 ? complexity : "trivial",
          max_tokens: maxTokens,
          functionName: "travel_capsule",
        });

        let parsed: any = null;
        if (content && typeof content === "object") {
          parsed = content;
        } else if (typeof content === "string") {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            lastError = new Error("No JSON in response: " + content.slice(0, 300));
            continue;
          }
          parsed = JSON.parse(jsonMatch[0]);
        }

        if (!parsed || typeof parsed !== "object") {
          lastError = new Error("AI returned empty capsule payload");
          continue;
        }

        if (!Array.isArray(parsed.capsule_items) || !Array.isArray(parsed.outfits)) {
          lastError = new Error("AI payload missing capsule_items/outfits arrays");
          continue;
        }

        result = parsed;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.error(`travel_capsule attempt ${attempt} failed:`, lastError.message);
        if (attempt === 1) break;
      }
    }

    if (!result) {
      console.warn("AI capsule generation failed, using deterministic fallback", lastError?.message || "unknown");
      result = buildDeterministicFallback();
    }

    console.log("AI capsule_items count:", result.capsule_items?.length, "sample:", JSON.stringify(result.capsule_items?.slice(0, 3)));
    console.log("AI outfits count:", result.outfits?.length);

    const resolveId = (id: string): string => {
      if (!id) return "";
      const trimmed = id.trim();
      if (validIds.has(trimmed)) return trimmed;
      // Prefix match (8+ chars)
      if (trimmed.length >= 8) {
        const match = garments.find(g => g.id.startsWith(trimmed) || g.id.includes(trimmed));
        if (match) return match.id;
      }
      // Title-based fallback
      const byTitle = titleIndex.get(trimmed.toLowerCase());
      if (byTitle) return byTitle;
      console.warn("Unresolvable garment ID:", trimmed);
      return trimmed;
    };

    let resolvedItems = (result.capsule_items || []).map(resolveId).filter((id: string) => validIds.has(id));
    let resolvedOutfits = (result.outfits || []).map((o: any) => ({
      ...o,
      items: (o.items || []).map(resolveId).filter((id: string) => validIds.has(id)),
    })).filter((o: any) => o.items.length >= 2);

    if (resolvedItems.length === 0 || resolvedOutfits.length === 0) {
      console.warn("Resolved capsule is empty, applying deterministic fallback mapping");
      const fallback = buildDeterministicFallback();
      resolvedItems = fallback.capsule_items.filter((id: string) => validIds.has(id));
      resolvedOutfits = fallback.outfits
        .map((o: any) => ({ ...o, items: (o.items || []).filter((id: string) => validIds.has(id)) }))
        .filter((o: any) => o.items.length >= 2);
      result = { ...fallback, ...result };
    }

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
