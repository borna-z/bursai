import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useWeather } from '@/hooks/useWeather';
import { useGarmentCount } from '@/hooks/useGarments';

export interface AISuggestion {
  title: string;
  garment_ids: string[];
  garments: {
    id: string;
    title: string;
    category: string;
    color_primary: string;
    image_path: string;
  }[];
  explanation: string;
  occasion: string;
}

interface AISuggestionsResponse {
  suggestions: AISuggestion[];
  message?: string;
  error?: string;
}

function isInsufficientGarmentsError(message?: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes('not enough matching garments')
  );
}

export function useAISuggestions() {
  const { user, session } = useAuth();
  const { locale } = useLanguage();
  const { weather } = useWeather();
  const { data: garmentCount = 0, isLoading: isGarmentCountLoading } = useGarmentCount();

  const weatherInput = weather
    ? { temperature: weather.temperature, precipitation: weather.precipitation, wind: weather.wind }
    : undefined;

  return useQuery({
    queryKey: ['ai-suggestions', user?.id, locale, garmentCount, weatherInput?.temperature, weatherInput?.precipitation, weatherInput?.wind],
    queryFn: async (): Promise<AISuggestion[]> => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Use BURS style engine in suggest mode
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
        return [];
      }

      if (response.error) {
        throw response.error;
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data?.suggestions || [];
    },
    enabled: !!user && !!session?.access_token && !isGarmentCountLoading && garmentCount >= 3,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });
}

