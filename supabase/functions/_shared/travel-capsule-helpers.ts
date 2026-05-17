/**
 * Travel-capsule helpers — pure scoring, selection, candidate-build, and
 * coverage-gap logic extracted from `travel_capsule/index.ts`.
 *
 * No DB, no fetch, no Deno globals. The orchestrator still owns HTTP/auth,
 * supabase reads, AI calls, and response shaping.
 */

import {
  classifyTravelCapsuleSlot,
  isCompleteTravelCapsuleOutfitGarments,
  type TravelCapsuleCoverageGap,
  type TravelCapsuleOutfitKind,
  type TravelCapsulePlanSlot,
} from "./travel-capsule-planner.ts";

export interface GarmentRow {
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
export function hydrateGarment(raw: any): GarmentRow {
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

export function inferLayeringRole(category: string, subcategory: string | null): string {
  const both = `${category} ${subcategory || ''}`.toLowerCase();
  if (['outerwear', 'jacket', 'coat', 'blazer', 'parka'].some(c => both.includes(c))) return 'outer';
  if (['t-shirt', 'tank', 'camisole'].some(c => both.includes(c))) return 'base';
  if (['cardigan', 'sweater', 'hoodie', 'vest'].some(c => both.includes(c))) return 'mid';
  return 'standalone';
}


// ─────────────────────────────────────────────
// PACK-WORTHINESS SCORING (Phase 2)
// ─────────────────────────────────────────────

export const TRAVEL_FRIENDLY_MATERIALS: Record<string, number> = {
  denim: 8, jersey: 9, knit: 7, cotton: 7, polyester: 8, nylon: 9,
  merino: 9, wool: 5, cashmere: 4, linen: 3, silk: 3, leather: 4,
  'gore-tex': 9, softshell: 8, fleece: 7, chiffon: 2, satin: 2,
};

export function getMaterialTravelScore(material: string | null): number {
  if (!material) return 5;
  const m = material.toLowerCase();
  for (const [key, score] of Object.entries(TRAVEL_FRIENDLY_MATERIALS)) {
    if (m.includes(key)) return score;
  }
  return 5;
}

export const LUGGAGE_LIMITS: Record<string, { garments: number; shoes: number }> = {
  carry_on: { garments: 8, shoes: 2 },
  carry_on_personal: { garments: 12, shoes: 2 },
  checked: { garments: 18, shoes: 3 },
};

export function scorePackWorthiness(
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

export const TRIP_TYPE_CONTEXT: Record<string, string> = {
  business: "Prioritise formality 4+, blazers, structured trousers, dress shirts. Minimise casual items.",
  beach: "Prioritise sandals, shorts, linen tops, swimwear-adjacent. Minimise heavy outerwear.",
  winter: "Prioritise coats, knits, boots, layering pieces. Every outfit needs a warm layer.",
  casual: "Prioritise versatility, comfort. Boost garments with high versatility_score.",
  mixed: "Balance occasion coverage: at least 1 smart, 1 casual, 1 evening look.",
};

export interface ScoredGarment {
  garment: GarmentRow;
  packScore: number;
}

export interface PlannedCapsuleOutfit {
  day: number;
  date: string;
  kind: TravelCapsuleOutfitKind;
  occasion: string;
  items: string[];
  note: string;
  slotIndex?: number;
}

export interface CandidateOutfit {
  items: string[];
  score: number;
}

export function normalizeOutfitKind(value: unknown, fallback: TravelCapsuleOutfitKind = "trip_day"): TravelCapsuleOutfitKind {
  if (value === "travel_outbound" || value === "travel_return" || value === "trip_day") return value;
  return fallback;
}

export const GARMENT_CEILING = 150;

export function selectGarmentsForAI(
  scoredGarments: ScoredGarment[],
  mustHaveIds: string[],
  _minimizeItems: boolean,
  _weatherMin: number,
  _luggageLimits: { garments: number; shoes: number } = { garments: 12, shoes: 2 },
  garmentSelection: Record<string, number> | null = null,
): GarmentRow[] {
  // Group garments by their normalized capsule slot for per-category caps.
  const bySlot = new Map<string, ScoredGarment[]>();
  for (const scored of scoredGarments) {
    const slot = classifyTravelCapsuleSlot(scored.garment.category, scored.garment.subcategory);
    const list = bySlot.get(slot) || [];
    list.push(scored);
    bySlot.set(slot, list);
  }

  const selected = new Map<string, GarmentRow>();

  if (garmentSelection && typeof garmentSelection === "object") {
    // User-controlled mode: take top N by pack-score for each category.
    for (const [category, count] of Object.entries(garmentSelection)) {
      const n = Math.max(0, Math.floor(Number(count) || 0));
      if (n === 0) continue;
      const pool = bySlot.get(category) || [];
      for (const entry of pool.slice(0, n)) {
        selected.set(entry.garment.id, entry.garment);
      }
    }
  } else {
    // Default mode: take everything, already sorted by pack-worthiness.
    for (const entry of scoredGarments) {
      selected.set(entry.garment.id, entry.garment);
    }
  }

  // Always include must-haves.
  const allById = new Map(scoredGarments.map((e) => [e.garment.id, e.garment]));
  for (const id of mustHaveIds) {
    const g = allById.get(id);
    if (g) selected.set(id, g);
  }

  // Enforce the 150-item safety ceiling while always preserving must-haves.
  if (selected.size > GARMENT_CEILING) {
    const selectedOrdered = scoredGarments.filter((e) => selected.has(e.garment.id));
    const mustHaveSet = new Set(
      mustHaveIds.filter((id) => selected.has(id) && allById.has(id)),
    );

    // If a user marks more must-haves than the nominal ceiling, keep all of them
    // and only clamp non-must-have items.
    const effectiveCeiling = Math.max(GARMENT_CEILING, mustHaveSet.size);
    const nonMustHaveBudget = Math.max(0, effectiveCeiling - mustHaveSet.size);

    const clamped = new Map<string, GarmentRow>();

    // Seed with must-haves first so explicit user intent is never dropped.
    for (const id of mustHaveIds) {
      const garment = allById.get(id);
      if (garment && selected.has(id)) clamped.set(id, garment);
    }

    // Fill remaining space with highest-ranked non-must-have picks.
    for (const entry of selectedOrdered) {
      const id = entry.garment.id;
      if (mustHaveSet.has(id) || clamped.has(id)) continue;
      if (clamped.size >= mustHaveSet.size + nonMustHaveBudget) break;
      clamped.set(id, entry.garment);
    }

    return Array.from(clamped.values());
  }

  return Array.from(selected.values());
}

export function buildCoverageGaps(
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

export function buildOutfitNote(outfit: PlannedCapsuleOutfit, garmentById: Map<string, GarmentRow>): string {
  const items = outfit.items
    .map((id) => garmentById.get(id))
    .filter((garment): garment is GarmentRow => Boolean(garment));
  const core = items.slice(0, 2).map((item) => `${item.color_primary ?? ""} ${item.title}`.trim()).filter(Boolean);
  const baseText = core.length >= 2 ? `${core[0]} with ${core[1]}` : "A complete travel look";
  if (outfit.kind === "travel_outbound") return `${baseText} for your outbound travel day.`;
  if (outfit.kind === "travel_return") return `${baseText} for your return travel day.`;
  return `${baseText} for ${outfit.occasion || "the day"}.`;
}

export function buildOutfitCandidates(
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

// ─────────────────────────────────────────────
// Locale name lookup — content language for AI prompt instructions.
// ─────────────────────────────────────────────

export const LOCALE_NAMES: Record<string, string> = {
  sv: "Svenska", en: "English", no: "Norsk", da: "Dansk", fi: "Suomi",
  de: "Deutsch", fr: "Français", es: "Español", it: "Italiano",
  pt: "Português", nl: "Nederlands", pl: "Polski",
  ar: "العربية", fa: "فارسی",
};

// ─────────────────────────────────────────────
// FIX 5 — OUTFIT NOTE QUALITY: low-effort phrases the AI sometimes returns.
// ─────────────────────────────────────────────

export const BANNED_NOTE_PATTERNS: RegExp[] = [
  /a flexible core look/i,
  /flexible core/i,
  /a considered \[?\w+\]? look/i,
];

// ─────────────────────────────────────────────
// Prompt input shaping — wardrobe lines + day plan text + tool schema.
// ─────────────────────────────────────────────

// Compact wardrobe format: one line per garment, reduce input tokens
export function formatWardrobeLines(garments: GarmentRow[]): string {
  return garments.map(g => {
    const parts = [g.id, g.category, g.title, g.color_primary];
    if (g.subcategory) parts.push(g.subcategory);
    if (g.material) parts.push(g.material);
    if (g.formality != null) parts.push(`f${g.formality}`);
    if (g.season_tags?.length) parts.push(g.season_tags.join(","));
    return parts.join("|");
  }).join("\n");
}

export interface PlanningRequirement {
  day: number;
  date: string;
  looks: number;
  labels: string[];
}

export function buildPlanningRequirements(
  planningSlots: TravelCapsulePlanSlot[],
): PlanningRequirement[] {
  return planningSlots.reduce((lines, slot) => {
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
  }, [] as PlanningRequirement[]);
}

export function buildPlanningRequirementsText(
  planningRequirements: PlanningRequirement[],
  dayOccasionLabels: Record<number, string>,
): string {
  return planningRequirements
    .map((entry) => {
      const occLabel = dayOccasionLabels[entry.day];
      const occSuffix = occLabel ? ` — ${occLabel}` : "";
      return `- Day ${entry.day} (${entry.date}): ${entry.looks} look(s)${entry.labels.length > 0 ? `, ${entry.labels.join(" and ")}` : ""}${occSuffix}`;
    })
    .join("\n");
}

// Resolve an AI-emitted garment ID against the wardrobe. Falls back to
// prefix match (≥8 chars) then a normalized-title lookup before giving up
// and returning the trimmed input.
export function resolveGarmentId(
  id: string,
  validIds: Set<string>,
  allGarments: GarmentRow[],
  titleIndex: Map<string, string>,
): string {
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
}

// Use tool calling for guaranteed structured output
export const CREATE_TRAVEL_CAPSULE_TOOL = {
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
} as const;
