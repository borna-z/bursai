// Offline mutation queue — persists tagged actions through connectivity loss
// and replays them in order when the network returns.
//
// Architecture (mobile port of `src/lib/offlineQueue.ts`):
//
//   * Handler registry. Each action type (e.g. 'add-garment-save') registers
//     a single async handler at app startup; the queue dispatches by action
//     name on replay. This keeps the queue body data-only (no captured
//     functions ever live in storage), which is what makes serialization
//     and cross-launch replay sound.
//
//   * Persistence via AsyncStorage. Reads are async, so module init kicks
//     off `hydrate()` once and consumers `await` it (or read the in-memory
//     mirror once it's filled). Writes after each enqueue / dequeue.
//
//   * Replay. Triggered by the consumer (typically NetInfo connectivity
//     listener wired from AuthContext). Items are taken FIFO; on handler
//     success the item is dropped; on failure the attempt counter increments
//     and the item stays at the head with a small retry cap (3) so a
//     persistently-broken item can't permanently block replay of newer items.
//
//   * Subscription. Tiny observer pattern so `useOfflineQueue` can re-render
//     when count / online flag changes.
//
// Wave M5. Mirrors web's offlineQueue.ts in spirit but native-shaped: no
// localStorage / DOMException; AsyncStorage instead of synchronous reads;
// handler-registry instead of inline supabase-from(table) dispatch.

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const STORAGE_KEY = 'burs.offline-queue.v1';

// Hard cap on queue size — beyond this we drop the oldest items so the
// app can't OOM AsyncStorage with a runaway queue (offline marathon, broken
// handler repeatedly retrying, etc.). Web uses 50; mobile holds the same.
const MAX_QUEUE_SIZE = 50;

// Retry cap before an item is dropped permanently. A handler that fails
// 3 times in a row is unrecoverable from the queue's perspective; the
// originating mutation already surfaced an error to the user when it was
// enqueued, so silently dropping after 3 attempts is the right floor.
const MAX_ATTEMPTS = 3;

export interface QueueItem<P = unknown> {
  id: string;
  action: string;
  payload: P;
  attempts: number;
  createdAt: number;
}

type Handler<P = unknown> = (payload: P) => Promise<void>;

/**
 * Sentinel a handler can throw to halt the current replay pass without
 * counting attempts on the failing item or any subsequent snapshot
 * items. Used for rate-limit responses (HTTP 429) where the rest of
 * a queued burst is going to bounce off the same gate — burning all
 * three retry attempts in 90s would drop valid signals before the
 * server window resets. `retryAfterMs` (when present) is fed into the
 * deferred-replay scheduler so the next attempt aligns with the
 * server's recovery window. Codex P2 round 5 on PR #734.
 */
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
let queue: QueueItem[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;
// Single-flight replay guard. Concurrent callers (the mount kick and a
// NetInfo connectivity-restored callback firing back-to-back) used to
// snapshot the same queue and double-process every item — duplicate
// garment rows + duplicate render-job enqueues. While a replay is in
// flight, subsequent callers receive that same promise instead of
// starting a fresh pass. Codex P1 round 1 on PR #732.
let replayInFlight: Promise<ReplayResult> | null = null;
// When true, replay() short-circuits without dispatching. Used by
// destructive flows (reset_style_memory) that need to guarantee no
// queued events leak past the reset point. Codex P2 round 7 on PR #735.
let replaysPaused = false;

const subscribers = new Set<() => void>();
function emitChange(): void {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      // A subscriber throwing must not corrupt queue state — swallow.
    }
  });
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // AsyncStorage write can fail on full disk / OS pressure. We can't surface
    // this to the user productively; the in-memory queue still drives replay
    // for the current session. Next launch may lose items but that's strictly
    // better than crashing the app.
  }
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          queue = (parsed as QueueItem[]).filter(
            (it) => it && typeof it.id === 'string' && typeof it.action === 'string',
          );
        }
      }
    } catch {
      // Corrupt or missing — start clean. The single source of truth becomes
      // whatever consumers enqueue next.
      queue = [];
    } finally {
      hydrated = true;
      hydrating = null;
      // Codex P2 round 2 on PR #732: subscribers added before hydrate
      // completed (the typical UI mount order — OfflineBanner subscribes
      // synchronously, hydrate returns one tick later) would otherwise
      // read pendingCount()=0 forever in the offline-cold-start case
      // because nothing else emits until the next enqueue / replay.
      // Emit unconditionally on hydrate completion so the banner picks
      // up surviving items immediately.
      emitChange();
    }
  })();
  return hydrating;
}

// Eagerly hydrate so the first enqueue doesn't have to await on the hot path.
// Errors are absorbed in hydrate() itself.
void hydrate();

/**
 * Register a handler for an action type. Call from app startup (typically
 * AuthContext mount). Subsequent enqueue+replay cycles dispatch through
 * this map. Re-registering an action overwrites the previous handler so
 * a hot-reload doesn't leak handlers.
 */
export function registerHandler<P>(action: string, fn: Handler<P>): void {
  handlers.set(action, fn as Handler);
}

/**
 * Push an action onto the queue. Returns a promise so callers can await
 * persistence — important when the originating mutation is about to surface
 * a "saved offline" toast (we want the queue write to actually land before
 * we tell the user).
 */
export async function enqueue<P>(action: string, payload: P): Promise<QueueItem<P>> {
  await hydrate();
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Drop oldest — preserves the user's most recent intent.
    queue = queue.slice(-(MAX_QUEUE_SIZE - 1));
  }
  const item: QueueItem<P> = {
    id: cryptoRandomId(),
    action,
    payload,
    attempts: 0,
    createdAt: Date.now(),
  };
  queue.push(item as unknown as QueueItem);
  await persist();
  emitChange();
  return item;
}

/**
 * Replay the queue. Calls each item's registered handler in order; on
 * success drops the item, on failure increments attempts and leaves it
 * at the head (capped at MAX_ATTEMPTS, after which the item is dropped).
 * Items whose action has no registered handler are dropped immediately —
 * an orphaned action type can't be processed and parking it in the queue
 * forever serves nobody.
 *
 * Single-flight: concurrent callers receive the in-flight promise instead
 * of starting a parallel replay (which would double-process snapshots and
 * duplicate garment rows). Codex P1 round 1 on PR #732.
 */
export function replay(): Promise<ReplayResult> {
  if (replaysPaused) {
    return Promise.resolve({ succeeded: 0, failed: 0, remaining: queue.length });
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

/**
 * Pause future replays AND await any in-flight pass to settle. Used by
 * destructive flows that need to guarantee no queued events for a given
 * action will dispatch (e.g. resetting style memory while a memory-event
 * replay is mid-snapshot). The caller is responsible for re-enabling
 * via `resumeReplays()`. Codex P2 round 7 on PR #735.
 */
export async function pauseReplaysAndWaitSettled(): Promise<void> {
  replaysPaused = true;
  if (replayInFlight) {
    try {
      await replayInFlight;
    } catch {
      // replay() owns its own error surface; we just need to know it
      // finished, success or failure.
    }
  }
}

export function resumeReplays(): void {
  replaysPaused = false;
}

async function runReplay(): Promise<ReplayResult> {
  await hydrate();
  if (queue.length === 0) {
    return { succeeded: 0, failed: 0, remaining: 0 };
  }
  let succeeded = 0;
  let failed = 0;
  // Take a snapshot so a concurrent enqueue during replay doesn't
  // get processed in this pass — it'll wait for the next replay tick.
  const snapshot = [...queue];
  const survivors: QueueItem[] = [];
  // Set of action types that hit a HaltReplayError this pass. Only items
  // of those actions get parked-without-attempts; unrelated actions
  // continue processing normally so a memory-event 429 doesn't starve
  // queued add-garment saves behind it. Codex P2 round 6 on PR #734.
  const haltedActions = new Set<string>();
  let haltRetryAfterMs: number | undefined;
  for (const item of snapshot) {
    if (haltedActions.has(item.action)) {
      // Same action as a previously-halted item this tick — park
      // without counting attempts and let the deferred replay pick
      // it up after retry-after.
      survivors.push(item);
      continue;
    }
    const handler = handlers.get(item.action);
    if (!handler) {
      // Drop orphaned action types — see jsdoc above.
      continue;
    }
    try {
      await handler(item.payload);
      succeeded++;
    } catch (err) {
      if (err instanceof HaltReplayError) {
        survivors.push(item);
        haltedActions.add(item.action);
        // Capture the earliest retry-after across actions so the
        // scheduled replay aligns with the soonest recovery window.
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
        // Surface dropped retries via subscription so a UI hook can warn
        // the user. We don't crash or throw — the queue's job is to keep
        // the rest of the items moving.
        failed++;
        continue;
      }
      survivors.push({ ...item, attempts: nextAttempts });
      failed++;
    }
  }
  // Items enqueued mid-replay (after the snapshot) are appended after the
  // survivors so retries keep priority over newer items.
  const newcomers = queue.slice(snapshot.length);
  queue = [...survivors, ...newcomers];
  await persist();
  emitChange();
  if (haltedActions.size > 0) {
    scheduleDeferredReplay(haltRetryAfterMs);
  }
  return { succeeded, failed, remaining: queue.length };
}

/** Read-only snapshot of pending items. Returns a new array each call. */
export function snapshot(): QueueItem[] {
  return [...queue];
}

/** Pending-item count. Synchronous after hydration; 0 before hydrate finishes. */
export function pendingCount(): number {
  return queue.length;
}

// ─── deferred replay scheduler ────────────────────────────────────────
// When a live caller enqueues after a transient failure (5xx, 429), we
// want to retry without waiting for the next NetInfo transition or app
// restart. This single-flight-coalesced timer kicks a replay later
// (default 30s, or the server's retry-after when supplied via
// HaltReplayError), and gates the actual replay on connectivity so an
// offline tick doesn't burn the queue's MAX_ATTEMPTS budget.
// Codex P2 rounds 4 + 5 on PR #734.
const DEFERRED_REPLAY_MS = 30_000;
const MIN_DEFERRED_REPLAY_MS = 5_000;
const MAX_DEFERRED_REPLAY_MS = 5 * 60_000;
let deferredReplayTimer: ReturnType<typeof setTimeout> | null = null;
let deferredReplayDelayMs = 0;

export function scheduleDeferredReplay(retryAfterMs?: number): void {
  // Cap the delay so a server retry-after of "Wait an hour" doesn't park
  // the queue for an hour — the next NetInfo transition / app cold start
  // will pick it up sooner anyway. Floor matches a sane client-side
  // backoff that won't burn cache on a tight loop.
  const requestedDelay =
    retryAfterMs != null && retryAfterMs > 0 ? retryAfterMs : DEFERRED_REPLAY_MS;
  const delay = Math.max(
    MIN_DEFERRED_REPLAY_MS,
    Math.min(MAX_DEFERRED_REPLAY_MS, requestedDelay),
  );
  if (deferredReplayTimer) {
    // If a longer delay is already pending, leave it. If the new delay
    // would land sooner (a 429 with shorter retry-after lands while a
    // generic 30s timer is pending), reschedule.
    if (delay >= deferredReplayDelayMs) return;
    clearTimeout(deferredReplayTimer);
  }
  deferredReplayDelayMs = delay;
  deferredReplayTimer = setTimeout(() => {
    deferredReplayTimer = null;
    deferredReplayDelayMs = 0;
    void (async () => {
      // Codex P2 round 5: gate on connectivity so an offline tick
      // doesn't iterate the queue and increment attempts uselessly.
      // NetInfo transition listeners pick it up the moment we're back
      // online; the deferred timer is for the case where we're online
      // but the server / rate-limit gate hasn't recovered.
      try {
        const state = await NetInfo.fetch();
        if (state.isConnected === false || state.isInternetReachable === false) {
          return;
        }
      } catch {
        // NetInfo probe failure — fall through and let replay try; the
        // wrapper itself defaults the unknown-state to online.
      }
      void replay().catch(() => {
        // replay() owns its own error surface.
      });
    })();
  }, delay);
}

/**
 * Clear the queue. Used on sign-out so user A's pending mutations don't
 * replay against user B's session.
 */
export async function clearQueue(): Promise<void> {
  queue = [];
  await persist();
  emitChange();
}

/**
 * Drop every queued item whose action matches the given name. Used by
 * destructive flows whose server-side reset must NOT see a stale
 * pending write replay after the destructive op (e.g.
 * `useResetStyleMemory` clears `memory-event` items so a queued
 * save_outfit signal can't repopulate the just-cleared feedback_signals
 * table). Codex P2 round 6 on PR #735.
 */
export async function clearActionFromQueue(action: string): Promise<void> {
  await hydrate();
  const before = queue.length;
  queue = queue.filter((item) => item.action !== action);
  if (queue.length === before) return;
  await persist();
  emitChange();
}

/**
 * Subscribe to queue changes (count up / down). Returns an unsubscribe.
 * useOfflineQueue uses this to drive component re-renders.
 */
export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Internal: stable id generator. expo-crypto would pull a native dep; this
 * is good enough for offline-queue uniqueness (collision risk negligible at
 * MAX_QUEUE_SIZE=50). */
function cryptoRandomId(): string {
  const head = Math.random().toString(36).slice(2, 10);
  const tail = Date.now().toString(36);
  return `${head}-${tail}`;
}
