import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeWeather } from '@/lib/outfitContext';
import { inferOutfitSlotFromGarment, validateBaseOutfit } from '@/lib/outfitValidation';
import type { Garment } from './useGarments';

export interface OutfitRequest {
  occasion: string;
  style?: string | null;
  locale?: string;
  eventTitle?: string | null;
  mode?: 'standard' | 'stylist';
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
  'Add more garments before generating an outfit. You need either at least 1 top + 1 bottom, or a dress.';


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
  return new Map((garments || []).map((g) => [g.id, g as Garment]));
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


function inferLayerRoleClient(garment: Pick<Garment, 'category' | 'subcategory'>): 'base' | 'mid' | 'outer' | 'standalone' {
  const category = String(garment.category || '').toLowerCase();
  const subcategory = String(garment.subcategory || '').toLowerCase();
  const value = `${category} ${subcategory}`.trim();

  if (['outerwear', 'coat', 'jacket', 'blazer', 'trench', 'jacka', 'kappa', 'vest', 'väst'].some((token) => value.includes(token))) return 'outer';
  if (['t-shirt', 'tee', 'tank', 'camisole', 'undershirt', 'linne'].some((token) => value.includes(token))) return 'base';
  if (['cardigan', 'sweater', 'hoodie', 'overshirt', 'shacket', 'shirt jacket', 'utility shirt', 'vest', 'väst', 'knit'].some((token) => value.includes(token))) return 'mid';
  return 'standalone';
}

function isCompleteOutfitClient(items: { slot: string; garment: Pick<Garment, 'category' | 'subcategory'> }[]): boolean {
  const baseValidation = validateBaseOutfit(items);
  if (!baseValidation.isValid) return false;
  if (baseValidation.isDressBased) return true;

  const topItems = items.filter((item) => item.slot === 'top');
  const topRoles = topItems.map((item) => inferLayerRoleClient(item.garment));
  const baseLikeTopCount = topRoles.filter((role) => role === 'base' || role === 'standalone').length;
  const midTopCount = topRoles.filter((role) => role === 'mid').length;
  const outerwearCount = items.filter((item) => item.slot === 'outerwear').length;

  if (baseLikeTopCount === 0) return false;
  if (baseLikeTopCount > 1) return false;
  if (midTopCount > 1) return false;
  if (topItems.length > 2) return false;
  if (outerwearCount > 1) return false;
  if (items.length > 6) return false;

  return true;
}

function isInsufficientGarmentsError(message?: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes('not enough matching garments')
  );
}

async function validateWardrobeForGeneration(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('garments')
    .select('category, subcategory')
    .eq('user_id', userId);

  if (error) throw error;

  const normalized = (data || []).map((item) => {
    const category = String(item.category || '').toLowerCase();
    const subcategory = String(item.subcategory || '').toLowerCase();
    return `${category} ${subcategory}`.trim();
  });

  const hasTop = normalized.some((v) =>
    ['top', 'shirt', 't-shirt', 'blouse', 'sweater', 'hoodie', 'polo', 'tank_top', 'tröja', 'skjorta'].some((x) =>
      v.includes(x)
    )
  );

  const hasBottom = normalized.some((v) =>
    ['bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'chinos', 'byxor', 'kjol'].some((x) =>
      v.includes(x)
    )
  );

  const hasDress = normalized.some((v) =>
    ['dress', 'jumpsuit', 'overall', 'klänning'].some((x) => v.includes(x))
  );

  const hasTopBottomPath = hasTop && hasBottom;
  const hasDressPath = hasDress;

  if (!hasTopBottomPath && !hasDressPath) {
    throw new Error(INSUFFICIENT_GARMENTS_MESSAGE);
  }
}

async function generateOutfitViaEngine(
  userId: string,
  request: OutfitRequest,
  resultMode: 'single' | 'multi' = 'single',
): Promise<GeneratedOutfit | GeneratedOutfit[]> {
  await validateWardrobeForGeneration(userId);

  const normalizedWeather = normalizeWeather(request.weather as Record<string, unknown>);

  const { data, error: fnError } = await invokeEdgeFunction<EngineGenerateResponse>('burs_style_engine', {
    timeout: 45000,
    body: {
      mode: resultMode === 'multi' ? 'suggest' : 'generate',
      occasion: request.occasion,
      style: request.style,
      weather: normalizedWeather,
      locale: request.locale || 'en',
      event_title: request.eventTitle || null,
    },
  });


  if (fnError) {
    if (isInsufficientGarmentsError(fnError.message)) {
      throw new Error(INSUFFICIENT_GARMENTS_MESSAGE);
    }
    throw new Error(fnError.message || 'Could not generate outfit');
  }

  if (data?.error) {
    if (isInsufficientGarmentsError(data.error)) {
      throw new Error(INSUFFICIENT_GARMENTS_MESSAGE);
    }
    throw new Error(data.error);
  }

  if (resultMode === 'multi') {
    const suggestions = data?.suggestions ?? [];
    if (!suggestions.length) {
      return [await generateOutfitViaEngine(userId, request, 'single') as GeneratedOutfit];
    }

    const garmentIds = suggestions.flatMap((suggestion) =>
      suggestion.garment_ids?.length
        ? suggestion.garment_ids
        : (suggestion.garments ?? []).map((garment) => garment.id)
    );
    const garmentMap = await fetchGarmentsByIds(garmentIds);

    const outfits = await Promise.all(suggestions.map(async (suggestion, index) => {
      const orderedGarments = (suggestion.garment_ids?.length
        ? suggestion.garment_ids.map((id) => garmentMap.get(id)).filter(Boolean)
        : (suggestion.garments ?? []).map((garment) => garmentMap.get(garment.id) ?? garment).filter(Boolean)) as Garment[];

      const selectedItems = orderedGarments.map((garment) => ({
        slot: inferOutfitSlotFromGarment(garment),
        garment,
      }));

      if (!isCompleteOutfitClient(selectedItems)) {
        throw new Error(`Incomplete outfit returned for option ${index + 1}.`);
      }

      const persisted = await persistGeneratedOutfit(
        userId,
        request,
        normalizedWeather,
        selectedItems,
        suggestion.explanation ?? '',
        null,
        false,
      );

      return {
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
      } satisfies GeneratedOutfit;
    }));

    return outfits;
  }

  const aiItems: { slot: string; garment_id: string }[] = data?.items ?? [];
  const explanation: string = data?.explanation ?? '';
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

  if (!aiItems.length) throw new Error('AI returned no garments');

  const garmentMap = await fetchGarmentsByIds(aiItems.map((i) => i.garment_id));
  const selectedItems = aiItems
    .map((item) => ({ slot: item.slot, garment: garmentMap.get(item.garment_id) as Garment }))
    .filter((item) => item.garment);

  if (!isCompleteOutfitClient(selectedItems)) {
    const slots = new Set(selectedItems.map(i => i.slot));
    const missing: string[] = [];
    const hasDress = slots.has('dress');
    if (!hasDress && !slots.has('top')) missing.push('top');
    if (!hasDress && !slots.has('bottom')) missing.push('bottom');
    const detail = missing.length > 0 ? ` Missing: ${missing.join(', ')}.` : '';
    throw new Error(`Incomplete outfit returned.${detail}`);
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
    queryClient.invalidateQueries({ queryKey: ['outfits'] });
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
