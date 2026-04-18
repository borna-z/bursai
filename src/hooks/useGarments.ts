import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { hapticSuccess, hapticHeavy } from '@/lib/haptics';
import { enqueue } from '@/lib/offlineQueue';
import { resumePendingGarmentRenders } from '@/lib/garmentIntelligence';
import { logger } from '@/lib/logger';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Garment = Tables<'garments'>;

export type SmartFilter = 'rarely_worn' | 'most_worn' | 'new';

export interface GarmentFilters {
  category?: string;
  color?: string;
  season?: string;
  formality?: number;
  inLaundry?: boolean;
  sortBy?: 'last_worn_at' | 'created_at' | 'wear_count';
  smartFilter?: SmartFilter | null;
}

const RARELY_WORN_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000;

function applyFilters<Q extends { eq: (col: string, val: unknown) => Q; contains: (col: string, val: unknown) => Q; or: (filters: string) => Q; gt: (col: string, val: unknown) => Q }>(
  query: Q,
  filters?: GarmentFilters,
): Q {
  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.color) query = query.eq('color_primary', filters.color);
  if (filters?.season) query = query.contains('season_tags', [filters.season]);
  if (filters?.formality !== undefined) query = query.eq('formality', filters.formality);
  if (filters?.inLaundry !== undefined) query = query.eq('in_laundry', filters.inLaundry);
  if (filters?.smartFilter === 'rarely_worn') {
    const cutoff = new Date(Date.now() - RARELY_WORN_CUTOFF_MS).toISOString();
    query = query.or(`last_worn_at.is.null,last_worn_at.lt.${cutoff}`);
  } else if (filters?.smartFilter === 'most_worn') {
    query = query.gt('wear_count', 0);
  }
  // 'new' needs no additional filter — just the default created_at sort.
  return query;
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

      query = applyFilters(query, filters);

      // Smart filters own their sort; sortBy is only applied when no smart filter is active.
      if (filters?.smartFilter === 'rarely_worn') {
        query = query.order('wear_count', { ascending: true, nullsFirst: true });
      } else if (filters?.smartFilter === 'most_worn') {
        query = query.order('wear_count', { ascending: false });
      } else if (filters?.smartFilter === 'new') {
        query = query.order('created_at', { ascending: false, nullsFirst: false });
      } else {
        const sortBy = filters?.sortBy || 'created_at';
        query = query.order(sortBy, { ascending: false, nullsFirst: false });
      }
      
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

      // Bounded to 10s to avoid hammering supabase on large wardrobes while
      // image processing / render status updates settle.
      return hasProcessingGarments ? 10000 : false;
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
  queryClient.invalidateQueries({ queryKey: userId ? ['garments-smart-counts', userId] : ['garments-smart-counts'] });
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
  // Bust server-side insights cache
  if (userId) {
    try {
      supabase.from('ai_response_cache').delete()
        .eq('cache_key', `insights_dashboard_${userId}`)
        .then(() => {});
    } catch { /* fire-and-forget */ }
  }
}

export function useCreateGarment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (garment: Omit<TablesInsert<'garments'>, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');

      const payload = {
        ...garment,
        id: garment.id ?? crypto.randomUUID(),
        user_id: user.id,
      } satisfies TablesInsert<'garments'>;
      
      // Offline: enqueue mutation for later replay
      if (!navigator.onLine) {
        enqueue({
          table: 'garments',
          type: 'insert',
          payload,
        });
        return payload as Tables<'garments'>;
      }
      
      const { error } = await supabase
        .from('garments')
        .insert(payload);
      
      if (error) throw error;
      return payload as Tables<'garments'>;
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
      if (!user) throw new Error('Not authenticated');
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
        .eq('user_id', user.id)
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
      if (!user) throw new Error('Not authenticated');

      // Atomic delete-with-release (Codex round 13 redesign). The RPC
      // releases any active render_jobs reservations AND deletes the
      // garment in ONE transaction. Replaces the round-12 two-step
      // release-then-delete which had two design flaws:
      //   (1) Race between concurrent deletes double-refunding the
      //       balance before either insert committed.
      //   (2) Split client-side transaction: if release succeeded and
      //       DELETE failed, worker's eventual consume hit already_terminal
      //       and the user got a free render.
      //
      // Atomic RPC rolls back both or commits both. Server-side
      // render_credits FOR UPDATE lock serializes concurrent callers.
      const { data, error } = await supabase.rpc(
        'delete_garment_with_release_atomic',
        { p_garment_id: id, p_user_id: user.id },
      );

      if (error) throw error;

      // Shape: { ok, released_count, garment_deleted, reason? }
      const result = data as {
        ok: boolean;
        released_count: number;
        garment_deleted: boolean;
        reason?: string;
      } | null;

      if (!result || result.ok !== true) {
        throw new Error(`delete_garment_with_release_atomic returned non-ok: ${result?.reason ?? 'unknown'}`);
      }

      if (result.released_count > 0) {
        logger.info('[useDeleteGarment] released active reservations before cascade', {
          garment_id: id,
          released_count: result.released_count,
        });
      }

      // ok=true + garment_deleted=false with reason='garment_not_found' is
      // idempotent success — retry after a prior successful delete lands
      // here. Don't throw.
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
        .eq('user_id', user.id)
        .single();

      // Update garment
      const { error: updateError } = await supabase
        .from('garments')
        .update({
          last_worn_at: today,
          wear_count: (garment?.wear_count || 0) + 1
        })
        .eq('id', garmentId)
        .eq('user_id', user.id);
      
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
      queryClient.invalidateQueries({ queryKey: ['garments', user?.id] });
    },
  });
}

export function useSmartFilterCounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['garments-smart-counts', user?.id],
    queryFn: async () => {
      if (!user) return { rarely_worn: 0, most_worn: 0, new: 0 };
      const cutoff = new Date(Date.now() - RARELY_WORN_CUTOFF_MS).toISOString();
      const [total, mostWorn, rarelyWorn] = await Promise.all([
        supabase.from('garments').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('garments').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gt('wear_count', 0),
        supabase.from('garments').select('*', { count: 'exact', head: true }).eq('user_id', user.id).or(`last_worn_at.is.null,last_worn_at.lt.${cutoff}`),
      ]);
      // Fail fast on any error so React Query retries instead of caching a
      // corrupted zero-count payload that would hide Smart Access tiles.
      if (total.error) throw total.error;
      if (mostWorn.error) throw mostWorn.error;
      if (rarelyWorn.error) throw rarelyWorn.error;
      return {
        rarely_worn: rarelyWorn.count ?? 0,
        most_worn: mostWorn.count ?? 0,
        new: total.count ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

export function useGarmentCount(filters?: GarmentFilters) {
  const { user } = useAuth();

  return useQuery({
    // Preserve the old cache key when no filters are provided so legacy
    // callers (useAddGarment, etc.) share the same cache entry they always did.
    queryKey: filters ? ['garments-count', user?.id, filters] : ['garments-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      let query = supabase
        .from('garments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      query = applyFilters(query, filters);

      const { count, error } = await query;

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
