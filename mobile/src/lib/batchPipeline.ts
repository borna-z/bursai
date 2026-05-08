// Multi-photo Add-piece pipeline — coordinator for the batch flow that lands a
// staged photo grid (Step 1) into N analyzed-and-uploaded items the user can
// review one-by-one in Steps 2 → 3.
//
// Design:
//   • Step 1 starts a batch via `startBatch(uris, userId, source)` and gets a
//     batchId. The pipeline immediately spawns the first MAX_PARALLEL items'
//     resize → analyze + upload work in the background (parallel to the user
//     reviewing item 0 in Step 2/Step 3).
//   • Step 2 calls `awaitItem(batchId, index)` — for the user-facing first item
//     this awaits the in-flight pipeline; for subsequent items the work has
//     usually finished by the time the user has saved the previous one, so
//     this resolves immediately. Step 2's UX is identical to the single-photo
//     loading screen, just with a "Photo X of N" eyebrow.
//   • Step 3 calls `markItemSaved(batchId, index)` after a successful insert
//     and reads `nextPendingIndex(batchId)` to decide whether to bounce back
//     into Step 2 or wrap up.
//   • Per-item failure recovery — `markItemSkipped(batchId, index)` (user
//     clicks "Skip this photo" on a failed analyze) and `retryItem(batchId,
//     index)` (re-runs resize+analyze+upload) keep the batch advancing without
//     losing the other photos.
//
// Concurrency guard: MAX_PARALLEL = 2. Higher would overwhelm the
// analyze_garment 8/min rate limit on a quick batch of 5+ photos and stress
// the device's bandwidth + memory (each resize allocates a fresh JPEG buffer).
//
// Per-item state machine:
//   pending → in_flight (resize+upload+analyze running) →
//     ready (analyze + upload promise both resolved into props for Step 3) |
//     failed (analyze rejected — user chooses Skip or Retry) |
//     saved (Step 3 mutateAsync succeeded) |
//     skipped (user dismissed a failed item or hit Close mid-batch)
//
// Memory + cleanup:
//   • The map is module-scope. `dropBatch` clears every item; called by
//     Step 1 on a fresh start AND by the Step 3 unmount path on the final
//     save / cancel.
//   • Storage objects from items the user skipped or that were left behind
//     when the batch was dropped are best-effort deleted to avoid orphans.
//   • Hot-reload during dev resets the module — production batches stay in
//     memory until the user finishes or app is backgrounded long enough to
//     be evicted by RN, which is fine.

import type { AnalysisResult } from '../hooks/useAnalyzeGarment';
import type { AddGarmentSource } from '../lib/garmentSave';
import { resizeForGarment, uploadManipulatedImage, deleteUpload } from './imageUpload';

// Concurrency cap. analyze_garment is rate-limited at 8/min and a typical
// resize+upload of a 1200px JPEG runs ~1.5-3s — running 2 in parallel keeps
// the user's "items ready" pool ahead of their review pace without spiking.
// Bumped to 3 only when batch length ≤3 so a 3-photo batch finishes all of
// the analyze work concurrently.
const MAX_PARALLEL_DEFAULT = 2;

export type BatchItemStatus =
  | 'pending'
  | 'in_flight'
  | 'ready'
  | 'failed'
  | 'saved'
  | 'skipped';

export interface BatchItem {
  index: number;
  uri: string;
  status: BatchItemStatus;
  storagePath: string | null;
  analysis: AnalysisResult | null;
  errorMessage: string | null;
  // Internal — promise the consumer awaits via awaitItem(). Resolves to the
  // BatchItem snapshot when the analyze + upload pair has settled (success or
  // failure). Re-created on retry.
  _settled: Promise<BatchItem> | null;
}

interface Batch {
  id: string;
  userId: string;
  source: AddGarmentSource;
  items: BatchItem[];
  // Caller-supplied analyzer — kept inside the batch so the pipeline doesn't
  // import useAnalyzeGarment at module scope (it pulls supabase + auth which
  // bloats unrelated module graphs). The hook handle is captured per-batch
  // when Step 1 starts the batch. Accepts either base64 (fast path) or
  // storagePath (fallback when ImageManipulator omits base64).
  analyzeFn: (input: { base64: string } | { storagePath: string }) => Promise<AnalysisResult | null>;
  maxParallel: number;
  inFlightCount: number;
}

const batches = new Map<string, Batch>();

export function makeBatchId(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface StartBatchOptions {
  uris: string[];
  userId: string;
  source: AddGarmentSource;
  analyzeFn: (input: { base64: string } | { storagePath: string }) => Promise<AnalysisResult | null>;
}

/**
 * Spin up a batch. Returns a batchId synchronously; the pipeline kicks the
 * first MAX_PARALLEL items off in the background. Callers thread the batchId
 * through React Navigation and consume items via awaitItem().
 */
export function startBatch(opts: StartBatchOptions): string {
  const id = makeBatchId();
  const items: BatchItem[] = opts.uris.map((uri, index) => ({
    index,
    uri,
    status: 'pending',
    storagePath: null,
    analysis: null,
    errorMessage: null,
    _settled: null,
  }));
  // For very small batches we can afford a higher parallelism — a 3-photo
  // batch with MAX_PARALLEL=2 would serialise the third item behind the first
  // two for no reason. Cap at 3 so we never blow past analyze_garment's
  // 8/min ceiling on a single user action.
  const maxParallel = Math.min(MAX_PARALLEL_DEFAULT + (opts.uris.length <= 3 ? 1 : 0), 3);
  const batch: Batch = {
    id,
    userId: opts.userId,
    source: opts.source,
    items,
    analyzeFn: opts.analyzeFn,
    maxParallel,
    inFlightCount: 0,
  };
  batches.set(id, batch);
  pumpBatch(batch);
  return id;
}

/** Synchronous lookup. Returns `null` if the batch was dropped or the index is out of range. */
export function getItem(batchId: string, index: number): BatchItem | null {
  const batch = batches.get(batchId);
  if (!batch) return null;
  return batch.items[index] ?? null;
}

export function getBatchSize(batchId: string): number {
  const batch = batches.get(batchId);
  return batch ? batch.items.length : 0;
}

/**
 * Resolve once the item's analyze + upload pair has settled (success or
 * failure). On a `ready` item, returns immediately. On a `failed` item, also
 * resolves — caller inspects `status` / `errorMessage`. Returns `null` when
 * the batch was dropped or the index is invalid.
 */
export function awaitItem(batchId: string, index: number): Promise<BatchItem | null> {
  const batch = batches.get(batchId);
  if (!batch) return Promise.resolve(null);
  const item = batch.items[index];
  if (!item) return Promise.resolve(null);
  if (item.status === 'ready' || item.status === 'failed') return Promise.resolve(item);
  // If this item hasn't been started yet (the parallel cap was holding it
  // back), bump it to the head of the queue so the user isn't blocked.
  if (item.status === 'pending') pumpBatch(batch, /* prioritiseIndex */ index);
  // Re-check after pumping: pumpBatch may have set _settled.
  if (item._settled) return item._settled;
  // Still pending (parallel cap is full) — return a deferred that resolves
  // when this specific item moves out of pending. The polling-free way to do
  // this is to install a pendingResolver array on the item, but a tiny micro-
  // poll keeps the pipeline simpler with no observable UX cost (Step 2 already
  // shows a spinner while waiting).
  return waitForItem(batch, index);
}

function waitForItem(batch: Batch, index: number): Promise<BatchItem | null> {
  return new Promise((resolve) => {
    const tick = () => {
      const live = batches.get(batch.id);
      if (!live) {
        resolve(null);
        return;
      }
      const item = live.items[index];
      if (!item) {
        resolve(null);
        return;
      }
      if (item._settled) {
        item._settled.then(resolve);
        return;
      }
      if (item.status === 'ready' || item.status === 'failed') {
        resolve(item);
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

/** Mark an item as saved — Step 3 calls this after mutateAsync succeeds. */
export function markItemSaved(batchId: string, index: number): void {
  const batch = batches.get(batchId);
  if (!batch) return;
  const item = batch.items[index];
  if (!item) return;
  item.status = 'saved';
  // Item's storage object now belongs to a saved garment row — never delete it
  // on cleanup. The status flip is the signal.
  pumpBatch(batch);
}

/**
 * User Skipped a failed item (or chose to discard a successfully-analyzed one
 * from the review screen). Best-effort delete the storage object so it doesn't
 * orphan, then advance the queue.
 */
export function markItemSkipped(batchId: string, index: number): void {
  const batch = batches.get(batchId);
  if (!batch) return;
  const item = batch.items[index];
  if (!item) return;
  if (item.status === 'saved' || item.status === 'skipped') return;
  if (item.storagePath) void deleteUpload(item.storagePath);
  item.status = 'skipped';
  item.storagePath = null;
  pumpBatch(batch);
}

/**
 * Retry a failed item. Resets state to `pending` and re-spawns the work.
 * Returns true when the retry was scheduled. The caller should re-await via
 * awaitItem(batchId, index).
 */
export function retryItem(batchId: string, index: number): boolean {
  const batch = batches.get(batchId);
  if (!batch) return false;
  const item = batch.items[index];
  if (!item) return false;
  if (item.status !== 'failed') return false;
  item.status = 'pending';
  item.errorMessage = null;
  item._settled = null;
  // Best-effort cleanup if a previous attempt's upload landed before analyze
  // failed — avoids orphan accumulation across multiple retries.
  if (item.storagePath) {
    void deleteUpload(item.storagePath);
    item.storagePath = null;
  }
  pumpBatch(batch, index);
  return true;
}

/**
 * Find the next index the user should land on after saving / skipping the
 * current one. Returns -1 when every item has reached a terminal state
 * (saved / skipped) — the caller should bounce out of the AddPiece flow.
 */
export function nextPendingIndex(batchId: string, fromIndex: number): number {
  const batch = batches.get(batchId);
  if (!batch) return -1;
  for (let i = fromIndex + 1; i < batch.items.length; i++) {
    const status = batch.items[i].status;
    if (status !== 'saved' && status !== 'skipped') return i;
  }
  return -1;
}

/**
 * Tear down a batch — clears the entry from the map and best-effort deletes
 * any storage objects from items the user never saved (analyzed-but-unsaved
 * items leave a JPEG in the bucket otherwise). Idempotent.
 */
export function dropBatch(batchId: string): void {
  const batch = batches.get(batchId);
  if (!batch) return;
  batches.delete(batchId);
  for (const item of batch.items) {
    if (item.status !== 'saved' && item.storagePath) {
      void deleteUpload(item.storagePath);
    }
  }
}

// ─── internal: scheduler ─────────────────────────────────────────────────────

/**
 * Drive the batch forward. Idempotent — safe to call repeatedly. When
 * `prioritiseIndex` is provided, that item is started ahead of others if it's
 * still pending and there's headroom under maxParallel.
 */
function pumpBatch(batch: Batch, prioritiseIndex?: number): void {
  // Prioritised start: if the user is staring at a still-pending item, get
  // it moving even when other items came first in queue order.
  if (typeof prioritiseIndex === 'number') {
    const target = batch.items[prioritiseIndex];
    if (target && target.status === 'pending' && batch.inFlightCount < batch.maxParallel) {
      runItem(batch, target);
    }
  }
  // Backfill remaining slots in queue order.
  for (const item of batch.items) {
    if (batch.inFlightCount >= batch.maxParallel) break;
    if (item.status === 'pending') runItem(batch, item);
  }
}

function runItem(batch: Batch, item: BatchItem): void {
  item.status = 'in_flight';
  batch.inFlightCount += 1;
  const work = (async (): Promise<BatchItem> => {
    try {
      // Single resize, base64 + bytes both consumed downstream.
      const resized = await resizeForGarment(item.uri, { wantBase64: true });

      // Upload + analyze in parallel.
      const uploadP = uploadManipulatedImage(resized, batch.userId).then((res) => {
        // Stash storagePath as soon as it lands so cleanup paths can find it.
        item.storagePath = res.storagePath;
        return res;
      });
      // Defensive .catch — if analyze rejects first and we exit before
      // re-awaiting uploadP, the upload's eventual rejection (if any) would
      // surface as an unhandled-promise-rejection. The catch swallows it;
      // any successful upload still resolves and the .then above stamps
      // storagePath. The catch attaches a no-op handler — the original
      // promise we re-await below still rejects/resolves identically.
      uploadP.catch(() => {});

      const base64 = resized.base64
        ? `data:image/jpeg;base64,${resized.base64}`
        : null;

      let analysis: AnalysisResult | null = null;
      if (base64) {
        // Fast path — analyze runs in parallel with upload via the base64
        // payload from the single-pass resize. Typical p50 is ~2-3s here.
        analysis = await batch.analyzeFn({ base64 });
      } else {
        // Fallback — ImageManipulator omitted the base64 string (rare; usually
        // a transient native module hiccup). Wait for upload to land, then
        // analyze via storagePath. Costs ~1-2s extra but keeps the item from
        // failing the whole batch.
        const upRes = await uploadP;
        analysis = await batch.analyzeFn({ storagePath: upRes.storagePath });
      }

      // Ensure upload also landed before marking ready — Step 3's Save needs
      // the path. On the fast path this typically resolves before analyze.
      const upRes = await uploadP;
      item.storagePath = upRes.storagePath;

      if (!analysis) {
        throw new Error('Could not analyze photo');
      }
      item.analysis = analysis;
      // If the item was skipped/dropped while in-flight, the storage object
      // is now orphaned — clean it up rather than transitioning to ready.
      if (
        item.status !== 'in_flight' ||
        !batches.has(batch.id)
      ) {
        if (item.storagePath) void deleteUpload(item.storagePath);
        item.storagePath = null;
        return item;
      }
      item.status = 'ready';
      return item;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pipeline failed';
      // Storage object may have landed before analyze rejected — keep it
      // on the item so retry can clean it up in one shot.
      if (item.status === 'in_flight') {
        item.status = 'failed';
        item.errorMessage = msg;
      }
      return item;
    } finally {
      batch.inFlightCount = Math.max(0, batch.inFlightCount - 1);
      // Pump again — completing one slot frees the next.
      if (batches.has(batch.id)) pumpBatch(batch);
    }
  })();
  item._settled = work;
}
