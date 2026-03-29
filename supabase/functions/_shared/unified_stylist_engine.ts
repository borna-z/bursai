import { CORS_HEADERS } from "./cors.ts";

export type UnifiedStylistMode = "generate" | "suggest" | "swap" | "refine";

export interface UnifiedStylistRequest {
  mode: UnifiedStylistMode;
  generator_mode?: "standard" | "stylist";
  occasion?: string;
  style?: string | null;
  weather?: {
    temperature?: number;
    precipitation?: string;
    wind?: string;
  };
  locale?: string;
  event_title?: string | null;
  prefer_garment_ids?: string[];
  exclude_garment_ids?: string[];
  active_look_garment_ids?: string[];
  locked_garment_ids?: string[];
  requested_edit_slots?: string[];
  output_count?: number;
  explanation_mode?: "short" | "detailed";
}

export interface UnifiedStylistOutfit {
  garment_ids: string[];
  score: number | null;
  confidence: number | null;
  confidence_level: string | null;
  family_label: string | null;
  rationale: string;
  wardrobe_gaps: string[];
  limitations: string[];
}

export interface UnifiedStylistResponse {
  mode: UnifiedStylistMode;
  outfits: UnifiedStylistOutfit[];
  refinement: {
    active_look_garment_ids: string[];
    locked_garment_ids: string[];
    requested_edit_slots: string[];
  };
}

function normalizeWeather(input?: UnifiedStylistRequest["weather"]) {
  return {
    temperature: typeof input?.temperature === "number" ? input.temperature : undefined,
    precipitation: typeof input?.precipitation === "string" ? input.precipitation : "none",
    wind: typeof input?.wind === "string" ? input.wind : "low",
  };
}

function normalizeIds(ids?: string[]): string[] {
  return Array.from(new Set((ids || []).filter(Boolean)));
}

export function buildAuthoritativeOutfitTag(garmentIds: string[], explanation: string): string | null {
  const ids = normalizeIds(garmentIds);
  if (!ids.length) return null;
  const sanitized = explanation.replace(/[\[\]\n\r|]+/g, " ").trim() || "Current active look";
  return `[[outfit:${ids.join(",")}|${sanitized}]]`;
}

export async function invokeUnifiedStylistEngine(params: {
  authToken: string;
  request: UnifiedStylistRequest;
}): Promise<UnifiedStylistResponse> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const request = params.request;
  const activeLookIds = normalizeIds(request.active_look_garment_ids);
  const lockedGarmentIds = normalizeIds(request.locked_garment_ids);
  const editSlots = normalizeIds(request.requested_edit_slots);
  const mode = request.mode === "refine" ? "generate" : request.mode;
  const shouldUseSwap = request.mode === "swap" && editSlots.length === 1 && activeLookIds.length > 0;
  const swapSlot = shouldUseSwap ? editSlots[0] : null;
  const currentGarmentId = shouldUseSwap
    ? (activeLookIds.find((id) => !lockedGarmentIds.includes(id)) ?? activeLookIds[0] ?? null)
    : null;
  const otherItems = shouldUseSwap
    ? activeLookIds
      .filter((id) => id !== currentGarmentId)
      .map((garmentId) => ({ slot: "unknown", garment_id: garmentId }))
    : [];

  const payload = {
    mode: shouldUseSwap ? "swap" : mode,
    generator_mode: request.generator_mode || "stylist",
    occasion: request.occasion || "everyday",
    style: request.style || null,
    weather: normalizeWeather(request.weather),
    locale: request.locale || "en",
    event_title: request.event_title || null,
    prefer_garment_ids: normalizeIds(request.prefer_garment_ids),
    exclude_garment_ids: normalizeIds(request.exclude_garment_ids),
    output_count: typeof request.output_count === "number" ? request.output_count : undefined,
    explanation_mode: request.explanation_mode || "short",
    swap_slot: swapSlot,
    current_garment_id: currentGarmentId,
    other_items: otherItems,
  };

  const response = await fetch(`${supabaseUrl}/functions/v1/burs_style_engine`, {
    method: "POST",
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.authToken}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error || `Unified stylist request failed (${response.status})`);
  }

  if (shouldUseSwap) {
    const bestSwap = Array.isArray(data?.candidates) ? data.candidates[0] : null;
    const swappedIds = bestSwap?.garment?.id
      ? [...activeLookIds.filter((id) => id !== currentGarmentId), bestSwap.garment.id]
      : activeLookIds;
    return {
      mode: request.mode,
      outfits: [{
        garment_ids: swappedIds,
        score: typeof bestSwap?.score === "number" ? bestSwap.score : null,
        confidence: typeof data?.confidence_score === "number" ? data.confidence_score : null,
        confidence_level: data?.confidence_level || null,
        family_label: null,
        rationale: bestSwap?.swap_reason || "",
        wardrobe_gaps: [],
        limitations: data?.limitation_note ? [String(data.limitation_note)] : [],
      }],
      refinement: {
        active_look_garment_ids: activeLookIds,
        locked_garment_ids: lockedGarmentIds,
        requested_edit_slots: editSlots,
      },
    };
  }

  const outfits: UnifiedStylistOutfit[] = [];
  if (Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
    for (const suggestion of data.suggestions) {
      const ids = normalizeIds(
        Array.isArray(suggestion?.garment_ids)
          ? suggestion.garment_ids
          : Array.isArray(suggestion?.garments)
            ? suggestion.garments.map((garment: { id?: string }) => garment.id || "")
            : [],
      );
      if (!ids.length) continue;
      outfits.push({
        garment_ids: ids,
        score: typeof suggestion?.score === "number" ? suggestion.score : null,
        confidence: typeof suggestion?.confidence_score === "number" ? suggestion.confidence_score : null,
        confidence_level: suggestion?.confidence_level || null,
        family_label: suggestion?.family_label || null,
        rationale: suggestion?.explanation || "",
        wardrobe_gaps: [],
        limitations: suggestion?.limitation_note ? [String(suggestion.limitation_note)] : [],
      });
    }
  }

  if (!outfits.length && Array.isArray(data?.items)) {
    outfits.push({
      garment_ids: normalizeIds(data.items.map((item: { garment_id?: string }) => item.garment_id || "")),
      score: null,
      confidence: typeof data?.confidence_score === "number" ? data.confidence_score : null,
      confidence_level: data?.confidence_level || null,
      family_label: data?.family_label || null,
      rationale: data?.explanation || "",
      wardrobe_gaps: Array.isArray(data?.wardrobe_insights)
        ? data.wardrobe_insights.filter((entry: unknown) => typeof entry === "string")
        : [],
      limitations: data?.limitation_note ? [String(data.limitation_note)] : [],
    });
  }

  return {
    mode: request.mode,
    outfits,
    refinement: {
      active_look_garment_ids: activeLookIds,
      locked_garment_ids: lockedGarmentIds,
      requested_edit_slots: editSlots,
    },
  };
}
