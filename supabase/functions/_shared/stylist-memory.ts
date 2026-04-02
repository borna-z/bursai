export interface StylistMemorySignal {
  signal_type: string;
  value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface StylistMemoryGarment {
  id: string;
  title: string;
  category: string;
  color_primary: string | null;
  formality: number | null;
  wear_count: number | null;
}

export interface StylistMemoryPairRecord {
  garment_a_id: string;
  garment_b_id: string;
  positive_count: number;
  negative_count: number;
  last_positive_at: string | null;
  last_negative_at: string | null;
}

export interface StylistMemoryProfile {
  archetype: string | null;
  formalityCenter: number | null;
}

export interface StylistMemorySummary {
  promptBlock: string;
  insightCount: number;
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function truncate(text: string, maxLength = 160): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function rankEntries(entries: Map<string, number>): string[] {
  return [...entries.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value);
}

function isPositiveReaction(value: string): boolean {
  return /(love|loved|polished|easy|clean|sharp|balanced|cool|great|perfect|good|comfortable)/i.test(value);
}

function isNegativeReaction(value: string): boolean {
  return /(too|not|bad|off|wrong|avoid|dislike|warm|cold|tight|itchy|formal|casual|busy|boring)/i.test(value);
}

export function buildStylistMemorySummary(input: {
  signals: StylistMemorySignal[];
  garments: StylistMemoryGarment[];
  pairMemory: StylistMemoryPairRecord[];
  dna: StylistMemoryProfile;
}): StylistMemorySummary {
  const positiveReactions = new Map<string, number>();
  const negativeReactions = new Map<string, number>();
  const swapSlots = new Map<string, number>();
  let saveCount = 0;
  let wearCount = 0;
  let followThroughCount = 0;
  let skipCount = 0;
  let highRatings = 0;
  let lowRatings = 0;

  for (const signal of input.signals) {
    const value = normalizeText(signal.value);
    const metadata = signal.metadata || {};
    const slot = normalizeText(
      typeof metadata.slot === 'string'
        ? metadata.slot
        : typeof signal.value === 'string' && /top|bottom|shoes|outerwear|dress/.test(signal.value)
          ? signal.value
          : '',
    );

    switch (signal.signal_type) {
      case 'save':
        saveCount += 1;
        break;
      case 'wear_confirm':
        wearCount += 1;
        break;
      case 'planned_follow_through':
        followThroughCount += 1;
        break;
      case 'planned_skip':
        skipCount += 1;
        break;
      case 'rating': {
        const rating = Number(signal.value);
        if (rating >= 4) highRatings += 1;
        if (rating > 0 && rating <= 2) lowRatings += 1;
        break;
      }
      case 'swap_choice':
        if (slot) {
          swapSlots.set(slot, (swapSlots.get(slot) || 0) + 1);
        }
        break;
      case 'quick_reaction':
        if (value && isPositiveReaction(value)) {
          positiveReactions.set(value, (positiveReactions.get(value) || 0) + 1);
        } else if (value && isNegativeReaction(value)) {
          negativeReactions.set(value, (negativeReactions.get(value) || 0) + 1);
        }
        break;
      default:
        break;
    }
  }

  const wornColors = [...input.garments]
    .filter((garment) => (garment.wear_count ?? 0) > 0 && garment.color_primary)
    .sort((a, b) => (b.wear_count ?? 0) - (a.wear_count ?? 0));
  const signatureColors = Array.from(new Set(wornColors.map((garment) => garment.color_primary as string))).slice(0, 3);

  const garmentById = new Map(input.garments.map((garment) => [garment.id, garment]));
  const positivePairs = input.pairMemory
    .filter((pair) => pair.positive_count >= 2 && pair.positive_count > pair.negative_count)
    .sort((a, b) => b.positive_count - a.positive_count)
    .slice(0, 2)
    .map((pair) => {
      const left = garmentById.get(pair.garment_a_id)?.title || pair.garment_a_id;
      const right = garmentById.get(pair.garment_b_id)?.title || pair.garment_b_id;
      return `${left} + ${right} (${pair.positive_count} wins)`;
    });
  const negativePairs = input.pairMemory
    .filter((pair) => pair.negative_count >= 2 && pair.negative_count >= pair.positive_count)
    .sort((a, b) => b.negative_count - a.negative_count)
    .slice(0, 2)
    .map((pair) => {
      const left = garmentById.get(pair.garment_a_id)?.title || pair.garment_a_id;
      const right = garmentById.get(pair.garment_b_id)?.title || pair.garment_b_id;
      return `${left} + ${right} (${pair.negative_count} misses)`;
    });

  const hottestSwapSlot = [...swapSlots.entries()]
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count >= 2)?.[0];

  const insights = [
    input.dna.archetype ? `Lean into ${input.dna.archetype}; it is the user's strongest proven style direction.` : '',
    signatureColors.length > 0 ? `Wear-backed palette that already performs well: ${signatureColors.join(', ')}.` : '',
    typeof input.dna.formalityCenter === 'number'
      ? `Typical formality center is ${input.dna.formalityCenter.toFixed(1)}/5, so only swing more formal or relaxed with clear intent.`
      : '',
    wearCount > 0 || saveCount > 0
      ? `Behavioral confidence: ${wearCount} worn confirmations and ${saveCount} saves in recent feedback. Treat worn looks as stronger signals than saves.`
      : '',
    hottestSwapSlot ? `The user keeps tweaking ${hottestSwapSlot}; start with a stronger first option in that slot.` : '',
    followThroughCount > 0 || skipCount > 0
      ? `Planner follow-through is ${followThroughCount >= skipCount ? 'solid' : 'fragile'} (${followThroughCount} completed vs ${skipCount} skipped).`
      : '',
    positivePairs.length > 0 ? `Proven garment pairings: ${positivePairs.join('; ')}.` : '',
    negativePairs.length > 0 ? `Avoid repeating weak pairings: ${negativePairs.join('; ')}.` : '',
    highRatings > 0 || lowRatings > 0
      ? `Recent ratings skew ${highRatings >= lowRatings ? 'positive' : 'mixed'} (${highRatings} high vs ${lowRatings} low).`
      : '',
    rankEntries(positiveReactions).length > 0
      ? `Positive reaction language to echo naturally: ${rankEntries(positiveReactions).slice(0, 2).join(', ')}.`
      : '',
    rankEntries(negativeReactions).length > 0
      ? `Avoid outcomes that read as: ${rankEntries(negativeReactions).slice(0, 2).join(', ')}.`
      : '',
  ].filter(Boolean).map((line) => truncate(line));

  return {
    promptBlock: insights.slice(0, 8).join('\n'),
    insightCount: insights.length,
  };
}
