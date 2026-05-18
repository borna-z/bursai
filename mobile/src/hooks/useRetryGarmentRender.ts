// useRetryGarmentRender — manual studio-render trigger from GarmentDetailScreen.
//
// Calls the existing `enqueue_render_job` edge function with `source: 'retry'`
// + `force: true` (user-initiated → bypass eligibility and already-ready
// short-circuit). The caller (GarmentDetailScreen) owns the `clientNonce`
// lifecycle: a single nonce is reused across user re-taps for the same
// logical attempt so the server-side reserve_key idempotency (which keys on
// nonce) returns `replay:true` instead of minting a second reservation.
// The screen rotates the nonce only after the worker has claimed the job
// (i.e., once `render_status` becomes active).
//
// The worker writes `rendered_image_path` + flips `render_status`; the
// existing `useRenderJobStatus` poller wired in GarmentDetailScreen picks
// up the new render_jobs row and invalidates the garment cache on
// completion. No writes from this hook to garment rows directly.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';
import { CACHE_KEYS } from './cacheKeys';

type EnqueueRenderJobResponse = {
  jobId?: string;
  ok?: boolean;
  error?: string;
};

type RetryRenderInput = {
  garmentId: string;
  clientNonce: string;
};

export function useRetryGarmentRender() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ garmentId, clientNonce }: RetryRenderInput) => {
      if (!user) throw new Error('Not authenticated');
      try {
        const data = await callEdgeFunction<EnqueueRenderJobResponse>(
          'enqueue_render_job',
          {
            body: {
              garmentId,
              source: 'retry',
              clientNonce,
              force: true,
            },
          },
        );
        return data ?? { ok: true };
      } catch (err) {
        if (err instanceof EdgeFunctionSubscriptionLockedError) {
          throw new Error(SUBSCRIPTION_SENTINEL);
        }
        throw err;
      }
    },
    onSuccess: (_data, { garmentId }) => {
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: CACHE_KEYS.garment(user?.id, garmentId) });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : '';
      if (message === SUBSCRIPTION_SENTINEL) return;
      Sentry.withScope((s) => {
        s.setTag('mutation', 'useRetryGarmentRender');
        Sentry.captureException(err);
      });
    },
  });
}
