/**
 * Wave 8.5 PR B — localStorage-backed offline queue for memory_ingest
 * hard failures.
 *
 * When `useRecordMemoryEvent` exhausts its retry budget (network down,
 * persistent 5xx, etc.), the input gets enqueued here. AuthContext drains
 * the queue on next SIGNED_IN so signals don't get lost across sessions.
 *
 * Design choice — localStorage over IndexedDB:
 *
 *   - synchronous API → simpler than IDB's transaction-then-callback dance
 *   - works in jsdom for unit tests with zero new dev dependencies
 *     (the alternative `fake-indexeddb` would have required a new package
 *     install — CLAUDE.md hard rule forbids that without user approval)
 *   - 5MB per-origin cap → MAX_QUEUE_SIZE × ~500 bytes = ~50KB; well under
 *   - persists across page reload / app restart / Median.co WebView restart
 *   - cleared correctly on origin storage clear
 *
 * Capped at MAX_QUEUE_SIZE entries (oldest dropped on overflow) — bounded
 * footprint regardless of how long the user is offline.
 *
 * Queue entries are scoped by userId — drain skips entries belonging to
 * a different user (multi-user device case). The localStorage key is
 * a single JSON array; we trade O(N) per-write for O(N) overall (N is
 * bounded at MAX_QUEUE_SIZE so this is fine).
 */

import { logger } from "@/lib/logger";
import type { RecordMemoryEventInput } from "./memoryEvents";

const STORAGE_KEY = "burs_memory_event_queue_v1";
export const MAX_QUEUE_SIZE = 100;

interface QueueEntry {
  /** Auto-incremented per write — used as the de-dup discriminator across reads. */
  id: number;
  userId: string;
  input: RecordMemoryEventInput;
  enqueuedAt: number;
}

interface QueueState {
  /** Monotonic id counter, persisted so ids stay unique across sessions. */
  nextId: number;
  entries: QueueEntry[];
}

function readState(): QueueState {
  if (typeof localStorage === "undefined") {
    return { nextId: 1, entries: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nextId: 1, entries: [] };
    const parsed = JSON.parse(raw) as Partial<QueueState> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.nextId !== "number" ||
      !Array.isArray(parsed.entries)
    ) {
      return { nextId: 1, entries: [] };
    }
    return { nextId: parsed.nextId, entries: parsed.entries as QueueEntry[] };
  } catch (err) {
    logger.warn("memoryEventQueue: corrupted state, resetting", err);
    return { nextId: 1, entries: [] };
  }
}

function writeState(state: QueueState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // QuotaExceededError or storage disabled. Drop silently — the user is
    // not blocked; we're already on the offline-fallback path.
    logger.warn("memoryEventQueue: localStorage write failed", err);
  }
}

export async function enqueueMemoryEvent(
  userId: string,
  input: RecordMemoryEventInput,
): Promise<void> {
  const state = readState();
  const entry: QueueEntry = {
    id: state.nextId,
    userId,
    input,
    enqueuedAt: Date.now(),
  };
  state.nextId += 1;
  state.entries.push(entry);
  // Cap-and-evict (FIFO): oldest first when over the limit.
  if (state.entries.length > MAX_QUEUE_SIZE) {
    state.entries.splice(0, state.entries.length - MAX_QUEUE_SIZE);
  }
  writeState(state);
}

/**
 * Drain entries belonging to `userId` through the supplied drainer. On
 * drainer success the entry is removed; on drainer rejection the entry
 * stays queued for the next drain attempt.
 *
 * Other users' entries are left untouched (multi-user device case).
 */
export async function drainMemoryEventQueue(
  userId: string,
  drainer: (
    userId: string,
    input: RecordMemoryEventInput,
  ) => Promise<void>,
): Promise<void> {
  const state = readState();
  const surviving: QueueEntry[] = [];
  let mutated = false;

  for (const entry of state.entries) {
    if (entry.userId !== userId) {
      surviving.push(entry);
      continue;
    }
    try {
      await drainer(entry.userId, entry.input);
      mutated = true;
      // Drained successfully — drop from queue.
    } catch (err) {
      // Drainer failed — keep the entry for next drain.
      logger.warn("memoryEventQueue: drain entry failed", { id: entry.id, err });
      surviving.push(entry);
    }
  }

  if (mutated) {
    writeState({ nextId: state.nextId, entries: surviving });
  }
}

export async function peekQueueLength(): Promise<number> {
  return readState().entries.length;
}

export async function clearQueue(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    logger.warn("memoryEventQueue: clear failed", err);
  }
}
