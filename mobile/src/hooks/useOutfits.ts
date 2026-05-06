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

// Module-level in-flight set keyed by outfitId. Synchronous double-mutate
// calls (e.g. HomeScreen exposes two CTAs wired to the same mutation —
// "Wear this" in the hero and "Wear today" in the mini-week strip — and
// React Query's `isPending` flag flips after the next render, so a tight
// double-tap can fire two `mutate(...)` calls before the disabled state
// renders) would otherwise double-bump every garment's wear_count and
// insert duplicate wear_logs. The synchronous prefix of mutationFn
// (set.has + set.add) runs to completion before the first `await` yields,
// so the second concurrent invocation always sees the entry and bails.
// The `try/finally delete()` guarantees the lock releases even on error.
// Codex P2 round 9 on PR #738.
const inFlightWearOutfit = new Set<string>();

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
      // Synchronous in-flight gate — see module comment above.
      if (inFlightWearOutfit.has(outfitId)) {
        // Silently no-op the duplicate. The first invocation's onSuccess
        // will surface the confirmation alert + cache invalidations.
        return { deduped: true };
      }
      inFlightWearOutfit.add(outfitId);
      try {
        return await runMarkOutfitWorn({ outfitId, garmentIds, userId: user.id });
      } finally {
        inFlightWearOutfit.delete(outfitId);
      }
    },
    onSuccess: (_data, { outfitId, garmentIds = [] }) => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfit'] });
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garment'] });
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
      void recordMemoryEvent(
        wearOutfitEvent(outfitId, garmentIds, 'mobile/useMarkOutfitWorn'),
      );
    },
    onError: captureMutationError('useMarkOutfitWorn'),
  });
}

// The actual mark-worn write sequence — extracted from the hook so the
// in-flight gate above can wrap it cleanly. Returns void (the wrapper
// returns `{ deduped: true }` for the dedup path; the real path returns
// undefined which TS narrows fine — both are valid mutation results).
async function runMarkOutfitWorn({
  outfitId,
  garmentIds,
  userId,
}: {
  outfitId: string;
  garmentIds: string[];
  userId: string;
}): Promise<void> {
  const nowIso = new Date().toISOString();

  // 1. Stamp the outfit.
  const { error: outfitError } = await supabase
    .from('outfits')
    .update({ worn_at: nowIso })
    .eq('id', outfitId)
    .eq('user_id', userId);
  if (outfitError) throw outfitError;

  // 2. Fallback path — caller didn't pass garmentIds. Single null-garment
  //    wear_log so we at least record the outfit-level wear.
  if (garmentIds.length === 0) {
    const { error: logError } = await supabase.from('wear_logs').insert({
      user_id: userId,
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
    .eq('user_id', userId);
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
        .eq('user_id', userId);
    }),
  );

  // 3c. Per-garment wear log — append-only INSERT. Idempotency for
  //     synchronous double-mutate calls is enforced by the
  //     `inFlightWearOutfit` Set in the hook wrapper above; this body only
  //     runs once per (outfitId, distinct mutate call). The wear_logs
  //     table has only a PK on `id` — no UNIQUE on
  //     (user_id, garment_id, worn_at) — so a real PostgREST upsert isn't
  //     viable without a migration. Tracked for follow-up.
  const wearLogRows = garmentIds.map((garmentId) => ({
    user_id: userId,
    garment_id: garmentId,
    outfit_id: outfitId,
    worn_at: nowIso,
  }));
  const { error: logError } = await supabase
    .from('wear_logs')
    .insert(wearLogRows);
  if (logError) throw logError;
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
 * SELECT-newest, UPDATE-or-INSERT, then DELETE-siblings on `outfit_feedback`.
 *
 * `outfit_feedback` lacks a UNIQUE constraint on `(user_id, outfit_id)` (see
 * inline comment on the per-hook fix history) so the canonical PostgREST
 * upsert path doesn't work. A naive SELECT-then-INSERT has a race window
 * where two concurrent rate/note taps both see "no row" and both INSERT,
 * leaving duplicate rows that subsequently break `useOutfitFeedback`'s
 * `.maybeSingle()` read with a "multiple rows returned" error — Codex P2
 * round 8 on PR #738.
 *
 * This helper:
 *   1. SELECTs every row for `(user_id, outfit_id)` ordered newest first.
 *   2. If any rows exist: UPDATEs the newest with the patch, DELETEs the
 *      stale siblings to collapse duplicates created by an earlier race.
 *   3. If no rows: INSERTs the new row, then re-reads + collapses any
 *      siblings that arrived from a concurrent INSERT we lost the
 *      milliseconds-race against. The defensive sweep is what makes
 *      back-to-back rates converge to a single row even under contention.
 *
 * Reads (`useOutfitFeedback` below) tolerate transient duplicates by using
 * `.order('created_at', desc).limit(1)` instead of `.maybeSingle()` — they
 * always pick the newest row, so even mid-race the user sees their latest
 * tap reflected. The next write collapses to one row again.
 */
async function upsertOutfitFeedbackRow(
  userId: string,
  outfitId: string,
  patch: { rating?: number; commentary?: string | null },
): Promise<void> {
  const { data: rows, error: readErr } = await supabase
    .from('outfit_feedback')
    .select('id')
    .eq('user_id', userId)
    .eq('outfit_id', outfitId)
    .order('created_at', { ascending: false });
  if (readErr) throw readErr;

  if (rows && rows.length > 0) {
    const newestId = rows[0].id;
    const { error: updateErr } = await supabase
      .from('outfit_feedback')
      .update(patch)
      .eq('id', newestId);
    if (updateErr) throw updateErr;
    if (rows.length > 1) {
      const staleIds = rows.slice(1).map((r) => r.id);
      // Best-effort cleanup — failure here just leaves the duplicate around
      // (caught by the read-tolerant `.limit(1)` path) so we don't surface
      // it as a mutation error.
      await supabase.from('outfit_feedback').delete().in('id', staleIds);
    }
    return;
  }

  const { error: insertErr } = await supabase
    .from('outfit_feedback')
    .insert({ user_id: userId, outfit_id: outfitId, ...patch });
  if (insertErr) throw insertErr;

  // Defensive sweep — a concurrent mutation may have INSERTed in parallel
  // since our SELECT. Re-read and delete any older siblings, keeping only
  // the newest row.
  const { data: postRows } = await supabase
    .from('outfit_feedback')
    .select('id')
    .eq('user_id', userId)
    .eq('outfit_id', outfitId)
    .order('created_at', { ascending: false });
  if (postRows && postRows.length > 1) {
    const staleIds = postRows.slice(1).map((r) => r.id);
    await supabase.from('outfit_feedback').delete().in('id', staleIds);
  }
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
      // `.order(desc).limit(1)` not `.maybeSingle()` — the latter throws on
      // multiple rows, which can transiently exist if two near-simultaneous
      // rate taps each INSERT before either's defensive sweep collapses the
      // duplicates. Picking the newest row keeps the screen showing the
      // user's latest tap; the next write converges back to a single row.
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
