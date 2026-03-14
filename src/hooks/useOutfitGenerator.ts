import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';
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
  'Add more garments in different categories (top, bottom, shoes) before generating an outfit.';

function isInsufficientGarmentsError(message?: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes('not enough matching garments') ||
    normalized.includes('inte tillräckligt med matchande plagg')
  );
}

async function validateWardrobeForGeneration(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('garments')
    .select('category')
    .eq('user_id', userId)
    .in('category', ['top', 'bottom', 'shoes']);

  if (error) throw error;

  const categories = new Set((data || []).map((item) => item.category));
  const hasRequiredCategories = ['top', 'bottom', 'shoes'].every((cat) => categories.has(cat));

  if (!hasRequiredCategories) {
    throw new Error(INSUFFICIENT_GARMENTS_MESSAGE);
  }
}

async function generateOutfitViaEngine(
  userId: string,
  request: OutfitRequest
): Promise<GeneratedOutfit> {
  await validateWardrobeForGeneration(userId);

  const { data, error: fnError } = await invokeEdgeFunction<any>('burs_style_engine', {
    timeout: 45000,
    body: {
      mode: 'generate',
      occasion: request.occasion,
      style: request.style,
      weather: request.weather,
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

  if (!aiItems?.length) throw new Error('AI returnerade inga plagg');

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
    throw new Error('Inte tillräckligt med matchande plagg');
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
      if (!user) throw new Error('Inte inloggad');
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

