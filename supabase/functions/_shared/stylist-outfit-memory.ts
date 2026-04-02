export interface StylistOutfitMemorySignal {
  signal_type: string;
  outfit_id?: string | null;
  value?: string | null;
  created_at?: string | null;
}

export interface StylistOutfitMemoryItem {
  slot?: string | null;
  garment_id?: string | null;
  garments?: {
    title?: string | null;
    color_primary?: string | null;
  } | null;
}

export interface StylistOutfitMemoryOutfit {
  id: string;
  occasion?: string | null;
  style_vibe?: string | null;
  explanation?: string | null;
  worn_at?: string | null;
  generated_at?: string | null;
  outfit_items?: StylistOutfitMemoryItem[] | null;
}

export interface StylistOutfitMemorySummary {
  promptBlock: string;
  preferredGarmentIds: string[];
  successfulGarmentSets: string[][];
}

function normalizeText(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function isPositiveReaction(value: string): boolean {
  return /(love|loved|polished|sharp|balanced|great|cool|easy|clean|elevated|chic|perfect|good)/i.test(value);
}

function scoreSignal(signal: StylistOutfitMemorySignal): number {
  switch (signal.signal_type) {
    case "wear_confirm":
      return 3;
    case "save":
      return 2;
    case "planned_follow_through":
      return 2;
    case "rating": {
      const rating = Number(signal.value);
      return rating >= 4 ? 2 : 0;
    }
    case "quick_reaction":
      return signal.value && isPositiveReaction(signal.value) ? 1 : 0;
    default:
      return 0;
  }
}

function formatOutfitFormula(outfit: StylistOutfitMemoryOutfit, confidence: number): string {
  const itemSummary = (outfit.outfit_items || [])
    .map((item) => {
      const slot = normalizeText(item.slot) || "piece";
      const title = item.garments?.title?.trim() || "unknown";
      return `${slot}: ${title}`;
    })
    .filter(Boolean)
    .slice(0, 4)
    .join(" + ");

  const contextParts = [outfit.occasion, outfit.style_vibe].filter((value): value is string => Boolean(value && value.trim()));
  const context = contextParts.length > 0 ? contextParts.join("/") : "successful look";

  return `${context} -> ${itemSummary} [confidence ${confidence}]`;
}

export function deriveStylistOutfitMemory(input: {
  outfits: StylistOutfitMemoryOutfit[];
  signals: StylistOutfitMemorySignal[];
}): StylistOutfitMemorySummary {
  const positiveScores = new Map<string, number>();

  for (const signal of input.signals) {
    if (!signal.outfit_id) continue;
    const weight = scoreSignal(signal);
    if (weight <= 0) continue;
    positiveScores.set(signal.outfit_id, (positiveScores.get(signal.outfit_id) || 0) + weight);
  }

  const scoredOutfits = input.outfits
    .map((outfit) => {
      const garmentIds = Array.from(new Set(
        (outfit.outfit_items || [])
          .map((item) => item.garment_id)
          .filter((garmentId): garmentId is string => typeof garmentId === "string" && garmentId.length > 0),
      ));
      const score = (outfit.worn_at ? 3 : 0) + (positiveScores.get(outfit.id) || 0);
      return { outfit, garmentIds, score };
    })
    .filter((entry) => entry.garmentIds.length >= 2 && entry.score >= 3)
    .sort((left, right) =>
      right.score - left.score
      || (right.outfit.worn_at || right.outfit.generated_at || "").localeCompare(left.outfit.worn_at || left.outfit.generated_at || "")
    )
    .slice(0, 5);

  const garmentFrequency = new Map<string, number>();
  for (const entry of scoredOutfits) {
    for (const garmentId of entry.garmentIds) {
      garmentFrequency.set(garmentId, (garmentFrequency.get(garmentId) || 0) + 1);
    }
  }

  const preferredGarmentIds = [...garmentFrequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([garmentId]) => garmentId);

  const formulaLines = scoredOutfits
    .slice(0, 3)
    .map((entry) => formatOutfitFormula(entry.outfit, entry.score));

  const promptLines = [
    formulaLines.length > 0
      ? `Historically successful look formulas to reuse when the ask fits:\n- ${formulaLines.join("\n- ")}`
      : "",
    preferredGarmentIds.length > 0
      ? `Repeatable hero garments from successful looks: ${preferredGarmentIds.join(", ")}.`
      : "",
  ].filter(Boolean);

  return {
    promptBlock: promptLines.join("\n"),
    preferredGarmentIds,
    successfulGarmentSets: scoredOutfits.map((entry) => entry.garmentIds),
  };
}
