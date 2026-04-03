import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeWeather } from '@/lib/outfitContext';
import {
  COMPLETE_OUTFIT_RECOVERY_MESSAGE,
  PREFERRED_GARMENT_RECOVERY_MESSAGE,
  humanizeOutfitGenerationError,
} from '@/lib/outfitGenerationErrors';
import { hasPreferredGarmentMatch, normalizePreferredGarmentIds } from '@/lib/outfitAnchoring';
import { inferOutfitSlotFromGarment, validateCompleteOutfit } from '@/lib/outfitValidation';
import type { Garment } from './useGarments';
import type { DayIntelligence } from '@/lib/dayIntelligence';

export interface OutfitRequest {
  occasion: string;
  style?: string | null;
  locale?: string;
  eventTitle?: string | null;
  mode?: 'standard' | 'stylist';
  dayContext?: DayIntelligence | null;
  exclude_garment_ids?: string[];
  prefer_garment_ids?: string[];
  weather: {
    temperature?: number;
    precipitation: string;
    wind: string;
  };
}

export interface GeneratedOutfit {
  id: string;
  occasion: string;
  style_vibe: string | null;
  explanation: string;
  weather: OutfitRequest['weather'];
  items: {
    slot: string;
    garment: Garment;
  }[];
  confidence_score?: number;
  confidence_level?: string;
  limitation_note?: string | null;
  family_label?: string;
  wardrobe_insights?: string[];
  layer_order?: { slot: string; garment_id: string; layer_role: string }[];
  needs_base_layer?: boolean;
  occasion_submode?: string | null;
  outfit_reasoning?: {
    why_it_works?: string;
    occasion_fit?: string;
    weather_logic?: string | null;
    color_note?: string;
  };
}

const INSUFFICIENT_GARMENTS_MESSAGE =
  'Add more garments before generating an outfit. You need either 1 top + 1 bottom + shoes, or a dress + shoes.';

interface EngineSuggestion {
  title?: string;
  garment_ids?: string[];
  garments?: Garment[];
  explanation?: string;
  occasion?: string;
  family_label?: string;
  confidence_score?: number;
  confidence_level?: string;
  limitation_note?: string | null;
}

interface EngineGenerateResponse {
  items?: { slot: string; garment_id: string }[];
  explanation?: string;
  style_score?: Record<string, number> | null;
  confidence_score?: number;
  confidence_level?: string;
  limitation_note?: string | null;
  family_label?: string;
  wardrobe_insights?: string[];
  layer_order?: { slot: string; garment_id: string; layer_role: string }[];
  needs_base_layer?: boolean;
  occasion_submode?: string | null;
  outfit_reasoning?: {
    why_it_works?: string;
    occasion_fit?: string;
    weather_logic?: string | null;
    color_note?: string;
  };
  suggestions?: EngineSuggestion[];
  error?: string;
}

async function fetchGarmentsByIds(garmentIds: string[]): Promise<Map<string, Garment>> {
  const uniqueIds = Array.from(new Set(garmentIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();

  const { data: garments, error } = await supabase
    .from('garments')
    .select('*')
    .in('id', uniqueIds);

  if (error) throw error;
  return new Map((garments || []).map((garment) => [garment.id, garment as Garment]));
}

function assertCompleteGeneratedOutfit(items: { slot: string; garment: Garment }[], contextLabel: string): void {
  const validation = validateCompleteOutfit(items);
  if (!validation.isValid) {
    const detail = validation.missing.length > 0 ? ` Missing: ${validation.missing.join(', ')}.` : '';
    throw new Error(`Incomplete outfit returned${contextLabel}.${detail}`.trim());
  }
}

async function persistGeneratedOutfit(
  userId: string,
  request: OutfitRequest,
  normalizedWeather: ReturnType<typeof normalizeWeather>,
  selectedItems: { slot: string; garment: Garment }[],
  explanation: string,
  styleScore: Record<string, number> | null,
  saved: boolean,
): Promise<{ id: string; occasion: string; style_vibe: string | null }> {
  assertCompleteGeneratedOutfit(selectedItems, ' before persistence');

  const weatherJson = {
    temperature: normalizedWeather.temperature,
    precipitation: normalizedWeather.precipitation,
    wind: normalizedWeather.wind,
    condition: normalizedWeather.condition,
  };

  const { data: outfit, error: outfitError } = await supabase
    .from('outfits')
    .insert([{
      user_id: userId,
      occasion: request.occasion,
      style_vibe: request.style || null,
      weather: weatherJson,
      explanation,
      saved,
      style_score: styleScore,
    }])
    .select()
    .single();

  if (outfitError) throw outfitError;

  const outfitItems = selectedItems.map((item) => ({
    outfit_id: outfit.id,
    garment_id: item.garment.id,
    slot: item.slot,
  }));

  const { error: itemsError } = await supabase.from('outfit_items').insert(outfitItems);
  if (itemsError) throw itemsError;

  return outfit;
}

function isInsufficientGarmentsError(message?: string | null) {
  if (!message) return false;
  return message.toLowerCase().includes('not enough matching garments');
}

function isIncompleteOutfitError(message?: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('incomplete outfit')
    || normalized.includes('could not create a complete outfit')
    || normalized.includes('ai returned no garments')
    || normalized.includes('missing: top')
    || normalized.includes('missing: bottom')
    || normalized.includes('missing: dress')
    || normalized.includes('missing: shoes');
}

function shouldRetrySingleFromSuggest(message?: string | null) {
  return isInsufficientGarmentsError(message) || isIncompleteOutfitError(message);
}

function normalizeGenerationFailureMessage(message?: string | null) {
  if (isInsufficientGarmentsError(message)) {
    return INSUFFICIENT_GARMENTS_MESSAGE;
  }
  return humanizeOutfitGenerationError(message);
}

function hasPreferredGarments(request: OutfitRequest): boolean {
  return normalizePreferredGarmentIds(request.prefer_garment_ids ?? []).length > 0;
}

function assertPreferredGarmentIncluded(
  request: OutfitRequest,
  items: { slot: string; garment: Garment }[],
): void {
  const preferredGarmentIds = normalizePreferredGarmentIds(request.prefer_garment_ids ?? []);
  if (!preferredGarmentIds.length) return;

  if (!hasPreferredGarmentMatch(items.map((item) => item.garment.id), preferredGarmentIds)) {
    throw new Error(PREFERRED_GARMENT_RECOVERY_MESSAGE);
  }
}

async function hydrateSelectedItems(
  aiItems: { slot: string; garment_id: string }[],
): Promise<{ slot: string; garment: Garment }[]> {
  const garmentMap = await fetchGarmentsByIds(aiItems.map((item) => item.garment_id));
  const slotToCategory = (slot: string): string | null => {
    const normalized = slot.toLowerCase();
    if (normalized.includes('shoe')) return 'shoes';
    if (normalized.includes('dress')) return 'dress';
    if (normalized.includes('outer')) return 'outerwear';
    if (normalized.includes('bottom') || normalized.includes('pant') || normalized.includes('skirt')) return 'bottom';
    if (normalized.includes('top') || normalized.includes('base') || normalized.includes('mid')) return 'top';
    return null;
  };

  return aiItems
    .map((item) => {
      const garmentRaw = garmentMap.get(item.garment_id) as Garment | undefined;
      const hintedCategory = slotToCategory(item.slot || '');
      const garment = garmentRaw
        ? ({
          ...garmentRaw,
          category: hintedCategory || garmentRaw.category,
        } as Garment)
        : undefined;
      if (!garment) return null;
      return { slot: item.slot || inferOutfitSlotFromGarment(garment), garment };
    })
    .filter((item): item is { slot: string; garment: Garment } => Boolean(item?.garment));
}

async function validateWardrobeForGeneration(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('garments')
    .select('category, subcategory')
    .eq('user_id', userId);

  if (error) throw error;

  const slots = new Set((data || []).map((item) => inferOutfitSlotFromGarment(item)));
  const hasTopBottomPath = slots.has('top') && slots.has('bottom') && slots.has('shoes');
  const hasDressPath = slots.has('dress') && slots.has('shoes');

  if (!hasTopBottomPath && !hasDressPath) {
    throw new Error(INSUFFICIENT_GARMENTS_MESSAGE);
  }
}

async function generateOutfitViaEngine(
  userId: string,
  request: OutfitRequest,
  resultMode: 'single' | 'multi' = 'single',
  shouldValidateWardrobe = true,
): Promise<GeneratedOutfit | GeneratedOutfit[]> {
  if (shouldValidateWardrobe) {
    await validateWardrobeForGeneration(userId);
  }
  const requiresPreferredGarment = hasPreferredGarments(request);

  const normalizedWeather = normalizeWeather(request.weather as Record<string, unknown>);
  const { data, error: fnError } = await invokeEdgeFunction<EngineGenerateResponse>('burs_style_engine', {
    timeout: 45000,
    body: {
      mode: resultMode === 'multi' ? 'suggest' : 'generate',
      generator_mode: request.mode || 'standard',
      occasion: request.occasion,
      style: request.style,
      weather: normalizedWeather,
      locale: request.locale || 'en',
      event_title: request.eventTitle || null,
      day_context: request.dayContext || null,
      exclude_garment_ids: request.exclude_garment_ids ?? [],
      prefer_garment_ids: request.prefer_garment_ids ?? [],
    },
  });

  if (fnError) {
    if (resultMode === 'multi' && shouldRetrySingleFromSuggest(fnError.message)) {
      return [await generateOutfitViaEngine(userId, request, 'single', false) as GeneratedOutfit];
    }
    if (requiresPreferredGarment && isIncompleteOutfitError(fnError.message)) {
      throw new Error(PREFERRED_GARMENT_RECOVERY_MESSAGE);
    }
    throw new Error(normalizeGenerationFailureMessage(fnError.message));
  }

  if (data?.error) {
    if (resultMode === 'multi' && shouldRetrySingleFromSuggest(data.error)) {
      return [await generateOutfitViaEngine(userId, request, 'single', false) as GeneratedOutfit];
    }
    if (requiresPreferredGarment && isIncompleteOutfitError(data.error)) {
      throw new Error(PREFERRED_GARMENT_RECOVERY_MESSAGE);
    }
    throw new Error(normalizeGenerationFailureMessage(data.error));
  }

  if (resultMode === 'multi') {
    const suggestions = data?.suggestions ?? [];
    if (!suggestions.length) {
      return [await generateOutfitViaEngine(userId, request, 'single', false) as GeneratedOutfit];
    }

    const garmentIds = suggestions.flatMap((suggestion) =>
      suggestion.garment_ids?.length
        ? suggestion.garment_ids
        : (suggestion.garments ?? []).map((garment) => garment.id),
    );
    const garmentMap = await fetchGarmentsByIds(garmentIds);

    const outfits: GeneratedOutfit[] = [];

    for (const [index, suggestion] of suggestions.entries()) {
      const orderedGarments = (suggestion.garment_ids?.length
        ? suggestion.garment_ids.map((id) => garmentMap.get(id)).filter(Boolean)
        : (suggestion.garments ?? []).map((garment) => garmentMap.get(garment.id) ?? garment).filter(Boolean)) as Garment[];

      const selectedItems = orderedGarments.map((garment) => ({
        slot: inferOutfitSlotFromGarment(garment),
        garment,
      }));

      try {
        assertCompleteGeneratedOutfit(selectedItems, ` for option ${index + 1}`);
        assertPreferredGarmentIncluded(request, selectedItems);

        const persisted = await persistGeneratedOutfit(
          userId,
          request,
          normalizedWeather,
          selectedItems,
          suggestion.explanation ?? '',
          null,
          false,
        );

        outfits.push({
          id: persisted.id,
          occasion: persisted.occasion,
          style_vibe: persisted.style_vibe,
          explanation: suggestion.explanation ?? '',
          weather: request.weather,
          items: selectedItems,
          confidence_score: suggestion.confidence_score,
          confidence_level: suggestion.confidence_level,
          limitation_note: suggestion.limitation_note,
          family_label: suggestion.family_label,
        } satisfies GeneratedOutfit);
      } catch (error) {
        if (!(error instanceof Error) || (!isIncompleteOutfitError(error.message) && error.message !== PREFERRED_GARMENT_RECOVERY_MESSAGE)) {
          throw error;
        }
      }
    }

    if (!outfits.length) {
      return [await generateOutfitViaEngine(userId, request, 'single', false) as GeneratedOutfit];
    }

    return outfits;
  }

  const aiItems: { slot: string; garment_id: string }[] = data?.items ?? [];
  const explanation = data?.explanation ?? '';
  const styleScore = data?.style_score || null;
  const confidenceScore = data?.confidence_score;
  const confidenceLevel = data?.confidence_level;
  const limitationNote = data?.limitation_note;
  const familyLabel = data?.family_label;
  const wardrobeInsights = data?.wardrobe_insights;
  const layerOrder = data?.layer_order;
  const needsBaseLayer = data?.needs_base_layer;
  const occasionSubmode = data?.occasion_submode;
  const outfitReasoning = data?.outfit_reasoning;

  if (!aiItems.length) {
    if (requiresPreferredGarment) {
      throw new Error(PREFERRED_GARMENT_RECOVERY_MESSAGE);
    }
    throw new Error(COMPLETE_OUTFIT_RECOVERY_MESSAGE);
  }

  const selectedItems = await hydrateSelectedItems(aiItems);

  try {
    assertCompleteGeneratedOutfit(selectedItems, '');
    assertPreferredGarmentIncluded(request, selectedItems);
  } catch (error) {
    if (error instanceof Error && error.message === PREFERRED_GARMENT_RECOVERY_MESSAGE) {
      throw error;
    }
    if (error instanceof Error && isIncompleteOutfitError(error.message)) {
      if (requiresPreferredGarment) {
        throw new Error(PREFERRED_GARMENT_RECOVERY_MESSAGE);
      }
      throw new Error(COMPLETE_OUTFIT_RECOVERY_MESSAGE);
    }
    throw error;
  }

  const outfit = await persistGeneratedOutfit(
    userId,
    request,
    normalizedWeather,
    selectedItems,
    explanation,
    styleScore,
    true,
  );

  return {
    id: outfit.id,
    occasion: outfit.occasion,
    style_vibe: outfit.style_vibe,
    explanation,
    weather: request.weather,
    items: selectedItems,
    confidence_score: confidenceScore,
    confidence_level: confidenceLevel,
    limitation_note: limitationNote,
    family_label: familyLabel,
    wardrobe_insights: wardrobeInsights,
    layer_order: layerOrder,
    needs_base_layer: needsBaseLayer,
    occasion_submode: occasionSubmode,
    outfit_reasoning: outfitReasoning,
  };
}

export function useOutfitGenerator() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invalidateOutfits = () => {
    queryClient.invalidateQueries({ queryKey: ['outfits', user?.id] });
  };

  const singleMutation = useMutation({
    mutationFn: async (request: OutfitRequest) => {
      if (!user) throw new Error('Not logged in');
      return await generateOutfitViaEngine(user.id, request, 'single') as GeneratedOutfit;
    },
    onSuccess: invalidateOutfits,
  });

  const multiMutation = useMutation({
    mutationFn: async (request: OutfitRequest) => {
      if (!user) throw new Error('Not logged in');
      return await generateOutfitViaEngine(user.id, request, 'multi') as GeneratedOutfit[];
    },
    onSuccess: invalidateOutfits,
  });

  return {
    generateOutfit: singleMutation.mutateAsync,
    generateOutfitCandidates: multiMutation.mutateAsync,
    isGenerating: singleMutation.isPending || multiMutation.isPending,
    error: singleMutation.error ?? multiMutation.error,
  };
}
