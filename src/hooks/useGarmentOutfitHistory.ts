import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Fetches outfits that contain a specific garment, ordered by most recent.
 * Returns outfit with items + garment data for thumbnail display.
 */
export function useGarmentOutfitHistory(garmentId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['garment-outfit-history', garmentId],
    queryFn: async () => {
      if (!garmentId || !user) return [];

      // Find outfit IDs containing this garment
      const { data: outfitItems, error: itemsErr } = await supabase
        .from('outfit_items')
        .select('outfit_id')
        .eq('garment_id', garmentId);

      if (itemsErr || !outfitItems?.length) return [];

      const outfitIds = [...new Set(outfitItems.map(i => i.outfit_id))];

      // Fetch those outfits with their items
      const { data: outfits, error: outfitsErr } = await supabase
        .from('outfits')
        .select(`
          id, occasion, style_vibe, generated_at, planned_for,
          outfit_items (
            id, slot, garment_id,
            garment:garments ( id, title, image_path )
          )
        `)
        .in('id', outfitIds)
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(10);

      if (outfitsErr) return [];
      return outfits || [];
    },
    enabled: !!garmentId && !!user,
    staleTime: 5 * 60 * 1000,
  });
}
