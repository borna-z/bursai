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

// Concurrency cap. A typical resize+upload of a 1200px JPEG runs ~1.5-3s —
// running 2 in parallel keeps the user's "items ready" pool ahead of their
// review pace without spiking. Bumped to 3 only when batch length ≤3 so a
// 3-photo batch finishes all of the analyze work concurrently. The bigger
// constraint is per-minute throughput, enforced by the rate-window logic
// below — concurrency alone wouldn't stop a 50-photo batch from blowing
// past the backend's per-user limit.
const MAX_PARALLEL_DEFAULT = 2;

// Per-user analyze rate limit on the server. Mirrors the cap in
// `supabase/functions/_shared/scale-guard.ts`. With MAX_PARALLEL_DEFAULT=2
// and analyze times of 1.5-3 s/photo, sustained throughput would be
// ~40-80 calls/min — well above this cap, so a 50-photo batch reliably
// drives later items into 429s without pacing. Track analyze starts in
// a sliding window and gate `pumpBatch` against it so we hand the
// scheduler a soft throttle that matches the server's hard one.
// (Codex P1 round 2 on PR #777.)
const ANALYZE_RATE_LIMIT = 30;
const ANALYZE_RATE_WINDOW_MS = 60 * 1000;
// Module-scope sliding window. The backend cap is per-user and only one
// authenticated user is signed in on the device at a time, so a single
// shared window is the correct grain — multiple concurrent batches (rare
// but possible if a user retries a failed batch while another is still
// draining) share the same per-minute budget the server enforces.
const analyzeStartTimestamps: number[] = [];

function pruneAnalyzeWindow(): void {
  const cutoff = Date.now() - ANALYZE_RATE_WINDOW_MS;
  while (
    analyzeStartTimestamps.length > 0 &&
    (analyzeStartTimestamps[0] ?? Infinity) < cutoff
  ) {
    analyzeStartTimestamps.shift();
  }
}

/** ms until the next analyze slot opens, or 0 if a slot is available now. */
function nextAnalyzeSlotMs(): number {
  pruneAnalyzeWindow();
  if (analyzeStartTimestamps.length < ANALYZE_RATE_LIMIT) return 0;
  const oldest = analyzeStartTimestamps[0] ?? Date.now();
  // Pad 50 ms past the expiry to dodge the race where setTimeout fires at
  // the exact ms the entry would expire and prune still considers it live.
  return Math.max(0, oldest + ANALYZE_RATE_WINDOW_MS - Date.now() + 50);
}

function recordAnalyzeStart(): void {
  pruneAnalyzeWindow();
  analyzeStartTimestamps.push(Date.now());
}

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
  // Pending pumpBatch retry scheduled by the rate-window throttle.
  // `null` when no retry is armed. Cleared on `dropBatch` so a teardown
  // doesn't leave a wakeup that fires `pumpBatch` on a missing batch.
  rateLimitTimerId: ReturnType<typeof setTimeout> | null;
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
    rateLimitTimerId: null,
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
  if (batch.rateLimitTimerId !== null) {
    clearTimeout(batch.rateLimitTimerId);
    batch.rateLimitTimerId = null;
  }
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
 * still pending and there's headroom under maxParallel. Gates each start on
 * the per-user analyze rate window — when the limit would be breached,
 * arms a single setTimeout to re-enter `pumpBatch` once a slot frees.
 */
function pumpBatch(batch: Batch, prioritiseIndex?: number): void {
  if (!batches.has(batch.id)) return;

  const tryStart = (item: BatchItem): boolean => {
    if (item.status !== 'pending') return false;
    if (batch.inFlightCount >= batch.maxParallel) return false;
    const wait = nextAnalyzeSlotMs();
    if (wait > 0) {
      scheduleRateLimitRetry(batch, wait);
      return false;
    }
    runItem(batch, item);
    return true;
  };

  // Prioritised start: if the user is staring at a still-pending item, get
  // it moving even when other items came first in queue order.
  if (typeof prioritiseIndex === 'number') {
    const target = batch.items[prioritiseIndex];
    if (target) tryStart(target);
  }
  // Backfill remaining slots in queue order. Stop on the first rate-limit
  // hit — we've already armed a retry; no point churning.
  for (const item of batch.items) {
    if (batch.inFlightCount >= batch.maxParallel) break;
    if (item.status !== 'pending') continue;
    if (!tryStart(item)) break;
  }
}

function scheduleRateLimitRetry(batch: Batch, waitMs: number): void {
  if (batch.rateLimitTimerId !== null) return; // already armed
  batch.rateLimitTimerId = setTimeout(() => {
    batch.rateLimitTimerId = null;
    if (batches.has(batch.id)) pumpBatch(batch);
  }, waitMs);
}

function runItem(batch: Batch, item: BatchItem): void {
  item.status = 'in_flight';
  batch.inFlightCount += 1;
  // Record the analyze-start timestamp BEFORE the resize step so a slow
  // resize doesn't pile up parallel starts that all arrive at the analyze
  // edge function at once. Slight overcount of actual HTTP starts is the
  // intended bias — better to under-throttle the server than over.
  recordAnalyzeStart();
  const work = (async (): Promise<BatchItem> => {
    // Hoisted out of the try so the catch path can re-await it for orphan
    // cleanup (Codex P2 round 1 on PR #777). Initialised inside the try
    // because the resize step runs first and we don't want to start an
    // upload until resize succeeds.
    let uploadP: ReturnType<typeof uploadManipulatedImage> | null = null;
    try {
      // Single resize, base64 + bytes both consumed downstream.
      const resized = await resizeForGarment(item.uri, { wantBase64: true });

      // Upload + analyze in parallel.
      uploadP = uploadManipulatedImage(resized, batch.userId).then((res) => {
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
      // analyzeFn rejected (or another step before it). The upload promise
      // may still be in flight — await it so a successful upload either
      // stamps its storagePath onto the item (retry / cleanup paths need
      // it) or, if the user already skipped/dropped the batch while we
      // were waiting, gets actively deleted to avoid an orphan object.
      // `uploadP` is null only when resize itself rejected before we
      // started the upload. Don't rethrow on upload failure here — the
      // analyze error already drives the item's failed state.
      // (Codex P2 round 1 on PR #777.)
      if (uploadP) {
        try {
          const upRes = await uploadP;
          if (item.status === 'in_flight' && batches.has(batch.id)) {
            item.storagePath = upRes.storagePath;
          } else {
            void deleteUpload(upRes.storagePath);
          }
        } catch {
          // Upload also failed — nothing to clean up.
        }
      }
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
