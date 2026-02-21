import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Garment } from './useGarments';

export interface OutfitRequest {
  occasion: string;
  style?: string | null;
  locale?: string;
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

async function generateOutfitViaAI(
  userId: string,
  request: OutfitRequest
): Promise<GeneratedOutfit> {
  // Call AI edge function
  const { data, error: fnError } = await supabase.functions.invoke('generate_outfit', {
    body: { occasion: request.occasion, style: request.style, weather: request.weather, locale: request.locale || 'sv' },
  });

  if (fnError) {
    throw new Error(fnError.message || 'Kunde inte generera outfit');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  const aiItems: { slot: string; garment_id: string }[] = data.items;
  const explanation: string = data.explanation;

  if (!aiItems?.length) {
    throw new Error('AI returnerade inga plagg');
  }

  // Fetch full garment data for the selected IDs
  const garmentIds = aiItems.map((i) => i.garment_id);
  const { data: garments, error: gError } = await supabase
    .from('garments')
    .select('*')
    .in('id', garmentIds);

  if (gError) throw gError;

  const garmentMap = new Map((garments || []).map((g) => [g.id, g]));

  const selectedItems = aiItems
    .map((item) => ({
      slot: item.slot,
      garment: garmentMap.get(item.garment_id) as Garment,
    }))
    .filter((item) => item.garment);

  if (selectedItems.length < 2) {
    throw new Error('Inte tillräckligt med matchande plagg');
  }

  // Save outfit to database
  const weatherJson = {
    temperature: request.weather.temperature,
    precipitation: request.weather.precipitation,
    wind: request.weather.wind,
  };

  const outfitInsert: {
    user_id: string;
    occasion: string;
    style_vibe: string | null;
    weather: typeof weatherJson;
    explanation: string;
    saved: boolean;
  } = {
    user_id: userId,
    occasion: request.occasion,
    style_vibe: request.style || null,
    weather: weatherJson,
    explanation,
    saved: true,
  };

  const { data: outfit, error: outfitError } = await supabase
    .from('outfits')
    .insert([outfitInsert])
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
      if (!user) throw new Error('Inte inloggad');
      setIsGenerating(true);
      try {
        return await generateOutfitViaAI(user.id, request);
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
