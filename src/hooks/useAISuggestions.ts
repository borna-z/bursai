import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useWeather } from '@/hooks/useWeather';
import { useLocation } from '@/contexts/LocationContext';
import { canBuildVisibleOutfit, getVisibleOutfitMissingSlots, inferOutfitSlotFromGarment, validateCompleteOutfit } from '@/lib/outfitValidation';
import { useFlatGarments, useGarmentCount } from '@/hooks/useGarments';
import { supabase } from '@/integrations/supabase/client';

export interface AISuggestion {
  title: string;
  garment_ids: string[];
  garments: {
    id: string;
    title: string;
    category: string;
    color_primary: string;
    image_path: string | null;
    original_image_path?: string | null;
    processed_image_path?: string | null;
    image_processing_status?: string | null;
    rendered_image_path?: string | null;
    render_status?: string | null;
  }[];
  explanation: string;
  occasion: string;
}

interface AISuggestionsResponse {
  suggestions: AISuggestion[];
  message?: string;
  error?: string;
}

export interface AISuggestionsEmptyState {
  reason: 'not_enough_garments' | 'missing_required_slots';
  missingSlots: Array<'top' | 'bottom' | 'dress' | 'shoes' | 'outerwear'>;
}

export interface AISuggestionsResult {
  suggestions: AISuggestion[];
  emptyState: AISuggestionsEmptyState | null;
}

function isInsufficientGarmentsError(message?: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('not enough matching garments');
}

export function useAISuggestionsVisibility() {
  const { effectiveCity } = useLocation();
  const { weather } = useWeather({ city: effectiveCity });
  const { data: garmentCount = 0, isLoading: isGarmentCountLoading } = useGarmentCount();
  const { data: garments = [], isLoading: areGarmentsLoading } = useFlatGarments();

  return useMemo(() => {
    const normalizedItems = garments.map((garment) => ({ slot: inferOutfitSlotFromGarment(garment), garment }));
    const missingSlots = garmentCount < 3
      ? ['top', 'bottom', 'shoes'] as Array<'top' | 'bottom' | 'dress' | 'shoes' | 'outerwear'>
      : getVisibleOutfitMissingSlots(normalizedItems, weather ?? undefined);

    return {
      garmentCount,
      isLoading: isGarmentCountLoading || areGarmentsLoading,
      canShowBlock: garmentCount >= 3 && missingSlots.length === 0,
      emptyState: garmentCount < 3
        ? { reason: 'not_enough_garments' as const, missingSlots }
        : missingSlots.length > 0
          ? { reason: 'missing_required_slots' as const, missingSlots }
          : null,
    };
  }, [areGarmentsLoading, garmentCount, garments, isGarmentCountLoading, weather]);
}

export function useAISuggestions() {
  const { user, session } = useAuth();
  const { locale } = useLanguage();
  const { effectiveCity } = useLocation();
  const { weather } = useWeather({ city: effectiveCity });
  const visibility = useAISuggestionsVisibility();

  const weatherInput = weather
    ? { temperature: weather.temperature, precipitation: weather.precipitation, wind: weather.wind }
    : undefined;

  return useQuery({
    queryKey: ['ai-suggestions', user?.id, locale, visibility.garmentCount, weatherInput?.temperature, weatherInput?.precipitation, weatherInput?.wind],
    queryFn: async (): Promise<AISuggestionsResult> => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      if (visibility.emptyState) {
        return { suggestions: [], emptyState: visibility.emptyState };
      }

      const response = await invokeEdgeFunction<AISuggestionsResponse>(
        'burs_style_engine',
        {
          timeout: 45000,
          body: { mode: 'suggest', locale, occasion: 'vardag', weather: weatherInput },
        }
      );

      const functionErrorMessage = response.error?.message;
      const payloadErrorMessage = response.data?.error;

      if (isInsufficientGarmentsError(functionErrorMessage) || isInsufficientGarmentsError(payloadErrorMessage)) {
        return {
          suggestions: [],
          emptyState: visibility.emptyState ?? {
            reason: 'missing_required_slots',
            missingSlots: [],
          },
        };
      }

      if (response.error) {
        throw response.error;
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const suggestions = (response.data?.suggestions || []).filter((suggestion) =>
        canBuildVisibleOutfit((suggestion.garments || []).map((garment) => ({ garment })), weather ?? undefined) &&
        validateCompleteOutfit((suggestion.garments || []).map((garment) => ({ garment }))).isValid
      );

      const garmentIds = Array.from(new Set(suggestions.flatMap((suggestion) => suggestion.garment_ids || [])));
      if (!garmentIds.length) {
        return { suggestions, emptyState: suggestions.length ? null : visibility.emptyState };
      }

      const { data: liveGarments, error: garmentsError } = await supabase
        .from('garments')
        .select('id, title, category, color_primary, image_path, original_image_path, processed_image_path, image_processing_status, rendered_image_path, render_status')
        .in('id', garmentIds);

      if (garmentsError) throw garmentsError;

      const garmentMap = new Map((liveGarments || []).map((garment) => [garment.id, garment]));

      return {
        suggestions: suggestions.map((suggestion) => ({
          ...suggestion,
          garments: suggestion.garments.map((garment) => ({
            ...garment,
            ...(garmentMap.get(garment.id) || {}),
          })),
        })),
        emptyState: null,
      };
    },
    enabled: !!user && !!session?.access_token && !visibility.isLoading && visibility.garmentCount >= 3,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    refetchInterval: (query) => {
      const suggestions = query.state.data?.suggestions || [];
      const hasProcessingGarments = suggestions.some((suggestion) =>
        suggestion.garments.some((garment) =>
          garment.image_processing_status === 'pending' ||
          garment.image_processing_status === 'processing' ||
          garment.render_status === 'pending' ||
          garment.render_status === 'rendering'
        )
      );

      return hasProcessingGarments ? 5000 : false;
    },
  });
}
