// React Query wrapper around `persistGarmentWithOfflineFallback`. The actual
// insert / render-queue / enrichment / offline-detection lives in
// `mobile/src/lib/garmentSave.ts` so the offline-replay handler in AuthContext
// can share the same code path without forming a circular import.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';
import { callEdgeFunction } from '../lib/edgeFunctionClient';
import { supabase } from '../lib/supabase';
import {
  OfflineQueuedError,
  persistGarmentWithOfflineFallback,
  type AddGarmentParams,
  type AddGarmentSource,
} from '../lib/garmentSave';

export type { AddGarmentParams, AddGarmentSource };
export { OfflineQueuedError };

export function useAddGarment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: AddGarmentParams) => {
      if (!user) throw new Error('Not authenticated');
      return persistGarmentWithOfflineFallback(params);
    },
    onSuccess: () => {
      // Invalidate every cached garments list (filters / smart filters /
      // search variants) so the new row shows up everywhere immediately.
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      // garments-count is a sibling cache key; ['garments'] prefix-match
      // does not cover it, so the count would stay stale until staleTime.
      queryClient.invalidateQueries({ queryKey: ['garments-count'] });
      // Profile stats bundle (M29) — sibling key, not covered by the
      // ['garments'] prefix invalidation above.
      queryClient.invalidateQueries({ queryKey: ['wardrobeStats', user?.id] });
      // Insights derives totals + palette + utilisation from garments — refresh
      // so the new piece is reflected next time the user opens the tab.
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });

      // Mirror web's `useAddGarment.ts:493-497` behavior — when the user
      // crosses 5 garments for the first time, warm prefetch_suggestions so
      // the next AI feature open finds cached daily picks. Fire-and-forget
      // — failure is non-critical, the cache warms on the next user fetch.
      //
      // Codex P2 round 2 on PR #816 — read the count authoritatively from
      // Supabase rather than the optional TanStack cache entry. A
      // cold/deep-linked add flow or a GC'd `['garments-count']` entry
      // leaves `getQueryData` undefined, which previously defaulted to 0
      // and silently skipped the warm-cache fire on the actual 5th save.
      // Light query (`head: true` + `count: 'exact'`) — no row payload.
      if (user?.id) {
        void (async () => {
          try {
            const { count } = await supabase
              .from('garments')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);
            if (count === 5) {
              callEdgeFunction('prefetch_suggestions', {
                body: { user_id: user.id, trigger: 'first_5_garments' },
              }).catch(() => {});
            }
          } catch {
            // Count probe failure is non-critical; the prefetch is a
            // performance warm-up, not a correctness gate.
          }
        })();
      }
    },
    onError: (err: unknown) => {
      // OfflineQueuedError is a controlled flow signal, not a failure — the
      // save WILL land once the network returns. Skip Sentry capture so the
      // dashboard doesn't fill with offline-mode noise.
      if (err instanceof OfflineQueuedError) return;
      captureMutationError('useAddGarment')(err);
    },
  });
}
