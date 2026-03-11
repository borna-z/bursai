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
  pattern: string | null;
  material: string | null;
  fit: string | null;
  formality: number | null;
  season_tags: string[] | null;
  wear_count: number | null;
  last_worn_at: string | null;
}

const LOCALE_NAMES: Record<string, string> = {
  sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "finska",
  de: "Deutsch", fr: "français", es: "español", it: "italiano",
  pt: "português", nl: "Nederlands", ja: "日本語", ko: "한국어", ar: "العربية",
  fa: "فارسی", zh: "中文",
};

// Categories that count as each slot
const TOP_CATEGORIES = ["top", "shirt", "t-shirt", "blouse", "sweater", "hoodie", "polo", "tank_top", "cardigan", "tröja", "skjorta"];
const BOTTOM_CATEGORIES = ["bottom", "pants", "jeans", "trousers", "shorts", "skirt", "chinos", "byxor", "kjol"];
const SHOES_CATEGORIES = ["shoes", "sneakers", "boots", "loafers", "sandals", "heels", "skor", "stövlar"];
const OUTERWEAR_CATEGORIES = ["outerwear", "jacket", "coat", "blazer", "parka", "windbreaker", "jacka", "kappa", "rock"];
const DRESS_CATEGORIES = ["dress", "jumpsuit", "overall", "klänning"];

function categorizeSlot(category: string, subcategory: string | null): string | null {
  const cat = (category || "").toLowerCase();
  const sub = (subcategory || "").toLowerCase();
  const both = `${cat} ${sub}`;
  
  if (DRESS_CATEGORIES.some(d => both.includes(d))) return "dress";
  if (OUTERWEAR_CATEGORIES.some(o => both.includes(o))) return "outerwear";
  if (TOP_CATEGORIES.some(t => both.includes(t))) return "top";
  if (BOTTOM_CATEGORIES.some(b => both.includes(b))) return "bottom";
  if (SHOES_CATEGORIES.some(s => both.includes(s))) return "shoes";
  return null;
}

function buildStyleContext(preferences: Record<string, any> | null, profile: any): string {
  if (!preferences) return "";
  const sp = preferences.styleProfile as Record<string, any> | undefined;
  if (!sp) {
    // Legacy fallback
    const parts: string[] = [];
    if (preferences.favoriteColors?.length) parts.push(`Favorite colors: ${(preferences.favoriteColors as string[]).join(", ")}`);
    if (preferences.dislikedColors?.length) parts.push(`Avoids: ${(preferences.dislikedColors as string[]).join(", ")}`);
    if (preferences.fitPreference) parts.push(`Fit: ${preferences.fitPreference}`);
    if (preferences.styleVibe) parts.push(`Style: ${preferences.styleVibe}`);
    return parts.join(". ");
  }
  // Quiz v3 — comprehensive style profile
  const lines: string[] = [];
  // Identity & body
  if (sp.gender) lines.push(`Gender: ${sp.gender}`);
  if (sp.ageRange) lines.push(`Age: ${sp.ageRange}`);
  if (sp.climate) lines.push(`Climate: ${sp.climate}`);
  // Lifestyle
  if (sp.weekdayLife) lines.push(`Weekday: ${sp.weekdayLife}`);
  if (sp.workFormality) lines.push(`Work formality: ${sp.workFormality}`);
  if (sp.weekendLife) lines.push(`Weekend: ${sp.weekendLife}`);
  if (sp.specialOccasionFreq) lines.push(`Special occasions: ${sp.specialOccasionFreq}`);
  // Style DNA
  if (sp.styleWords?.length) lines.push(`Style words: ${sp.styleWords.join(", ")}`);
  if (sp.comfortVsStyle !== undefined) lines.push(`Comfort vs style: ${sp.comfortVsStyle}/100`);
  if (sp.adventurousness) lines.push(`Adventurousness: ${sp.adventurousness}`);
  if (sp.trendFollowing) lines.push(`Trends: ${sp.trendFollowing}`);
  if (sp.genderNeutral) lines.push("Open to gender-neutral suggestions");
  // Fit
  if (sp.fit) lines.push(`Fit: ${sp.fit}`);
  if (sp.layering) lines.push(`Layering: ${sp.layering}`);
  if (sp.topFit) lines.push(`Top fit: ${sp.topFit}`);
  if (sp.bottomLength) lines.push(`Bottom length: ${sp.bottomLength}`);
  // Colors & patterns
  if (sp.favoriteColors?.length) lines.push(`Favorite colors: ${sp.favoriteColors.join(", ")}`);
  if (sp.dislikedColors?.length) lines.push(`Avoids colors: ${sp.dislikedColors.join(", ")}`);
  if (sp.paletteVibe) lines.push(`Palette vibe: ${sp.paletteVibe}`);
  if (sp.patternFeeling) lines.push(`Patterns: ${sp.patternFeeling}`);
  // Philosophy
  if (sp.shoppingMindset) lines.push(`Shopping: ${sp.shoppingMindset}`);
  if (sp.sustainability) lines.push(`Sustainability: ${sp.sustainability}`);
  if (sp.capsuleWardrobe) lines.push(`Capsule wardrobe: ${sp.capsuleWardrobe}`);
  if (sp.wardrobeFrustrations?.length) lines.push(`Frustrations: ${sp.wardrobeFrustrations.join(", ")}`);
  // Inspiration
  if (sp.styleIcons) lines.push(`Inspiration: ${sp.styleIcons}`);
  if (sp.hardestOccasions?.length) lines.push(`Hardest to dress for: ${sp.hardestOccasions.join(", ")}`);
  if (sp.fabricFeel) lines.push(`Favorite fabrics: ${sp.fabricFeel}`);
  if (sp.signaturePieces) lines.push(`Signature pieces: ${sp.signaturePieces}`);
  // Goals
  if (sp.primaryGoal) lines.push(`Primary goal: ${sp.primaryGoal}`);
  if (sp.morningTime) lines.push(`Morning routine: ${sp.morningTime}`);
  if (sp.freeNote) lines.push(`Personal note: ${sp.freeNote}`);
  return lines.join(". ");
}

const TOOL_DEF = {
  type: "function" as const,
  function: {
    name: "select_outfit",
    description: "Select garments for a complete outfit from the user's wardrobe",
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
                enum: ["top", "bottom", "shoes", "outerwear", "accessory", "dress"],
              },
              garment_id: { type: "string", description: "UUID of the garment from the wardrobe list" },
            },
            required: ["slot", "garment_id"],
            additionalProperties: false,
          },
        },
        explanation: {
          type: "string",
          description: "2-3 sentence explanation of why this outfit works stylistically",
        },
      },
      required: ["items", "explanation"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { occasion, style, weather, locale = "sv" } = await req.json();
    const localeName = LOCALE_NAMES[locale] || "English";

    // Fetch garments, profile, and recent outfits in parallel
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [garmentsRes, profileRes, recentOutfitsRes] = await Promise.all([
      supabase
        .from("garments")
        .select("id, title, category, subcategory, color_primary, color_secondary, pattern, material, fit, formality, season_tags, wear_count, last_worn_at")
        .eq("user_id", userId)
        .eq("in_laundry", false),
      supabase.from("profiles").select("preferences, height_cm, weight_kg").eq("id", userId).single(),
      // Fetch last 5 outfits with their items for anti-repetition
      serviceSupabase
        .from("outfit_items")
        .select("outfit_id, garment_id, outfits!inner(user_id, generated_at)")
        .eq("outfits.user_id", userId)
        .order("outfits(generated_at)", { ascending: false })
        .limit(25),
    ]);

    if (garmentsRes.error) throw garmentsRes.error;
    const garments = garmentsRes.data as GarmentRow[];

    if (!garments || garments.length < 3) {
      return new Response(
        JSON.stringify({ error: "Du behöver minst 3 plagg (överdel, underdel, skor) för att generera en outfit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profile = profileRes.data;
    const preferences = profile?.preferences as Record<string, any> | null;

    // Build recent outfits context for anti-repetition
    let recentOutfitsContext = "";
    if (recentOutfitsRes.data?.length) {
      const outfitMap = new Map<string, string[]>();
      for (const item of recentOutfitsRes.data) {
        const oid = item.outfit_id;
        if (!outfitMap.has(oid)) outfitMap.set(oid, []);
        outfitMap.get(oid)!.push(item.garment_id);
      }
      const recentSets = Array.from(outfitMap.values()).slice(0, 5);
      if (recentSets.length > 0) {
        recentOutfitsContext = `\nRECENTLY GENERATED OUTFITS (DO NOT repeat these exact combinations — use DIFFERENT garments):\n${recentSets.map((ids, i) => `Outfit ${i + 1}: ${ids.join(", ")}`).join("\n")}`;
      }
    }

    // Categorize available garments by slot
    const availableBySlot: Record<string, GarmentRow[]> = { top: [], bottom: [], shoes: [], outerwear: [], dress: [] };
    for (const g of garments) {
      const slot = categorizeSlot(g.category, g.subcategory);
      if (slot && availableBySlot[slot]) {
        availableBySlot[slot].push(g);
      }
    }

    // Build garment list for prompt
    const garmentList = garments
      .map((g) => {
        const parts = [`ID:${g.id}`, g.title, `category:${g.category}`];
        if (g.subcategory) parts.push(`sub:${g.subcategory}`);
        parts.push(`color:${g.color_primary}`);
        if (g.color_secondary) parts.push(`secondary:${g.color_secondary}`);
        if (g.pattern) parts.push(`pattern:${g.pattern}`);
        if (g.material) parts.push(`material:${g.material}`);
        if (g.fit) parts.push(`fit:${g.fit}`);
        if (g.formality) parts.push(`formality:${g.formality}/5`);
        if (g.season_tags?.length) parts.push(`season:${g.season_tags.join(",")}`);
        if (g.wear_count !== null) parts.push(`worn:${g.wear_count}x`);
        if (g.last_worn_at) parts.push(`last:${g.last_worn_at}`);
        return parts.join(" | ");
      })
      .join("\n");

    const styleContext = buildStyleContext(preferences, profile);

    const currentMonth = new Date().getMonth();
    const seasonHint = currentMonth >= 2 && currentMonth <= 4 ? "spring" :
                       currentMonth >= 5 && currentMonth <= 7 ? "summer" :
                       currentMonth >= 8 && currentMonth <= 10 ? "autumn" : "winter";

    const needsOuterwear = (weather?.temperature !== undefined && weather.temperature < 15) ||
      (weather?.precipitation && weather.precipitation !== "none" && weather.precipitation !== "ingen");

    const systemPrompt = `You are a world-class personal stylist. Create ONE complete, wearable outfit.

MANDATORY RULES — FOLLOW STRICTLY:
1. Every outfit MUST include ALL of these slots: "top" + "bottom" + "shoes" (minimum 3 items)
2. ${needsOuterwear ? 'OUTERWEAR IS REQUIRED for this weather. You MUST include an "outerwear" slot (4 items minimum).' : 'Outerwear is optional for this weather.'}
3. EXCEPTION: If choosing a dress/jumpsuit, use slot "dress" which replaces top+bottom. Still MUST include shoes.
4. ONLY use garment IDs from the WARDROBE list below. Never invent IDs.
5. Prioritize garments not recently worn (low wear_count, old last_worn date)
6. Consider color harmony: complementary, analogous, tone-on-tone, or neutral base + accent
7. Match formality levels across all items
8. Each garment ID can only appear ONCE in the outfit

WEATHER CONTEXT:
${weather?.temperature !== undefined ? `Temperature: ${weather.temperature}°C` : "Unknown temperature"}
${weather?.precipitation ? `Precipitation: ${weather.precipitation}` : ""}
${weather?.wind ? `Wind: ${weather.wind}` : ""}
Season: ${seasonHint}

${recentOutfitsContext}

OCCASION: ${occasion}
${style ? `REQUESTED STYLE: ${style}` : ""}
${styleContext ? `\nUSER STYLE PROFILE:\n${styleContext}` : ""}
${profile?.height_cm ? `Height: ${profile.height_cm}cm` : ""}

Write the explanation in ${localeName}.

WARDROBE (choose ONLY from these):
${garmentList}`;

    // Call AI with BURS AI abstraction
    async function callAI(messages: { role: string; content: string }[]) {
      try {
        const { data } = await callBursAI({
          messages,
          tools: [TOOL_DEF],
          tool_choice: { type: "function", function: { name: "select_outfit" } },
          complexity: "standard",
          max_tokens: 300,
        });
        return { data: data as { items: { slot: string; garment_id: string }[]; explanation: string } };
      } catch (e: any) {
        if (e.status === 429) return { error: "rate_limit", status: 429 };
        if (e.status === 402) return { error: "payment", status: 402 };
        console.error("AI error:", e);
        return { error: "ai_error", status: 500 };
      }
    }

    // First attempt
    const result = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: "Create a complete outfit for me." },
    ]);

    if (result.error) {
      if (result.status === 429) {
        return new Response(JSON.stringify({ error: "För många förfrågningar, försök igen om en stund." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (result.status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut. Kontakta support." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI service error");
    }

    const garmentIdSet = new Set(garments.map((g) => g.id));
    let validItems = result.data!.items.filter((item) => garmentIdSet.has(item.garment_id));
    let explanation = result.data!.explanation;

    // Validate completeness
    const slots = new Set(validItems.map(i => i.slot));
    const hasDress = slots.has("dress");
    const hasTop = slots.has("top") || hasDress;
    const hasBottom = slots.has("bottom") || hasDress;
    const hasShoes = slots.has("shoes");
    const hasOuterwear = slots.has("outerwear");

    const missingSlots: string[] = [];
    if (!hasTop && availableBySlot.top.length > 0) missingSlots.push("top");
    if (!hasBottom && availableBySlot.bottom.length > 0) missingSlots.push("bottom");
    if (!hasShoes && availableBySlot.shoes.length > 0) missingSlots.push("shoes");
    if (needsOuterwear && !hasOuterwear && availableBySlot.outerwear.length > 0) missingSlots.push("outerwear");

    // Fill missing mandatory slots instantly from available garments (no retry)
    if (missingSlots.length > 0) {
      console.log("Filling missing slots locally:", missingSlots.join(", "));
      const usedIds = new Set(validItems.map(i => i.garment_id));
      for (const slot of missingSlots) {
        const candidate = (availableBySlot[slot] || []).find(g => !usedIds.has(g.id));
        if (candidate) {
          validItems.push({ slot, garment_id: candidate.id });
          usedIds.add(candidate.id);
        }
      }
    }

    if (validItems.length < 3) {
      // Last resort: if we have garments for each slot, manually fill
      const finalSlots = new Set(validItems.map(i => i.slot));
      if (!finalSlots.has("top") && !finalSlots.has("dress") && availableBySlot.top.length > 0) {
        validItems.push({ slot: "top", garment_id: availableBySlot.top[0].id });
      }
      if (!finalSlots.has("bottom") && !finalSlots.has("dress") && availableBySlot.bottom.length > 0) {
        validItems.push({ slot: "bottom", garment_id: availableBySlot.bottom[0].id });
      }
      if (!finalSlots.has("shoes") && availableBySlot.shoes.length > 0) {
        validItems.push({ slot: "shoes", garment_id: availableBySlot.shoes[0].id });
      }
    }

    if (validItems.length < 2) {
      throw new Error("Kunde inte skapa en komplett outfit med din garderob");
    }

    return new Response(
      JSON.stringify({
        items: validItems,
        explanation: explanation || "Snygg kombination!",
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
