import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type Garment = Tables<'garments'>;

export function useSimilarGarments(garment: Garment | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['similar-garments', garment?.id],
    queryFn: async (): Promise<Garment[]> => {
      if (!user || !garment) return [];

      // Find garments with same category OR same primary color, excluding current
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', garment.category)
        .neq('id', garment.id)
        .limit(4);

      if (error) throw error;

      // Sort: prioritize same color, then same category
      const sorted = (data || []).sort((a, b) => {
        const aColorMatch = a.color_primary === garment.color_primary ? 1 : 0;
        const bColorMatch = b.color_primary === garment.color_primary ? 1 : 0;
        return bColorMatch - aColorMatch;
      });

      return sorted.slice(0, 4);
    },
    enabled: !!user && !!garment?.id,
    staleTime: 5 * 60 * 1000,
  });
}
