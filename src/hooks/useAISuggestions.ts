import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AISuggestion {
  title: string;
  garment_ids: string[];
  garments: {
    id: string;
    title: string;
    category: string;
    color_primary: string;
  }[];
  explanation: string;
  occasion: string;
}

interface AISuggestionsResponse {
  suggestions: AISuggestion[];
  message?: string;
  error?: string;
}

export function useAISuggestions() {
  const { user, session } = useAuth();

  return useQuery({
    queryKey: ['ai-suggestions', user?.id],
    queryFn: async (): Promise<AISuggestion[]> => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke<AISuggestionsResponse>(
        'suggest_outfit_combinations',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data?.suggestions || [];
    },
    enabled: !!user && !!session?.access_token,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });
}
