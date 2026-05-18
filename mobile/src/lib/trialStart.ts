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

import { Platform } from 'react-native';

import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
} from './edgeFunctionClient';
import {
  enqueue as enqueueOffline,
  isOnlineNow,
  scheduleDeferredReplay,
} from './offlineQueue';
import { Sentry } from './sentry';

export const START_TRIAL_ACTION = 'start-trial';

export interface StartTrialPayload {
  /** Captured for diagnostics + idempotency; the edge function reads the
   *  acting user from the bearer JWT, not from this field. */
  userId: string;
}

/** Distinguish failures that won't change on retry (4xx client errors,
 *  subscription locked) from transient failures that should be queued
 *  for replay (5xx, network errors, timeouts, rate limits, circuit
 *  breakers — all of which can recover on their own).
 *
 *  Codex review on PR #876 caught the original "Sentry-only when still
 *  online" branch losing trials during exactly the Supabase 5xx outage
 *  this wave was meant to recover from. Classifying by error type
 *  (rather than by current connectivity) is the correct fix. */
function isPermanentFailure(err: unknown): boolean {
  if (err instanceof EdgeFunctionSubscriptionLockedError) return true;
  if (err instanceof EdgeFunctionHttpError) {
    // 4xx: malformed body, missing auth, forbidden, not found. Retrying
    // changes nothing. 5xx falls through to the transient branch.
    return err.status >= 400 && err.status < 500;
  }
  // Rate limits (EdgeFunctionRateLimitError), timeouts
  // (EdgeFunctionTimeoutError), circuit-open
  // (EdgeFunctionCircuitOpenError), network errors, etc. all return
  // false here — they're transient and worth a replay.
  return false;
}

/** Direct call against the `start_trial` edge function. Used both for the
 *  immediate-online path inside `enqueueStartTrial` and as the replay
 *  handler registered with the offline-queue dispatcher.
 *
 *  `retries: 2` matches the `callEdgeFunction` default for transient
 *  network failures. All errors propagate — the caller decides what to
 *  do with them. */
export async function dispatchStartTrial(_payload: StartTrialPayload): Promise<void> {
  await callEdgeFunction('start_trial', { body: {}, retries: 2 });
}

/** Non-blocking trial-start with offline-queue fallback. Never throws to
 *  the caller — failures go to Sentry (permanent) / the offline queue
 *  (transient or offline). */
export async function enqueueStartTrial(userId: string): Promise<void> {
  // `start_trial` is Stripe-only and was deprecated for mobile when M31
  // moved iOS/Android billing onto RevenueCat. Calling it on mobile returns
  // 503, which `isPermanentFailure` classifies as transient and queues
  // for replay — so every new mobile signup writes a stuck job that
  // retries forever. Short-circuit native platforms entirely; the
  // RevenueCat purchase flow is the real trial-start path on mobile.
  if (Platform.OS === 'ios' || Platform.OS === 'android') return;

  const payload: StartTrialPayload = { userId };

  if (!(await isOnlineNow())) {
    await enqueueOffline(START_TRIAL_ACTION, payload);
    // Defense in depth: NetInfo *should* fire an `online` event when the
    // user reconnects and `useOfflineQueueReplay` will drain the queue
    // then. If that event never fires (NetInfo race, app backgrounded
    // during reconnect, OS suppressing callbacks), the deferred replay
    // gives us a second wake-up to catch up. The dispatcher self-checks
    // connectivity before replaying, so this is a no-op when still offline.
    scheduleDeferredReplay();
    return;
  }

  try {
    await dispatchStartTrial(payload);
  } catch (err) {
    if (isPermanentFailure(err)) {
      // 4xx or subscription-locked — retrying won't help. Surface to
      // Sentry so we can diagnose and don't waste queue capacity.
      Sentry.withScope((scope) => {
        scope.setTag('mutation', 'startTrial');
        scope.setContext('startTrialPayload', { userId });
        Sentry.captureException(err);
      });
      return;
    }
    // Transient (5xx, timeout, network, rate limit, circuit-open) — queue
    // for replay regardless of whether the connectivity probe still
    // reports online. The whole point of M46 is that Supabase can be
    // having a bad minute while NetInfo is happy.
    await enqueueOffline(START_TRIAL_ACTION, payload);
    // Codex review round 2 on PR #876: without an explicit reschedule,
    // a transient-online failure leaves the queued trial sitting until
    // app restart or a NetInfo transition that may never come (if
    // connectivity stays stable). Kick a deferred replay so the queue
    // gets a second chance ~30s later regardless of NetInfo state.
    scheduleDeferredReplay();
  }
}
