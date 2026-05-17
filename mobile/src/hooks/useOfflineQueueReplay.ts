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
import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';
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
    // handler redispatches; the dispatcher owns success/fail bookkeeping.
    //
    // Rate-limit handling mirrors the memory handler above: 429 (which
    // `callEdgeFunction` surfaces as `EdgeFunctionRateLimitError`) must
    // throw `HaltReplayError` so the dispatcher reschedules a deferred
    // replay using the server's `retryAfter`. Falling through as a
    // generic failure would let the trial drop after 3 retries with no
    // wake-up between them. (Codex P2 round 2 on PR #876.)
    //
    // On success, invalidate `['subscription']` so `useSubscription`
    // refetches and paywall / premium-gated UI flips from `locked` to
    // `trialing` immediately, rather than waiting for the 60s stale
    // time. Same shape as the purchase/restore paths.
    // (Codex P2 round 3 on PR #876.)
    registerHandler<StartTrialPayload>(START_TRIAL_ACTION, async (payload) => {
      // Guard against account-switch race (Codex P1 on PR #877). The
      // `start_trial` edge function derives the target user from the
      // bearer JWT in the current Supabase session — it does NOT read
      // the `userId` we queued. So if the session changed between
      // enqueue and replay (account switch via token refresh, or any
      // path that bypasses the `SIGNED_OUT` queue-clear), naively
      // dispatching would credit the trial to the wrong account.
      //
      //   - No session → throw so the dispatcher retries later when
      //     the user is signed in again (subject to the 3-attempt cap).
      //   - Different user → return so the item is removed (retrying
      //     can't help; we never want the trial to go to a wrong
      //     account). Log a breadcrumb so the drop is auditable.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('start_trial replay deferred: no active session');
      }
      if (session.user.id !== payload.userId) {
        Sentry.addBreadcrumb({
          category: 'offline_queue',
          level: 'info',
          message: 'start_trial_skipped_user_mismatch',
          data: { queued: payload.userId, current: session.user.id },
        });
        return;
      }

      try {
        await dispatchStartTrial(payload);
      } catch (err) {
        if (err instanceof EdgeFunctionRateLimitError) {
          const retryAfterSec = err.retryAfter > 0 ? err.retryAfter : 60;
          throw new HaltReplayError(retryAfterSec * 1000);
        }
        throw err;
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
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
