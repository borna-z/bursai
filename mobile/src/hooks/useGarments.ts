// Garment data hooks for mobile. React Query–backed; mirrors the relevant
// shape of the web's `src/hooks/useGarments.ts` but slimmed down — no offline
// queue, no haptics dependency, no atomic-delete RPC (mobile uses a simple
// soft-friendly DELETE for now; the web's RPC handles render-credit refunds
// which mobile won't trigger until Wave 9+ render is wired).
//
// All queries scope by `user_id` AND let RLS enforce the same constraint
// server-side — defense in depth. Without an authenticated user the queries
// stay disabled, returning empty arrays.
//
// Pagination uses Supabase `.range()` with PAGE_SIZE=30. Smart filters
// (rarely_worn / most_worn) own their sort order; otherwise sortBy applies
// (default created_at desc).

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Garment, GarmentFilters, GarmentUpdate } from '../types/garment';

const PAGE_SIZE = 30;
const RARELY_WORN_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000;

// PostgREST treats `%` and `_` as ilike wildcards; an unsanitized search term
// containing those characters lets a user accidentally match anything. The
// backslash escapes them; `\\` is also escaped so a typed backslash doesn't
// leak into the pattern.
function sanitizeIlikeTerm(value: string): string {
  return value.trim().replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');
}

export function useGarments(filters?: GarmentFilters) {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ['garments', user?.id, filters],
    queryFn: async ({ pageParam = 0 }) => {
      if (!user) return { items: [] as Garment[], nextPage: undefined };

      let query = supabase.from('garments').select('*').eq('user_id', user.id);

      // Smart filter sort wins — they encode the intent (most-worn,
      // rarely-worn) better than a raw column choice.
      if (filters?.smartFilter === 'most_worn') {
        query = query.gt('wear_count', 0).order('wear_count', { ascending: false });
      } else if (filters?.smartFilter === 'rarely_worn') {
        const cutoff = new Date(Date.now() - RARELY_WORN_CUTOFF_MS).toISOString();
        query = query
          .or(`last_worn_at.is.null,last_worn_at.lt.${cutoff}`)
          .order('wear_count', { ascending: true, nullsFirst: true });
      } else if (filters?.smartFilter === 'new') {
        query = query.order('created_at', { ascending: false, nullsFirst: false });
      } else {
        const sortBy = filters?.sortBy ?? 'created_at';
        query = query.order(sortBy, { ascending: false, nullsFirst: false });
      }

      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.color) query = query.eq('color_primary', filters.color);
      if (filters?.season) query = query.contains('season_tags', [filters.season]);
      if (filters?.inLaundry !== undefined) query = query.eq('in_laundry', filters.inLaundry);
      if (filters?.search?.trim()) {
        const term = sanitizeIlikeTerm(filters.search);
        query = query.ilike('title', `%${term}%`);
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error } = await query;
      if (error) throw error;

      const items = (data ?? []) as Garment[];
      return {
        items,
        nextPage: items.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (last) => last.nextPage,
    initialPageParam: 0,
    enabled: !!user,
  });
}

/** Flattens InfiniteData pages into a plain Garment[]. */
export function useFlatGarments(filters?: GarmentFilters) {
  const query = useGarments(filters);
  // useMemo prevents identity churn on every render — important for FlatList
  // referential equality (avoids re-rendering every cell when nothing
  // changed).
  const data = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );
  return { ...query, data };
}

export function useGarment(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    // Scope by user.id so a sign-out + sign-in as a different user never
    // serves user A's cached garment row to user B. Without the user.id
    // segment, the (id, _) cache key would collide across accounts on the
    // same device.
    queryKey: ['garment', user?.id, id],
    queryFn: async () => {
      if (!id || !user) return null;
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Garment | null) ?? null;
    },
    enabled: !!id && !!user,
  });
}

export function useUpdateGarment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: GarmentUpdate }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('garments')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data as Garment;
    },
    onSuccess: (data) => {
      // Refresh every list query (key prefix ['garments']) and the single
      // garment query for the updated row. Setting the single-garment data
      // directly avoids a round-trip when the detail screen is open during
      // the mutation.
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.setQueryData(['garment', user?.id, data.id], data);
    },
  });
}

export function useDeleteGarment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('garments')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.removeQueries({ queryKey: ['garment', user?.id, id] });
    },
  });
}

export function useMarkLaundry() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, inLaundry }: { id: string; inLaundry: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('garments')
        .update({ in_laundry: inLaundry })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garment', user?.id, id] });
    },
  });
}

/**
 * Increments wear_count and stamps last_worn_at = now. Mirrors the web's
 * `useMarkGarmentWorn` minus the wear_logs insert (which is a wave-9 concern).
 */
export function useMarkWorn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      // Read-modify-write — server-side increment isn't exposed via REST,
      // so we fetch the current count and write +1. Concurrent wears would
      // last-write-win; not worth a transaction for this UX.
      const { data: existing, error: readError } = await supabase
        .from('garments')
        .select('wear_count')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (readError) throw readError;
      const next = (existing?.wear_count ?? 0) + 1;
      const { data, error } = await supabase
        .from('garments')
        .update({
          wear_count: next,
          last_worn_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data as Garment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.setQueryData(['garment', user?.id, data.id], data);
    },
  });
}
