import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Garment = Tables<'garments'>;

export interface GarmentFilters {
  search?: string;
  category?: string;
  color?: string;
  season?: string;
  formality?: number;
  inLaundry?: boolean;
  sortBy?: 'last_worn_at' | 'created_at' | 'wear_count';
}

export function useGarments(filters?: GarmentFilters) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['garments', user?.id, filters],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('garments')
        .select('*')
        .eq('user_id', user.id);
      
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters?.color) {
        query = query.eq('color_primary', filters.color);
      }
      
      if (filters?.season) {
        query = query.contains('season_tags', [filters.season]);
      }
      
      if (filters?.formality !== undefined) {
        query = query.eq('formality', filters.formality);
      }
      
      if (filters?.inLaundry !== undefined) {
        query = query.eq('in_laundry', filters.inLaundry);
      }
      
      // Sort
      const sortBy = filters?.sortBy || 'created_at';
      query = query.order(sortBy, { ascending: false, nullsFirst: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Client-side search filter
      let results = data as Garment[];
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(g => 
          g.title.toLowerCase().includes(searchLower) ||
          g.category.toLowerCase().includes(searchLower) ||
          g.color_primary.toLowerCase().includes(searchLower)
        );
      }
      
      return results;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

export function useGarment(id: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['garment', id],
    queryFn: async () => {
      if (!id || !user) return null;
      
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data as Garment;
    },
    enabled: !!id && !!user,
  });
}

export function useCreateGarment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (garment: Omit<TablesInsert<'garments'>, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('garments')
        .insert({ ...garment, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
    },
  });
}

export function useUpdateGarment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'garments'> }) => {
      const { data, error } = await supabase
        .from('garments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garment', data.id] });
    },
  });
}

export function useDeleteGarment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('garments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
    },
  });
}

export function useMarkGarmentWorn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (garmentId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get current wear count
      const { data: garment } = await supabase
        .from('garments')
        .select('wear_count')
        .eq('id', garmentId)
        .single();
      
      // Update garment
      const { error: updateError } = await supabase
        .from('garments')
        .update({
          last_worn_at: today,
          wear_count: (garment?.wear_count || 0) + 1
        })
        .eq('id', garmentId);
      
      if (updateError) throw updateError;
      
      // Create wear log
      const { error: logError } = await supabase
        .from('wear_logs')
        .insert({
          user_id: user.id,
          garment_id: garmentId,
          worn_at: today,
        });
      
      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
    },
  });
}

export function useGarmentCount() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['garments-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('garments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
