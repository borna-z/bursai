import AsyncStorage from '@react-native-async-storage/async-storage';

import { Sentry } from '../sentry';
import { emitChange } from './subscriber';

const STORAGE_KEY = 'burs.offline-queue.v1';

const MAX_QUEUE_SIZE = 200;
const MAX_QUEUE_BYTES = 5 * 1024 * 1024;

export interface QueueItem<P = unknown> {
  id: string;
  action: string;
  payload: P;
  attempts: number;
  createdAt: number;
}

let queue: QueueItem[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // AsyncStorage write can fail on full disk / OS pressure.
  }
}

export async function hydrate(): Promise<void> {
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
      queue = [];
    } finally {
      hydrated = true;
      hydrating = null;
      emitChange();
    }
  })();
  return hydrating;
}

void hydrate();

function cryptoRandomId(): string {
  const head = Math.random().toString(36).slice(2, 10);
  const tail = Date.now().toString(36);
  return `${head}-${tail}`;
}

export async function enqueue<P>(action: string, payload: P): Promise<QueueItem<P>> {
  await hydrate();
  let cappedReason: 'count' | 'bytes' | null = null;
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue = queue.slice(-(MAX_QUEUE_SIZE - 1));
    cappedReason = 'count';
  }
  const item: QueueItem<P> = {
    id: cryptoRandomId(),
    action,
    payload,
    attempts: 0,
    createdAt: Date.now(),
  };
  queue.push(item as unknown as QueueItem);
  let serialised = JSON.stringify(queue);
  while (serialised.length > MAX_QUEUE_BYTES && queue.length > 1) {
    queue.shift();
    cappedReason = cappedReason ?? 'bytes';
    serialised = JSON.stringify(queue);
  }
  if (cappedReason) {
    Sentry.addBreadcrumb({
      category: 'offline_queue',
      level: 'warning',
      message: 'queue_capped',
      data: {
        reason: cappedReason,
        size: queue.length,
        bytes: serialised.length,
      },
    });
  }
  await persist();
  emitChange();
  return item;
}

export function snapshot(): QueueItem[] {
  return [...queue];
}

export function pendingCount(): number {
  return queue.length;
}

export async function commitQueueAfterReplay(
  survivors: QueueItem[],
  snapshotLength: number,
): Promise<void> {
  const newcomers = queue.slice(snapshotLength);
  queue = [...survivors, ...newcomers];
  await persist();
  emitChange();
}

export async function clearQueue(): Promise<void> {
  queue = [];
  await persist();
  emitChange();
}

export async function clearActionFromQueue(action: string): Promise<void> {
  await hydrate();
  const before = queue.length;
  queue = queue.filter((item) => item.action !== action);
  if (queue.length === before) return;
  await persist();
  emitChange();
}
