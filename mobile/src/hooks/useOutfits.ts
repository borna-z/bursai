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
import { recordMemoryEvent } from '../lib/memoryIngest';
import { saveOutfitEvent, wearOutfitEvent } from '../lib/memoryEvents';
import { captureMutationError } from '../lib/sentry';
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
    onSuccess: (_data, { outfitId, garmentIds = [] }) => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfit'] });
      // Garment caches refresh so HomeScreen "Wardrobe used %" + Wardrobe
      // most-worn surfaces reflect the bumped wear_count immediately.
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garment'] });
      // Insights derives wear-frequency bars, most-worn list, and utilisation
      // from this very wear_logs insert — refresh so the gauges and chart
      // update immediately instead of waiting for staleTime.
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
      // Style Memory signal — fire-and-forget. Failure must never block
      // the wear flow (the primary DB write already succeeded). Scope is
      // limited to wear + save in W4 — delete and rate intentionally do
      // NOT ingest here (web's fireMemoryIngest does, but mobile defers
      // those signals to a future wave when the rating UI lands the same
      // event_type contract). Codex audit P2-4 (audit 3).
      // M10: typed event creator + queue-aware dispatcher. The wire field
      // is `signal_type` (NOT the legacy `event_type` which the server
      // 400'd silently — Wave 8.5 P0 caught in PR #712); the typed creator
      // gets the field name right. recordMemoryEvent enqueues to the M5
      // offline queue on transport / 5xx so the wear signal is preserved
      // through connectivity loss.
      void recordMemoryEvent(
        wearOutfitEvent(outfitId, garmentIds, 'mobile/useMarkOutfitWorn'),
      );
    },
    onError: captureMutationError('useMarkOutfitWorn'),
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
    onSuccess: (_data, outfitId) => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      // Style Memory signal — fire-and-forget; queue-aware so a network
      // drop doesn't lose the save signal. M10 fix: also corrects the
      // `event_type` → `signal_type` field-name bug.
      void recordMemoryEvent(saveOutfitEvent(outfitId, 'mobile/useSaveOutfit'));
    },
    onError: captureMutationError('useSaveOutfit'),
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
    onError: captureMutationError('useDeleteOutfit'),
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
      queryClient.invalidateQueries({ queryKey: ['outfit_feedback', user?.id, outfitId] });
    },
    onError: captureMutationError('useRateOutfit'),
  });
}

/**
 * Read the user's existing feedback row (rating + commentary) for an outfit.
 * Returns null when the user hasn't rated/noted the outfit yet. Used by
 * OutfitDetailScreen to hydrate the notes TextInput so a returning user sees
 * their prior note instead of an empty box (audit L on PR #718).
 */
export function useOutfitFeedback(outfitId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['outfit_feedback', user?.id, outfitId],
    queryFn: async () => {
      if (!user || !outfitId) return null;
      const { data, error } = await supabase
        .from('outfit_feedback')
        .select('rating, commentary')
        .eq('user_id', user.id)
        .eq('outfit_id', outfitId)
        .maybeSingle();
      if (error) throw error;
      return (data as { rating: number | null; commentary: string | null } | null) ?? null;
    },
    enabled: !!user && !!outfitId,
    staleTime: 60 * 1000,
  });
}

/**
 * Save the user's free-text note for an outfit. Upserts into
 * `outfit_feedback.commentary` on (user_id, outfit_id), preserving any
 * existing rating in the same row. Empty / whitespace-only input clears the
 * column to NULL so a deliberate erase actually drops the prior text.
 */
export function useSaveOutfitNote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ outfitId, note }: { outfitId: string; note: string }) => {
      if (!user) throw new Error('Not authenticated');
      const trimmed = note.trim();
      const { error } = await supabase
        .from('outfit_feedback')
        .upsert(
          {
            user_id: user.id,
            outfit_id: outfitId,
            commentary: trimmed.length === 0 ? null : trimmed,
          },
          { onConflict: 'user_id,outfit_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_data, { outfitId }) => {
      queryClient.invalidateQueries({ queryKey: ['outfit_feedback', user?.id, outfitId] });
    },
    onError: captureMutationError('useSaveOutfitNote'),
  });
}
