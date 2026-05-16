// MAX_PARALLEL = 2 consumer that drives the pure state machine's "next task"
// output through real I/O — resize + upload + analyze. Owns the per-user
// analyze rate-window throttle and the per-item `_settled` promise plumbing.
//
// Why a separate file:
//   • The state machine stays pure / Node-only testable.
//   • The lifecycle registry stays a thin Map-with-explicit-API.
//   • The I/O glue (this file) is where the messy interactions between
//     prefetch, ImageManipulator, upload, and analyze live — isolating them
//     here makes the other two units trivial to reason about.

import type { AnalysisResult } from '../../hooks/useAnalyzeGarment';
import type { AddGarmentSource } from '../garmentSave';
import { log } from '../log';
import {
  resizeForGarment,
  uploadManipulatedImage,
  deleteUpload,
  GARMENT_IMAGE_MIME,
} from '../imageUpload';
import { getAnalyzePrefetch, clearAnalyzePrefetch } from '../analyzePrefetch';
import {
  createItems,
  isSettledStatus,
  nextPendingIndexFrom,
  selectStartCandidates,
  transitionForRetry,
  transitionToFailed,
  transitionToInFlight,
  transitionToReady,
  transitionToReviewKept,
  transitionToSaved,
  transitionToSkipped,
} from './BatchStateMachine';
import {
  type Batch,
  type BatchItem,
  cleanup as lifecycleCleanup,
  getBatch,
  hasBatch,
  makeBatchId,
  register,
} from './BatchLifecycle';

// Concurrency cap.
const MAX_PARALLEL_DEFAULT = 2;

// Per-user analyze rate limit on the server. Mirrors the cap in
// `supabase/functions/_shared/scale-guard.ts`.
const ANALYZE_RATE_LIMIT = 30;
const ANALYZE_RATE_WINDOW_MS = 60 * 1000;
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

function nextAnalyzeSlotMs(): number {
  pruneAnalyzeWindow();
  if (analyzeStartTimestamps.length < ANALYZE_RATE_LIMIT) return 0;
  const oldest = analyzeStartTimestamps[0] ?? Date.now();
  return Math.max(0, oldest + ANALYZE_RATE_WINDOW_MS - Date.now() + 50);
}

function recordAnalyzeStart(): void {
  pruneAnalyzeWindow();
  analyzeStartTimestamps.push(Date.now());
}

/**
 * Test-only — clears the analyze-rate-limit window so specs that exercise
 * `startBatch` don't inherit timestamps from earlier `describe` blocks. The
 * window is otherwise a module-scope sliding average and intentionally
 * survives batch lifecycle (per the original Phase 4 spec).
 *
 * Not exported via `./index.ts` — call directly from tests only.
 */
export function __resetAnalyzeRateWindowForTests(): void {
  analyzeStartTimestamps.length = 0;
}

export type { BatchItemStatus } from './BatchStateMachine';
export type { BatchItem } from './BatchLifecycle';

export interface StartBatchOptions {
  uris: string[];
  userId: string;
  source: AddGarmentSource;
  analyzeFn: (input: { base64: string } | { storagePath: string }) => Promise<AnalysisResult | null>;
}

export function startBatch(opts: StartBatchOptions): string {
  const id = makeBatchId();
  const items: BatchItem[] = createItems(opts.uris).map((s) => ({ ...s, _settled: null }));
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
  register(batch);
  pumpBatch(batch);
  return id;
}

export function getItem(batchId: string, index: number): BatchItem | null {
  const batch = getBatch(batchId);
  if (!batch) return null;
  return batch.items[index] ?? null;
}

export function getBatchSize(batchId: string): number {
  const batch = getBatch(batchId);
  return batch ? batch.items.length : 0;
}

export function awaitItem(batchId: string, index: number): Promise<BatchItem | null> {
  const batch = getBatch(batchId);
  if (!batch) return Promise.resolve(null);
  const item = batch.items[index];
  if (!item) return Promise.resolve(null);
  if (isSettledStatus(item.status)) {
    return Promise.resolve(item);
  }
  if (item.status === 'pending') pumpBatch(batch, index);
  if (item._settled) return item._settled;
  return waitForItem(batch, index);
}

function waitForItem(batch: Batch, index: number): Promise<BatchItem | null> {
  return new Promise((resolve) => {
    const tick = () => {
      const live = getBatch(batch.id);
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
      if (isSettledStatus(item.status)) {
        resolve(item);
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

export function markItemReviewedKeep(batchId: string, index: number): void {
  const batch = getBatch(batchId);
  if (!batch) return;
  const item = batch.items[index];
  if (!item) return;
  const next = transitionToReviewKept(item);
  if (!next) return;
  Object.assign(item, next);
  pumpBatch(batch);
}

export function markItemSaved(batchId: string, index: number): void {
  const batch = getBatch(batchId);
  if (!batch) return;
  const item = batch.items[index];
  if (!item) return;
  const next = transitionToSaved(item);
  if (!next) return;
  Object.assign(item, next);
  pumpBatch(batch);
}

export function markItemSkipped(batchId: string, index: number): void {
  const batch = getBatch(batchId);
  if (!batch) return;
  const item = batch.items[index];
  if (!item) return;
  // The helper rejects skipping a terminal item (`saved` keeps its
  // storagePath; `skipped` already has it null). Capture the live
  // storagePath BEFORE Object.assign clears it, and delete the blob only
  // after the helper confirms the transition fires — otherwise we'd orphan
  // a saved garment's image. (Capturing pre-assign matters: a future
  // refactor that moves the read after the assign would always see null.)
  const next = transitionToSkipped(item);
  if (!next) return;
  const staleStoragePath = item.storagePath;
  Object.assign(item, next);
  if (staleStoragePath) void deleteUpload(staleStoragePath);
  pumpBatch(batch);
}

export function retryItem(batchId: string, index: number): boolean {
  const batch = getBatch(batchId);
  if (!batch) return false;
  const item = batch.items[index];
  if (!item) return false;
  const next = transitionForRetry(item);
  if (!next) return false;
  // Capture the stale upload path before the helper clears it, then apply
  // the transition. _settled MUST be nulled AFTER Object.assign — the
  // helper's spread carries the runtime `_settled` field (not in the
  // BatchItemState typing but present on BatchItem), so assigning before
  // nulling would re-stamp the stale failed promise. Consumers calling
  // `awaitItem` while `pumpBatch` defers `runItem` (rate-limited / cap
  // saturated) would otherwise resolve to the old failed snapshot instead
  // of the fresh retry.
  const staleStoragePath = item.storagePath;
  Object.assign(item, next);
  item._settled = null;
  if (staleStoragePath) void deleteUpload(staleStoragePath);
  pumpBatch(batch, index);
  return true;
}

export function nextPendingIndex(batchId: string, fromIndex: number): number {
  const batch = getBatch(batchId);
  if (!batch) return -1;
  return nextPendingIndexFrom(batch.items, fromIndex);
}

export function dropBatch(batchId: string): void {
  lifecycleCleanup(batchId);
}

// ─── internal scheduler ─────────────────────────────────────────────────────

function pumpBatch(batch: Batch, prioritiseIndex?: number): void {
  if (!hasBatch(batch.id)) return;

  const candidates = selectStartCandidates(
    batch.items,
    batch.inFlightCount,
    batch.maxParallel,
    prioritiseIndex,
  );

  for (const idx of candidates) {
    const item = batch.items[idx];
    if (!item) continue;
    if (item.status !== 'pending') continue;
    if (batch.inFlightCount >= batch.maxParallel) break;
    const wait = nextAnalyzeSlotMs();
    if (wait > 0) {
      scheduleRateLimitRetry(batch, wait);
      break;
    }
    runItem(batch, item);
  }
}

function scheduleRateLimitRetry(batch: Batch, waitMs: number): void {
  if (batch.rateLimitTimerId !== null) return;
  batch.rateLimitTimerId = setTimeout(() => {
    batch.rateLimitTimerId = null;
    if (hasBatch(batch.id)) pumpBatch(batch);
  }, waitMs);
}

function runItem(batch: Batch, item: BatchItem): void {
  const inflight = transitionToInFlight(item);
  if (!inflight) {
    // pumpBatch's `selectStartCandidates` should only ever return pending
    // indexes, and the loop re-checks `status === 'pending'` before
    // calling. If we land here the scheduler is out of sync with the
    // helper's contract — surface it via the dev-only `log.warn` rather
    // than silently dropping the slot (which would leave `inFlightCount`
    // un-incremented and the item permanently stuck). `log.warn` is a
    // no-op in production.
    log.warn(
      `[batchPipeline] runItem invoked with non-pending status "${item.status}" — scheduler invariant violated`,
    );
    return;
  }
  Object.assign(item, inflight);
  batch.inFlightCount += 1;
  recordAnalyzeStart();
  const work = (async (): Promise<BatchItem> => {
    let uploadP: ReturnType<typeof uploadManipulatedImage> | null = null;
    try {
      const prefetched = getAnalyzePrefetch(item.uri);
      let resized: Awaited<ReturnType<typeof resizeForGarment>>;
      if (prefetched) {
        try {
          resized = await prefetched.resized;
        } catch {
          clearAnalyzePrefetch(item.uri);
          resized = await resizeForGarment(item.uri, { wantBase64: true });
        }
      } else {
        resized = await resizeForGarment(item.uri, { wantBase64: true });
      }

      uploadP = uploadManipulatedImage(resized, batch.userId).then((res) => {
        item.storagePath = res.storagePath;
        return res;
      });
      uploadP.catch(() => {});

      const base64 = resized.base64
        ? `data:${GARMENT_IMAGE_MIME};base64,${resized.base64}`
        : null;

      let analysis: AnalysisResult | null = null;
      let prefetchFailed = false;
      if (prefetched) {
        try {
          analysis = await prefetched.promise;
        } catch {
          analysis = null;
        }
        if (prefetched.outcome === 'failed') {
          prefetchFailed = true;
        }
        clearAnalyzePrefetch(item.uri);
      }
      if (prefetchFailed && !analysis) {
        throw new Error('Could not analyze photo');
      }
      if (!analysis && base64) {
        analysis = await batch.analyzeFn({ base64 });
      } else if (!analysis) {
        const upRes = await uploadP;
        analysis = await batch.analyzeFn({ storagePath: upRes.storagePath });
      }

      const upRes = await uploadP;
      item.storagePath = upRes.storagePath;

      if (!analysis) {
        throw new Error('Could not analyze photo');
      }
      item.analysis = analysis;
      if (
        item.status !== 'in_flight' ||
        !hasBatch(batch.id)
      ) {
        if (item.storagePath) void deleteUpload(item.storagePath);
        item.storagePath = null;
        return item;
      }
      const ready = transitionToReady(item, analysis, upRes.storagePath);
      if (ready) Object.assign(item, ready);
      return item;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pipeline failed';
      if (uploadP) {
        try {
          const upRes = await uploadP;
          if (item.status === 'in_flight' && hasBatch(batch.id)) {
            item.storagePath = upRes.storagePath;
          } else {
            void deleteUpload(upRes.storagePath);
          }
        } catch {
          // upload also failed — nothing to clean up
        }
      }
      const failed = transitionToFailed(item, msg);
      if (failed) Object.assign(item, failed);
      return item;
    } finally {
      batch.inFlightCount = Math.max(0, batch.inFlightCount - 1);
      if (hasBatch(batch.id)) pumpBatch(batch);
    }
  })();
  item._settled = work;
}
