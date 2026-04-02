/**
 * Offline mutation queue V3.
 * Uses IndexedDB when available so uploads are stored as binary data instead of base64 in localStorage.
 * Falls back to localStorage in environments without IndexedDB support (for example, jsdom tests).
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface QueuedMutation {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'delete' | 'upsert';
  payload: Record<string, unknown>;
  match?: Record<string, unknown>;
  createdAt: number;
}

export interface QueuedUpload {
  id: string;
  bucket: string;
  path: string;
  blob: Blob;
  contentType: string;
  createdAt: number;
}

type LegacyQueuedUpload = {
  id: string;
  bucket: string;
  path: string;
  base64: string;
  contentType: string;
  createdAt: number;
};

type QueuedUploadInput =
  | Omit<QueuedUpload, 'id' | 'createdAt'>
  | Omit<LegacyQueuedUpload, 'id' | 'createdAt'>;

interface LegacyOfflineQueue {
  mutations: QueuedMutation[];
  uploads: LegacyQueuedUpload[];
}

interface QueueSummary {
  mutations: number;
  uploads: number;
}

const LEGACY_STORAGE_KEY = 'burs_offline_queue';
const SUMMARY_STORAGE_KEY = 'burs_offline_queue_summary';
const MIGRATION_STORAGE_KEY = 'burs_offline_queue_migrated_v3';
const DB_NAME = 'burs-offline-queue';
const DB_VERSION = 1;
const MUTATIONS_STORE = 'mutations';
const UPLOADS_STORE = 'uploads';
const MAX_QUEUE_SIZE = 50;

let migrationPromise: Promise<void> | null = null;

function hasIndexedDbSupport() {
  return typeof indexedDB !== 'undefined';
}

function readSummary(): QueueSummary {
  try {
    const raw = JSON.parse(localStorage.getItem(SUMMARY_STORAGE_KEY) || '{}');
    return {
      mutations: typeof raw.mutations === 'number' ? raw.mutations : 0,
      uploads: typeof raw.uploads === 'number' ? raw.uploads : 0,
    };
  } catch {
    return { mutations: 0, uploads: 0 };
  }
}

function writeSummary(summary: QueueSummary) {
  localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(summary));
}

function emitChange(summary: QueueSummary = readSummary()) {
  window.dispatchEvent(new CustomEvent('offline-queue-change', {
    detail: {
      count: summary.mutations + summary.uploads,
      uploads: summary.uploads,
      mutations: summary.mutations,
    },
  }));
}

function loadLegacyQueue(): LegacyOfflineQueue {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '{}');
    return {
      mutations: Array.isArray(raw.mutations) ? raw.mutations : (Array.isArray(raw) ? raw : []),
      uploads: Array.isArray(raw.uploads) ? raw.uploads : [],
    };
  } catch {
    return { mutations: [], uploads: [] };
  }
}

function saveLegacyQueue(queue: LegacyOfflineQueue) {
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(queue));
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to convert blob to base64'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

async function normalizeUploadInput(upload: QueuedUploadInput): Promise<Omit<QueuedUpload, 'id' | 'createdAt'>> {
  if ('blob' in upload) {
    return upload;
  }

  return {
    bucket: upload.bucket,
    path: upload.path,
    blob: base64ToBlob(upload.base64, upload.contentType),
    contentType: upload.contentType,
  };
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MUTATIONS_STORE)) {
        db.createObjectStore(MUTATIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(UPLOADS_STORE)) {
        db.createObjectStore(UPLOADS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open offline queue database'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    Promise.resolve(callback(store)).then(resolve).catch(reject);

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error(`IndexedDB transaction failed for ${storeName}`));
      db.close();
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error(`IndexedDB transaction aborted for ${storeName}`));
      db.close();
    };
  });
}

async function getAllMutationsIndexedDb(): Promise<QueuedMutation[]> {
  return withStore(MUTATIONS_STORE, 'readonly', (store) => requestToPromise(store.getAll() as IDBRequest<QueuedMutation[]>));
}

async function getAllUploadsIndexedDb(): Promise<QueuedUpload[]> {
  return withStore(UPLOADS_STORE, 'readonly', (store) => requestToPromise(store.getAll() as IDBRequest<QueuedUpload[]>));
}

async function deleteQueuedMutationIndexedDb(id: string): Promise<void> {
  await withStore<void>(MUTATIONS_STORE, 'readwrite', (store) => {
    store.delete(id);
  });
}

async function deleteQueuedUploadIndexedDb(id: string): Promise<void> {
  await withStore<void>(UPLOADS_STORE, 'readwrite', (store) => {
    store.delete(id);
  });
}

async function putMutationIndexedDb(mutation: QueuedMutation): Promise<void> {
  await withStore<void>(MUTATIONS_STORE, 'readwrite', (store) => {
    store.put(mutation);
  });
}

async function putUploadIndexedDb(upload: QueuedUpload): Promise<void> {
  await withStore<void>(UPLOADS_STORE, 'readwrite', (store) => {
    store.put(upload);
  });
}

async function clearStoreIndexedDb(storeName: string): Promise<void> {
  await withStore<void>(storeName, 'readwrite', (store) => {
    store.clear();
  });
}

async function refreshSummary() {
  let summary: QueueSummary;

  if (hasIndexedDbSupport()) {
    const [mutations, uploads] = await Promise.all([
      getAllMutationsIndexedDb(),
      getAllUploadsIndexedDb(),
    ]);
    summary = { mutations: mutations.length, uploads: uploads.length };
  } else {
    const legacy = loadLegacyQueue();
    summary = { mutations: legacy.mutations.length, uploads: legacy.uploads.length };
  }

  writeSummary(summary);
  emitChange(summary);
  return summary;
}

async function migrateLegacyQueueToIndexedDb() {
  if (!hasIndexedDbSupport()) {
    await refreshSummary();
    return;
  }

  if (localStorage.getItem(MIGRATION_STORAGE_KEY) === 'done') {
    await refreshSummary();
    return;
  }

  const legacy = loadLegacyQueue();
  if (legacy.mutations.length === 0 && legacy.uploads.length === 0) {
    localStorage.setItem(MIGRATION_STORAGE_KEY, 'done');
    await refreshSummary();
    return;
  }

  await Promise.all([
    ...legacy.mutations.map((mutation) => putMutationIndexedDb(mutation)),
    ...legacy.uploads.map((upload) => putUploadIndexedDb({
      id: upload.id,
      bucket: upload.bucket,
      path: upload.path,
      blob: base64ToBlob(upload.base64, upload.contentType),
      contentType: upload.contentType,
      createdAt: upload.createdAt,
    })),
  ]);

  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.setItem(MIGRATION_STORAGE_KEY, 'done');
  await refreshSummary();
}

async function ensureMigrated() {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyQueueToIndexedDb().finally(() => {
      migrationPromise = null;
    });
  }

  await migrationPromise;
}

async function getAllMutations(): Promise<QueuedMutation[]> {
  await ensureMigrated();
  if (hasIndexedDbSupport()) {
    return getAllMutationsIndexedDb();
  }
  return loadLegacyQueue().mutations;
}

async function getAllUploads(): Promise<QueuedUpload[]> {
  await ensureMigrated();
  if (hasIndexedDbSupport()) {
    return getAllUploadsIndexedDb();
  }

  return loadLegacyQueue().uploads.map((upload) => ({
    id: upload.id,
    bucket: upload.bucket,
    path: upload.path,
    blob: base64ToBlob(upload.base64, upload.contentType),
    contentType: upload.contentType,
    createdAt: upload.createdAt,
  }));
}

export function getQueueLength(): number {
  const summary = readSummary();
  return summary.mutations + summary.uploads;
}

export function getUploadCount(): number {
  return readSummary().uploads;
}

export async function hydrateQueueSummary(): Promise<number> {
  const summary = await refreshSummary();
  return summary.mutations + summary.uploads;
}

export async function enqueue(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>) {
  await ensureMigrated();

  const nextMutation: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  if (hasIndexedDbSupport()) {
    const existing = await getAllMutationsIndexedDb();
    const sorted = [...existing].sort((a, b) => a.createdAt - b.createdAt);
    if (sorted.length >= MAX_QUEUE_SIZE) {
      logger.warn(`[offline-queue] Queue is large (${sorted.length} mutations). Dropping oldest.`);
      const toDrop = sorted.slice(0, sorted.length - MAX_QUEUE_SIZE + 1);
      await Promise.all(toDrop.map((entry) => deleteQueuedMutationIndexedDb(entry.id)));
    }
    await putMutationIndexedDb(nextMutation);
  } else {
    const queue = loadLegacyQueue();
    if (queue.mutations.length >= MAX_QUEUE_SIZE) {
      logger.warn(`[offline-queue] Queue is large (${queue.mutations.length} mutations). Dropping oldest.`);
      queue.mutations = queue.mutations.slice(-MAX_QUEUE_SIZE + 1);
    }
    queue.mutations.push(nextMutation);
    saveLegacyQueue(queue);
  }

  await refreshSummary();
}

export async function enqueueUpload(upload: QueuedUploadInput) {
  await ensureMigrated();
  const normalizedUpload = await normalizeUploadInput(upload);

  const nextUpload: QueuedUpload = {
    ...normalizedUpload,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  if (hasIndexedDbSupport()) {
    await putUploadIndexedDb(nextUpload);
  } else {
    const queue = loadLegacyQueue();
    const base64 = await blobToBase64(nextUpload.blob);
    queue.uploads.push({
      id: nextUpload.id,
      bucket: nextUpload.bucket,
      path: nextUpload.path,
      base64,
      contentType: nextUpload.contentType,
      createdAt: nextUpload.createdAt,
    });
    saveLegacyQueue(queue);
  }

  await refreshSummary();
}

export async function replayQueue(
  onProgress?: (completed: number, total: number) => void
): Promise<number> {
  const [mutations, uploads] = await Promise.all([getAllMutations(), getAllUploads()]);
  const total = mutations.length + uploads.length;
  if (total === 0) return 0;

  let success = 0;
  let completed = 0;

  for (const upload of uploads) {
    try {
      const { error } = await supabase.storage
        .from(upload.bucket)
        .upload(upload.path, upload.blob, {
          contentType: upload.contentType,
          upsert: true,
        });

      if (error) {
        logger.warn('[offline-queue] Upload replay failed:', error.message);
      } else {
        success += 1;
        if (hasIndexedDbSupport()) {
          await deleteQueuedUploadIndexedDb(upload.id);
        } else {
          const queue = loadLegacyQueue();
          queue.uploads = queue.uploads.filter((entry) => entry.id !== upload.id);
          saveLegacyQueue(queue);
        }
      }
    } catch (err) {
      logger.warn('[offline-queue] Upload error:', err);
    }

    completed += 1;
    onProgress?.(completed, total);
  }

  for (const mutation of mutations) {
    try {
      let result: { error: { message: string } | null } = { error: null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table names from offline queue are inherently untyped
      const table = supabase.from(mutation.table as any);

      if (mutation.type === 'insert') {
        result = await table.insert(mutation.payload);
      } else if (mutation.type === 'update' && mutation.match) {
        result = await table.update(mutation.payload).match(mutation.match);
      } else if (mutation.type === 'upsert') {
        result = await table.upsert(mutation.payload);
      } else if (mutation.type === 'delete' && mutation.match) {
        result = await table.delete().match(mutation.match);
      }

      if (result.error) {
        logger.warn('[offline-queue] Replay failed:', result.error.message);
      } else {
        success += 1;
        if (hasIndexedDbSupport()) {
          await deleteQueuedMutationIndexedDb(mutation.id);
        } else {
          const queue = loadLegacyQueue();
          queue.mutations = queue.mutations.filter((entry) => entry.id !== mutation.id);
          saveLegacyQueue(queue);
        }
      }
    } catch (err) {
      logger.warn('[offline-queue] Replay error:', err);
    }

    completed += 1;
    onProgress?.(completed, total);
  }

  await refreshSummary();
  return success;
}

export async function clearQueue() {
  await ensureMigrated();

  if (hasIndexedDbSupport()) {
    await Promise.all([
      clearStoreIndexedDb(MUTATIONS_STORE),
      clearStoreIndexedDb(UPLOADS_STORE),
    ]);
  }

  localStorage.removeItem(LEGACY_STORAGE_KEY);
  writeSummary({ mutations: 0, uploads: 0 });
  emitChange({ mutations: 0, uploads: 0 });
}
