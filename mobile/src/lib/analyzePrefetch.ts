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
//
// Module-scope state: Single Map per JS isolate. Hot-reload in dev clears it.
// No persistence — prefetches are an in-session-only optimization.

import type * as ImageManipulator from 'expo-image-manipulator';

import type { AnalysisResult } from '../hooks/useAnalyzeGarment';

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 16;

export interface PrefetchEntry {
  /** Promise resolving to the analyze() result (or null on failure). */
  promise: Promise<AnalysisResult | null>;
  /** Resized image so Step 2 doesn't have to re-resize for the upload. */
  resized: Promise<ImageManipulator.ImageResult>;
  /** Wall-clock timestamp the entry was registered. Used for TTL pruning. */
  createdAt: number;
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
 */
export function setAnalyzePrefetch(uri: string, entry: PrefetchEntry): void {
  registry.set(uri, entry);
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
