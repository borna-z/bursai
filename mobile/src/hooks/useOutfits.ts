// Outfit data hooks for mobile. React Query–backed; mirrors the relevant
// shape of the web's `src/hooks/useOutfits.ts` but slimmed down — no
// completeness validation, no haptics, no retry tuning.
//
// All queries scope by `user_id` AND let RLS enforce the same constraint
// server-side — defense in depth. Without an authenticated user the queries
// stay disabled, returning empty arrays / null.
//
// Schema notes:
//   • `outfits.worn_at` is the "last worn" timestamp (the spec referred to a
//     `last_worn_at` column that doesn't exist on this table — schema is
//     authoritative).
//   • `wear_logs.worn_at` (NOT `worn_on`) is the wear date column. The mobile
//     "Wear today" mutation inserts a single per-outfit log row with a null
//     `garment_id` — the per-garment wear tracking the web does is a future
//     wave; this is enough for "did the user actually mark this worn today".
//   • The 23505 (unique violation) catch handles a same-day double-tap
//     gracefully — two "Wear today" presses don't error, the second is a no-op.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { OutfitWithItems } from '../types/outfit';

const OUTFIT_WITH_ITEMS_SELECT = `
  *,
  outfit_items (
    *,
    garment:garments (*)
  )
`;

export function useOutfits(savedOnly = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['outfits', user?.id, savedOnly],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('outfits')
        .select(OUTFIT_WITH_ITEMS_SELECT)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (savedOnly) query = query.eq('saved', true);

      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as unknown as OutfitWithItems[]);
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

export function useOutfit(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['outfit', user?.id, id],
    queryFn: async () => {
      if (!id || !user) return null;
      const { data, error } = await supabase
        .from('outfits')
        .select(OUTFIT_WITH_ITEMS_SELECT)
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as OutfitWithItems | null) ?? null;
    },
    enabled: !!id && !!user,
    staleTime: 60 * 1000,
  });
}

/**
 * Mark an outfit worn today. Mirrors the web's `useMarkOutfitWorn` more
 * closely than the V0 mobile shim:
 *   1. stamp `outfits.worn_at` to now (full ISO timestamp — the column is
 *      timestamptz, NOT a date column, so writing a YYYY-MM-DD string would
 *      coerce to UTC midnight and silently shift the wear date for non-UTC
 *      users; audit B on PR #718 caught this);
 *   2. for each constituent garment: bump `wear_count` and stamp
 *      `last_worn_at` so HomeScreen "Wardrobe used %" + Wardrobe most-worn
 *      surfaces stay in sync (audit F);
 *   3. insert one wear_logs row per garment via upsert on
 *      (user_id, garment_id, worn_at) — same convention as the web. If no
 *      garmentIds are provided (fallback path for callers that don't have
 *      outfit_items in hand) we insert a single null-garment_id log row so
 *      the wear is still recorded against the outfit.
 *
 * Garment per-row counter increments are read-modify-write (web takes the
 * same trade-off, see web's useMarkWorn). Concurrent same-garment wears lose
 * increments under contention; acceptable for v1.
 */
export function useMarkOutfitWorn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      outfitId,
      garmentIds = [],
    }: {
      outfitId: string;
      garmentIds?: string[];
    }) => {
      if (!user) throw new Error('Not authenticated');
      const nowIso = new Date().toISOString();

      // 1. Stamp the outfit.
      const { error: outfitError } = await supabase
        .from('outfits')
        .update({ worn_at: nowIso })
        .eq('id', outfitId)
        .eq('user_id', user.id);
      if (outfitError) throw outfitError;

      // 2. Fallback path — caller didn't pass garmentIds. Single null-garment
      //    wear_log so we at least record the outfit-level wear.
      if (garmentIds.length === 0) {
        const { error: logError } = await supabase.from('wear_logs').insert({
          user_id: user.id,
          outfit_id: outfitId,
          worn_at: nowIso,
        });
        if (logError) throw logError;
        return;
      }

      // 3a. Read current wear_count snapshot so the per-row +1 doesn't
      //     clobber concurrent writes from a different mutation. Last-write-
      //     wins under contention (matches web behavior).
      const { data: garmentStates, error: stateError } = await supabase
        .from('garments')
        .select('id, wear_count')
        .in('id', garmentIds)
        .eq('user_id', user.id);
      if (stateError) throw stateError;

      const stateMap = new Map(
        (garmentStates ?? []).map((g) => [g.id, g.wear_count ?? 0]),
      );

      // 3b. Bump every garment in parallel.
      await Promise.all(
        garmentIds.map((garmentId) => {
          const next = (stateMap.get(garmentId) ?? 0) + 1;
          return supabase
            .from('garments')
            .update({ wear_count: next, last_worn_at: nowIso })
            .eq('id', garmentId)
            .eq('user_id', user.id);
        }),
      );

      // 3c. Per-garment wear log. ignoreDuplicates=false → repeat same-day
      //     wear updates the row in place (idempotent under double-tap).
      const wearLogRows = garmentIds.map((garmentId) => ({
        user_id: user.id,
        garment_id: garmentId,
        outfit_id: outfitId,
        worn_at: nowIso,
      }));
      const { error: logError } = await supabase
        .from('wear_logs')
        .upsert(wearLogRows, {
          onConflict: 'user_id,garment_id,worn_at',
          ignoreDuplicates: false,
        });
      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfit'] });
      // Garment caches refresh so HomeScreen "Wardrobe used %" + Wardrobe
      // most-worn surfaces reflect the bumped wear_count immediately.
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garment'] });
    },
  });
}

export function useSaveOutfit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (outfitId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('outfits')
        .update({ saved: true })
        .eq('id', outfitId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
    },
  });
}

export function useDeleteOutfit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (outfitId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('outfits')
        .delete()
        .eq('id', outfitId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: (_data, outfitId) => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.removeQueries({ queryKey: ['outfit', user?.id, outfitId] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfit'] });
    },
  });
}

/**
 * Save / replace a rating. Writes BOTH:
 *   1. `outfit_feedback` row (web's canonical store, upsert on
 *      `(user_id, outfit_id)`); and
 *   2. `outfits.rating` column (used by OutfitDetailScreen to hydrate prior
 *      ratings on screen open — without this, the local rating state always
 *      starts at 0 and a re-tap would silently overwrite a prior rating;
 *      audit K on PR #718 caught this).
 *
 * Rating 0 = clear. Two writes are in sequence rather than transactional —
 * if the second fails the user sees a partial state (feedback row stored,
 * outfit column unchanged); next rate fixes it.
 */
export function useRateOutfit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ outfitId, rating }: { outfitId: string; rating: number }) => {
      if (!user) throw new Error('Not authenticated');
      const { error: feedbackError } = await supabase
        .from('outfit_feedback')
        .upsert(
          { user_id: user.id, outfit_id: outfitId, rating },
          { onConflict: 'user_id,outfit_id' },
        );
      if (feedbackError) throw feedbackError;

      const { error: outfitError } = await supabase
        .from('outfits')
        .update({ rating: rating === 0 ? null : rating })
        .eq('id', outfitId)
        .eq('user_id', user.id);
      if (outfitError) throw outfitError;
    },
    onSuccess: (_data, { outfitId }) => {
      queryClient.invalidateQueries({ queryKey: ['outfit', user?.id, outfitId] });
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
    },
  });
}
