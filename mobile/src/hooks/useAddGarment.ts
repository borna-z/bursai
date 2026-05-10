// React Query wrapper around `persistGarmentWithOfflineFallback`. The actual
// insert / render-queue / enrichment / offline-detection lives in
// `mobile/src/lib/garmentSave.ts` so the offline-replay handler in AuthContext
// can share the same code path without forming a circular import.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';
import { callEdgeFunction } from '../lib/edgeFunctionClient';
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
      // the next AI feature open finds cached daily picks. Pre-invalidation
      // count + 1 = post-save projection; queryClient.getQueryData reads the
      // stale value the count cache held before this onSuccess invalidate
      // pass marked it dirty (TanStack invalidates lazily — the entry isn't
      // refetched yet at this point in the tick). Fire-and-forget — failure
      // is non-critical, the cache will warm itself on the next user fetch.
      const cachedCount = queryClient.getQueryData<number>([
        'garments-count',
        user?.id,
      ]);
      const newCount = (cachedCount ?? 0) + 1;
      if (newCount === 5 && user?.id) {
        callEdgeFunction('prefetch_suggestions', {
          body: { user_id: user.id, trigger: 'first_5_garments' },
        }).catch(() => {});
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
