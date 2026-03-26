import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";
import { VOICE_TRAVEL_CAPSULE } from "../_shared/burs-voice.ts";

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
  // Enrichment (hydrated from ai_raw)
  versatility_score: number;
  layering_role: string;
  occasion_tags: string[];
  texture_intensity: number;
}

/** Extract enrichment fields from ai_raw with safe defaults. */
function hydrateGarment(raw: any): GarmentRow {
  const aiRaw = (raw.ai_raw && typeof raw.ai_raw === 'object') ? raw.ai_raw : {};
  const e = aiRaw.enrichment || aiRaw;
  return {
    ...raw,
    versatility_score: typeof e.versatility_score === 'number' ? Math.max(1, Math.min(10, e.versatility_score)) : 5,
    layering_role: String(e.layering_role || inferLayeringRole(raw.category, raw.subcategory)).toLowerCase(),
    occasion_tags: Array.isArray(e.occasion_tags) ? e.occasion_tags.map((t: any) => String(t).toLowerCase()) : [],
    texture_intensity: typeof e.texture_intensity === 'number' ? Math.max(1, Math.min(10, e.texture_intensity)) : 3,
  };
}

function inferLayeringRole(category: string, subcategory: string | null): string {
  const both = `${category} ${subcategory || ''}`.toLowerCase();
  if (['outerwear', 'jacket', 'coat', 'blazer', 'parka'].some(c => both.includes(c))) return 'outer';
  if (['t-shirt', 'tank', 'camisole'].some(c => both.includes(c))) return 'base';
  if (['cardigan', 'sweater', 'hoodie', 'vest'].some(c => both.includes(c))) return 'mid';
  return 'standalone';
}


function normalizeCategoryToken(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function classifyCoreSlot(category: string, subcategory: string | null): 'dress' | 'top' | 'bottom' | 'shoes' | 'outerwear' | 'accessory' | 'other' {
  const both = `${normalizeCategoryToken(category)} ${normalizeCategoryToken(subcategory)}`.trim();
  if (['dress', 'jumpsuit', 'overall', 'fullbody', 'full body', 'romper', 'klänning'].some(c => both.includes(c))) return 'dress';
  if (['shoes', 'shoe', 'sneakers', 'boots', 'heels', 'sandals', 'loafers', 'footwear', 'skor', 'stövlar'].some(c => both.includes(c))) return 'shoes';
  if (['outerwear', 'coat', 'jacket', 'blazer', 'trench', 'parka', 'jacka', 'kappa'].some(c => both.includes(c))) return 'outerwear';
  if (['accessory', 'accessories', 'bag', 'hat', 'belt', 'scarf', 'smycke', 'väska'].some(c => both.includes(c))) return 'accessory';
  if (['bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'chinos', 'leggings', 'byxor', 'kjol'].some(c => both.includes(c))) return 'bottom';
  if (['top', 'shirt', 'blouse', 'sweater', 't-shirt', 'tee', 'polo', 'tank', 'hoodie', 'cardigan', 'skjorta', 'tröja'].some(c => both.includes(c))) return 'top';
  return 'other';
}

function isCompleteCoreOutfit(slotNames: Iterable<string>): boolean {
  const slots = new Set(slotNames);
  return (slots.has('dress') && slots.has('shoes')) || (slots.has('top') && slots.has('bottom') && slots.has('shoes'));
}

// ─────────────────────────────────────────────
// PACK-WORTHINESS SCORING (Phase 2)
// ─────────────────────────────────────────────

const TRAVEL_FRIENDLY_MATERIALS: Record<string, number> = {
  denim: 8, jersey: 9, knit: 7, cotton: 7, polyester: 8, nylon: 9,
  merino: 9, wool: 5, cashmere: 4, linen: 3, silk: 3, leather: 4,
  'gore-tex': 9, softshell: 8, fleece: 7, chiffon: 2, satin: 2,
};

function getMaterialTravelScore(material: string | null): number {
  if (!material) return 5;
  const m = material.toLowerCase();
  for (const [key, score] of Object.entries(TRAVEL_FRIENDLY_MATERIALS)) {
    if (m.includes(key)) return score;
  }
  return 5;
}

function scorePackWorthiness(
  garment: GarmentRow,
  weatherMin: number,
  weatherMax: number,
  occasions: string[],
  allGarments: GarmentRow[]
): number {
  let score = 0;

  // 1. Versatility (30%) — from enrichment
  score += garment.versatility_score * 0.30;

  // 2. Material travel-friendliness (20%) — wrinkle/pack tolerance
  score += getMaterialTravelScore(garment.material) * 0.20;

  // 3. Weather coverage (20%) — does it work for trip temperature range?
  const tags = garment.season_tags || [];
  let weatherFit = 5;
  if (weatherMax < 10) {
    // Cold trip
    if (tags.includes('winter') || tags.includes('autumn')) weatherFit += 3;
    if (garment.layering_role === 'outer' || garment.layering_role === 'mid') weatherFit += 2;
    if (tags.includes('summer')) weatherFit -= 3;
  } else if (weatherMin > 22) {
    // Hot trip
    if (tags.includes('summer') || tags.includes('spring')) weatherFit += 3;
    if (garment.layering_role === 'outer') weatherFit -= 3;
    if (tags.includes('winter')) weatherFit -= 4;
  } else {
    // Mixed: reward multi-season garments
    if (tags.length >= 2) weatherFit += 2;
    if (garment.layering_role === 'mid') weatherFit += 1;
  }
  score += Math.max(0, Math.min(10, weatherFit)) * 0.20;

  // 4. Occasion match (15%) — how many trip occasions does it cover?
  if (occasions.length > 0 && garment.occasion_tags.length > 0) {
    const matchCount = occasions.filter(occ =>
      garment.occasion_tags.includes(occ.toLowerCase())
    ).length;
    score += Math.min(10, (matchCount / Math.max(1, occasions.length)) * 10) * 0.15;
  } else {
    score += 5 * 0.15; // neutral
  }

  // 5. Category pairing potential (15%) — how many compatible items exist?
  const cat = garment.category.toLowerCase();
  let pairingCount = 0;
  if (['top', 'shirt', 'blouse', 'sweater', 't-shirt'].some(c => cat.includes(c))) {
    pairingCount = allGarments.filter(g => g.category.toLowerCase().includes('bottom') || g.category.toLowerCase().includes('jean')).length;
  } else if (['bottom', 'pants', 'jeans', 'skirt'].some(c => cat.includes(c))) {
    pairingCount = allGarments.filter(g => ['top', 'shirt', 'blouse', 'sweater', 't-shirt'].some(c2 => g.category.toLowerCase().includes(c2))).length;
  } else {
    pairingCount = 3; // neutral for shoes, outerwear, etc.
  }
  score += Math.min(10, pairingCount * 1.5) * 0.15;

  return Math.max(0, Math.min(10, score));
}

// ─────────────────────────────────────────────
// FIX 3 — TRIP TYPE CONTEXT STRINGS
// ─────────────────────────────────────────────

const TRIP_TYPE_CONTEXT: Record<string, string> = {
  business: "Prioritise formality 4+, blazers, structured trousers, dress shirts. Minimise casual items.",
  beach: "Prioritise sandals, shorts, linen tops, swimwear-adjacent. Minimise heavy outerwear.",
  winter: "Prioritise coats, knits, boots, layering pieces. Every outfit needs a warm layer.",
  casual: "Prioritise versatility, comfort. Boost garments with high versatility_score.",
  mixed: "Balance occasion coverage: at least 1 smart, 1 casual, 1 evening look.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const userId = userData.user.id;
    const user = { id: userId };

    // ─────────────────────────────────────────────
    // FIX 4 — GET HANDLER (list saved capsules)
    // ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('travel_capsules')
        .select('id, destination, trip_type, duration_days, created_at, outfits, capsule_items, packing_list')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      return new Response(JSON.stringify({ capsules: data ?? [] }), { status: 200, headers: corsHeaders });
    }

    // ─────────────────────────────────────────────
    // FIX 3 — Accept new request fields
    // ─────────────────────────────────────────────
    const {
      duration_days: rawDurationDays,
      destination,
      weather,
      occasions,
      locale = "en",
      outfits_per_day = 1,
      must_have_items = [],
      trip_type = "mixed",
      transition_looks = false,
    } = await req.json();

    // FIX 3 — duration_days now accepts 1-30, derive targetOutfits by trip length
    const duration_days: number = rawDurationDays;

    if (!duration_days || duration_days < 1 || duration_days > 30) {
      throw new Error("duration_days must be 1-30");
    }

    const { data: garmentsRaw, error: gError } = await supabase
      .from("garments")
      .select("id, title, category, subcategory, color_primary, color_secondary, material, pattern, fit, formality, season_tags, in_laundry, image_path, ai_raw")
      .eq("user_id", user.id)
      .or("in_laundry.is.null,in_laundry.eq.false")
      .order("id", { ascending: true });

    if (gError) throw gError;
    const allGarments = (garmentsRaw || []).map(hydrateGarment) as GarmentRow[];
    if (allGarments.length < 5) {
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

    // Phase 2: Score pack-worthiness and pre-filter
    const weatherMin = weather?.temperature_min ?? 10;
    const weatherMax = weather?.temperature_max ?? 22;
    const scoredGarments = allGarments.map(g => ({
      garment: g,
      packScore: scorePackWorthiness(g, weatherMin, weatherMax, occasions || [], allGarments),
    })).sort((a, b) => b.packScore - a.packScore);

    // Must-have items — declared early so pre-filter can use them
    const preValidIds = new Set(allGarments.map(g => g.id));
    const mustHaveIds: string[] = (must_have_items || []).filter((id: string) => preValidIds.has(id));

    // Send top 40 most packable garments to AI (reduces input size, improves quality)
    const MAX_AI_INPUT = 40;
    const garments = scoredGarments.length > MAX_AI_INPUT
      ? [
          // Always include must-have items
          ...scoredGarments.filter(s => mustHaveIds.includes(s.garment.id)),
          // Fill rest with top-scoring
          ...scoredGarments.filter(s => !mustHaveIds.includes(s.garment.id)),
        ].slice(0, MAX_AI_INPUT).map(s => s.garment)
      : scoredGarments.map(s => s.garment);

    console.log(`travel_capsule pack-worthiness: ${allGarments.length} total → ${garments.length} sent to AI (top scores: ${scoredGarments.slice(0, 3).map(s => s.packScore.toFixed(1)).join(', ')})`);

    const byCategory: Record<string, GarmentRow[]> = {};
    for (const g of garments) {
      if (!byCategory[g.category]) byCategory[g.category] = [];
      byCategory[g.category].push(g);
    }

    // Compact wardrobe format: one line per garment, reduce input tokens
    const wardrobeLines = garments.map(g => {
      const parts = [g.id, g.category, g.title, g.color_primary];
      if (g.subcategory) parts.push(g.subcategory);
      if (g.material) parts.push(g.material);
      if (g.formality != null) parts.push(`f${g.formality}`);
      if (g.season_tags?.length) parts.push(g.season_tags.join(","));
      return parts.join("|");
    }).join("\n");

    const weatherDesc = weather
      ? `${weather.temperature_min}–${weather.temperature_max}°C, ${weather.condition || "mixed"}`
      : "unknown";

    const occasionsList = occasions?.length > 0 ? occasions.join(", ") : "mixed casual/semi-formal";
    const outfitsPerDay = Math.max(1, Math.min(4, outfits_per_day || 1));

    // ─────────────────────────────────────────────
    // FIX 3 — targetOutfits by duration bracket
    // ─────────────────────────────────────────────
    let targetOutfits: number;
    if (duration_days >= 15) {
      targetOutfits = 15;
    } else if (duration_days >= 8) {
      targetOutfits = Math.ceil(duration_days * 2);
    } else if (duration_days >= 4) {
      targetOutfits = Math.ceil(duration_days * 1.5);
    } else {
      targetOutfits = Math.ceil(duration_days * 1);
    }

    // FIX 3 — transition looks bonus
    if (transition_looks && duration_days >= 3) {
      targetOutfits += Math.floor(duration_days / 3);
    }

    targetOutfits = Math.min(targetOutfits, 35);

    const maxItems = Math.min(Math.ceil(duration_days * 2.5), 30);

    // FIX 3 — trip type context string
    const tripTypeContext = TRIP_TYPE_CONTEXT[trip_type] ?? TRIP_TYPE_CONTEXT.mixed;

    // Build valid ID set and lookup structures early
    const validIds = new Set(garments.map(g => g.id));
    const titleIndex = new Map(garments.map(g => [g.title.toLowerCase().trim(), g.id]));

    // (mustHaveIds declared earlier for pre-filter use)

    // Scale max_tokens generously — each outfit with 4 UUIDs ≈ 100 tokens, capsule_items ≈ 20 tokens/item
    const maxTokens = estimateMaxTokens({ outputItems: targetOutfits + maxItems, perItemTokens: 120, baseTokens: 1000, cap: 8192 });
    // Use stronger model only for long/complex trips (>7 days or 3+ outfits/day)
    const complexity: "trivial" | "standard" | "complex" = (duration_days > 7 || outfitsPerDay > 2) ? "complex" : "standard";

    const mustHaveNote = mustHaveIds.length > 0
      ? `\nMUST-HAVE items (MUST appear in capsule_items): ${mustHaveIds.join(", ")}`
      : "";

    // System prompt: English for reliability, locale instruction for content language only.
    // No JSON schema here — tool_choice handles structure.
    const systemPrompt = `${VOICE_TRAVEL_CAPSULE}

Your task: select the MINIMUM garments from the user's wardrobe that create the MOST outfit combinations for a trip.

TRIP DETAILS:
- Duration: ${duration_days} days to ${destination || "unknown destination"}
- Trip type: ${trip_type} — ${tripTypeContext}
- Weather: ${weatherDesc}
- Occasions needed: ${occasionsList}
- Outfits per day: ${outfitsPerDay}
- Target: generate exactly ${targetOutfits} outfits across all ${duration_days} days (${outfitsPerDay} per day)
- Max packing items: ${maxItems}
- Each outfit MUST have 2-5 items from different categories${mustHaveNote}
${transition_looks && duration_days >= 3 ? `- Include office→dinner transition looks: 1 per every 3-day block` : ''}

WARDROBE FORMAT: Each line is id|category|title|color|[subcategory]|[material]|[formality]|[seasons]

CRITICAL RULES:
1. Copy garment IDs EXACTLY as shown (they are full UUIDs like "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
2. Never invent or modify IDs — only use IDs from the wardrobe list
3. capsule_items = the packing list (unique garment IDs you'd pack)
4. Each outfit.items = subset of capsule_items worn together that day
5. Distribute outfits evenly: ${outfitsPerDay} outfit(s) for each of the ${duration_days} days
6. Vary items across outfits — maximize reuse of capsule items in different combinations
7. Consider weather and occasion when pairing items

Write all text content (notes, tips, reasoning) in ${LOCALE_NAMES[locale] || "English"}.`;

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
      const garmentLookup = new Map(garments.map(g => [g.id, g]));
      const tops = garments.filter(g => classifyCoreSlot(g.category, g.subcategory) === 'top').slice(0, 6);
      const bottoms = garments.filter(g => classifyCoreSlot(g.category, g.subcategory) === 'bottom').slice(0, 4);
      const dresses = garments.filter(g => classifyCoreSlot(g.category, g.subcategory) === 'dress').slice(0, 3);
      const shoes = garments.filter(g => classifyCoreSlot(g.category, g.subcategory) === 'shoes').slice(0, 3);
      const outerwear = garments.filter(g => classifyCoreSlot(g.category, g.subcategory) === 'outerwear').slice(0, 2);
      const accessories = garments.filter(g => classifyCoreSlot(g.category, g.subcategory) === 'accessory').slice(0, 2);

      const capsuleItems = Array.from(new Set([
        ...mustHaveIds,
        ...tops.map(g => g.id),
        ...bottoms.map(g => g.id),
        ...shoes.map(g => g.id),
        ...outerwear.map(g => g.id),
        ...accessories.map(g => g.id),
      ])).slice(0, maxItems);

      const totalOutfits = Math.min(targetOutfits, duration_days * outfitsPerDay);
      const outfits: any[] = [];
      for (let day = 1; day <= duration_days && outfits.length < totalOutfits; day++) {
        for (let slot = 0; slot < outfitsPerDay && outfits.length < totalOutfits; slot++) {
          const idx = outfits.length;
          const baseItems = dresses.length > 0 && (idx % Math.max(dresses.length + tops.length, 1)) < dresses.length
            ? [
                dresses[idx % Math.max(dresses.length, 1)]?.id,
                shoes[idx % Math.max(shoes.length, 1)]?.id,
              ]
            : [
                tops[idx % Math.max(tops.length, 1)]?.id,
                bottoms[idx % Math.max(bottoms.length, 1)]?.id,
                shoes[idx % Math.max(shoes.length, 1)]?.id,
              ];

          const items = baseItems.filter(Boolean) as string[];

          if ((weather?.temperature_min ?? 15) <= 12 && outerwear.length > 0) {
            items.push(outerwear[idx % outerwear.length].id);
          }

          if (items.length < 2) {
            items.push(...capsuleItems.slice(0, Math.max(0, 2 - items.length)));
          }

          const uniqueItems = Array.from(new Set(items)).slice(0, 4);
          const uniqueSlots = uniqueItems
            .map((itemId) => garmentLookup.get(itemId))
            .filter((garment): garment is GarmentRow => Boolean(garment))
            .map((garment) => classifyCoreSlot(garment.category, garment.subcategory));
          if (!isCompleteCoreOutfit(uniqueSlots)) continue;

          outfits.push({
            day,
            occasion: occasions?.[slot % Math.max(occasions?.length || 0, 1)] || "casual",
            items: uniqueItems,
            note: "A flexible core look for travel day.",
          });
        }
      }

      return {
        capsule_items: capsuleItems,
        outfits,
        packing_tips: [
              "Choose pieces that layer well.",
              "Keep a cohesive color palette for more combinations.",
              "Pack one backup pair of shoes for comfort and variation.",
            ],
        total_combinations: outfits.length,
        reasoning: "Automatic fallback was used to guarantee a complete capsule from your wardrobe.",
      };
    };

    console.log("travel_capsule v4 start", { duration_days, outfitsPerDay, garment_count: garments.length, targetOutfits, maxItems, maxTokens, complexity, trip_type, transition_looks });

    // Single attempt — fall back to deterministic on failure
    try {
        const callOpts: any = {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `WARDROBE (${garments.length} items):\n${wardrobeLines}` },
          ],
          tools,
          complexity,
          max_tokens: maxTokens,
          timeout: 35000,
          functionName: "travel_capsule",
          cacheTtlSeconds: 1800,
          cacheNamespace: "travel_capsule",
          tool_choice: { type: "function", function: { name: "create_travel_capsule" } },
        };

        console.log("travel_capsule calling AI");
        const { data: content, model_used } = await callBursAI(callOpts, supabase);

        console.log(`travel_capsule model=${model_used} type=${typeof content} truthy=${!!content}`);

        let parsed: any = null;
        if (content && typeof content === "object") {
          parsed = content;
        } else if (typeof content === "string") {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        }

        if (parsed && typeof parsed === "object" && Array.isArray(parsed.capsule_items) && Array.isArray(parsed.outfits)) {
          result = parsed;
        } else {
          lastError = new Error("AI returned invalid structure");
          console.warn("AI response invalid, keys:", parsed ? Object.keys(parsed) : "null");
        }
    } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn("travel_capsule AI call failed:", lastError.message);
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

    console.log("Resolved items (pre-validation):", resolvedItems.length, "Resolved outfits:", resolvedOutfits.length);

    // ─────────────────────────────────────────────
    // FIX 1 — RECONCILE: ensure every outfit item is in capsule_items
    // ─────────────────────────────────────────────

    // Use mutable arrays so reconciliation can extend them
    let capsule_items: any[] = resolvedItems.map((id: string) => garments.find(g => g.id === id)).filter(Boolean);
    let outfits: any[] = resolvedOutfits;
    const { packing_tips, total_combinations, reasoning } = result;

    const capsuleIds = new Set(capsule_items.map((g: any) => g.id));
    for (const outfit of outfits) {
      for (const itemId of (outfit.items ?? [])) {
        const id = typeof itemId === 'string' ? itemId : itemId?.id;
        if (id && !capsuleIds.has(id)) {
          const g = garments.find((g: any) => g.id === id);
          if (g) {
            capsule_items.push(g);
            capsuleIds.add(id);
            console.log("travel_capsule: auto-added to capsule:", id);
          }
        }
      }
    }

    // Prune: remove capsule items not used in any outfit (except must_have_items)
    const usedInOutfitSet = new Set(outfits.flatMap((o: any) => (o.items ?? []).map((i: any) => typeof i === 'string' ? i : i?.id)));
    const mustHaveIdSet = new Set((must_have_items ?? []).map((g: any) => g.id ?? g));
    capsule_items = capsule_items.filter((g: any) => usedInOutfitSet.has(g.id) || mustHaveIdSet.has(g.id));

    // ─────────────────────────────────────────────
    // IB-2c: MATRIX COVERAGE VALIDATION
    // ─────────────────────────────────────────────

    const garmentById = new Map(garments.map(g => [g.id, g]));

    // Build lookup for capsule garments by coverage slot
    const capsuleBySlot: Record<string, string[]> = {};
    for (const g of capsule_items) {
      const slot = classifyCoreSlot(g.category, g.subcategory);
      if (!capsuleBySlot[slot]) capsuleBySlot[slot] = [];
      capsuleBySlot[slot].push(g.id);
    }

    // ─────────────────────────────────────────────
    // FIX 2 — INCOMPLETE OUTFIT FALLBACK (5-level)
    // ─────────────────────────────────────────────

    const hasShoesInWardrobe = garments.some(g => classifyCoreSlot(g.category, g.subcategory) === 'shoes');

    // Helper: try to find a garment of a given slot, first from capsule then from all garments
    const pickSlot = (slot: string, exclude: Set<string>): string | null => {
      // Level 1: from capsule
      const fromCapsule = (capsuleBySlot[slot] || []).find(id => !exclude.has(id));
      if (fromCapsule) return fromCapsule;
      // Extend to full wardrobe
      const fromWardrobe = garments.find(g => classifyCoreSlot(g.category, g.subcategory) === slot && !exclude.has(g.id));
      if (fromWardrobe) {
        // Auto-add to capsule
        if (!capsuleIds.has(fromWardrobe.id)) {
          capsule_items.push(fromWardrobe);
          capsuleIds.add(fromWardrobe.id);
          if (!capsuleBySlot[slot]) capsuleBySlot[slot] = [];
          capsuleBySlot[slot].push(fromWardrobe.id);
          console.log(`travel_capsule: auto-added ${slot} to capsule for outfit completeness:`, fromWardrobe.id);
        }
        return fromWardrobe.id;
      }
      return null;
    };

    // Validate and patch each outfit
    let patchCount = 0;
    let dropCount = 0;
    const validatedOutfits: typeof resolvedOutfits = [];

    for (const outfit of outfits) {
      const slots = new Set<string>();
      for (const id of outfit.items) {
        const g = garmentById.get(id);
        if (g) slots.add(classifyCoreSlot(g.category, g.subcategory));
      }

      const isComplete = isCompleteCoreOutfit(slots);

      if (isComplete) {
        validatedOutfits.push(outfit);
        continue;
      }

      const hasDress = slots.has('dress');
      const hasTop = slots.has('top');
      const hasBottom = slots.has('bottom');
      const hasShoes = slots.has('shoes');

      const usedInOutfit = new Set(outfit.items);
      const patched = [...outfit.items];
      let wasPatched = false;

      // 5-level fallback
      const tryAdd = (slot: string) => {
        const picked = pickSlot(slot, usedInOutfit);
        if (picked) {
          patched.push(picked);
          usedInOutfit.add(picked);
          wasPatched = true;
        }
      };

      // Level 1: top + bottom + shoes (ideal)
      if (!hasDress) {
        if (!hasTop) tryAdd('top');
        if (!hasBottom) tryAdd('bottom');
        if (!hasShoes && hasShoesInWardrobe) tryAdd('shoes');
      }

      // Level 3: dress + shoes (if we got a dress but no shoes)
      if (!hasShoes && hasDress && hasShoesInWardrobe) tryAdd('shoes');

      // Re-check
      const patchedSlots = new Set<string>();
      for (const id of patched) {
        const g = garmentById.get(id) ?? capsule_items.find((c: any) => c.id === id);
        if (g) patchedSlots.add(classifyCoreSlot(g.category, g.subcategory));
      }
      const patchedComplete = isCompleteCoreOutfit(patchedSlots);

      if (patchedComplete) {
        validatedOutfits.push({ ...outfit, items: patched });
        if (wasPatched) patchCount++;
      } else {
        // Level 2: top + bottom (no shoes in wardrobe)
        if (!hasShoesInWardrobe && patchedSlots.has('top') && patchedSlots.has('bottom')) {
          validatedOutfits.push({ ...outfit, items: patched });
          if (wasPatched) patchCount++;
        // Level 4: dress only (no shoes)
        } else if (!hasShoesInWardrobe && patchedSlots.has('dress')) {
          validatedOutfits.push({ ...outfit, items: patched });
          if (wasPatched) patchCount++;
        // Level 5: any 2 garments from different categories, but must have a wearable base
        } else if (patched.length >= 2) {
          const diffCats = new Set(patched.map(id => {
            const g = garmentById.get(id) ?? capsule_items.find((c: any) => c.id === id);
            return g ? classifyCoreSlot(g.category, g.subcategory) : 'other';
          }));
          const hasBase = (diffCats.has('top') && diffCats.has('bottom')) || diffCats.has('dress');
          if (diffCats.size >= 2 && hasBase) {
            validatedOutfits.push({ ...outfit, items: patched });
            if (wasPatched) patchCount++;
          } else {
            dropCount++;
            console.warn(`Dropped incomplete outfit for day ${outfit.day}: slots=${[...patchedSlots].join(',')}`);
          }
        } else {
          dropCount++;
          console.warn(`Dropped incomplete outfit for day ${outfit.day}: slots=${[...patchedSlots].join(',')}`);
        }
      }
    }

    // Prune capsule items not used in any validated outfit
    const usedInAnyOutfit = new Set<string>();
    for (const o of validatedOutfits) {
      for (const id of o.items) usedInAnyOutfit.add(id);
    }
    // Keep must-haves even if unused
    const prunedCapsule = capsule_items.filter((g: any) => usedInAnyOutfit.has(g.id) || mustHaveIds.includes(g.id));

    console.log(`IB-2c matrix validation: ${outfits.length} outfits → ${validatedOutfits.length} valid (${patchCount} patched, ${dropCount} dropped), capsule ${capsule_items.length} → ${prunedCapsule.length} items`);

    // ─────────────────────────────────────────────
    // FIX 5 — OUTFIT NOTE QUALITY
    // ─────────────────────────────────────────────

    const BANNED_NOTE_PATTERNS = [
      /a flexible core look/i,
      /flexible core/i,
      /a considered \[?\w+\]? look/i,
    ];

    for (const outfit of validatedOutfits) {
      const hasBanned = BANNED_NOTE_PATTERNS.some(p => p.test(outfit.note ?? ''));
      if (hasBanned || !outfit.note) {
        const items = (outfit.items ?? [])
          .map((id: string) => prunedCapsule.find((g: any) => g.id === id))
          .filter(Boolean);
        if (items.length >= 2) {
          const [a, b] = items;
          outfit.note = `${a.color_primary ?? ''} ${a.title} with ${b.color_primary ?? ''} ${b.title} — ${outfit.occasion ?? 'day'} look.`.trim();
        }
      }
    }

    // ─────────────────────────────────────────────
    // FIX 4 — SAVE CAPSULE TO DB
    // ─────────────────────────────────────────────

    const packingList = prunedCapsule.map((g: any) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      color_primary: g.color_primary,
      image_path: g.image_path ?? null,
    }));

    const { error: saveError } = await supabase
      .from('travel_capsules')
      .insert({
        user_id: userId,
        destination: destination ?? null,
        trip_type: trip_type ?? 'mixed',
        duration_days: duration_days ?? 5,
        weather_min: weather?.min ?? null,
        weather_max: weather?.max ?? null,
        occasions: occasions ?? [],
        capsule_items: prunedCapsule,
        outfits: validatedOutfits,
        packing_list: packingList,
        packing_tips: packing_tips ?? null,
        total_combinations: total_combinations ?? null,
        reasoning: reasoning ?? null,
      });
    if (saveError) console.warn('travel_capsule: failed to save capsule:', saveError.message);

    return new Response(JSON.stringify({
      capsule_items: prunedCapsule,
      outfits: validatedOutfits,
      packing_tips: packing_tips || [],
      total_combinations: total_combinations || validatedOutfits.length,
      reasoning: reasoning || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("travel_capsule error:", e);
    return bursAIErrorResponse(e, corsHeaders);
  }
});
