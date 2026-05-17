import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { EdgeFunctionRateLimitError } from '../lib/edgeFunctionClient';
import {
  registerHandler,
  replay as replayOfflineQueue,
  HaltReplayError,
  isOnlineNow,
} from '../lib/offlineQueue';
import {
  persistGarment,
  surfaceRenderEnqueueFailureToast,
  type AddGarmentParams,
} from '../lib/garmentSave';
import {
  dispatchMemoryEvent,
  MEMORY_EVENT_ACTION,
  type MemoryIngestPayload,
} from '../lib/memoryIngest';
import {
  dispatchStartTrial,
  START_TRIAL_ACTION,
  type StartTrialPayload,
} from '../lib/trialStart';

function invalidateGarmentCaches(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['garments'] });
  queryClient.invalidateQueries({ queryKey: ['garments-count'] });
  queryClient.invalidateQueries({ queryKey: ['garments-smart-counts'] });
  queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
}

export function useOfflineQueueReplay(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    registerHandler<AddGarmentParams>('add-garment-save', async (payload) => {
      await persistGarment(payload, {
        onRenderEnqueueFailure: surfaceRenderEnqueueFailureToast,
      });
      invalidateGarmentCaches(queryClient);
    });

    registerHandler<MemoryIngestPayload>(MEMORY_EVENT_ACTION, async (payload) => {
      try {
        await dispatchMemoryEvent(payload);
      } catch (err) {
        if (err instanceof EdgeFunctionRateLimitError) {
          const retryAfterSec = err.retryAfter > 0 ? err.retryAfter : 60;
          throw new HaltReplayError(retryAfterSec * 1000);
        }
        throw err;
      }
    });

    // M46 — trial-start queued from AuthContext when the user signs up
    // offline (or the live call fails with the network dropping). The
    // handler just redispatches; the offline-queue dispatcher owns
    // success / fail bookkeeping and Sentry surfacing.
    registerHandler<StartTrialPayload>(START_TRIAL_ACTION, async (payload) => {
      await dispatchStartTrial(payload);
    });

    void (async () => {
      if (await isOnlineNow()) {
        void replayOfflineQueue().catch(() => {});
      }
    })();

    const unsub = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected !== false && state.isInternetReachable !== false;
      if (online) {
        void replayOfflineQueue().catch(() => {});
      }
    });
    return () => {
      unsub();
    };
  }, [queryClient]);
}
