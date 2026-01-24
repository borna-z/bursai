import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Outfit = Tables<'outfits'>;
export type OutfitItem = Tables<'outfit_items'>;

export interface OutfitWithItems extends Outfit {
  outfit_items: (OutfitItem & {
    garment: Tables<'garments'>;
  })[];
}

export function useOutfits(savedOnly = true) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['outfits', user?.id, savedOnly],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('outfits')
        .select(`
          *,
          outfit_items (
            *,
            garment:garments (*)
          )
        `)
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false });
      
      if (savedOnly) {
        query = query.eq('saved', true);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as unknown as OutfitWithItems[];
    },
    enabled: !!user,
  });
}

export function useOutfit(id: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['outfit', id],
    queryFn: async () => {
      if (!id || !user) return null;
      
      const { data, error } = await supabase
        .from('outfits')
        .select(`
          *,
          outfit_items (
            *,
            garment:garments (*)
          )
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data as unknown as OutfitWithItems;
    },
    enabled: !!id && !!user,
  });
}

export function useCreateOutfit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      outfit, 
      items 
    }: { 
      outfit: Omit<TablesInsert<'outfits'>, 'user_id'>; 
      items: { garment_id: string; slot: string }[] 
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Create outfit
      const { data: outfitData, error: outfitError } = await supabase
        .from('outfits')
        .insert({ ...outfit, user_id: user.id })
        .select()
        .single();
      
      if (outfitError) throw outfitError;
      
      // Create outfit items
      const outfitItems = items.map(item => ({
        outfit_id: outfitData.id,
        garment_id: item.garment_id,
        slot: item.slot,
      }));
      
      const { error: itemsError } = await supabase
        .from('outfit_items')
        .insert(outfitItems);
      
      if (itemsError) throw itemsError;
      
      return outfitData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
    },
  });
}

export function useUpdateOutfit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'outfits'> }) => {
      const { data, error } = await supabase
        .from('outfits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit', data.id] });
    },
  });
}

export function useDeleteOutfit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('outfits')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
    },
  });
}

export function useMarkOutfitWorn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ outfitId, garmentIds }: { outfitId: string; garmentIds: string[] }) => {
      if (!user) throw new Error('Not authenticated');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Update outfit
      const { error: outfitError } = await supabase
        .from('outfits')
        .update({ worn_at: today })
        .eq('id', outfitId);
      
      if (outfitError) throw outfitError;
      
      // Update each garment and create wear logs
      for (const garmentId of garmentIds) {
        await supabase
          .from('garments')
          .update({ last_worn_at: today })
          .eq('id', garmentId);
        
        await supabase
          .from('wear_logs')
          .insert({
            user_id: user.id,
            garment_id: garmentId,
            outfit_id: outfitId,
            worn_at: today,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['garments'] });
    },
  });
}
