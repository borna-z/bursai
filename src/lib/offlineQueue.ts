/**
 * Offline mutation queue.
 * Stores pending mutations in localStorage and replays them when back online.
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface QueuedMutation {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'delete' | 'upsert';
  payload: Record<string, unknown>;
  /** For update/delete — the match filter */
  match?: Record<string, unknown>;
  createdAt: number;
}

const STORAGE_KEY = 'burs_offline_queue';

function load(): QueuedMutation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function save(queue: QueuedMutation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

/** Add a mutation to the offline queue */
export function enqueue(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>) {
  const queue = load();
  queue.push({
    ...mutation,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
  save(queue);
  window.dispatchEvent(new CustomEvent('offline-queue-change', { detail: { count: queue.length } }));
}

/** Get current queue length */
export function getQueueLength(): number {
  return load().length;
}

/** Replay all queued mutations; returns count of successful replays */
export async function replayQueue(): Promise<number> {
  const queue = load();
  if (queue.length === 0) return 0;

  let success = 0;
  const failed: QueuedMutation[] = [];

  for (const mutation of queue) {
    try {
      let result: { error: { message: string } | null } = { error: null };
      if (mutation.type === 'insert') {
        result = await supabase.from(mutation.table as any).insert(mutation.payload as any);
      } else if (mutation.type === 'update' && mutation.match) {
        result = await supabase.from(mutation.table as any).update(mutation.payload as any).match(mutation.match as any);
      } else if (mutation.type === 'upsert') {
        result = await supabase.from(mutation.table as any).upsert(mutation.payload as any);
      } else if (mutation.type === 'delete' && mutation.match) {
        result = await supabase.from(mutation.table as any).delete().match(mutation.match as any);
      }

      if (result.error) {
          console.warn('[offline-queue] Replay failed:', error.message);
          failed.push(mutation);
        } else {
          success++;
        }
      }
    } catch (err) {
      console.warn('[offline-queue] Replay error:', err);
      failed.push(mutation);
    }
  }

  save(failed);
  window.dispatchEvent(new CustomEvent('offline-queue-change', { detail: { count: failed.length } }));
  return success;
}

/** Clear the queue (e.g. on logout) */
export function clearQueue() {
  save([]);
  window.dispatchEvent(new CustomEvent('offline-queue-change', { detail: { count: 0 } }));
}
