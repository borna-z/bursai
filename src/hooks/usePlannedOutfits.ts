import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { OutfitWithItems } from './useOutfits';
import { addDays, format, startOfDay } from 'date-fns';
import { validateBaseOutfit } from '@/lib/outfitValidation';

export interface PlannedOutfit {
  id: string;
  user_id: string;
  date: string;
  outfit_id: string | null;
  status: 'planned' | 'worn' | 'skipped';
  note: string | null;
  created_at: string;
  outfit?: OutfitWithItems | null;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

const PLANNED_OUTFIT_SELECT = `
  *,
  outfit:outfits (
    *,
    outfit_items (
      *,
      garment:garments (*)
    )
  )
`;

export function usePlannedOutfits(dateRange?: DateRange) {
  const { user } = useAuth();
  
  const defaultStart = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const defaultEnd = format(addDays(new Date(), 6), 'yyyy-MM-dd');
  
  const start = dateRange?.startDate || defaultStart;
  const end = dateRange?.endDate || defaultEnd;
  
  return useQuery({
    queryKey: ['planned-outfits', user?.id, start, end],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('planned_outfits')
        .select(PLANNED_OUTFIT_SELECT)
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });
      
      if (error) throw error;
      return (data as PlannedOutfit[]).map((entry) => ({
        ...entry,
        outfit: entry.outfit && validateBaseOutfit(entry.outfit.outfit_items || []).isValid ? entry.outfit : null,
      }));
    },
    enabled: !!user,
  });
}

export function usePlannedOutfitsForDate(date: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['planned-outfits-day', user?.id, date],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('planned_outfits')
        .select(PLANNED_OUTFIT_SELECT)
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data as PlannedOutfit[]).map((entry) => ({
        ...entry,
        outfit: entry.outfit && validateBaseOutfit(entry.outfit.outfit_items || []).isValid ? entry.outfit : null,
      }));
    },
    enabled: !!user && !!date,
  });
}

/** @deprecated Use usePlannedOutfitsForDate instead */
export function usePlannedOutfitForDate(date: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['planned-outfit', user?.id, date],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('planned_outfits')
        .select(PLANNED_OUTFIT_SELECT)
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle();
      
      if (error) throw error;
      const entry = data as PlannedOutfit | null;
      if (!entry?.outfit) return entry;
      return validateBaseOutfit(entry.outfit.outfit_items || []).isValid ? entry : { ...entry, outfit: null };
    },
    enabled: !!user && !!date,
  });
}

const MAX_OUTFITS_PER_DAY = 4;

export function useUpsertPlannedOutfit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      date, 
      outfitId, 
      status = 'planned',
      note 
    }: { 
      date: string; 
      outfitId: string | null;
      status?: 'planned' | 'worn' | 'skipped';
      note?: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Check count for this day
      const { count, error: countErr } = await supabase
        .from('planned_outfits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', date);
      
      if (countErr) throw countErr;
      if ((count || 0) >= MAX_OUTFITS_PER_DAY) {
        throw new Error(`Maximum ${MAX_OUTFITS_PER_DAY} outfits per day`);
      }
      
      const { data, error } = await supabase
        .from('planned_outfits')
        .insert({
          user_id: user.id,
          date,
          outfit_id: outfitId,
          status,
          note: note || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] });
      queryClient.invalidateQueries({ queryKey: ['planned-outfit'] });
    },
  });
}

export function useUpdatePlannedOutfitStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      status 
    }: { 
      id: string; 
      status: 'planned' | 'worn' | 'skipped';
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('planned_outfits')
        .update({ status })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] });
      queryClient.invalidateQueries({ queryKey: ['planned-outfit'] });
    },
  });
}

export function useDeletePlannedOutfit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('planned_outfits')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] });
      queryClient.invalidateQueries({ queryKey: ['planned-outfit'] });
    },
  });
}
