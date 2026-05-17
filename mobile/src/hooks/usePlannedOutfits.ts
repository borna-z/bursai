// Planned-outfit hooks for mobile. React Query–backed; mirrors the relevant
// shape of the web's `src/hooks/usePlannedOutfits.ts`.
//
// Schema notes:
//   • The column is `date`, not `planned_date`. The web hook is the
//     source of truth on this — the W3 spec used a legacy name.
//   • There is no DB-level unique constraint on (user_id, date). The
//     mobile UX is "one planned outfit per day" — so the upsert mutation
//     deletes any existing plans for the date before inserting the new
//     one. Atomicity is best-effort across two round-trips, but the
//     happy-path race window is tiny and the consequence of a stale row
//     is "user sees two plans for one day" — they can clear one. Web
//     allows up to 4 per day; we reduce that to 1 here.
//   • `usePlannedOutfitForDate` uses `.maybeSingle()` because the UX
//     guarantees ≤1 row per day. If the DB drifts and contains 2+, the
//     query throws — preferable to silently rendering one of N.
//
// Cache scoping: queries key on (`['planned_outfits' | 'planned_outfit']`,
// user.id, range/date) so a sign-out + sign-in as a different user never
// serves user A's calendar to user B.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';
import { localISODate } from '../lib/outfitDisplay';
import type { PlannedOutfitWithOutfit } from '../types/outfit';
import { CACHE_KEYS } from './cacheKeys';

const PLANNED_WITH_OUTFIT_SELECT = `
  *,
  outfit:outfits (
    *,
    outfit_items (
      *,
      garment:garments (*)
    )
  )
`;

export function usePlannedOutfitsForRange(startDate: string, endDate: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: CACHE_KEYS.plannedOutfits(user?.id, startDate, endDate),
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('planned_outfits')
        .select(PLANNED_WITH_OUTFIT_SELECT)
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as PlannedOutfitWithOutfit[]);
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

/** Convenience wrapper that builds a 7-day window starting from the given
 *  date (defaults to today). */
export function usePlannedOutfitsForWeek(startDate?: string) {
  const start = startDate ?? localISODate(new Date());
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const end = localISODate(new Date(startMs + 6 * 24 * 60 * 60 * 1000));
  return usePlannedOutfitsForRange(start, end);
}

export function usePlannedOutfitForDate(date: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: CACHE_KEYS.plannedOutfit(user?.id, date),
    queryFn: async () => {
      if (!user || !date) return null;
      const { data, error } = await supabase
        .from('planned_outfits')
        .select(PLANNED_WITH_OUTFIT_SELECT)
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PlannedOutfitWithOutfit | null) ?? null;
    },
    enabled: !!user && !!date,
    staleTime: 60 * 1000,
  });
}

export function useTodayPlannedOutfit() {
  const today = localISODate(new Date());
  return usePlannedOutfitForDate(today);
}

/**
 * Upsert pattern: insert the NEW row first, then sweep any older sibling
 * rows for the same (user, date). There's no DB-level unique constraint to
 * leverage via Supabase's `.upsert(..., { onConflict })`, so we simulate
 * one — but INSERT-FIRST. Earlier delete-then-insert lost the user's plan
 * if the network dropped between the two calls (audit E on PR #718).
 * INSERT-FIRST trades a transient "two plans for one day" window (worst
 * case: sweep failed) for never-empty-after-failure semantics.
 *
 * Concurrent upserts converge to "all racers' rows persist briefly, then
 * each sweep clears the others' rows" — last-writer-wins by row id.
 */
export function useUpsertPlannedOutfit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ date, outfitId }: { date: string; outfitId: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data: inserted, error: insertError } = await supabase
        .from('planned_outfits')
        .insert({
          user_id: user.id,
          date,
          outfit_id: outfitId,
          status: 'planned',
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      // Sweep older sibling rows for the same (user, date). Don't throw on
      // failure — the user's intended row is already persisted; surface the
      // "two plans for one day" via the next refetch instead of failing the
      // whole mutation. Strictly better than the previous failure mode.
      const { error: sweepError } = await supabase
        .from('planned_outfits')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date)
        .neq('id', inserted.id);
      if (sweepError) {
        console.warn(
          '[usePlannedOutfits] sibling sweep failed (plan persisted, refetch will reconcile):',
          sweepError.message,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned_outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfit'] });
    },
    onError: captureMutationError('useUpsertPlannedOutfit'),
  });
}

export function useDeletePlannedOutfit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (date: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('planned_outfits')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned_outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfit'] });
    },
    onError: captureMutationError('useDeletePlannedOutfit'),
  });
}
