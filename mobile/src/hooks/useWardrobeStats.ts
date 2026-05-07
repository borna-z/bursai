// useWardrobeStats — three HEAD count queries (garments / outfits /
// wear_logs) bundled into a single React Query entry so ProfileScreen +
// SettingsScreen can wire all three stats with one hook.
//
// Why HEAD-only: the screens render counts only — a `select('*')` would
// pay for every row's bytes for a number that the database already knows.
// `select('*', { count: 'exact', head: true })` returns no rows; the
// `count` field is populated from a server-side COUNT(*).
//
// Why three queries (not one RPC): the three tables have different RLS
// policies and indexes; a single SQL function would need SECURITY DEFINER
// + a service-role grant, which is more surface area than three indexed
// COUNT(*) calls. `Promise.all` parallelism keeps the wall-clock cost at
// ~max(t1, t2, t3) ≈ a single round trip.
//
// Cache key intentionally distinct from the per-table keys
// (`['garments-count', userId]` from useGarmentCount) so a future
// invalidation that only knows the bundle key doesn't also bust the
// per-table caches and vice versa. Mutations that change row counts
// (useAddGarment, useDeleteGarment, useSaveOutfit, etc.) should
// invalidate `['wardrobeStats']` explicitly when they care.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface WardrobeStats {
  garmentCount: number;
  outfitCount: number;
  wearLogCount: number;
}

async function headCount(table: 'garments' | 'outfits' | 'wear_logs', userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

export function useWardrobeStats() {
  const { user } = useAuth();

  return useQuery<WardrobeStats>({
    queryKey: ['wardrobeStats', user?.id],
    queryFn: async (): Promise<WardrobeStats> => {
      if (!user) return { garmentCount: 0, outfitCount: 0, wearLogCount: 0 };
      const [garmentCount, outfitCount, wearLogCount] = await Promise.all([
        headCount('garments', user.id),
        headCount('outfits', user.id),
        headCount('wear_logs', user.id),
      ]);
      return { garmentCount, outfitCount, wearLogCount };
    },
    enabled: !!user,
    // Stats refresh more aggressively than the DNA — a user may add a
    // garment / save an outfit / log a wear and immediately come back to
    // Profile expecting the number to bump. 1-min stale window keeps
    // the screen responsive without spamming COUNT queries on quick
    // back-and-forth navigation.
    staleTime: 60 * 1000,
  });
}
