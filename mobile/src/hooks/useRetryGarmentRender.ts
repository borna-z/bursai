// useRetryGarmentRender — manual studio-render trigger from GarmentDetailScreen.
//
// Calls the existing `enqueue_render_job` edge function with `source: 'retry'`
// and a fresh `client_nonce` per tap cycle. The edge function's reserve-key
// idempotency dedupes a retried network call, while a distinct nonce forces
// a fresh reservation for an intentional re-render.
//
// The worker writes `rendered_image_path` + flips `render_status`; the
// existing `useRenderJobStatus` poller wired in GarmentDetailScreen picks
// up the new render_jobs row and invalidates the garment cache on
// completion. No writes from this hook to garment rows directly.

import * as Crypto from 'expo-crypto';
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

export function useRetryGarmentRender() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (garmentId: string) => {
      if (!user) throw new Error('Not authenticated');
      const clientNonce = Crypto.randomUUID();
      try {
        const data = await callEdgeFunction<EnqueueRenderJobResponse>(
          'enqueue_render_job',
          {
            body: {
              garment_id: garmentId,
              source: 'retry',
              client_nonce: clientNonce,
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
    onSuccess: (_data, garmentId) => {
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
