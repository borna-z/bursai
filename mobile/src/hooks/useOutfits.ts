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
import {
  inFlightWearOutfit,
  OUTFIT_WITH_ITEMS_SELECT,
  runMarkOutfitWorn,
  upsertOutfitFeedbackRow,
  type MarkOutfitWornResult,
} from './useOutfits.helpers';

export type { MarkOutfitWornResult } from './useOutfits.helpers';

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

  return useMutation<
    MarkOutfitWornResult,
    Error,
    { outfitId: string; garmentIds?: string[] }
  >({
    mutationFn: async ({ outfitId, garmentIds = [] }) => {
      if (!user) throw new Error('Not authenticated');
      // Synchronous in-flight gate — covers the same-frame double-mutate
      // case where two `mutate(...)` calls fire before the first's `await`
      // yields. See module comment above.
      if (inFlightWearOutfit.has(outfitId)) {
        return { deduped: true };
      }
      inFlightWearOutfit.add(outfitId);
      try {
        return await runMarkOutfitWorn({ outfitId, garmentIds, userId: user.id });
      } finally {
        inFlightWearOutfit.delete(outfitId);
      }
    },
    onSuccess: (data, { outfitId, garmentIds = [] }) => {
      // Skip cache invalidations + memory event when the mutation deduped
      // (no DB write occurred, so caches don't need refresh, and recording
      // a wear signal would over-count style memory). Codex P2 round 10.
      if (data.deduped) return;
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfit'] });
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garment'] });
      // Profile stats bundle (M29) — wear_logs row count moves on every
      // non-deduped wear, and outfits.worn_at flips affect the saved
      // outfit count over time when filtered by saved=true.
      queryClient.invalidateQueries({ queryKey: ['wardrobeStats', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
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
    mutationFn: async ({ outfitId }: { outfitId: string; garmentIds?: string[] }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('outfits')
        .update({ saved: true })
        .eq('id', outfitId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: (_data, { outfitId, garmentIds }) => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      // Profile stats bundle (M29) — flipping `saved` from false→true
      // moves the outfit into the saved-only count on Profile.
      queryClient.invalidateQueries({ queryKey: ['wardrobeStats', user?.id] });
      // Style Memory signal — fire-and-forget; queue-aware so a network
      // drop doesn't lose the save signal. The `ingest_memory_event` RPC
      // only updates positive pair-memory weight when garment_ids has ≥2
      // entries, so the caller passes the outfit roster (Codex P2 round 4
      // on PR #734).
      void recordMemoryEvent(
        saveOutfitEvent(outfitId, garmentIds ?? [], 'mobile/useSaveOutfit'),
      );
    },
    onError: captureMutationError('useSaveOutfit'),
  });
}

/**
 * G5: persist a freshly-generated outfit (StyleMe / MoodFlow) that has not
 * been written to the DB yet. The web's `useOutfitGenerator` performs the
 * outfits + outfit_items insert dance internally; mobile's
 * `useGenerateOutfit` deliberately stays a "preview" hook (no persist),
 * so this mutation is the persistence step screens call from their Save
 * handler. Returns the new `outfit_id` so the screen can deep-link to
 * `OutfitDetail` and stamp a `savedOutfitId` for "Saved ✓" state.
 *
 * Insert pattern mirrors `OutfitPoolScreen.persistDraft` (lines 124–142):
 * single insert into `outfits` with `saved: true`, then bulk insert into
 * `outfit_items` keyed on the new `outfit.id`. RLS scopes everything to
 * the authenticated user; `user_id` is set explicitly for clarity.
 *
 * Cache invalidations match `useSaveOutfit` so the new row appears in the
 * Outfits list, the wardrobe stats counter ticks, and the recent-outfits
 * surfaces (G2) refresh.
 */
export function usePersistGeneratedOutfit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<
    { outfitId: string },
    Error,
    {
      occasion?: string | null;
      explanation?: string | null;
      familyLabel?: string | null;
      items: { garment_id: string; slot: string }[];
    }
  >({
    mutationFn: async ({ occasion, explanation, familyLabel, items }) => {
      if (!user) throw new Error('Not authenticated');
      if (items.length === 0) {
        throw new Error('Cannot save an empty outfit');
      }
      const { data: outfit, error: insertErr } = await supabase
        .from('outfits')
        .insert({
          user_id: user.id,
          occasion: occasion ?? null,
          explanation: explanation ?? '',
          family_label: familyLabel ?? null,
          saved: true,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      const outfitId = outfit.id;
      const itemRows = items.map((item) => ({
        outfit_id: outfitId,
        garment_id: item.garment_id,
        slot: item.slot,
      }));
      const { error: itemsErr } = await supabase.from('outfit_items').insert(itemRows);
      if (itemsErr) throw itemsErr;
      return { outfitId };
    },
    onSuccess: ({ outfitId }, { items }) => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      queryClient.invalidateQueries({ queryKey: ['wardrobeStats', user?.id] });
      // Style Memory — same signal `useSaveOutfit` fires for the existing
      // toggle path, so a freshly-saved generated outfit produces the same
      // pair-memory bump as one saved from OutfitDetail.
      const garmentIds = items.map((it) => it.garment_id).filter(Boolean);
      void recordMemoryEvent(
        saveOutfitEvent(outfitId, garmentIds, 'mobile/usePersistGeneratedOutfit'),
      );
    },
    onError: captureMutationError('usePersistGeneratedOutfit'),
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
      // Drop the cached feedback row too — without this, a subsequent
      // outfit save that happens to mint the same id (cosmic chance, but
      // also true after manual DB cleanup in dev) would surface the prior
      // user's rating/note. Codex P2 round on PR #738.
      queryClient.removeQueries({ queryKey: ['outfit_feedback', user?.id, outfitId] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfit'] });
      // Profile stats bundle (M29). Deleting a saved outfit drops the
      // count by one; the per-table HEAD count would otherwise stay
      // stale up to 60s.
      queryClient.invalidateQueries({ queryKey: ['wardrobeStats', user?.id] });
    },
    onError: captureMutationError('useDeleteOutfit'),
  });
}

/**
 * Save / replace a rating. Writes BOTH:
 *   1. `outfit_feedback` row via `upsertOutfitFeedbackRow` (race-tolerant,
 *      collapses duplicates); and
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
      await upsertOutfitFeedbackRow(user.id, outfitId, { rating });

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
      // `.order(desc).limit(1)` is defense-in-depth: post-theme-2 the
      // `outfit_feedback_user_outfit_uidx` UNIQUE INDEX guarantees ≤1 row
      // per (user_id, outfit_id), but keeping the read tolerant means
      // any future drift (e.g. a service-role write that bypasses the
      // index check, or an out-of-band restore that re-introduces rows)
      // still yields the newest row instead of an exception.
      const { data, error } = await supabase
        .from('outfit_feedback')
        .select('rating, commentary')
        .eq('user_id', user.id)
        .eq('outfit_id', outfitId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = (data ?? [])[0] as { rating: number | null; commentary: string | null } | undefined;
      return row ?? null;
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
      const commentary = trimmed.length === 0 ? null : trimmed;
      await upsertOutfitFeedbackRow(user.id, outfitId, { commentary });
    },
    onSuccess: (_data, { outfitId }) => {
      queryClient.invalidateQueries({ queryKey: ['outfit_feedback', user?.id, outfitId] });
    },
    onError: captureMutationError('useSaveOutfitNote'),
  });
}
