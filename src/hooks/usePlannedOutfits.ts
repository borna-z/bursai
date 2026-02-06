import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { OutfitWithItems } from './useOutfits';
import { addDays, format, startOfDay } from 'date-fns';

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

export function usePlannedOutfits(dateRange?: DateRange) {
  const { user } = useAuth();
  
  // Default to today + 6 days (7 days total)
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
        .select(`
          *,
          outfit:outfits (
            *,
            outfit_items (
              *,
              garment:garments (*)
            )
          )
        `)
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data as PlannedOutfit[];
    },
    enabled: !!user,
  });
}

export function usePlannedOutfitForDate(date: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['planned-outfit', user?.id, date],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('planned_outfits')
        .select(`
          *,
          outfit:outfits (
            *,
            outfit_items (
              *,
              garment:garments (*)
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle();
      
      if (error) throw error;
      return data as PlannedOutfit | null;
    },
    enabled: !!user && !!date,
  });
}

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
      
      const { data, error } = await supabase
        .from('planned_outfits')
        .upsert({
          user_id: user.id,
          date,
          outfit_id: outfitId,
          status,
          note: note || null,
        }, {
          onConflict: 'user_id,date',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-outfits'] });
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
      queryClient.invalidateQueries({ queryKey: ['planned-outfit'] });
    },
  });
}
