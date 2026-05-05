// Count-only garment query — used by gap-analysis prerequisites and any
// surface that needs `garments.length` without paying for `select('*')`.
// Mirrors the web's `useGarmentCount` from src/hooks/useGarments.ts but
// stripped to the no-filters case (mobile call sites only need the total).
//
// Cache key intentionally matches the web's `['garments-count', user?.id]`
// shape so a future port of count-driven web flows shares the same entry.
// Mutations that change the row count — useAddGarment and useDeleteGarment —
// must invalidate `['garments-count']` explicitly: TanStack's prefix-match
// on `['garments']` does NOT cover this key.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useGarmentCount() {
  const { user } = useAuth();

  return useQuery<number>({
    queryKey: ['garments-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('garments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
