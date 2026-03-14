/**
 * Offline mutation queue V2.
 * Handles standard mutations + image uploads stored as base64.
 * Step 19: Offline Mutation Queue V2
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

export interface QueuedUpload {
  id: string;
  bucket: string;
  path: string;
  /** Base64-encoded file data */
  base64: string;
  contentType: string;
  createdAt: number;
}

interface OfflineQueue {
  mutations: QueuedMutation[];
  uploads: QueuedUpload[];
}

const STORAGE_KEY = 'burs_offline_queue';

function load(): OfflineQueue {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      mutations: Array.isArray(raw.mutations) ? raw.mutations : (Array.isArray(raw) ? raw : []),
      uploads: Array.isArray(raw.uploads) ? raw.uploads : [],
    };
  } catch {
    return { mutations: [], uploads: [] };
  }
}

function save(queue: OfflineQueue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

function emitChange(queue: OfflineQueue) {
  const count = queue.mutations.length + queue.uploads.length;
  window.dispatchEvent(new CustomEvent('offline-queue-change', { detail: { count, uploads: queue.uploads.length } }));
}

/** Add a mutation to the offline queue */
export function enqueue(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>) {
  const queue = load();
  queue.mutations.push({
    ...mutation,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
  save(queue);
  emitChange(queue);
}

/** Add an image upload to the offline queue */
export function enqueueUpload(upload: Omit<QueuedUpload, 'id' | 'createdAt'>) {
  const queue = load();
  queue.uploads.push({
    ...upload,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
  save(queue);
  emitChange(queue);
}

/** Get current queue counts */
export function getQueueLength(): number {
  const q = load();
  return q.mutations.length + q.uploads.length;
}

export function getUploadCount(): number {
  return load().uploads.length;
}

/** Convert base64 to Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Replay all queued mutations and uploads */
export async function replayQueue(
  onProgress?: (completed: number, total: number) => void
): Promise<number> {
  const queue = load();
  const total = queue.mutations.length + queue.uploads.length;
  if (total === 0) return 0;

  let success = 0;
  let completed = 0;
  const failedMutations: QueuedMutation[] = [];
  const failedUploads: QueuedUpload[] = [];

  // Replay uploads first
  for (const upload of queue.uploads) {
    try {
      const bytes = base64ToUint8Array(upload.base64);
      const { error } = await supabase.storage
        .from(upload.bucket)
        .upload(upload.path, bytes, { contentType: upload.contentType, upsert: true });

      if (error) {
        console.warn('[offline-queue] Upload replay failed:', error.message);
        failedUploads.push(upload);
      } else {
        success++;
      }
    } catch (err) {
      console.warn('[offline-queue] Upload error:', err);
      failedUploads.push(upload);
    }
    completed++;
    onProgress?.(completed, total);
  }

  // Replay mutations
  for (const mutation of queue.mutations) {
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
        console.warn('[offline-queue] Replay failed:', result.error.message);
        failedMutations.push(mutation);
      } else {
        success++;
      }
    } catch (err) {
      console.warn('[offline-queue] Replay error:', err);
      failedMutations.push(mutation);
    }
    completed++;
    onProgress?.(completed, total);
  }

  save({ mutations: failedMutations, uploads: failedUploads });
  emitChange({ mutations: failedMutations, uploads: failedUploads });
  return success;
}

/** Clear the queue (e.g. on logout) */
export function clearQueue() {
  save({ mutations: [], uploads: [] });
  emitChange({ mutations: [], uploads: [] });
}
