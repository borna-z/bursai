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
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';
import type { Garment, GarmentFilters, GarmentUpdate } from '../types/garment';

const PAGE_SIZE = 30;
const RARELY_WORN_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000;

// PostgREST treats `%` and `_` as ilike wildcards; an unsanitized search term
// containing those characters lets a user accidentally match anything. The
// backslash escapes them; `\\` is also escaped so a typed backslash doesn't
// leak into the pattern. Commas/parens cannot break out of an ilike value
// (verified by the audit) — only `%/_` need escaping.
function sanitizeIlikeTerm(value: string): string {
  return value.trim().replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');
}

type GarmentPage = { items: Garment[]; nextPage: number | undefined };

export function useGarments(filters?: GarmentFilters, enabled = true) {
  const { user } = useAuth();

  return useInfiniteQuery<GarmentPage, Error, InfiniteData<GarmentPage>, readonly unknown[], number>({
    queryKey: ['garments', user?.id, filters],
    queryFn: async ({ pageParam = 0 }) => {
      if (!user) return { items: [], nextPage: undefined };

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
    enabled: !!user && enabled,
    // 30s gcTime keeps mid-typing search results from accumulating in memory,
    // but applying that to non-search browsing was wrong: Wardrobe → push
    // GarmentDetail → goBack with reading-time > 30s caused the infinite
    // query to evict and reload from page 0, dropping any pages 2+ the user
    // had paginated to. Audit R on PR #718. Non-search queries get the
    // default 5min so a normal navigation round-trip preserves pagination.
    gcTime: filters?.search?.trim() ? 30_000 : 5 * 60_000,
  });
}

/**
 * Flattens InfiniteData pages into a plain Garment[]. Memo keyed on the
 * `pages` reference itself: React Query's `setQueriesData` updater returns a
 * new pages array (and new page objects) every time it touches a row, so
 * relying on the array reference is correct AND covers in-page mutations
 * (e.g. `markWorn` updating an item in the middle of page 0). An earlier
 * version keyed on a length-+-edge-ids fingerprint as a refresh-thrash
 * optimisation, but that turned out to be unsafe — middle-of-page mutations
 * left the fingerprint identical so consumers (Wardrobe / Laundry / Search /
 * Used / Unused) saw a stale flattened array. Codex P1 round 1 on PR #718.
 */
type FlatGarments = Omit<UseInfiniteQueryResult<InfiniteData<GarmentPage>, Error>, 'data'> & {
  data: Garment[];
};

export function useFlatGarments(filters?: GarmentFilters, enabled = true): FlatGarments {
  const query = useGarments(filters, enabled);
  const pages = query.data?.pages;

  const data = useMemo(() => pages?.flatMap((p) => p.items) ?? [], [pages]);

  return { ...query, data };
}

/**
 * Targeted lookup of garments by id list — for AI-result screens that need
 * to resolve image paths against arbitrary garment ids the engine returned
 * (potentially older rows outside the wardrobe's first paginated page).
 * `useFlatGarments()` only contains whatever pages the user has scrolled
 * through, so for users with > 30 garments those older ids miss the cache;
 * this hook does an in-clause fetch scoped to the exact ids the consumer
 * needs. Codex P2 on PR #780 (2026-05-09) — MoodFlowScreen + StyleMeScreen
 * were rendering gradients for engine-selected garments outside the first
 * page; this hook is the supplied lookup. Returns the rows keyed nowhere
 * special — consumers `useMemo` a Map<id, imagePath> on top.
 *
 * Caching: the query key is the SORTED, DEDUPED id list so two screens
 * asking for overlapping subsets share the cache; a re-render with the
 * same ids in different order doesn't re-fire the query. Stable across
 * the natural lifetime of an AI result screen mount.
 */
export function useGarmentsByIds(ids: readonly string[]) {
  const { user } = useAuth();
  // Stable key — sort + dedupe so order/duplicate variation doesn't
  // fragment the cache. `useMemo` keeps the array reference stable across
  // renders that don't change the underlying id set.
  const sortedIds = useMemo(() => {
    const set = new Set(ids.filter((id) => typeof id === 'string' && id.length > 0));
    return Array.from(set).sort();
  }, [ids]);
  const idsKey = sortedIds.join(',');

  return useQuery({
    queryKey: ['garments-by-ids', user?.id, idsKey],
    queryFn: async (): Promise<Garment[]> => {
      if (!user || sortedIds.length === 0) return [];
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .in('id', sortedIds)
        .eq('user_id', user.id);
      if (error) throw error;
      return (data ?? []) as Garment[];
    },
    enabled: !!user && sortedIds.length > 0,
    // 5 min — these are rarely-changing hydration lookups; the AI result
    // screen mounts, reads imagePath once, and the row data isn't going
    // to drift in the user's wardrobe during the screen's lifetime.
    staleTime: 5 * 60 * 1000,
  });
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

// Patch a garment row inside every cached `useGarments` page that contains it.
// Used by optimistic mutations (markWorn / markLaundry / update) so list
// surfaces (Wardrobe / Laundry / Used / Unused) reflect the change before the
// server round-trip lands. The single-garment cache is also patched.
function patchGarmentInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
  garmentId: string,
  patch: Partial<Garment>,
) {
  // 1. Single-garment cache.
  queryClient.setQueryData(['garment', userId, garmentId], (prev: Garment | null | undefined) =>
    prev ? { ...prev, ...patch } : prev,
  );
  // 2. Every list page across every garments query (filters / smart filters /
  //    laundry / search). React Query's setQueriesData walks the cache by
  //    key prefix and applies the updater to each match.
  queryClient.setQueriesData<InfiniteData<GarmentPage> | undefined>(
    { queryKey: ['garments', userId] },
    (prev) => {
      if (!prev) return prev;
      let mutated = false;
      const nextPages = prev.pages.map((page) => {
        let pageChanged = false;
        const items = page.items.map((g) => {
          if (g.id !== garmentId) return g;
          pageChanged = true;
          mutated = true;
          return { ...g, ...patch };
        });
        return pageChanged ? { ...page, items } : page;
      });
      return mutated ? { ...prev, pages: nextPages } : prev;
    },
  );
}

type UpdateContext = { previousSnapshot: Garment | null | undefined };

export function useUpdateGarment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<Garment, Error, { id: string; updates: GarmentUpdate }, UpdateContext>({
    mutationFn: async ({ id, updates }) => {
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
    onMutate: async ({ id, updates }) => {
      // Optimistic — patch every cached row + the single garment, snapshot
      // the prior state so onError can roll back.
      await queryClient.cancelQueries({ queryKey: ['garment', user?.id, id] });
      const previousSnapshot = queryClient.getQueryData<Garment | null>(
        ['garment', user?.id, id],
      );
      patchGarmentInCaches(queryClient, user?.id, id, updates as Partial<Garment>);
      return { previousSnapshot };
    },
    onError: (err, { id }, context) => {
      captureMutationError('useUpdateGarment')(err);
      if (context?.previousSnapshot !== undefined) {
        queryClient.setQueryData(['garment', user?.id, id], context.previousSnapshot);
      }
      // Lists will resync from the invalidate-and-refetch on settle.
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
    },
    onSuccess: (data) => {
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
      // garments-count is a sibling cache key; ['garments'] prefix-match
      // does not cover it, so the count would stay stale until staleTime.
      queryClient.invalidateQueries({ queryKey: ['garments-count'] });
      // Profile stats bundle (M29) — Profile + SettingsScreen counters
      // both read this key; without the explicit invalidation the badge
      // stays stale up to staleTime (60s).
      queryClient.invalidateQueries({ queryKey: ['wardrobeStats', user?.id] });
      queryClient.removeQueries({ queryKey: ['garment', user?.id, id] });
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
    },
    onError: captureMutationError('useDeleteGarment'),
  });
}

type MarkLaundryArgs = { id: string; inLaundry: boolean };

export function useMarkLaundry(): UseMutationResult<void, Error, MarkLaundryArgs, UpdateContext> {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, MarkLaundryArgs, UpdateContext>({
    mutationFn: async ({ id, inLaundry }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('garments')
        .update({ in_laundry: inLaundry })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onMutate: async ({ id, inLaundry }) => {
      await queryClient.cancelQueries({ queryKey: ['garment', user?.id, id] });
      const previousSnapshot = queryClient.getQueryData<Garment | null>(
        ['garment', user?.id, id],
      );
      patchGarmentInCaches(queryClient, user?.id, id, { in_laundry: inLaundry });
      return { previousSnapshot };
    },
    onError: (err, { id }, context) => {
      captureMutationError('useMarkLaundry')(err);
      if (context?.previousSnapshot !== undefined) {
        queryClient.setQueryData(['garment', user?.id, id], context.previousSnapshot);
      }
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garment', user?.id, id] });
      // Insights derives every metric from garments + wear_logs — refetch so
      // the gauges, palette, weekly bars, and most-worn list don't lie for up
      // to staleTime (5min) after a wear / laundry / update.
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
    },
  });
}

/**
 * Increments wear_count and stamps last_worn_at = now via the
 * `increment_wear_count(uuid)` RPC (post-launch theme-2 schema hardening).
 * Single-statement UPDATE-with-RETURNING on the server, so concurrent wears
 * accumulate instead of last-write-winning.
 *
 * The RPC's WHERE clause pins `user_id = auth.uid()`, so an unowned garment
 * id returns zero rows and the mutation surfaces a "Garment not found"
 * error — RLS on `garments` remains in effect as a second line of defense.
 *
 * The mutation result type is the narrow RPC return shape (id, wear_count,
 * last_worn_at) — not the full Garment — because callers only use
 * `isPending` / `onError` and never read `data`. Cache convergence to the
 * canonical wear_count happens inside `mutationFn` via `patchGarmentInCaches`.
 */
type WearCountIncrement = { id: string; wear_count: number; last_worn_at: string };

export function useMarkWorn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<WearCountIncrement, Error, string, UpdateContext>({
    mutationFn: async (id) => {
      if (!user) throw new Error('Not authenticated');
      // RPC returns SETOF (id, wear_count, last_worn_at). `.maybeSingle()`
      // gives null when the row isn't owned (or doesn't exist) — surface
      // that as an explicit error so the optimistic +1 rolls back.
      const { data, error } = await supabase
        .rpc('increment_wear_count', { p_garment_id: id })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Garment not found');
      const rpcRow = data as WearCountIncrement;
      // Patch the canonical (wear_count, last_worn_at) into single + every
      // list cache. patchGarmentInCaches gates the single-cache write on
      // `prev` truthiness, so a cache miss is a true no-op — the next
      // fetch will hydrate the full row. List caches are merged in place
      // when the row is already paginated. This replaces the optimistic
      // +1 with the canonical server count.
      patchGarmentInCaches(queryClient, user.id, id, {
        wear_count: rpcRow.wear_count,
        last_worn_at: rpcRow.last_worn_at,
      });
      return rpcRow;
    },
    onMutate: async (id) => {
      // Optimistic +1 to wear_count and last_worn_at = now. The detail
      // screen + every list page sees the bump immediately; the server
      // confirms it on settle.
      await queryClient.cancelQueries({ queryKey: ['garment', user?.id, id] });
      const previousSnapshot = queryClient.getQueryData<Garment | null>(
        ['garment', user?.id, id],
      );
      const optimistic = previousSnapshot
        ? {
            wear_count: (previousSnapshot.wear_count ?? 0) + 1,
            last_worn_at: new Date().toISOString(),
          }
        : null;
      if (optimistic) {
        patchGarmentInCaches(queryClient, user?.id, id, optimistic);
      }
      return { previousSnapshot };
    },
    onError: (err, id, context) => {
      captureMutationError('useMarkWorn')(err);
      if (context?.previousSnapshot !== undefined) {
        queryClient.setQueryData(['garment', user?.id, id], context.previousSnapshot);
      }
    },
    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garment', user?.id, id] });
      // Profile stats bundle (M29). useMarkWorn doesn't insert into
      // wear_logs today (that's the per-outfit wear path), but listing
      // it here keeps the invalidation contract uniform — when the
      // per-garment wear_logs path lands it'll already be wired.
      queryClient.invalidateQueries({ queryKey: ['wardrobeStats', user?.id] });
      // Insights derives every metric from garments + wear_logs — refetch so
      // the gauges, palette, weekly bars, and most-worn list don't lie for up
      // to staleTime (5min) after a wear / laundry / update.
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
    },
  });
}
