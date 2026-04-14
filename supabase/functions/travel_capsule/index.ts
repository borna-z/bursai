import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, bursAIErrorResponse, estimateMaxTokens } from "../_shared/burs-ai.ts";
import { VOICE_TRAVEL_CAPSULE } from "../_shared/burs-voice.ts";
import {
  buildTravelCapsulePlanSummary,
  classifyTravelCapsuleSlot,
  isCompleteTravelCapsuleOutfitGarments,
  validateTravelCapsuleOutfitGarments,
  type TravelCapsuleCoverageGap,
  type TravelCapsuleGarmentLike,
  type TravelCapsuleOutfitKind,
  type TravelCapsulePlanSlot,
} from "../_shared/travel-capsule-planner.ts";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

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

const LUGGAGE_LIMITS: Record<string, { garments: number; shoes: number }> = {
  carry_on: { garments: 8, shoes: 2 },
  carry_on_personal: { garments: 12, shoes: 2 },
  checked: { garments: 18, shoes: 3 },
};

function scorePackWorthiness(
  garment: GarmentRow,
  weatherMin: number,
  weatherMax: number,
  occasions: string[],
  allGarments: GarmentRow[],
  companions: string = 'solo',
  stylePreference: string = 'balanced',
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

  // 6. Companion adjustment + 7. Style preference adjustment (guarded by known formality)
  const rawFormality = typeof garment.formality === 'number' ? garment.formality : null;
  if (rawFormality != null) {
    if (companions === 'partner' && rawFormality >= 4) score += 0.5;
    else if (companions === 'friends' && rawFormality <= 2) score += 0.5;
    else if (companions === 'family' && rawFormality <= 2) score += 0.3;

    if (stylePreference === 'casual' && rawFormality <= 2) score += 1.0;
    else if (stylePreference === 'dressy' && rawFormality >= 4) score += 1.0;
  }

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

interface ScoredGarment {
  garment: GarmentRow;
  packScore: number;
}

interface PlannedCapsuleOutfit {
  day: number;
  date: string;
  kind: TravelCapsuleOutfitKind;
  occasion: string;
  items: string[];
  note: string;
  slotIndex?: number;
}

interface CandidateOutfit {
  items: string[];
  score: number;
}

function normalizeOutfitKind(value: unknown, fallback: TravelCapsuleOutfitKind = "trip_day"): TravelCapsuleOutfitKind {
  if (value === "travel_outbound" || value === "travel_return" || value === "trip_day") return value;
  return fallback;
}

function selectGarmentsForAI(
  scoredGarments: ScoredGarment[],
  mustHaveIds: string[],
  minimizeItems: boolean,
  weatherMin: number,
  luggageLimits: { garments: number; shoes: number } = { garments: 12, shoes: 2 },
): GarmentRow[] {
  const bySlot = new Map<string, GarmentRow[]>();
  for (const scored of scoredGarments) {
    const slot = classifyTravelCapsuleSlot(scored.garment.category, scored.garment.subcategory);
    const existing = bySlot.get(slot) || [];
    existing.push(scored.garment);
    bySlot.set(slot, existing);
  }

  const selected = new Map<string, GarmentRow>();
  const reserveSlot = (slot: string, count: number) => {
    for (const garment of (bySlot.get(slot) || []).slice(0, count)) {
      selected.set(garment.id, garment);
    }
  };

  // Shoes are constrained by luggage. Everything else is tuned proportionally
  // to the total garment budget so we don't blow past the carry-on limit.
  const garmentBudget = luggageLimits.garments;
  const nonShoeBudget = Math.max(4, garmentBudget - luggageLimits.shoes);
  const topCount = Math.max(2, Math.round(nonShoeBudget * 0.45));
  const bottomCount = Math.max(2, Math.round(nonShoeBudget * 0.28));
  const dressCount = minimizeItems ? 0 : 1;
  const outerCount = weatherMin <= 12 ? (minimizeItems ? 1 : 2) : (minimizeItems ? 0 : 1);
  const accessoryCount = minimizeItems ? 0 : 1;

  reserveSlot("shoes", luggageLimits.shoes);
  reserveSlot("dress", dressCount);
  reserveSlot("top", topCount);
  reserveSlot("bottom", bottomCount);
  reserveSlot("outerwear", outerCount);
  reserveSlot("accessory", accessoryCount);

  for (const mustHaveId of mustHaveIds) {
    const match = scoredGarments.find((entry) => entry.garment.id === mustHaveId);
    if (match) selected.set(match.garment.id, match.garment);
  }

  // Cap AI input near the luggage budget × 2 so the model has choice without
  // being overwhelmed, but never more than 40.
  const maxAiInput = Math.min(40, Math.max(20, garmentBudget * 2));
  for (const scored of scoredGarments) {
    if (selected.size >= maxAiInput) break;
    selected.set(scored.garment.id, scored.garment);
  }

  return Array.from(selected.values());
}

function buildCoverageGaps(
  garments: GarmentRow[],
  uncoveredOutfits: number,
): TravelCapsuleCoverageGap[] {
  const counts = new Map<string, number>();
  for (const garment of garments) {
    const slot = classifyTravelCapsuleSlot(garment.category, garment.subcategory);
    counts.set(slot, (counts.get(slot) || 0) + 1);
  }

  const gaps: TravelCapsuleCoverageGap[] = [];
  if ((counts.get("shoes") || 0) === 0) {
    gaps.push({
      code: "missing_shoes",
      message: "You need at least one pair of shoes to build complete travel outfits.",
      missing_slots: ["shoes"],
    });
  }
  if ((counts.get("top") || 0) === 0 && (counts.get("dress") || 0) === 0) {
    gaps.push({
      code: "missing_top",
      message: "You need a top or a dress to build complete travel outfits.",
      missing_slots: ["top", "dress"],
    });
  }
  if ((counts.get("bottom") || 0) === 0 && (counts.get("dress") || 0) === 0) {
    gaps.push({
      code: "missing_bottom",
      message: "You need a bottom or a dress to build complete travel outfits.",
      missing_slots: ["bottom", "dress"],
    });
  }
  if ((counts.get("dress") || 0) === 0 && ((counts.get("top") || 0) === 0 || (counts.get("bottom") || 0) === 0)) {
    gaps.push({
      code: "missing_dress_or_separates",
      message: "This wardrobe does not have enough dresses or separates to cover every planned look.",
      missing_slots: ["dress", "top", "bottom"],
    });
  }
  if (uncoveredOutfits > 0) {
    gaps.push({
      code: "insufficient_complete_outfits",
      message: `I could not build ${uncoveredOutfits} of your requested looks as complete outfits with this wardrobe.`,
      uncovered_outfits: uncoveredOutfits,
    });
  }
  return gaps;
}

function buildOutfitNote(outfit: PlannedCapsuleOutfit, garmentById: Map<string, GarmentRow>): string {
  const items = outfit.items
    .map((id) => garmentById.get(id))
    .filter((garment): garment is GarmentRow => Boolean(garment));
  const core = items.slice(0, 2).map((item) => `${item.color_primary ?? ""} ${item.title}`.trim()).filter(Boolean);
  const baseText = core.length >= 2 ? `${core[0]} with ${core[1]}` : "A complete travel look";
  if (outfit.kind === "travel_outbound") return `${baseText} for your outbound travel day.`;
  if (outfit.kind === "travel_return") return `${baseText} for your return travel day.`;
  return `${baseText} for ${outfit.occasion || "the day"}.`;
}

function buildOutfitCandidates(
  garments: GarmentRow[],
  scoreById: Map<string, number>,
  weatherMin: number,
): CandidateOutfit[] {
  const tops = garments.filter((garment) => classifyTravelCapsuleSlot(garment.category, garment.subcategory) === "top").slice(0, 8);
  const bottoms = garments.filter((garment) => classifyTravelCapsuleSlot(garment.category, garment.subcategory) === "bottom").slice(0, 6);
  const dresses = garments.filter((garment) => classifyTravelCapsuleSlot(garment.category, garment.subcategory) === "dress").slice(0, 5);
  const shoes = garments.filter((garment) => classifyTravelCapsuleSlot(garment.category, garment.subcategory) === "shoes").slice(0, 4);
  const outerwear = garments.filter((garment) => classifyTravelCapsuleSlot(garment.category, garment.subcategory) === "outerwear").slice(0, 3);
  const includeOuterwear = weatherMin <= 12 && outerwear.length > 0;
  const candidates: CandidateOutfit[] = [];

  for (const dress of dresses) {
    for (const shoe of shoes) {
      const items = includeOuterwear ? [dress.id, shoe.id, outerwear[0].id] : [dress.id, shoe.id];
      const candidateGarments = items.map((id) => garments.find((garment) => garment.id === id)).filter((garment): garment is GarmentRow => Boolean(garment));
      if (!isCompleteTravelCapsuleOutfitGarments(candidateGarments)) continue;
      candidates.push({
        items,
        score: items.reduce((sum, id) => sum + (scoreById.get(id) || 0), 0),
      });
    }
  }

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        const items = includeOuterwear ? [top.id, bottom.id, shoe.id, outerwear[0].id] : [top.id, bottom.id, shoe.id];
        const candidateGarments = items.map((id) => garments.find((garment) => garment.id === id)).filter((garment): garment is GarmentRow => Boolean(garment));
        if (!isCompleteTravelCapsuleOutfitGarments(candidateGarments)) continue;
        candidates.push({
          items,
          score: items.reduce((sum, id) => sum + (scoreById.get(id) || 0), 0),
        });
      }
    }
  }

  return candidates
    .map((candidate) => ({ ...candidate, items: Array.from(new Set(candidate.items)) }))
    .filter((candidate) => candidate.items.length >= 2)
    .sort((a, b) => b.score - a.score);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (checkOverload("travel_capsule")) {
    return overloadResponse(CORS_HEADERS);
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

    await enforceRateLimit(supabase, userId, "travel_capsule");

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
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
      return new Response(JSON.stringify({ capsules: data ?? [] }), { status: 200, headers: CORS_HEADERS });
    }

    // ─────────────────────────────────────────────
    // FIX 3 — Accept new request fields
    // ─────────────────────────────────────────────
    const {
      destination,
      weather,
      occasions = [],
      locale = "en",
      outfits_per_day = 1,
      must_have_items = [],
      trip_type = "mixed",
      start_date,
      end_date,
      minimize_items = true,
      include_travel_days = false,
      transition_looks = false,
      luggage_type = "carry_on_personal",
      companions = "solo",
      style_preference = "balanced",
    } = await req.json();

    const luggageLimits = LUGGAGE_LIMITS[luggage_type] ?? LUGGAGE_LIMITS.carry_on_personal;

    const outfitsPerDay = Math.max(1, Math.min(4, outfits_per_day || 1));

    // Derive trip length from dates and build the exact planning slots up front.
    if (!start_date || !end_date) {
      throw new Error("start_date and end_date are required");
    }

    const planningSummary = buildTravelCapsulePlanSummary(
      start_date,
      end_date,
      outfitsPerDay,
      include_travel_days,
    );
    const duration_days = planningSummary.tripDays;
    const requiredOutfits = planningSummary.requiredOutfits;
    const planningSlots = planningSummary.slots;

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
    const scoredGarments: ScoredGarment[] = allGarments.map(g => ({
      garment: g,
      packScore: scorePackWorthiness(
        g,
        weatherMin,
        weatherMax,
        occasions || [],
        allGarments,
        companions,
        style_preference,
      ),
    })).sort((a, b) => b.packScore - a.packScore);

    // Must-have items — declared early so pre-filter can use them
    const preValidIds = new Set(allGarments.map(g => g.id));
    const mustHaveIds: string[] = (must_have_items || []).filter((id: string) => preValidIds.has(id));

    // Send top 40 most packable garments to AI (reduces input size, improves quality)
    const garments = selectGarmentsForAI(
      scoredGarments,
      mustHaveIds,
      Boolean(minimize_items),
      weatherMin,
      luggageLimits,
    );
    const allGarmentById = new Map(allGarments.map((garment) => [garment.id, garment]));
    const scoreById = new Map(scoredGarments.map((entry) => [entry.garment.id, entry.packScore]));

    console.log(`travel_capsule pack-worthiness: ${allGarments.length} total → ${garments.length} sent to AI (top scores: ${scoredGarments.slice(0, 3).map(s => s.packScore.toFixed(1)).join(', ')})`);

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

    const maxItems = Boolean(minimize_items)
      ? Math.min(Math.max(8, Math.ceil(requiredOutfits * 1.5)), 18)
      : Math.min(Math.max(10, Math.ceil(requiredOutfits * 2.2)), 28);

    // FIX 3 — trip type context string
    const tripTypeContext = TRIP_TYPE_CONTEXT[trip_type] ?? TRIP_TYPE_CONTEXT.mixed;

    // Build valid ID set and lookup structures early
    const validIds = new Set(allGarments.map(g => g.id));
    const titleIndex = new Map(allGarments.map(g => [g.title.toLowerCase().trim(), g.id]));

    // (mustHaveIds declared earlier for pre-filter use)

    // Scale max_tokens generously — each outfit with 4 UUIDs ≈ 100 tokens, capsule_items ≈ 20 tokens/item
    const maxTokens = estimateMaxTokens({ outputItems: requiredOutfits + maxItems, perItemTokens: 120, baseTokens: 1000, cap: 8192 });
    // Use stronger model only for long/complex trips (>7 days or 3+ outfits/day)
    const complexity: "trivial" | "standard" | "complex" = (duration_days > 7 || outfitsPerDay > 2) ? "complex" : "standard";

    const mustHaveNote = mustHaveIds.length > 0
      ? `\nMUST-HAVE items (MUST appear in capsule_items): ${mustHaveIds.join(", ")}`
      : "";
    const planningRequirements = planningSlots.reduce((lines, slot) => {
      const last = lines.at(-1);
      const label = slot.kind === "travel_outbound"
        ? "plus one outbound travel look"
        : slot.kind === "travel_return"
          ? "plus one return travel look"
          : null;

      if (!last || last.day !== slot.day) {
        lines.push({
          day: slot.day,
          date: slot.date,
          looks: 1,
          labels: label ? [label] : [],
        });
        return lines;
      }

      last.looks += 1;
      if (label) last.labels.push(label);
      return lines;
    }, [] as Array<{ day: number; date: string; looks: number; labels: string[] }>);
    // Distribute occasions across trip days. Each day gets 1-2 occasions from
    // the selected set, rotating so every occasion appears at least once.
    const occasionList: string[] = Array.isArray(occasions) ? occasions.filter((o: unknown) => typeof o === "string") : [];
    const dayOccasionLabels: Record<number, string> = {};
    if (occasionList.length > 0) {
      planningRequirements.forEach((entry, idx) => {
        dayOccasionLabels[entry.day] = occasionList[idx % occasionList.length];
      });
    }

    const planningRequirementsText = planningRequirements
      .map((entry) => {
        const occLabel = dayOccasionLabels[entry.day];
        const occSuffix = occLabel ? ` — ${occLabel}` : "";
        return `- Day ${entry.day} (${entry.date}): ${entry.looks} look(s)${entry.labels.length > 0 ? `, ${entry.labels.join(" and ")}` : ""}${occSuffix}`;
      })
      .join("\n");
    const packingDirective = Boolean(minimize_items)
      ? "Choose the smallest complete capsule that can cover the trip."
      : "Choose a balanced capsule with a little redundancy for comfort and variation.";

    // System prompt: English for reliability, locale instruction for content language only.
    // No JSON schema here — tool_choice handles structure.
    const systemPrompt = `${VOICE_TRAVEL_CAPSULE}

Your task: build a smart travel capsule from the user's wardrobe.

TRIP DETAILS:
- Dates: ${start_date} to ${end_date} (${duration_days} trip day(s), ${planningSummary.tripNights} night(s))
- Destination: ${destination || "unknown destination"}
${occasionList.length === 0 ? `- Trip type: ${trip_type} - ${tripTypeContext}` : ''}
- Weather: ${weatherDesc}
- Luggage: ${luggage_type} (≤${luggageLimits.garments} garments, ≤${luggageLimits.shoes} pairs of shoes)
- Companions: ${companions}
- Style lean: ${style_preference}
- Occasions needed: ${occasionsList}
- Base outfits per day: ${outfitsPerDay}
- Required complete looks: ${requiredOutfits}
- Packing mode: ${Boolean(minimize_items) ? "minimal" : "balanced"} - ${packingDirective}
- Max packing items: ${maxItems}
- Day plan:
${planningRequirementsText}${mustHaveNote}

WARDROBE FORMAT: Each line is id|category|title|color|[subcategory]|[material]|[formality]|[seasons]

CRITICAL RULES:
1. Copy garment IDs EXACTLY as shown (they are full UUIDs like "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
2. Never invent or modify IDs — only use IDs from the wardrobe list
3. capsule_items = the packing list (unique garment IDs you'd pack)
4. Each outfit.items = subset of capsule_items worn together that day
5. A valid outfit MUST be either:
   - top + bottom + shoes
   - dress + shoes
   Outerwear and one accessory are optional
6. Never output partial looks, missing-shoes looks, or duplicate core slots
7. Cover the exact day plan above and return one outfit object per required look
8. Vary items across outfits while keeping the capsule coherent
9. Consider weather and occasion when pairing items

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
                  date: { type: "string" },
                  kind: { type: "string", description: "trip_day, travel_outbound, or travel_return" },
                  occasion: { type: "string" },
                  items: { type: "array", items: { type: "string" }, description: "Garment UUIDs for this outfit" },
                  note: { type: "string" }
                },
                required: ["day", "date", "kind", "occasion", "items", "note"]
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

    const buildDeterministicFallback = (seedCapsuleIds: string[] = []) => {
      const seedGarments = [
        ...seedCapsuleIds.map((id) => allGarmentById.get(id)),
        ...mustHaveIds.map((id) => allGarmentById.get(id)),
        ...garments,
        ...allGarments,
      ].filter((garment): garment is GarmentRow => Boolean(garment));
      const pool = Array.from(new Map(seedGarments.map((garment) => [garment.id, garment])).values());
      const candidates = buildOutfitCandidates(pool, scoreById, weatherMin);
      const capsuleMap = new Map<string, GarmentRow>();
      const usageCount = new Map<string, number>();
      const usedComboKeys = new Set<string>();
      const outfits: PlannedCapsuleOutfit[] = [];

      for (const seedId of [...mustHaveIds, ...seedCapsuleIds]) {
        const garment = allGarmentById.get(seedId);
        if (garment) capsuleMap.set(garment.id, garment);
      }

      const chooseCandidate = (respectCap: boolean): CandidateOutfit | null => {
        let bestCandidate: CandidateOutfit | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const candidate of candidates) {
          const comboKey = candidate.items.slice().sort().join(",");
          const newItems = candidate.items.filter((id) => !capsuleMap.has(id));
          if (respectCap && capsuleMap.size + newItems.length > maxItems) continue;

          const reuseCount = candidate.items.reduce((sum, id) => sum + (usageCount.get(id) || 0), 0);
          const adjustedScore = candidate.score
            - (Boolean(minimize_items) ? newItems.length * 7 : newItems.length * 3)
            - (!Boolean(minimize_items) ? reuseCount * 0.6 : 0)
            - (usedComboKeys.has(comboKey) ? 4 : 0);

          if (adjustedScore > bestScore) {
            bestCandidate = candidate;
            bestScore = adjustedScore;
          }
        }

        return bestCandidate;
      };

      for (const slot of planningSlots) {
        let candidate = chooseCandidate(true);
        if (!candidate) candidate = chooseCandidate(false);
        if (!candidate) continue;

        const candidateGarments = candidate.items
          .map((id) => allGarmentById.get(id))
          .filter((garment): garment is GarmentRow => Boolean(garment));
        if (!isCompleteTravelCapsuleOutfitGarments(candidateGarments)) continue;

        const comboKey = candidate.items.slice().sort().join(",");
        for (const garment of candidateGarments) {
          capsuleMap.set(garment.id, garment);
          usageCount.set(garment.id, (usageCount.get(garment.id) || 0) + 1);
        }
        usedComboKeys.add(comboKey);

        outfits.push({
          day: slot.day,
          date: slot.date,
          kind: slot.kind,
          occasion: slot.kind === "trip_day"
            ? (occasions?.[(slot.day + slot.slotIndex) % Math.max(occasions.length || 0, 1)] || "casual")
            : "travel",
          items: candidate.items,
          note: "",
          slotIndex: slot.slotIndex,
        });
      }

      return {
        capsule_items: Array.from(capsuleMap.values()),
        outfits,
        packing_tips: [
          "Choose pieces that layer well.",
          "Keep a cohesive color palette for more combinations.",
          "Pack one reliable pair of shoes for every complete look.",
        ],
        total_combinations: outfits.length,
        reasoning: "Automatic fallback planned complete travel outfits from your wardrobe.",
      };
    };

    console.log("travel_capsule v5 start", {
      duration_days,
      trip_nights: planningSummary.tripNights,
      outfitsPerDay,
      requiredOutfits,
      garment_count: garments.length,
      maxItems,
      maxTokens,
      complexity,
      trip_type,
      transition_looks,
      include_travel_days,
      minimize_items,
    });

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
        const match = allGarments.find(g => g.id.startsWith(trimmed) || g.id.includes(trimmed));
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
      day: Math.max(1, Math.min(duration_days, Number(o.day) || 1)),
      date: typeof o.date === "string" ? o.date : start_date,
      kind: normalizeOutfitKind(o.kind),
      occasion: typeof o.occasion === "string" ? o.occasion : "casual",
      items: (o.items || []).map(resolveId).filter((id: string) => validIds.has(id)),
      note: typeof o.note === "string" ? o.note : "",
    })).filter((o: any) => o.items.length >= 2);

    if (resolvedItems.length === 0 || resolvedOutfits.length === 0) {
      console.warn("Resolved capsule is empty, applying deterministic fallback mapping");
      const fallback = buildDeterministicFallback();
      resolvedItems = fallback.capsule_items.map((garment: GarmentRow) => garment.id).filter((id: string) => validIds.has(id));
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
    let capsule_items: any[] = resolvedItems.map((id: string) => allGarmentById.get(id)).filter(Boolean);
    let outfits: any[] = resolvedOutfits;
    const { packing_tips, total_combinations, reasoning } = result;

    const capsuleIds = new Set(capsule_items.map((g: any) => g.id));
    for (const outfit of outfits) {
      for (const itemId of (outfit.items ?? [])) {
        const id = typeof itemId === 'string' ? itemId : itemId?.id;
        if (id && !capsuleIds.has(id)) {
          const g = allGarmentById.get(id);
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

    const garmentById = allGarmentById;

    // Build lookup for capsule garments by coverage slot
    const capsuleBySlot: Record<string, string[]> = {};
    for (const g of capsule_items) {
      const slot = classifyTravelCapsuleSlot(g.category, g.subcategory);
      if (!capsuleBySlot[slot]) capsuleBySlot[slot] = [];
      capsuleBySlot[slot].push(g.id);
    }

    // ─────────────────────────────────────────────
    // FIX 2 — INCOMPLETE OUTFIT FALLBACK (5-level)
    // ─────────────────────────────────────────────

    const hasShoesInWardrobe = allGarments.some(g => classifyTravelCapsuleSlot(g.category, g.subcategory) === 'shoes');

    // Helper: try to find a garment of a given slot, first from capsule then from all garments
    const pickSlot = (slot: string, exclude: Set<string>): string | null => {
      // Level 1: from capsule
      const fromCapsule = (capsuleBySlot[slot] || []).find(id => !exclude.has(id));
      if (fromCapsule) return fromCapsule;
      // Extend to full wardrobe
      const fromWardrobe = allGarments.find(g => classifyTravelCapsuleSlot(g.category, g.subcategory) === slot && !exclude.has(g.id));
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
      const outfitGarments = outfit.items
        .map((id: string) => garmentById.get(id))
        .filter((garment): garment is GarmentRow => Boolean(garment));
      let validation = validateTravelCapsuleOutfitGarments(outfitGarments as TravelCapsuleGarmentLike[]);
      const isComplete = validation.isComplete;

      if (isComplete) {
        validatedOutfits.push(outfit);
        continue;
      }

      const presentSlots = new Set(validation.presentSlots);
      const hasDress = presentSlots.has('dress');
      const hasTop = presentSlots.has('top');
      const hasBottom = presentSlots.has('bottom');
      const hasShoes = presentSlots.has('shoes');

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
      const patchedGarments = patched
        .map((id) => garmentById.get(id) ?? capsule_items.find((c: any) => c.id === id))
        .filter((garment): garment is GarmentRow => Boolean(garment));
      validation = validateTravelCapsuleOutfitGarments(patchedGarments as TravelCapsuleGarmentLike[]);
      const patchedComplete = validation.isComplete;

      if (patchedComplete) {
        validatedOutfits.push({ ...outfit, items: patched });
        if (wasPatched) patchCount++;
      } else {
        dropCount++;
        console.warn(`Dropped incomplete outfit for day ${outfit.day}: slots=${validation.presentSlots.join(',')}`);
      }
    }

    // Prune capsule items not used in any validated outfit
    const planningSlotKey = (slot: { day: number; kind: TravelCapsuleOutfitKind; slotIndex?: number }) =>
      `${slot.day}:${slot.kind}:${slot.slotIndex ?? 0}`;
    const remainingPlanningSlots = [...planningSlots];
    const scheduledOutfits: PlannedCapsuleOutfit[] = [];

    for (const outfit of validatedOutfits) {
      const exactIndex = remainingPlanningSlots.findIndex((slot) =>
        slot.day === outfit.day && normalizeOutfitKind(outfit.kind, "trip_day") === slot.kind,
      );
      const claimedSlot = exactIndex >= 0
        ? remainingPlanningSlots.splice(exactIndex, 1)[0]
        : remainingPlanningSlots.find((slot) => slot.day === outfit.day);

      if (!claimedSlot) continue;
      if (exactIndex < 0) {
        remainingPlanningSlots.splice(remainingPlanningSlots.indexOf(claimedSlot), 1);
      }

      scheduledOutfits.push({
        ...outfit,
        day: claimedSlot.day,
        date: claimedSlot.date,
        kind: claimedSlot.kind,
        occasion: claimedSlot.kind === "trip_day" ? outfit.occasion : "travel",
        slotIndex: claimedSlot.slotIndex,
      });
    }

    const fallback = buildDeterministicFallback([
      ...resolvedItems,
      ...scheduledOutfits.flatMap((outfit) => outfit.items),
    ]);
    const fallbackOutfitByKey = new Map(
      fallback.outfits.map((outfit: PlannedCapsuleOutfit) => [planningSlotKey(outfit), outfit]),
    );

    for (const slot of remainingPlanningSlots) {
      const fallbackOutfit = fallbackOutfitByKey.get(planningSlotKey(slot));
      if (fallbackOutfit) scheduledOutfits.push(fallbackOutfit);
    }

    scheduledOutfits.sort((a, b) => a.day - b.day || (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

    const usedInAnyOutfit = new Set<string>();
    for (const o of scheduledOutfits) {
      for (const id of o.items) usedInAnyOutfit.add(id);
    }
    const prunedCapsule = Array.from(new Map(
      [...capsule_items, ...fallback.capsule_items]
        .filter((g: any) => usedInAnyOutfit.has(g.id) || mustHaveIds.includes(g.id))
        .map((g: any) => [g.id, g]),
    ).values());
    const coverage_gaps = buildCoverageGaps(allGarments, Math.max(0, requiredOutfits - scheduledOutfits.length));

    console.log(`IB-2c matrix validation: ${outfits.length} outfits -> ${scheduledOutfits.length} scheduled (${patchCount} patched, ${dropCount} dropped), capsule ${capsule_items.length} -> ${prunedCapsule.length} items`);

    // ─────────────────────────────────────────────
    // FIX 5 — OUTFIT NOTE QUALITY
    // ─────────────────────────────────────────────

    const BANNED_NOTE_PATTERNS = [
      /a flexible core look/i,
      /flexible core/i,
      /a considered \[?\w+\]? look/i,
    ];

    for (const outfit of scheduledOutfits) {
      const hasBanned = BANNED_NOTE_PATTERNS.some(p => p.test(outfit.note ?? ''));
      if (hasBanned || !outfit.note) {
        const items = (outfit.items ?? [])
          .map((id: string) => prunedCapsule.find((g: any) => g.id === id))
          .filter(Boolean);
        if (items.length >= 2) {
          const [a, b] = items;
          outfit.note = `${a.color_primary ?? ''} ${a.title} with ${b.color_primary ?? ''} ${b.title} - ${outfit.occasion ?? 'day'} look.`.trim();
        }
      }
    }

    // ─────────────────────────────────────────────
    // Clamp capsule to luggage garment budget — preserve items used by outfits
    // ─────────────────────────────────────────────

    let clampedCapsule: GarmentRow[] = prunedCapsule as GarmentRow[];
    if (clampedCapsule.length > luggageLimits.garments) {
      const usedIds = new Set<string>();
      for (const outfit of scheduledOutfits) {
        for (const id of outfit.items ?? []) usedIds.add(id);
      }
      const itemId = (item: any) => typeof item === 'string' ? item : item?.id;
      const kept = clampedCapsule.filter((item: any) => usedIds.has(itemId(item)));
      const extras = clampedCapsule.filter((item: any) => !usedIds.has(itemId(item)));
      clampedCapsule = [...kept, ...extras].slice(0, luggageLimits.garments);
    }

    // ─────────────────────────────────────────────
    // FIX 4 — SAVE CAPSULE TO DB
    // ─────────────────────────────────────────────

    const packingList = clampedCapsule.map((g: any) => ({
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
        weather_min: weather?.temperature_min ?? null,
        weather_max: weather?.temperature_max ?? null,
        occasions: occasions ?? [],
        capsule_items: clampedCapsule,
        outfits: scheduledOutfits,
        packing_list: packingList,
        packing_tips: packing_tips ?? null,
        total_combinations: total_combinations ?? scheduledOutfits.length,
        reasoning: [reasoning, ...coverage_gaps.map((gap) => gap.message)].filter(Boolean).join(' ') || null,
      });
    if (saveError) console.warn('travel_capsule: failed to save capsule:', saveError.message);

    return new Response(JSON.stringify({
      capsule_items: clampedCapsule,
      outfits: scheduledOutfits,
      packing_tips: packing_tips || [],
      coverage_gaps,
      total_combinations: total_combinations || scheduledOutfits.length,
      reasoning: [reasoning, ...coverage_gaps.map((gap) => gap.message)].filter(Boolean).join(' ') || "",
    }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitResponse(e, CORS_HEADERS);
    }
    console.error("travel_capsule error:", e);
    return bursAIErrorResponse(e, CORS_HEADERS);
  }
});
