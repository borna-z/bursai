// useSmartFilterCounts — server-counted Smart Access tile totals for the
// Wardrobe screen. Replaces the client-side `garments.filter(...).length`
// derivation that collapsed to "—" on paginated wardrobes (Codex P2
// round 9 on PR #738 documented the trade-off; Q-C1 closes it).
//
// Three parallel HEAD count queries — Recently Added (total), Most Worn
// (`wear_count > 0`), and Rarely Worn (`last_worn_at IS NULL OR
// last_worn_at < now - 30 days`). Each runs via Supabase's
// `{ count: 'exact', head: true }` shape so no rows are pulled back over
// the wire — only the count header. RLS scopes each query to the
// authenticated user; we additionally `.eq('user_id')` so a stale id
// from a different account never leaks past the RLS layer.
//
// Mirrors web `src/hooks/useGarments.ts:443-469` byte-for-byte (same
// queries, same cutoff math, same fail-fast on any error so React
// Query retries instead of caching a corrupted zero payload). The web
// version returns `{ rarely_worn, most_worn, new }`; mobile mirrors that
// shape so consumers can swap between platforms without re-keying.
//
// `staleTime: 2 min` matches web — the counts shift after every garment
// add / wear / RLS invalidation, but a brief stale window is acceptable
// for tile counts that update on the next focus.

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/** Rolling window cutoff for the Rarely Worn count. 30 days mirrors
 *  web; widen here if the product team decides "rarely" means quarterly. */
const RARELY_WORN_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000;

export interface SmartFilterCounts {
  /** All garments owned by the user — drives the "Recently added" /
   *  "Inventory" tile and the search-bar placeholder. Authoritative
   *  even on paginated wardrobes. */
  new: number;
  /** Garments with at least one wear (`wear_count > 0`). */
  most_worn: number;
  /** Garments that haven't been worn within the last 30 days
   *  (or never worn at all). */
  rarely_worn: number;
}

const ZERO: SmartFilterCounts = { new: 0, most_worn: 0, rarely_worn: 0 };

export function useSmartFilterCounts() {
  const { user } = useAuth();
  return useQuery<SmartFilterCounts>({
    queryKey: ['garments-smart-counts', user?.id],
    queryFn: async () => {
      if (!user) return ZERO;
      const cutoff = new Date(Date.now() - RARELY_WORN_CUTOFF_MS).toISOString();
      const [total, mostWorn, rarelyWorn] = await Promise.all([
        supabase
          .from('garments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('garments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gt('wear_count', 0),
        supabase
          .from('garments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .or(`last_worn_at.is.null,last_worn_at.lt.${cutoff}`),
      ]);
      // Fail fast on any error so React Query retries instead of
      // caching a corrupted zero-count payload that would hide tiles.
      if (total.error) throw total.error;
      if (mostWorn.error) throw mostWorn.error;
      if (rarelyWorn.error) throw rarelyWorn.error;
      return {
        new: total.count ?? 0,
        most_worn: mostWorn.count ?? 0,
        rarely_worn: rarelyWorn.count ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}
