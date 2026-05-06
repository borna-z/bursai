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
  for (const item of snapshot) {
    const handler = handlers.get(item.action);
    if (!handler) {
      // Drop orphaned action types — see jsdoc above.
      continue;
    }
    try {
      await handler(item.payload);
      succeeded++;
    } catch {
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
// restart. This single-flight-coalesced timer kicks a replay ~30s later,
// matching typical 5xx outage / 429 rate-limit-window durations.
// Codex P2 round 4 on PR #734.
const DEFERRED_REPLAY_MS = 30_000;
let deferredReplayTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDeferredReplay(): void {
  if (deferredReplayTimer) return; // already pending
  deferredReplayTimer = setTimeout(() => {
    deferredReplayTimer = null;
    void replay().catch(() => {
      // replay() owns its own error surface — caller's responsibility
      // to log if needed.
    });
  }, DEFERRED_REPLAY_MS);
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
