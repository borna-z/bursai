// Wave S-C.1 — single-photo analyze prefetch.
//
// As soon as Step 1's single-photo entry mode (Camera tile / Gallery pick) lands
// a photo, we can fire the same resize → base64 → analyze pipeline that Step 2
// would otherwise wait on. Park the in-flight promise here, keyed by photo URI,
// and Step 2 just awaits the cached entry instead of starting from scratch. In
// the common case where the user spends ≥2 s on Step 1 before tapping Continue,
// analysis is already done by the time Step 2 mounts — Step 3 lands almost
// instantly.
//
// Why URI-keyed:
//   - The photo URI is the natural cache key — a re-used gallery pick OR a
//     retry from the AddPiece flow both produce the same URI and should
//     coalesce onto a single in-flight call.
//   - We also stash the resized image (so Step 2 can hand the SAME bytes to the
//     upload path without re-resizing) and the resolved analysis.
//
// Capacity + TTL:
//   - 5-minute TTL: a stale prefetch from a previous Add session shouldn't be
//     consumed by a fresh flow with the same source URI (e.g. a gallery pick
//     re-used minutes later). Stale entries are pruned on every set / get.
//   - 16-entry capacity: the multi-photo batch path uses batchPipeline.ts
//     (which owns its own pipeline state), so the single-photo prefetch
//     registry typically holds 1 entry. A user repeatedly bouncing between
//     Step 1 and the back button could accumulate more — cap at 16 so the
//     map's memory footprint stays bounded under pathological behavior.
//     LRU eviction on overflow.
//
// Failure semantics:
//   - The stored promise is the analyze() return. If analyze rejected, the
//     promise rejects — Step 2's awaiter falls through to its error UI and
//     can offer Retry. We intentionally do NOT delete failed entries on
//     reject; if Step 2 retries via `clearAnalyzePrefetch(uri)` first, the
//     next prefetch lands cleanly.
//   - Because `useAnalyzeGarment.analyze()` catches every HTTP failure and
//     resolves `null` (rather than rejecting), the stored promise *also*
//     resolves `null` on a real backend failure (429 rate limit, 402
//     subscription lock, 5xx). Callers that fall through to a fresh
//     `analyze({ base64 })` on `null` would then burn another quota hit
//     immediately after the server already refused — exactly when the
//     request is most likely to fail again. Codex P2 round 2 on PR #848.
//     The registry now tracks an `outcome` alongside the promise so the
//     batch / Step 2 paths can distinguish:
//       'analyzed' — promise settled with a real AnalysisResult
//       'failed'   — promise resolved to `null` (analyze() ate a 4xx/5xx)
//                    or rejected (resize threw / analyze somehow rejected).
//                    Callers should route to the existing failed-item retry
//                    UI rather than auto-retrying.
//       'pending'  — settlement hasn't landed yet; callers should await.
//
// Module-scope state: Single Map per JS isolate. Hot-reload in dev clears it.
// No persistence — prefetches are an in-session-only optimization.

import type * as ImageManipulator from 'expo-image-manipulator';

import type { AnalysisResult } from '../hooks/useAnalyzeGarment';

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 16;

export type PrefetchOutcome = 'pending' | 'analyzed' | 'failed';

export interface PrefetchEntry {
  /** Promise resolving to the analyze() result (or null on failure). */
  promise: Promise<AnalysisResult | null>;
  /** Resized image so Step 2 doesn't have to re-resize for the upload. */
  resized: Promise<ImageManipulator.ImageResult>;
  /** Wall-clock timestamp the entry was registered. Used for TTL pruning. */
  createdAt: number;
  /**
   * Tracks how the analyze prefetch settled. Updated synchronously from a
   * `.then` / `.catch` attached at registration time. Readers can poll this
   * after `await entry.promise` to learn whether the resolution represents
   * a successful analysis or a backend failure — `useAnalyzeGarment.analyze`
   * swallows HTTP failures into a `null` resolution rather than rejecting,
   * so the promise's resolved value alone cannot disambiguate the two.
   */
  outcome: PrefetchOutcome;
}

const registry = new Map<string, PrefetchEntry>();

function prune(now: number = Date.now()): void {
  // TTL pass first — drops stale entries regardless of access order.
  for (const [key, entry] of registry) {
    if (now - entry.createdAt > TTL_MS) {
      registry.delete(key);
    }
  }
  // Capacity pass: Map iterates in insertion order, so deleting from the front
  // evicts the oldest entries first.
  while (registry.size > MAX_ENTRIES) {
    const oldestKey = registry.keys().next().value;
    if (oldestKey === undefined) break;
    registry.delete(oldestKey);
  }
}

/**
 * Register a prefetch promise for `uri`. The caller is responsible for kicking
 * off the underlying resize + analyze work; this module only memoizes. If an
 * entry already exists for this URI it is replaced — useful for explicit
 * "refresh on retry" flows where the previous attempt failed.
 *
 * Accepts the input WITHOUT an `outcome` field; the registry installs its own
 * `.then` / `.catch` to track settlement state on the stored entry. This keeps
 * the registration call sites simple (Step 1 just hands us the in-flight
 * promises) while giving consumers a reliable read of whether the analyze
 * prefetch produced a usable result or a failure that should NOT be retried.
 */
export function setAnalyzePrefetch(
  uri: string,
  entry: Omit<PrefetchEntry, 'outcome'>,
): void {
  const stored: PrefetchEntry = { ...entry, outcome: 'pending' };
  // Track settlement on the stored entry without observing the original
  // promise from the caller's perspective — `entry.promise` is what consumers
  // await; we only need to know how IT settles. Attach to the existing
  // promise rather than wrapping/replacing it so any consumer holding a
  // reference to `entry.promise` (e.g. via `getAnalyzePrefetch`) sees the
  // exact same settlement timing.
  entry.promise
    .then((result) => {
      // analyze() resolves null on every backend failure path (402/429/5xx);
      // treat that as a failure rather than a usable cache hit. A genuine
      // analysis always carries at least a non-empty title or category.
      stored.outcome = result == null ? 'failed' : 'analyzed';
    })
    .catch(() => {
      // Rejection means the resize step (or analyze in some future world)
      // threw outright. Same routing as a `null` resolution from our
      // consumers' point of view: don't auto-retry, surface the retry UI.
      stored.outcome = 'failed';
    });
  registry.set(uri, stored);
  prune();
}

/**
 * Look up a prefetched analyze promise WITHOUT consuming the entry. Returns
 * null when no entry exists OR the existing entry has aged out. Step 2 calls
 * this on mount; if it gets back a promise, it awaits instead of starting
 * fresh.
 *
 * Non-consuming so a back-out + re-entry to Step 2 (e.g. transient nav stack
 * pop) doesn't lose the prefetch. The TTL handles eventual cleanup.
 */
export function getAnalyzePrefetch(uri: string): PrefetchEntry | null {
  const entry = registry.get(uri);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    registry.delete(uri);
    return null;
  }
  return entry;
}

/** Drop the entry for `uri`, e.g. on a successful save or an explicit retry. */
export function clearAnalyzePrefetch(uri: string): void {
  registry.delete(uri);
}

/** Test-only — clears all entries. */
export function __resetAnalyzePrefetchForTests(): void {
  registry.clear();
}
