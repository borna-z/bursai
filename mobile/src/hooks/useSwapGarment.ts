// useSwapGarment — fetch valid replacement garments for a slot in an outfit
// and persist the user's pick. Mirrors web's `src/hooks/useSwapGarment.ts`,
// trimmed to the M37 surface: no AI scoring loop, no fallback chain, no swap
// modes. The candidate list filters the wardrobe to garments whose inferred
// canonical slot matches the target slot AND that aren't already worn in the
// outfit, in laundry, or the same id we're swapping out.
//
// `swapGarment` updates the outfit_items row in place — `garment_id` swaps,
// `slot` resets to the inferred canonical slot of the new garment so the
// stored slot string stays in sync with the engine's expectations.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';
import { inferOutfitSlotFromGarment } from '../lib/outfitValidation';
import type { CanonicalOutfitSlot } from '../lib/outfitRules';
import type { Garment } from '../types/garment';
import { CACHE_KEYS } from './cacheKeys';

export interface SwapCandidate {
  garment: Garment;
}

export interface UseSwapGarmentArgs {
  /** The outfit being edited — the candidate query excludes its current garments. */
  outfitId: string | null | undefined;
  /** Slot we're swapping for ('top' | 'bottom' | 'shoes' | 'dress' | 'outerwear' | 'accessory' | 'layer'). */
  slot: string | null | undefined;
  /** Outfit item id whose garment we're replacing — excluded from candidates. */
  outfitItemId: string | null | undefined;
  /** Garment ids already attached to the outfit — also excluded so a swap
   *  never duplicates an existing piece. */
  excludeGarmentIds: string[];
  /** Sheet open flag — gate the candidate query so we don't fetch wardrobe
   *  rows until the user actually opens the swap sheet. */
  enabled: boolean;
}

// M37 Codex P2 — display slot → canonical inference targets. Earlier this
// hook ran a `.in('category', [...])` filter against exact lowercase strings,
// which missed wardrobe rows whose `category` column stored the value in a
// different case (`EditGarmentScreen`'s chips write `Top` / `Bottom` /
// `Shoes` / `Outer` / `Dress` / `Accessory`) AND missed garments where the
// canonical slot is decided by `subcategory` rather than `category` alone
// (a `category=top, subcategory=dress` row classifies as `dress` under
// `inferCanonicalOutfitSlot`). The fix: pull a broader candidate set and
// apply M13's canonical inference client-side. `layer` is a display sub-
// bucket of `top`, so both display slots target the same canonical slot.
const DISPLAY_SLOT_TO_CANONICAL: Record<string, CanonicalOutfitSlot[]> = {
  top: ['top'],
  layer: ['top'],
  bottom: ['bottom'],
  shoes: ['shoes'],
  outerwear: ['outerwear'],
  accessory: ['accessory'],
  dress: ['dress'],
};

export function useSwapGarment({
  outfitId,
  slot,
  outfitItemId,
  excludeGarmentIds,
  enabled,
}: UseSwapGarmentArgs) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Stable cache key — sort the exclusion list so an array reorder doesn't
  // invalidate. Keyed by user + outfit + slot + the exclusion set.
  const exclusionKey = [...excludeGarmentIds].sort().join(',');

  const candidatesQ = useQuery({
    queryKey: CACHE_KEYS.m37SwapCandidates(user?.id, outfitId, slot, exclusionKey),
    enabled: enabled && !!user && !!slot,
    queryFn: async (): Promise<SwapCandidate[]> => {
      if (!user || !slot) return [];
      const targetSlots = DISPLAY_SLOT_TO_CANONICAL[slot];
      if (!targetSlots) return [];
      const targetSet = new Set<CanonicalOutfitSlot>(targetSlots);

      // Pull the wardrobe in pages and run `inferOutfitSlotFromGarment` per
      // row so case-divergent or subcategory-overridden categories still
      // surface. M37 Codex round 2 — the prior single-page `.limit(200)`
      // could miss valid matches when the freshest 200 garments were
      // dominated by one slot (a user with 200+ tops + accessories ahead
      // of older shoes would see an empty Swap sheet on the shoes slot).
      // Paginate until we collect enough inferred matches OR exhaust the
      // wardrobe; capped at 5 pages (1000 rows) so a runaway scan can't
      // hammer the DB.
      const PAGE_SIZE = 200;
      const MAX_PAGES = 5;
      const TARGET_MATCHES = 50;
      const matched: Garment[] = [];

      for (let page = 0; page < MAX_PAGES; page++) {
        let query = supabase
          .from('garments')
          .select('*')
          .eq('user_id', user.id)
          .eq('in_laundry', false)
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (excludeGarmentIds.length > 0) {
          // PostgREST `not.in.(…)` requires a parenthesised list; the
          // supabase-js builder handles escaping for us.
          query = query.not('id', 'in', `(${excludeGarmentIds.join(',')})`);
        }

        const { data, error } = await query;
        if (error) throw error;
        const rows = data ?? [];
        for (const garment of rows) {
          const inferred = inferOutfitSlotFromGarment(garment);
          if (targetSet.has(inferred as CanonicalOutfitSlot)) {
            matched.push(garment);
            if (matched.length >= TARGET_MATCHES) break;
          }
        }
        if (matched.length >= TARGET_MATCHES) break;
        // Page returned fewer rows than the page size → we've exhausted
        // the wardrobe, no point hitting the next range.
        if (rows.length < PAGE_SIZE) break;
      }

      return matched.map((garment) => ({ garment }));
    },
    staleTime: 30 * 1000,
  });

  const swapMutation = useMutation({
    mutationFn: async ({
      newGarmentId,
    }: {
      newGarmentId: string;
    }): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      if (!outfitItemId) throw new Error('Missing outfit item id');

      // Read the new garment's category so we can refresh the row's slot
      // value. Without this a top → outerwear swap would persist the wrong
      // slot string and the screen would mis-bucket it on next render.
      const { data: newGarment, error: garmentErr } = await supabase
        .from('garments')
        .select('id, category, subcategory')
        .eq('user_id', user.id)
        .eq('id', newGarmentId)
        .single();
      if (garmentErr) throw garmentErr;
      if (!newGarment) throw new Error('Replacement garment not found');

      const inferred = inferOutfitSlotFromGarment(newGarment);
      // If the inferred slot is `unknown` keep the existing slot string
      // rather than overwriting it with garbage — the next render will
      // still bucket the row by garment metadata via groupGarmentsBySlot's
      // inference branch.
      const update: { garment_id: string; slot?: string } = {
        garment_id: newGarmentId,
      };
      if (inferred !== 'unknown') update.slot = inferred;

      const { error } = await supabase
        .from('outfit_items')
        .update(update)
        .eq('id', outfitItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Re-read the outfit + the outfits index so the swapped garment
      // surfaces immediately. `useOutfit` is keyed `['outfit', userId, id]`
      // (mobile/src/hooks/useOutfits.ts:77).
      if (user && outfitId) {
        queryClient.invalidateQueries({ queryKey: CACHE_KEYS.outfit(user.id, outfitId) });
      }
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
    },
    onError: captureMutationError('useSwapGarment'),
  });

  return {
    candidates: candidatesQ.data ?? [],
    isLoadingCandidates: candidatesQ.isFetching,
    candidatesError:
      candidatesQ.error instanceof Error ? candidatesQ.error.message : null,
    swap: swapMutation.mutateAsync,
    isSwapping: swapMutation.isPending,
  };
}
