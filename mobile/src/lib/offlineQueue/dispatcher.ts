import NetInfo from '@react-native-community/netinfo';

import {
  hydrate,
  getQueueSnapshot,
  getQueueLength,
  commitQueueAfterReplay,
  type QueueItem,
} from './persistence';

const MAX_ATTEMPTS = 3;

type Handler<P = unknown> = (payload: P) => Promise<void>;

export class HaltReplayError extends Error {
  retryAfterMs?: number;
  constructor(retryAfterMs?: number) {
    super('Replay halted by handler');
    this.name = 'HaltReplayError';
    this.retryAfterMs = retryAfterMs;
  }
}

interface ReplayResult {
  succeeded: number;
  failed: number;
  remaining: number;
}

const handlers = new Map<string, Handler>();
let replayInFlight: Promise<ReplayResult> | null = null;
let replaysPaused = false;

export function registerHandler<P>(action: string, fn: Handler<P>): void {
  handlers.set(action, fn as Handler);
}

export function replay(): Promise<ReplayResult> {
  if (replaysPaused) {
    return Promise.resolve({ succeeded: 0, failed: 0, remaining: getQueueLength() });
  }
  if (replayInFlight) return replayInFlight;
  replayInFlight = (async () => {
    try {
      return await runReplay();
    } finally {
      replayInFlight = null;
    }
  })();
  return replayInFlight;
}

export async function pauseReplaysAndWaitSettled(): Promise<void> {
  replaysPaused = true;
  if (replayInFlight) {
    try {
      await replayInFlight;
    } catch {
      // replay() owns its own error surface.
    }
  }
}

export function resumeReplays(): void {
  replaysPaused = false;
}

async function runReplay(): Promise<ReplayResult> {
  await hydrate();
  if (getQueueLength() === 0) {
    return { succeeded: 0, failed: 0, remaining: 0 };
  }
  let succeeded = 0;
  let failed = 0;
  const snapshot = getQueueSnapshot();
  const survivors: QueueItem[] = [];
  const haltedActions = new Set<string>();
  let haltRetryAfterMs: number | undefined;
  for (const item of snapshot) {
    if (haltedActions.has(item.action)) {
      survivors.push(item);
      continue;
    }
    const handler = handlers.get(item.action);
    if (!handler) {
      continue;
    }
    try {
      await handler(item.payload);
      succeeded++;
    } catch (err) {
      if (err instanceof HaltReplayError) {
        survivors.push(item);
        haltedActions.add(item.action);
        if (
          err.retryAfterMs != null &&
          (haltRetryAfterMs == null || err.retryAfterMs < haltRetryAfterMs)
        ) {
          haltRetryAfterMs = err.retryAfterMs;
        }
        continue;
      }
      const nextAttempts = item.attempts + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        failed++;
        continue;
      }
      survivors.push({ ...item, attempts: nextAttempts });
      failed++;
    }
  }
  await commitQueueAfterReplay(survivors, snapshot.length);
  const remaining = getQueueLength();
  if (haltedActions.size > 0) {
    scheduleDeferredReplay(haltRetryAfterMs);
  }
  return { succeeded, failed, remaining };
}

const DEFERRED_REPLAY_MS = 30_000;
const MIN_DEFERRED_REPLAY_MS = 5_000;
const MAX_DEFERRED_REPLAY_MS = 5 * 60_000;
let deferredReplayTimer: ReturnType<typeof setTimeout> | null = null;
let deferredReplayDelayMs = 0;

export function scheduleDeferredReplay(retryAfterMs?: number): void {
  const requestedDelay =
    retryAfterMs != null && retryAfterMs > 0 ? retryAfterMs : DEFERRED_REPLAY_MS;
  const delay = Math.max(
    MIN_DEFERRED_REPLAY_MS,
    Math.min(MAX_DEFERRED_REPLAY_MS, requestedDelay),
  );
  if (deferredReplayTimer) {
    if (delay >= deferredReplayDelayMs) return;
    clearTimeout(deferredReplayTimer);
  }
  deferredReplayDelayMs = delay;
  deferredReplayTimer = setTimeout(() => {
    deferredReplayTimer = null;
    deferredReplayDelayMs = 0;
    void (async () => {
      try {
        const state = await NetInfo.fetch();
        if (state.isConnected === false || state.isInternetReachable === false) {
          return;
        }
      } catch {
        // NetInfo probe failure — fall through.
      }
      void replay().catch(() => {});
    })();
  }, delay);
}
