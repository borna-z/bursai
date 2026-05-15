// useGarmentsByIds — hydrate a list of garment ids into the minimal row
// shape the OutfitCard's `garments` prop expects (id + image paths).
//
// Used by:
//   • OutfitSuggestionCard — chat-row outfit attachment that renders the
//     upgraded G6 OutfitCard with real garment thumbs.
//
// Mirrors the shape of the web hook at `src/hooks/useGarmentsByIds.ts` but
// returns only the columns required by `OutfitCardGarment` so the SELECT
// stays narrow. A future consumer that needs `category`/`color_primary`
// can add a sibling hook rather than widening this one.
//
// React Query caches per-id-list so repeated chat bubbles referencing
// the same outfit don't re-fetch. The cache key preserves the
// requested order — distinct orderings get distinct cache entries
// (Codex P2 round 2 on PR #789) so a refine turn that reorders the
// same garments renders with the new order rather than the prior
// card's stale ordering. RLS enforces user_id matching server-side;
// we additionally `.eq('user_id')` so a stale id from a different
// account never leaks.

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export interface GarmentBasic {
  id: string;
  title: string | null;
  rendered_image_path: string | null;
  original_image_path: string | null;
  image_path: string | null;
}

export function useGarmentsByIds(ids: readonly string[] | null | undefined) {
  const { user } = useAuth();
  // Codex P2 round 2 on PR #789: cache key preserves the requested
  // order. Sorting collapsed [a,b] and [b,a] into one entry, which
  // meant the second card rendered with the first card's ordering —
  // breaking refine turns where the assistant reorders the same
  // pieces. Order-preserving keys cost a separate cache entry per
  // permutation but the wardrobe is small enough that the overhead is
  // negligible.
  const safeIds = ids ? ids.filter((id) => typeof id === 'string' && id.length > 0) : [];
  const cacheKey = safeIds.join(',');

  return useQuery<GarmentBasic[]>({
    queryKey: ['garmentsByIds', user?.id, cacheKey],
    enabled: !!user?.id && safeIds.length > 0,
    queryFn: async () => {
      if (!user?.id || safeIds.length === 0) return [];
      const { data, error } = await supabase
        .from('garments')
        .select('id, title, rendered_image_path, original_image_path, image_path')
        .eq('user_id', user.id)
        .in('id', safeIds);
      if (error) throw error;
      const rows = (data ?? []) as GarmentBasic[];
      // Preserve the requested order so the OutfitCard slot grid matches
      // the order the assistant suggested rather than the SELECT's
      // pg-default ordering.
      const byId = new Map(rows.map((r) => [r.id, r]));
      return safeIds
        .map((id) => byId.get(id))
        .filter((r): r is GarmentBasic => !!r);
    },
    staleTime: 5 * 60_000,
  });
}
