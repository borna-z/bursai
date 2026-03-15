import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeWeather } from '@/lib/outfitContext';
import type { Garment } from './useGarments';

export interface OutfitRequest {
  occasion: string;
  style?: string | null;
  locale?: string;
  eventTitle?: string | null;
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
}

const INSUFFICIENT_GARMENTS_MESSAGE =
  'Add more garments before generating an outfit. You need either top + bottom + shoes, or dress + shoes.';

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

  const hasShoes = normalized.some((v) =>
    ['shoes', 'sneakers', 'boots', 'loafers', 'sandals', 'heels', 'skor', 'stövlar'].some((x) =>
      v.includes(x)
    )
  );

  const hasDress = normalized.some((v) =>
    ['dress', 'jumpsuit', 'overall', 'klänning'].some((x) => v.includes(x))
  );

  const hasTopBottomPath = hasTop && hasBottom && hasShoes;
  const hasDressPath = hasDress && hasShoes;

  if (!hasTopBottomPath && !hasDressPath) {
    throw new Error(INSUFFICIENT_GARMENTS_MESSAGE);
  }
}

async function generateOutfitViaEngine(
  userId: string,
  request: OutfitRequest
): Promise<GeneratedOutfit> {
  await validateWardrobeForGeneration(userId);

  const normalizedWeather = normalizeWeather(request.weather as Record<string, unknown>);

  const { data, error: fnError } = await invokeEdgeFunction<{
    items?: { slot: string; garment_id: string }[];
    explanation?: string;
    style_score?: Record<string, number> | null;
    error?: string;
  }>('burs_style_engine', {
    timeout: 45000,
    body: {
      mode: 'generate',
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

  const aiItems: { slot: string; garment_id: string }[] = data.items;
  const explanation: string = data.explanation;
  const styleScore = data.style_score || null;

  if (!aiItems?.length) throw new Error('AI returned no garments');

  // Fetch full garment data
  const garmentIds = aiItems.map((i) => i.garment_id);
  const { data: garments, error: gError } = await supabase
    .from('garments')
    .select('*')
    .in('id', garmentIds);

  if (gError) throw gError;

  const garmentMap = new Map((garments || []).map((g) => [g.id, g]));
  const selectedItems = aiItems
    .map((item) => ({ slot: item.slot, garment: garmentMap.get(item.garment_id) as Garment }))
    .filter((item) => item.garment);

  if (selectedItems.length < 2) {
    throw new Error('Not enough matching garments');
  }

  // Save outfit
  const weatherJson = {
    temperature: request.weather.temperature,
    precipitation: request.weather.precipitation,
    wind: request.weather.wind,
  };

  const { data: outfit, error: outfitError } = await supabase
    .from('outfits')
    .insert([{
      user_id: userId,
      occasion: request.occasion,
      style_vibe: request.style || null,
      weather: weatherJson,
      explanation,
      saved: true,
      style_score: styleScore,
    }])
    .select()
    .single();

  if (outfitError) throw outfitError;

  // Save outfit items
  const outfitItems = selectedItems.map((item) => ({
    outfit_id: outfit.id,
    garment_id: item.garment.id,
    slot: item.slot,
  }));

  const { error: itemsError } = await supabase.from('outfit_items').insert(outfitItems);
  if (itemsError) throw itemsError;

  return {
    id: outfit.id,
    occasion: outfit.occasion,
    style_vibe: outfit.style_vibe,
    explanation,
    weather: request.weather,
    items: selectedItems,
  };
}

export function useOutfitGenerator() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const mutation = useMutation({
    mutationFn: async (request: OutfitRequest) => {
      if (!user) throw new Error('Not logged in');
      setIsGenerating(true);
      try {
        return await generateOutfitViaEngine(user.id, request);
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
    },
  });

  return {
    generateOutfit: mutation.mutateAsync,
    isGenerating: isGenerating || mutation.isPending,
    error: mutation.error,
  };
}

