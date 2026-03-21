import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { hapticSuccess, hapticHeavy } from '@/lib/haptics';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { filterValidBaseOutfits, validateBaseOutfit } from '@/lib/outfitValidation';

export type Outfit = Tables<'outfits'>;
export type OutfitItem = Tables<'outfit_items'>;

export interface OutfitWeather {
  temp?: number;
  temperature?: number;
  condition?: string;
  precipitation?: string;
  wind?: string;
}

export interface OutfitWithItems extends Omit<Outfit, 'feedback' | 'weather'> {
  outfit_items: (OutfitItem & {
    garment: Tables<'garments'>;
  })[];
  feedback?: string[] | null;
  weather?: OutfitWeather | null;
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
        .order('generated_at', { ascending: false })
        .limit(50);
      
      if (savedOnly) {
        query = query.eq('saved', true);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return filterValidBaseOutfits((data as unknown as OutfitWithItems[]) || []);
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
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
      const outfit = data as unknown as OutfitWithItems;
      return validateBaseOutfit(outfit?.outfit_items || []).isValid ? outfit : null;
    },
    enabled: !!id && !!user,
    staleTime: 60 * 1000,
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
      
      const normalizedItems = items.map((item) => ({ ...item, slot: item.slot }));
      const baseValidation = validateBaseOutfit(normalizedItems.map((item) => ({ slot: item.slot })));
      if (!baseValidation.isValid) {
        throw new Error(`Refusing to persist invalid outfit. Missing: ${baseValidation.missing.join(', ')}`);
      }

      // Create outfit
      const { data: outfitData, error: outfitError } = await supabase
        .from('outfits')
        .insert({ ...outfit, user_id: user.id })
        .select()
        .single();
      
      if (outfitError) throw outfitError;
      
      // Create outfit items
      const outfitItems = normalizedItems.map(item => ({
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
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    onSuccess: () => {
      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
    },
  });
}

export function useUpdateOutfit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'outfits'> }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('outfits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['outfit', id] });
      const prevOutfit = queryClient.getQueryData(['outfit', id]);
      queryClient.setQueryData(['outfit', id], (old: OutfitWithItems | undefined) =>
        old ? { ...old, ...updates } : old
      );
      return { prevOutfit };
    },
    onError: (_err, { id }, context) => {
      if (context?.prevOutfit) {
        queryClient.setQueryData(['outfit', id], context.prevOutfit);
      }
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit', data.id] });
    },
  });
}

export function useDeleteOutfit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('outfits')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    onSuccess: () => {
      hapticHeavy();
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
    },
  });
}

export interface WornResult {
  outfitId: string;
  wornAt: string;
  wearLogIds: string[];
  garmentUpdates: { garmentId: string; previousWearCount: number; previousLastWornAt: string | null }[];
}

export function useMarkOutfitWorn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      outfitId, 
      garmentIds,
      occasion,
      eventTitle,
    }: { 
      outfitId: string; 
      garmentIds: string[];
      occasion?: string;
      eventTitle?: string;
    }): Promise<WornResult> => {
      if (!user) throw new Error('Not authenticated');
      
      const today = new Date().toISOString().split('T')[0];
      const wearLogIds: string[] = [];
      const garmentUpdates: WornResult['garmentUpdates'] = [];
      
      // Update outfit
      const { error: outfitError } = await supabase
        .from('outfits')
        .update({ worn_at: today })
        .eq('id', outfitId);
      
      if (outfitError) throw outfitError;
      
      // Batch: get all garment states at once
      const { data: garmentStates } = await supabase
        .from('garments')
        .select('id, wear_count, last_worn_at')
        .in('id', garmentIds);
      
      const stateMap = new Map(garmentStates?.map(g => [g.id, g]) || []);
      
      for (const garmentId of garmentIds) {
        const g = stateMap.get(garmentId);
        garmentUpdates.push({
          garmentId,
          previousWearCount: g?.wear_count || 0,
          previousLastWornAt: g?.last_worn_at || null,
        });
      }
      
      // Batch: update all garments in parallel
      await Promise.all(garmentIds.map(garmentId => {
        const prev = stateMap.get(garmentId);
        return supabase
          .from('garments')
          .update({ last_worn_at: today, wear_count: (prev?.wear_count || 0) + 1 })
          .eq('id', garmentId);
      }));
      
      // Batch: upsert all wear logs (with event_title for social context)
      const wearLogRows = garmentIds.map(garmentId => ({
        user_id: user.id,
        garment_id: garmentId,
        outfit_id: outfitId,
        worn_at: today,
        occasion: occasion || null,
        event_title: eventTitle || null,
      }));
      
      const { data: wearLogs, error: wearLogError } = await supabase
        .from('wear_logs')
        .upsert(wearLogRows, { onConflict: 'user_id,garment_id,worn_at', ignoreDuplicates: false })
        .select('id');
      
      if (wearLogError) {
        console.error('Wear log error:', wearLogError);
      } else if (wearLogs) {
        wearLogIds.push(...wearLogs.map(l => l.id));
      }
      
      return { outfitId, wornAt: today, wearLogIds, garmentUpdates };
    },
    onSuccess: () => {
      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}

export function useUndoMarkWorn() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (wornResult: WornResult) => {
      // Delete the wear logs we created
      if (wornResult.wearLogIds.length > 0) {
        const { error: deleteLogsError } = await supabase
          .from('wear_logs')
          .delete()
          .in('id', wornResult.wearLogIds);
        
        if (deleteLogsError) throw deleteLogsError;
      }
      
      // Restore garment states
      for (const update of wornResult.garmentUpdates) {
        await supabase
          .from('garments')
          .update({
            wear_count: update.previousWearCount,
            last_worn_at: update.previousLastWornAt,
          })
          .eq('id', update.garmentId);
      }
      
      // Clear outfit worn_at
      const { error: outfitError } = await supabase
        .from('outfits')
        .update({ worn_at: null })
        .eq('id', wornResult.outfitId);
      
      if (outfitError) throw outfitError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}
