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
import { localISODate } from '../lib/outfitDisplay';
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
 * Mark an outfit worn today. Inserts a single per-outfit wear_log (null
 * garment_id is allowed by the schema) and stamps `outfits.worn_at` so the
 * outfit card / Today's Look surfaces reflect "you wore this today".
 *
 * Same-day double-tap → 23505 unique violation → swallowed (idempotent).
 */
export function useMarkOutfitWorn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (outfitId: string) => {
      if (!user) throw new Error('Not authenticated');
      const today = localISODate(new Date());
      const nowIso = new Date().toISOString();

      const { error: logError } = await supabase
        .from('wear_logs')
        .insert({
          user_id: user.id,
          outfit_id: outfitId,
          worn_at: today,
        });
      if (logError && (logError as { code?: string }).code !== '23505') {
        throw logError;
      }

      const { error: outfitError } = await supabase
        .from('outfits')
        .update({ worn_at: nowIso })
        .eq('id', outfitId)
        .eq('user_id', user.id);
      if (outfitError) throw outfitError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned_outfit'] });
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
 * Save / replace an outfit_feedback rating row. Web upserts on
 * (user_id, outfit_id) — mobile follows the same pattern. Rating 0 = clear.
 */
export function useRateOutfit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ outfitId, rating }: { outfitId: string; rating: number }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('outfit_feedback')
        .upsert(
          { user_id: user.id, outfit_id: outfitId, rating },
          { onConflict: 'user_id,outfit_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_data, { outfitId }) => {
      queryClient.invalidateQueries({ queryKey: ['outfit', user?.id, outfitId] });
    },
  });
}
