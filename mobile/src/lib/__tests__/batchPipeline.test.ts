// Phase 4 — Tests for the split batchPipeline modules.
//
//   1. State-machine-only tests pull from BatchStateMachine.ts directly. The
//      file imports zero runtime dependencies beyond a type, so these specs
//      exercise pure functions with no I/O / RN setup.
//   2. Lifecycle tests use a mocked `deleteUpload` so register / unregister /
//      cleanup can run without touching supabase.
//   3. Pool tests stub the prefetch + image-upload modules and verify
//      register-then-cleanup is idempotent and that re-creating a batch with
//      a fresh id starts cleanly with no leaked state.

import type { AnalysisResult } from '../../hooks/useAnalyzeGarment';
import {
  REVIEW_CONFIDENCE_FLOOR,
  createItems,
  isSettledStatus,
  isTerminalStatus,
  nextPendingIndexFrom,
  selectStartCandidates,
  shouldNeedReview,
  transitionForRetry,
  transitionToFailed,
  transitionToInFlight,
  transitionToReady,
  transitionToReviewKept,
  transitionToSaved,
  transitionToSkipped,
  type BatchItemState,
} from '../batchPipeline/BatchStateMachine';
import {
  cleanup,
  getBatch,
  hasBatch,
  makeBatchId,
  register,
  unregister,
  type Batch,
} from '../batchPipeline/BatchLifecycle';
import {
  awaitItem,
  dropBatch,
  getBatchSize,
  getItem,
  markItemReviewedKeep,
  markItemSaved,
  markItemSkipped,
  nextPendingIndex,
  retryItem,
  startBatch,
} from '../batchPipeline';
import { __resetAnalyzeRateWindowForTests } from '../batchPipeline/BatchConcurrencyPool';

jest.mock('../imageUpload', () => ({
  resizeForGarment: jest.fn(),
  uploadManipulatedImage: jest.fn(),
  deleteUpload: jest.fn().mockResolvedValue(undefined),
  GARMENT_IMAGE_MIME: 'image/webp',
}));

jest.mock('../analyzePrefetch', () => ({
  getAnalyzePrefetch: jest.fn().mockReturnValue(null),
  clearAnalyzePrefetch: jest.fn(),
}));

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => `uuid-${++counter}`),
  };
});

const { deleteUpload: mockDeleteUpload } = jest.requireMock<{
  deleteUpload: jest.Mock;
}>('../imageUpload');
const { resizeForGarment: mockResize, uploadManipulatedImage: mockUpload } = jest.requireMock<{
  resizeForGarment: jest.Mock;
  uploadManipulatedImage: jest.Mock;
}>('../imageUpload');

function makeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    title: 't',
    category: 'top',
    subcategory: null,
    color_primary: null,
    color_secondary: null,
    material: null,
    fit: null,
    pattern: null,
    season_tags: [],
    formality: null,
    description: null,
    confidence: 0.9,
    image_contains_multiple_garments: false,
    ...overrides,
  };
}

// ─── State machine (no I/O, no RN, no jest-expo runtime concerns) ──────────

describe('BatchStateMachine — pure helpers', () => {
  it('createItems builds a pending FIFO queue', () => {
    const items = createItems(['a', 'b', 'c']);
    expect(items.map((i) => i.status)).toEqual(['pending', 'pending', 'pending']);
    expect(items.map((i) => i.index)).toEqual([0, 1, 2]);
    expect(items.map((i) => i.uri)).toEqual(['a', 'b', 'c']);
  });

  it('shouldNeedReview triggers on multi-garment OR low confidence', () => {
    expect(shouldNeedReview(makeAnalysis({ confidence: 0.9 }))).toBe(false);
    expect(shouldNeedReview(makeAnalysis({ confidence: REVIEW_CONFIDENCE_FLOOR - 0.01 }))).toBe(
      true,
    );
    expect(
      shouldNeedReview(makeAnalysis({ image_contains_multiple_garments: true, confidence: 1 })),
    ).toBe(true);
  });

  it('isTerminalStatus & isSettledStatus classify correctly', () => {
    expect(isTerminalStatus('saved')).toBe(true);
    expect(isTerminalStatus('skipped')).toBe(true);
    expect(isTerminalStatus('ready')).toBe(false);
    expect(isSettledStatus('ready')).toBe(true);
    expect(isSettledStatus('failed')).toBe(true);
    expect(isSettledStatus('needs_review')).toBe(true);
    expect(isSettledStatus('pending')).toBe(false);
    expect(isSettledStatus('in_flight')).toBe(false);
  });

  it('nextPendingIndexFrom skips terminal items', () => {
    const items = createItems(['a', 'b', 'c', 'd']);
    items[1].status = 'saved';
    items[2].status = 'skipped';
    expect(nextPendingIndexFrom(items, 0)).toBe(3);
    expect(nextPendingIndexFrom(items, 3)).toBe(-1);
  });

  it('selectStartCandidates respects parallel cap', () => {
    const items = createItems(['a', 'b', 'c', 'd']);
    expect(selectStartCandidates(items, 0, 2)).toEqual([0, 1]);
    expect(selectStartCandidates(items, 1, 2)).toEqual([0]);
    expect(selectStartCandidates(items, 2, 2)).toEqual([]);
  });

  it('selectStartCandidates honors prioritised index', () => {
    const items = createItems(['a', 'b', 'c']);
    expect(selectStartCandidates(items, 0, 2, 2)).toEqual([2, 0]);
  });

  it('selectStartCandidates skips non-pending items', () => {
    const items = createItems(['a', 'b', 'c']);
    items[0].status = 'in_flight';
    expect(selectStartCandidates(items, 1, 2)).toEqual([1]);
  });

  it('transitions follow the documented rules', () => {
    const base = createItems(['x'])[0];

    expect(transitionToInFlight({ ...base, status: 'ready' })).toBeNull();
    const inflight = transitionToInFlight(base);
    expect(inflight?.status).toBe('in_flight');

    const ready = transitionToReady(inflight!, makeAnalysis({ confidence: 0.9 }), '/p/1');
    expect(ready?.status).toBe('ready');
    expect(ready?.storagePath).toBe('/p/1');

    const review = transitionToReady(
      inflight!,
      makeAnalysis({ image_contains_multiple_garments: true }),
      '/p/2',
    );
    expect(review?.status).toBe('needs_review');

    const failed = transitionToFailed(inflight!, 'boom');
    expect(failed?.status).toBe('failed');
    expect(failed?.errorMessage).toBe('boom');

    const saved = transitionToSaved(ready!);
    expect(saved?.status).toBe('saved');
    expect(transitionToSaved({ ...base, status: 'in_flight' } as BatchItemState)).toBeNull();
    expect(transitionToSaved({ ...base, status: 'failed' } as BatchItemState)).toBeNull();
    expect(transitionToSaved({ ...base, status: 'pending' } as BatchItemState)).toBeNull();
    expect(transitionToSaved({ ...base, status: 'needs_review' } as BatchItemState)).toBeNull();

    const skipped = transitionToSkipped(ready!);
    expect(skipped?.status).toBe('skipped');
    expect(skipped?.storagePath).toBeNull();
    expect(transitionToSkipped({ ...base, status: 'saved' })).toBeNull();

    const kept = transitionToReviewKept({ ...inflight!, status: 'needs_review' } as BatchItemState);
    expect(kept?.status).toBe('ready');
    expect(transitionToReviewKept({ ...base, status: 'ready' } as BatchItemState)).toBeNull();

    const retried = transitionForRetry(failed!);
    expect(retried?.status).toBe('pending');
    expect(retried?.errorMessage).toBeNull();
    expect(retried?.storagePath).toBeNull();
    expect(transitionForRetry({ ...base, status: 'ready' } as BatchItemState)).toBeNull();
  });
});

// ─── Lifecycle ─────────────────────────────────────────────────────────────

function makeBatch(id: string, items: { storagePath?: string | null; status?: string }[] = []): Batch {
  return {
    id,
    userId: 'u',
    source: 'batch_add',
    analyzeFn: jest.fn(),
    maxParallel: 2,
    inFlightCount: 0,
    rateLimitTimerId: null,
    items: items.map((it, idx) => ({
      index: idx,
      uri: `uri-${idx}`,
      status: (it.status ?? 'pending') as Batch['items'][number]['status'],
      storagePath: it.storagePath ?? null,
      analysis: null,
      errorMessage: null,
      _settled: null,
    })),
  };
}

describe('BatchLifecycle — register / unregister / cleanup', () => {
  beforeEach(() => {
    mockDeleteUpload.mockClear();
  });

  it('register makes the batch retrievable; unregister removes it', () => {
    const b = makeBatch('B1');
    register(b);
    expect(hasBatch('B1')).toBe(true);
    expect(getBatch('B1')).toBe(b);
    unregister('B1');
    expect(hasBatch('B1')).toBe(false);
    expect(getBatch('B1')).toBeUndefined();
  });

  it('cleanup deletes storage objects for non-saved items and clears the entry', () => {
    const b = makeBatch('B2', [
      { storagePath: '/saved', status: 'saved' },
      { storagePath: '/orphan', status: 'ready' },
      { storagePath: null, status: 'pending' },
    ]);
    register(b);
    cleanup('B2');
    expect(hasBatch('B2')).toBe(false);
    expect(mockDeleteUpload).toHaveBeenCalledTimes(1);
    expect(mockDeleteUpload).toHaveBeenCalledWith('/orphan');
  });

  it('cleanup is idempotent — calling twice does nothing on the second call', () => {
    const b = makeBatch('B3', [{ storagePath: '/x', status: 'ready' }]);
    register(b);
    cleanup('B3');
    cleanup('B3');
    expect(mockDeleteUpload).toHaveBeenCalledTimes(1);
  });

  it('cleanup clears any armed rate-limit timer', () => {
    jest.useFakeTimers();
    const tick = jest.fn();
    const timer = setTimeout(tick, 1000) as unknown as ReturnType<typeof setTimeout>;
    const b: Batch = {
      ...makeBatch('B4'),
      rateLimitTimerId: timer,
    };
    register(b);
    cleanup('B4');
    jest.advanceTimersByTime(2000);
    expect(tick).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('register/unregister/re-register with same id leaks no state', () => {
    const first = makeBatch('SAME', [{ storagePath: '/old', status: 'ready' }]);
    register(first);
    expect(hasBatch('SAME')).toBe(true);
    cleanup('SAME');
    expect(hasBatch('SAME')).toBe(false);

    const second = makeBatch('SAME', [{ storagePath: '/new', status: 'pending' }]);
    register(second);
    const retrieved = getBatch('SAME');
    expect(retrieved).toBe(second);
    expect(retrieved?.items[0].storagePath).toBe('/new');
    expect(retrieved?.items[0].status).toBe('pending');
    unregister('SAME');
  });

  it('makeBatchId prefixes with b-', () => {
    const id = makeBatchId();
    expect(id.startsWith('b-')).toBe(true);
  });
});

// ─── Concurrency pool (with mocked I/O) ────────────────────────────────────

describe('BatchConcurrencyPool — startBatch + cleanup with mocked I/O', () => {
  beforeEach(() => {
    mockResize.mockReset();
    mockUpload.mockReset();
    mockDeleteUpload.mockClear();
    // Reset module-scope analyze rate window so timestamps from prior
    // specs don't trip `nextAnalyzeSlotMs > 0` and defer `runItem` via
    // a real `setTimeout`, which would cause `awaitItem` to fall into
    // its 100 ms polling loop.
    __resetAnalyzeRateWindowForTests();
  });

  it('runs a happy-path single-item batch end-to-end with mocked I/O', async () => {
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/1' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult>, [unknown]>()
      .mockResolvedValue(makeAnalysis({ confidence: 0.95 }));

    const id = startBatch({
      uris: ['photo://1'],
      userId: 'u',
      source: 'batch_add',
      analyzeFn,
    });
    expect(getBatchSize(id)).toBe(1);

    const settled = await awaitItem(id, 0);
    expect(settled?.status).toBe('ready');
    expect(settled?.storagePath).toBe('/up/1');
    expect(settled?.analysis?.confidence).toBe(0.95);
    expect(nextPendingIndex(id, 0)).toBe(-1);

    dropBatch(id);
    expect(getItem(id, 0)).toBeNull();
  });

  it('routes ambiguous analyses to needs_review', async () => {
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/r' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult>, [unknown]>()
      .mockResolvedValue(makeAnalysis({ image_contains_multiple_garments: true, confidence: 0.9 }));

    const id = startBatch({
      uris: ['photo://multi'],
      userId: 'u',
      source: 'batch_add',
      analyzeFn,
    });
    const settled = await awaitItem(id, 0);
    expect(settled?.status).toBe('needs_review');
    dropBatch(id);
  });

  it('marks a failed analyze as failed and surfaces the error message', async () => {
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/f' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult | null>, [unknown]>()
      .mockResolvedValue(null);

    const id = startBatch({
      uris: ['photo://bad'],
      userId: 'u',
      source: 'batch_add',
      analyzeFn,
    });
    const settled = await awaitItem(id, 0);
    expect(settled?.status).toBe('failed');
    expect(settled?.errorMessage).toBe('Could not analyze photo');
    dropBatch(id);
  });

  // Regression guard for the Phase 4 audit finding: prior to this guard, the
  // pool mutated `item.status` directly so misuse (e.g. markItemSaved on a
  // non-ready item) silently corrupted state. The transition helpers in
  // BatchStateMachine.ts gate every status change; these tests exercise the
  // public pool API to confirm production paths actually go through them.
  it('markItemSaved is a no-op when the item is not ready', async () => {
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/g' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult>, [unknown]>()
      .mockResolvedValue(makeAnalysis({ image_contains_multiple_garments: true, confidence: 0.9 }));

    const id = startBatch({ uris: ['photo://g'], userId: 'u', source: 'batch_add', analyzeFn });
    const settled = await awaitItem(id, 0);
    expect(settled?.status).toBe('needs_review');

    // Direct save on a needs_review item must NOT advance to saved — the
    // helper guard rejects the transition.
    markItemSaved(id, 0);
    expect(getItem(id, 0)?.status).toBe('needs_review');

    // After the user keeps the review, status moves to ready, then save works.
    markItemReviewedKeep(id, 0);
    expect(getItem(id, 0)?.status).toBe('ready');
    markItemSaved(id, 0);
    expect(getItem(id, 0)?.status).toBe('saved');

    dropBatch(id);
  });

  it('markItemSkipped on a ready item nulls storagePath AND deletes the stale blob', async () => {
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/sr' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult>, [unknown]>()
      .mockResolvedValue(makeAnalysis({ confidence: 0.95 }));

    const id = startBatch({ uris: ['photo://sr'], userId: 'u', source: 'batch_add', analyzeFn });
    await awaitItem(id, 0);
    expect(getItem(id, 0)?.status).toBe('ready');
    expect(getItem(id, 0)?.storagePath).toBe('/up/sr');

    // Skipping a non-terminal item must (a) fire the transition, (b)
    // null `storagePath` on the item, and (c) call `deleteUpload` with
    // the PRIOR path — the reorder fix from the 2nd review pins exactly
    // this ordering invariant. If a future refactor reads `item.storagePath`
    // after `Object.assign`, both assertions below fail.
    mockDeleteUpload.mockClear();
    markItemSkipped(id, 0);
    expect(getItem(id, 0)?.status).toBe('skipped');
    expect(getItem(id, 0)?.storagePath).toBeNull();
    expect(mockDeleteUpload).toHaveBeenCalledWith('/up/sr');

    dropBatch(id);
  });

  it('markItemSkipped on a saved item is a true no-op (does NOT delete the persisted blob)', async () => {
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/s' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult>, [unknown]>()
      .mockResolvedValue(makeAnalysis({ confidence: 0.95 }));

    const id = startBatch({ uris: ['photo://s'], userId: 'u', source: 'batch_add', analyzeFn });
    await awaitItem(id, 0);
    markItemSaved(id, 0);
    expect(getItem(id, 0)?.status).toBe('saved');
    expect(getItem(id, 0)?.storagePath).toBe('/up/s');

    // Skipping a saved item must be a no-op — the helper rejects the
    // transition AND the side-effectful deleteUpload must not fire,
    // otherwise we'd orphan the persisted garment's image.
    mockDeleteUpload.mockClear();
    markItemSkipped(id, 0);
    expect(getItem(id, 0)?.status).toBe('saved');
    expect(getItem(id, 0)?.storagePath).toBe('/up/s');
    expect(mockDeleteUpload).not.toHaveBeenCalled();

    dropBatch(id);
  });

  it('markItemReviewedKeep is a no-op when the item is not needs_review', async () => {
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/k' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult>, [unknown]>()
      .mockResolvedValue(makeAnalysis({ confidence: 0.95 }));

    const id = startBatch({ uris: ['photo://k'], userId: 'u', source: 'batch_add', analyzeFn });
    await awaitItem(id, 0);
    expect(getItem(id, 0)?.status).toBe('ready');

    // Keep-review on a ready item must NOT flip status nor trigger any
    // side effects — the helper guard rejects the transition.
    markItemReviewedKeep(id, 0);
    expect(getItem(id, 0)?.status).toBe('ready');

    dropBatch(id);
  });

  it('retryItem only re-runs failed items and refuses to re-pend ready items', async () => {
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/r' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult>, [unknown]>()
      .mockResolvedValue(makeAnalysis({ confidence: 0.95 }));

    const id = startBatch({ uris: ['photo://r'], userId: 'u', source: 'batch_add', analyzeFn });
    await awaitItem(id, 0);
    expect(getItem(id, 0)?.status).toBe('ready');

    // Calling retry on a non-failed item must return false and leave status alone.
    expect(retryItem(id, 0)).toBe(false);
    expect(getItem(id, 0)?.status).toBe('ready');

    dropBatch(id);
  });

  it('retryItem can recover from a SECOND failure (replaces _settled twice)', async () => {
    // Pins the `_settled` reset path across multiple retries. The prior
    // P1 was that Object.assign restamped a stale `_settled` after the
    // first retry — but a third-pass reviewer flagged that the suite
    // only proved the FIRST retry replaces the promise. This test drives
    // failed → retry → failed → retry → ready and confirms the second
    // retry's awaitItem resolves to ready (not the second failure's
    // stale snapshot).
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/r3' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult | null>, [unknown]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(makeAnalysis({ confidence: 0.95 }));

    const id = startBatch({ uris: ['photo://r3'], userId: 'u', source: 'batch_add', analyzeFn });
    expect((await awaitItem(id, 0))?.status).toBe('failed');

    expect(retryItem(id, 0)).toBe(true);
    expect((await awaitItem(id, 0))?.status).toBe('failed');

    expect(retryItem(id, 0)).toBe(true);
    const finalSettled = await awaitItem(id, 0);
    expect(finalSettled?.status).toBe('ready');
    expect(finalSettled?.errorMessage).toBeNull();
    expect(analyzeFn).toHaveBeenCalledTimes(3);

    dropBatch(id);
  });

  it('retryItem drives a failed item back through the pipeline to ready', async () => {
    // Happy-path regression for the helper-wiring fix: production path must
    // actually re-execute runItem, replace `_settled`, delete the stale
    // upload, and end up `ready`. Previously the "retryItem just returns
    // true" assertion above could pass while production silently bricked.
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/r2' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult | null>, [unknown]>()
      .mockResolvedValueOnce(null) // first call: simulate analyze failure
      .mockResolvedValue(makeAnalysis({ confidence: 0.95 }));

    const id = startBatch({ uris: ['photo://r2'], userId: 'u', source: 'batch_add', analyzeFn });
    const firstSettled = await awaitItem(id, 0);
    expect(firstSettled?.status).toBe('failed');
    expect(firstSettled?.storagePath).toBe('/up/r2');

    mockDeleteUpload.mockClear();
    expect(retryItem(id, 0)).toBe(true);

    const retried = await awaitItem(id, 0);
    expect(retried?.status).toBe('ready');
    expect(retried?.storagePath).toBe('/up/r2');
    expect(retried?.errorMessage).toBeNull();
    expect(analyzeFn).toHaveBeenCalledTimes(2);
    expect(mockDeleteUpload).toHaveBeenCalledWith('/up/r2');

    dropBatch(id);
  });

  it('dropBatch then a fresh startBatch leaks no state', async () => {
    mockResize.mockResolvedValue({ uri: 'r.webp', base64: 'AAA', width: 1, height: 1 });
    mockUpload.mockResolvedValue({ storagePath: '/up/x' });
    const analyzeFn = jest
      .fn<Promise<AnalysisResult>, [unknown]>()
      .mockResolvedValue(makeAnalysis({ confidence: 0.9 }));

    const id1 = startBatch({ uris: ['p://1'], userId: 'u', source: 'batch_add', analyzeFn });
    await awaitItem(id1, 0);
    dropBatch(id1);
    // Second drop is idempotent.
    dropBatch(id1);
    expect(getItem(id1, 0)).toBeNull();

    const id2 = startBatch({ uris: ['p://2', 'p://3'], userId: 'u', source: 'batch_add', analyzeFn });
    expect(id2).not.toBe(id1);
    expect(getBatchSize(id2)).toBe(2);
    const a = await awaitItem(id2, 0);
    const b = await awaitItem(id2, 1);
    expect(a?.status).toBe('ready');
    expect(b?.status).toBe('ready');
    dropBatch(id2);
  });
});
