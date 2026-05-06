// Queue-aware Style Memory ingest. Mobile equivalent of web's
// useRecordMemoryEvent + memoryEventQueue, deliberately shaped as a plain
// async function (not a hook) so non-component contexts — useOutfits
// mutations, future job handlers, screen-level effects — can fire signals
// without prop-drilling a hook ref.
//
// Behaviour:
//   - Drops `quick_reaction` events with no `value` (server-side
//     pair_delta derivation depends on polarity; missing value is a
//     silent zero-delta failure mode).
//   - Builds a stable idempotency key from (userId, signal_type, target,
//     discriminator, minute_bucket) so double-tap / Strict-Mode /
//     React Query retry within a minute collapses server-side without
//     burning rate-limit quota.
//   - Online: calls `memory_ingest` via callEdgeFunction. 4xx (validation,
//     rate limit, paywall) → log + drop (retrying client mistakes is
//     futile). 5xx / transport / timeout → enqueue to the M5 offline
//     queue tagged `'memory-event'`; AuthContext drains on connectivity
//     restored.
//   - Offline-replay path uses `dispatchMemoryEvent` directly so a 5xx
//     leaves the item parked for the next replay tick (no infinite
//     re-enqueue loop).

import { supabase } from './supabase';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionRateLimitError,
  EdgeFunctionSubscriptionLockedError,
} from './edgeFunctionClient';
import { enqueue as enqueueOffline, scheduleDeferredReplay } from './offlineQueue';
import {
  buildMemoryIdempotencyKey,
  isQuickReactionMissingValue,
  type RecordMemoryEventInput,
} from './memoryEvents';

export const MEMORY_EVENT_ACTION = 'memory-event';

/** Wire body: input plus the derived idempotency key. The offline-queue
 * handler dispatches this exact shape on replay so the server collapses
 * dupes via the same `request_idempotency` cache row. */
export interface MemoryIngestPayload extends RecordMemoryEventInput {
  idempotency_key: string;
}

/**
 * Fire-and-forget Style Memory write. Routes through the offline queue
 * on transport / 5xx failure; drops 4xx silently (logged). The wire field
 * is `signal_type` (NOT the legacy mobile `event_type` which the server
 * silently 400'd — Wave 8.5 P0 caught in PR #712).
 */
export async function recordMemoryEvent(
  input: RecordMemoryEventInput,
): Promise<void> {
  if (isQuickReactionMissingValue(input)) {
    console.warn(
      '[memoryIngest] dropped quick_reaction without value',
      { signal_type: input.signal_type, source: input.source },
    );
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  // Without a user we can't derive a stable idempotency key AND the edge
  // function would 401 anyway. Drop silently — sign-out races aren't an
  // error.
  if (!userId) return;

  const idempotency_key = buildMemoryIdempotencyKey(userId, input);
  const payload: MemoryIngestPayload = { ...input, idempotency_key };

  try {
    await dispatchMemoryEvent(payload);
  } catch (err) {
    // 5xx / transport / unclassified — preserve via the M5 queue. The
    // 4xx surface was already swallowed inside dispatchMemoryEvent.
    await enqueueOffline(MEMORY_EVENT_ACTION, payload);
    // Codex P2 round 4 on PR #734: an online failure (transient 5xx /
    // 429) would otherwise sit in the queue until the next NetInfo
    // transition or app restart. Schedule a deferred replay so the
    // event syncs once the server / rate-limit window recovers.
    scheduleDeferredReplay();
    console.warn(
      '[memoryIngest] enqueued for retry:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Send a payload to memory_ingest. Used by both `recordMemoryEvent`
 * (live caller) and the AuthContext-registered offline-queue replay
 * handler. Throws on network / transport / 5xx so the queue handler can
 * leave the item in place; 4xx is treated as a permanent client mistake
 * and logged-then-swallowed (no throw).
 */
export async function dispatchMemoryEvent(
  payload: MemoryIngestPayload,
): Promise<void> {
  try {
    await callEdgeFunction('memory_ingest', {
      body: payload,
      retries: 1,
      timeoutMs: 8000,
    });
  } catch (err) {
    // SubscriptionLocked is permanent for the user's current plan —
    // memory_ingest gates on subscription, and an unsubscribed user
    // won't be subscribed by retry. Drop, logged.
    if (err instanceof EdgeFunctionSubscriptionLockedError) {
      console.warn(
        '[memoryIngest] memory_ingest paywalled (dropped):',
        err.message,
      );
      return;
    }
    // RateLimit (HTTP 429) is RETRYABLE once the per-minute / per-hour
    // window resets — Codex P2 round 2 on PR #734. A reconnect-burst
    // that queued more events than the per-minute quota would otherwise
    // see the first batch drop on 429. Re-throw so the live caller
    // enqueues and the replay path leaves the item parked for the next
    // tick. The M5 queue's MAX_ATTEMPTS=3 still caps the retry budget
    // so a persistently-throttled user can't pile up forever.
    if (err instanceof EdgeFunctionRateLimitError) {
      throw err;
    }
    // EdgeFunctionHttpError covers BOTH 4xx (after the retry budget for
    // non-retryable statuses) AND 5xx (after the retry budget for
    // transient statuses). Codex P2 round 1 on PR #734: only 4xx is a
    // permanent client mistake — 5xx is a server-side outage that may
    // resolve, so throw it back so the live caller can enqueue and the
    // queue replay can leave the item parked for the next attempt.
    if (err instanceof EdgeFunctionHttpError) {
      if (err.status >= 400 && err.status < 500) {
        console.warn(
          '[memoryIngest] memory_ingest 4xx (dropped):',
          err.message,
        );
        return;
      }
      // 5xx — fall through to throw so the queue retries.
    }
    // Unknown / transport / 5xx — caller decides whether to enqueue or retry.
    throw err;
  }
}
