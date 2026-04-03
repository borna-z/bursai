import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { hapticSuccess, hapticHeavy } from '@/lib/haptics';
import { enqueue } from '@/lib/offlineQueue';
import { resumePendingGarmentRenders } from '@/lib/garmentIntelligence';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Garment = Tables<'garments'>;

export interface GarmentFilters {
  category?: string;
  color?: string;
  season?: string;
  formality?: number;
  inLaundry?: boolean;
  sortBy?: 'last_worn_at' | 'created_at' | 'wear_count';
}

const PAGE_SIZE = 30;

function sanitizeIlikeSearchTerm(value: string) {
  return value
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/[%_,()]/g, '\\$&');
}

export function useGarments(filters?: GarmentFilters) {
  const { user } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ['garments', user?.id, filters],
    queryFn: async ({ pageParam = 0 }) => {
      if (!user) return { items: [] as Garment[], nextPage: undefined };
      
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
      
      // Pagination
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);
      
      const { data, error } = await query;

      if (error) throw error;

      return {
        items: data as Garment[],
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    refetchInterval: (query) => {
      const pages = query.state.data?.pages ?? [];
      const hasProcessingGarments = pages.some((page) =>
        page.items.some((garment) =>
          garment.image_processing_status === 'pending' ||
          garment.image_processing_status === 'processing' ||
          garment.render_status === 'pending' ||
          garment.render_status === 'rendering'
        )
      );

      return hasProcessingGarments ? 5000 : false;
    },
  });

  useEffect(() => {
    if (!user || !query.data) {
      return;
    }

    const hasPendingRenders = query.data.pages.some((page) =>
      page.items.some((garment) => garment.render_status === 'pending')
    );

    if (!hasPendingRenders) {
      return;
    }

    void resumePendingGarmentRenders(user.id);
  }, [query.data, user]);

  return query;
}

/** Flattens InfiniteData pages into a plain Garment[] for consumers that need all items */
export function useFlatGarments(filters?: GarmentFilters) {
  const query = useGarments(filters);
  const garments = useMemo(
    () => query.data?.pages.flatMap(p => p.items) ?? [],
    [query.data]
  );
  return { ...query, data: garments };
}

/** Server-side search across all garments (no pagination). Uses FTS with ilike fallback. */
export function useGarmentSearch(searchTerm: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['garments-search', user?.id, searchTerm],
    queryFn: async () => {
      if (!user || !searchTerm.trim()) return [] as Garment[];

      // Build a tsquery from the search term
      // Multi-word: "blue jeans" → "blue:* & jeans:*"
      // Single word: "jeans" → "jeans:*"
      const sanitized = searchTerm.trim().replace(/[^\w\s\-åäöæøüéèçß]/gi, '').trim();
      const tsQuery = sanitized
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word + ':*')
        .join(' & ');

      if (tsQuery) {
        try {
          const { data, error } = await supabase
            .from('garments')
            .select('*')
            .eq('user_id', user.id)
            .textSearch('fts', tsQuery, { config: 'simple' })
            .order('created_at', { ascending: false })
            .limit(200);

          if (!error && data) return data as Garment[];
        } catch {
          // Fall through to ilike fallback
        }
      }

      // ilike fallback for short/special queries
      const term = `%${sanitizeIlikeSearchTerm(searchTerm)}%`;
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .eq('user_id', user.id)
        .or(`title.ilike.${term},category.ilike.${term},color_primary.ilike.${term}`)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as Garment[];
    },
    enabled: !!user && searchTerm.trim().length > 0,
    staleTime: 30_000,
  });
}

export function useGarment(id: string | undefined, options?: { refetchInterval?: number | false }) {
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
    refetchInterval: options?.refetchInterval,
  });
}

export function invalidateWardrobeQueries(queryClient: ReturnType<typeof useQueryClient>, userId?: string) {
  queryClient.invalidateQueries({ queryKey: userId ? ['garments', userId] : ['garments'] });
  queryClient.invalidateQueries({ queryKey: userId ? ['garments-count', userId] : ['garments-count'] });
  queryClient.invalidateQueries({ queryKey: ['garment'] });
  queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
  queryClient.invalidateQueries({ queryKey: ['insights'] });
  queryClient.invalidateQueries({ queryKey: userId ? ['outfits', userId] : ['outfits'] });
  queryClient.invalidateQueries({ queryKey: ['planned-outfits'] });
  queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] });
  queryClient.invalidateQueries({ queryKey: ['garments-by-ids'] });
  if (userId) {
    queryClient.invalidateQueries({ queryKey: ['garments-search', userId] });
  }
}

export function useCreateGarment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (garment: Omit<TablesInsert<'garments'>, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');
      
      // Offline: enqueue mutation for later replay
      if (!navigator.onLine) {
        enqueue({
          table: 'garments',
          type: 'insert',
          payload: { ...garment, user_id: user.id },
        });
        return { ...garment, user_id: user.id, id: crypto.randomUUID() } as Tables<'garments'>;
      }
      
      const { data, error } = await supabase
        .from('garments')
        .insert({ ...garment, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    onSuccess: () => {
      hapticSuccess();
      invalidateWardrobeQueries(queryClient, user?.id);
    },
  });
}

export function useUpdateGarment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'garments'> }) => {
      // Offline: enqueue mutation for later replay
      if (!navigator.onLine) {
        enqueue({
          table: 'garments',
          type: 'update',
          payload: updates as Record<string, unknown>,
          match: { id },
        });
        return { id, ...updates } as Tables<'garments'>;
      }
      
      const { data, error } = await supabase
        .from('garments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: user?.id ? ['garments', user.id] : ['garments'] });
      await queryClient.cancelQueries({ queryKey: ['garment', id] });
      const prevGarment = queryClient.getQueryData(['garment', id]);
      queryClient.setQueryData(['garment', id], (old: Garment | undefined) =>
        old ? { ...old, ...updates } : old
      );
      return { prevGarment };
    },
    onError: (_err, { id }, context) => {
      if (context?.prevGarment) {
        queryClient.setQueryData(['garment', id], context.prevGarment);
      }
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    onSuccess: (data) => {
      hapticSuccess();
      invalidateWardrobeQueries(queryClient, user?.id);
      queryClient.invalidateQueries({ queryKey: ['garment', data.id] });
    },
  });
}

export function useDeleteGarment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('garments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    onSuccess: () => {
      hapticHeavy();
      invalidateWardrobeQueries(queryClient, user?.id);
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
      localStorage.setItem('burs_first_wear_logged', 'true');
      queryClient.invalidateQueries({ queryKey: ['garments', user?.id] });
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
