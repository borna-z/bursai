// React Query wrapper around `persistGarmentWithOfflineFallback`. The actual
// insert / render-queue / enrichment / offline-detection lives in
// `mobile/src/lib/garmentSave.ts` so the offline-replay handler in AuthContext
// can share the same code path without forming a circular import.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';
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
