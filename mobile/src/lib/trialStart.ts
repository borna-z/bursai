// M46 — offline-resilient trial-start.
//
// Background: pre-M46, AuthContext fire-and-forgot `callStartTrial()` via a
// 0ms setTimeout that swallowed every error. If Supabase was momentarily
// unavailable during the fresh-signup window (common on flaky networks and
// the first 60s after install), the trial silently never started and the
// user paid later expecting a trial discount that wasn't recorded. Copilot
// codebase audit (2026-05-17) flagged this Medium-severity; Day 0 sprint
// audit escalated to launch must-ship.
//
// Fix: route the call through the existing offline-queue infrastructure
// (`lib/offlineQueue`). Online path tries directly with retries; offline
// path enqueues for replay when connectivity returns. AuthContext stays
// non-blocking — `enqueueStartTrial` never throws to its caller, mirroring
// the old fire-and-forget contract.
//
// The replay handler is registered in `useOfflineQueueReplay` so the queue
// dispatcher knows what to do when the user comes back online and a
// `start-trial` job is sitting in the queue.

import { callEdgeFunction } from './edgeFunctionClient';
import { enqueue as enqueueOffline, isOnlineNow } from './offlineQueue';
import { Sentry } from './sentry';

export const START_TRIAL_ACTION = 'start-trial';

export interface StartTrialPayload {
  /** Captured for diagnostics + idempotency; the edge function reads the
   *  acting user from the bearer JWT, not from this field. */
  userId: string;
}

/** Direct call against the `start_trial` edge function. Used both for the
 *  immediate-online path inside `enqueueStartTrial` and as the replay
 *  handler registered with the offline-queue dispatcher.
 *
 *  `retries: 2` matches the `callEdgeFunction` default for transient
 *  network failures. Permanent 4xx errors throw — the offline-queue
 *  dispatcher will surface them to Sentry through its own error path. */
export async function dispatchStartTrial(_payload: StartTrialPayload): Promise<void> {
  await callEdgeFunction('start_trial', { body: {}, retries: 2 });
}

/** Non-blocking trial-start with offline-queue fallback. Never throws to
 *  the caller — failures go to Sentry / the offline queue / both. */
export async function enqueueStartTrial(userId: string): Promise<void> {
  const payload: StartTrialPayload = { userId };

  if (!(await isOnlineNow())) {
    await enqueueOffline(START_TRIAL_ACTION, payload);
    return;
  }

  try {
    await dispatchStartTrial(payload);
  } catch (err) {
    // Connectivity may have dropped between the isOnlineNow check and the
    // call itself. If we're now offline, queue for replay. Otherwise the
    // failure is permanent (4xx, malformed response, etc.) — surface to
    // Sentry but don't block the auth flow.
    if (!(await isOnlineNow())) {
      await enqueueOffline(START_TRIAL_ACTION, payload);
      return;
    }
    Sentry.withScope((scope) => {
      scope.setTag('mutation', 'startTrial');
      scope.setContext('startTrialPayload', { userId });
      Sentry.captureException(err);
    });
  }
}
