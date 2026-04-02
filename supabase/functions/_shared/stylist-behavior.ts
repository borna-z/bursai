export interface StylistBehaviorSignal {
  signal_type: string;
  outfit_id?: string | null;
  garment_id?: string | null;
  value?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface StylistBehaviorOutfitItem {
  outfit_id: string;
  garment_id: string;
}

export interface StylistBehaviorGarment {
  id: string;
  title: string;
  category: string;
  color_primary: string | null;
}

export interface StylistBehaviorPairRecord {
  garment_a_id: string;
  garment_b_id: string;
  positive_count: number;
  negative_count: number;
}

export interface StylistBehaviorProfile {
  preferredGarmentIds: string[];
  avoidedGarmentIds: string[];
  preferredColors: string[];
  avoidedColors: string[];
  favoredPairKeys: string[];
  avoidedPairKeys: string[];
  summaryLines: string[];
}

export interface RankedBehaviorCandidate {
  score: number;
  reasons: string[];
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').toLowerCase().trim();
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function getOutfitGarmentIds(
  signal: StylistBehaviorSignal,
  outfitItemsByOutfit: Map<string, string[]>,
): string[] {
  const fromMetadata = Array.isArray(signal.metadata?.garment_ids)
    ? signal.metadata?.garment_ids.filter((id): id is string => typeof id === 'string')
    : [];
  if (fromMetadata.length > 0) return Array.from(new Set(fromMetadata));
  if (signal.outfit_id && outfitItemsByOutfit.has(signal.outfit_id)) {
    return outfitItemsByOutfit.get(signal.outfit_id) || [];
  }
  return [];
}

function addWeight(map: Map<string, number>, ids: string[], weight: number) {
  ids.forEach((id) => map.set(id, (map.get(id) || 0) + weight));
}

function isPositiveReaction(value: string): boolean {
  return /(love|loved|polished|sharp|balanced|great|cool|easy|clean|elevated|chic)/i.test(value);
}

function isNegativeReaction(value: string): boolean {
  return /(too|not|bad|off|wrong|boring|awkward|warm|cold|formal|casual|busy|flat)/i.test(value);
}

export function deriveStylistBehaviorProfile(input: {
  signals: StylistBehaviorSignal[];
  outfitItems: StylistBehaviorOutfitItem[];
  garments: StylistBehaviorGarment[];
  pairMemory: StylistBehaviorPairRecord[];
}): StylistBehaviorProfile {
  const positiveGarments = new Map<string, number>();
  const negativeGarments = new Map<string, number>();
  const garmentsById = new Map(input.garments.map((garment) => [garment.id, garment]));
  const outfitItemsByOutfit = new Map<string, string[]>();
  input.outfitItems.forEach((item) => {
    const existing = outfitItemsByOutfit.get(item.outfit_id) || [];
    existing.push(item.garment_id);
    outfitItemsByOutfit.set(item.outfit_id, existing);
  });

  for (const signal of input.signals) {
    const signalValue = normalizeText(signal.value);
    const outfitGarmentIds = getOutfitGarmentIds(signal, outfitItemsByOutfit);

    switch (signal.signal_type) {
      case 'save':
        addWeight(positiveGarments, outfitGarmentIds, 2);
        break;
      case 'wear_confirm':
        addWeight(positiveGarments, outfitGarmentIds, 3);
        break;
      case 'planned_follow_through':
        addWeight(positiveGarments, outfitGarmentIds, 2);
        break;
      case 'planned_skip':
      case 'ignore':
        addWeight(negativeGarments, outfitGarmentIds, 2);
        break;
      case 'rating': {
        const rating = Number(signal.value);
        if (rating >= 4) addWeight(positiveGarments, outfitGarmentIds, 2);
        if (rating > 0 && rating <= 2) addWeight(negativeGarments, outfitGarmentIds, 2);
        break;
      }
      case 'swap_choice':
        if (signal.garment_id) {
          addWeight(positiveGarments, [signal.garment_id], 2);
        }
        if (typeof signal.metadata?.replaced === 'string') {
          addWeight(negativeGarments, [signal.metadata.replaced], 1);
        }
        break;
      case 'quick_reaction':
        if (outfitGarmentIds.length > 0 && signalValue) {
          if (isPositiveReaction(signalValue)) addWeight(positiveGarments, outfitGarmentIds, 1);
          if (isNegativeReaction(signalValue)) addWeight(negativeGarments, outfitGarmentIds, 1);
        }
        break;
      default:
        if (signal.garment_id && /(reject|dislike|thumbs_down)/i.test(signal.signal_type)) {
          addWeight(negativeGarments, [signal.garment_id], 2);
        }
        break;
    }
  }

  const preferredGarmentIds = [...positiveGarments.entries()]
    .filter(([garmentId, weight]) => weight >= 2 && (negativeGarments.get(garmentId) || 0) < weight)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([garmentId]) => garmentId);

  const avoidedGarmentIds = [...negativeGarments.entries()]
    .filter(([garmentId, weight]) => weight >= 2 && weight >= (positiveGarments.get(garmentId) || 0))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([garmentId]) => garmentId);

  const preferredColors = Array.from(new Set(
    preferredGarmentIds
      .map((garmentId) => garmentsById.get(garmentId)?.color_primary)
      .filter((color): color is string => typeof color === 'string' && color.length > 0)
      .map((color) => normalizeText(color)),
  )).slice(0, 3);

  const avoidedColors = Array.from(new Set(
    avoidedGarmentIds
      .map((garmentId) => garmentsById.get(garmentId)?.color_primary)
      .filter((color): color is string => typeof color === 'string' && color.length > 0),
  )).slice(0, 3);

  const favoredPairKeys = input.pairMemory
    .filter((pair) => pair.positive_count >= 2 && pair.positive_count > pair.negative_count)
    .sort((a, b) => b.positive_count - a.positive_count)
    .slice(0, 6)
    .map((pair) => pairKey(pair.garment_a_id, pair.garment_b_id));

  const avoidedPairKeys = input.pairMemory
    .filter((pair) => pair.negative_count >= 2 && pair.negative_count >= pair.positive_count)
    .sort((a, b) => b.negative_count - a.negative_count)
    .slice(0, 6)
    .map((pair) => pairKey(pair.garment_a_id, pair.garment_b_id));

  const summaryLines = [
    preferredGarmentIds.length > 0
      ? `Behavior-backed hero pieces: ${preferredGarmentIds.slice(0, 3).map((garmentId) => garmentsById.get(garmentId)?.title || garmentId).join(', ')}.`
      : '',
    preferredColors.length > 0
      ? `Behavior-backed colors: ${preferredColors.join(', ')}.`
      : '',
    avoidedColors.length > 0
      ? `Ease off weak color repeats around: ${avoidedColors.join(', ')}.`
      : '',
    avoidedGarmentIds.length > 0
      ? `Avoid weak repeats around: ${avoidedGarmentIds.slice(0, 2).map((garmentId) => garmentsById.get(garmentId)?.title || garmentId).join(', ')}.`
      : '',
    favoredPairKeys.length > 0
      ? `Prioritize proven pairings when they still fit the ask.`
      : '',
  ].filter(Boolean);

  return {
    preferredGarmentIds,
    avoidedGarmentIds,
    preferredColors,
    avoidedColors,
    favoredPairKeys,
    avoidedPairKeys,
    summaryLines,
  };
}

export function scoreBehavioralCandidate(params: {
  garmentIds: string[];
  garments: StylistBehaviorGarment[];
  profile: StylistBehaviorProfile;
  recentGarmentSets: string[][];
}): RankedBehaviorCandidate {
  const garmentIds = Array.from(new Set(params.garmentIds));
  const garmentsById = new Map(params.garments.map((garment) => [garment.id, garment]));
  let score = 0;
  const reasons: string[] = [];

  const preferredHits = garmentIds.filter((garmentId) => params.profile.preferredGarmentIds.includes(garmentId)).length;
  if (preferredHits > 0) {
    score += preferredHits * 2;
    reasons.push(`preferred-garments:${preferredHits}`);
  }

  const avoidedHits = garmentIds.filter((garmentId) => params.profile.avoidedGarmentIds.includes(garmentId)).length;
  if (avoidedHits > 0) {
    score -= avoidedHits * 3;
    reasons.push(`avoided-garments:${avoidedHits}`);
  }

  const uniqueColors = new Set(
    garmentIds
      .map((garmentId) => normalizeText(garmentsById.get(garmentId)?.color_primary))
      .filter(Boolean),
  );
  const preferredColorHits = [...uniqueColors].filter((color) => params.profile.preferredColors.includes(color)).length;
  if (preferredColorHits > 0) {
    score += preferredColorHits;
    reasons.push(`preferred-colors:${preferredColorHits}`);
  }

  const avoidedColorHits = [...uniqueColors].filter((color) => params.profile.avoidedColors.includes(color)).length;
  if (avoidedColorHits > 0) {
    score -= avoidedColorHits * 2;
    reasons.push(`avoided-colors:${avoidedColorHits}`);
  }

  for (let index = 0; index < garmentIds.length; index += 1) {
    for (let inner = index + 1; inner < garmentIds.length; inner += 1) {
      const key = pairKey(garmentIds[index], garmentIds[inner]);
      if (params.profile.favoredPairKeys.includes(key)) {
        score += 3;
        reasons.push('favored-pair');
      }
      if (params.profile.avoidedPairKeys.includes(key)) {
        score -= 4;
        reasons.push('avoided-pair');
      }
    }
  }

  const exactRecentMatch = params.recentGarmentSets.some((set) => {
    const normalized = Array.from(new Set(set)).sort();
    return normalized.length === garmentIds.length
      && normalized.every((garmentId, index) => garmentId === [...garmentIds].sort()[index]);
  });
  if (exactRecentMatch) {
    score -= 6;
    reasons.push('exact-repeat');
  }

  const heavyRecentOverlap = params.recentGarmentSets.some((set) =>
    set.filter((garmentId) => garmentIds.includes(garmentId)).length >= Math.min(3, garmentIds.length),
  );
  if (!exactRecentMatch && heavyRecentOverlap) {
    score -= 2;
    reasons.push('high-overlap');
  }

  return { score, reasons };
}
