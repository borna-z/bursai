import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type GarmentBasic = Pick<Tables<'garments'>, 'id' | 'title' | 'category' | 'color_primary' | 'image_path' | 'original_image_path' | 'processed_image_path' | 'image_processing_status' | 'rendered_image_path' | 'render_status'>;

export function useGarmentsByIds(ids: string[]) {
  return useQuery({
    queryKey: ['garments-by-ids', [...ids].sort().join(',')],
    queryFn: async () => {
      if (!ids.length) return [] as GarmentBasic[];
      const { data, error } = await supabase
        .from('garments')
        .select('id, title, category, color_primary, image_path, original_image_path, processed_image_path, image_processing_status, rendered_image_path, render_status')
        .in('id', ids);
      if (error) throw error;
      return (data ?? []) as GarmentBasic[];
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const garments = query.state.data || [];
      const hasProcessingGarments = garments.some((garment) =>
        garment.image_processing_status === 'pending' ||
        garment.image_processing_status === 'processing' ||
        garment.render_status === 'pending' ||
        garment.render_status === 'rendering'
      );

      return hasProcessingGarments ? 5000 : false;
    },
  });
}
