// Module-scope cache + fetch primitives for the signed-URL hooks. Lives
// outside the hook file so the cache state survives between consumers
// and so `clearSignedUrlCache` / `bustSignedUrlCache` can be imported
// without dragging the hook closures.

import type { QueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';

export const BUCKET = 'garments';
export const EXPIRES_IN_SECONDS = 60 * 60; // signed URL TTL — 1 hour
export const TTL_MS = 50 * 60 * 1000; // cache TTL — 10 min before signed URL expiry
// Hard ceiling on a single `createSignedUrl` round-trip. Without this a network
// stall on the storage endpoint could leave the inflight Promise pending
// forever, leaving every sharing observer wedged on `data === undefined` —
// which, before the throw-on-error contract below, was indistinguishable from
// a permanent `null` result. 15s is well above the p99 latency we see for the
// storage edge in eu-central-1 but short enough that the consumer's gradient
// placeholder doesn't stay up for a noticeably long time on a flaky network.
export const FETCH_TIMEOUT_MS = 15 * 1000;

export type CacheEntry = {
  url: string;
  expiresAt: number;
};

// LRU cap on the module-scope cache. Without a ceiling, a long-lived session
// that scrolls through hundreds of garments + outfits accumulates entries
// indefinitely — each entry holds a JWT-bearing URL string (~400 bytes) plus
// the Map overhead. 200 is generous: a typical wardrobe is ~80 items, and
// the bulk hook batches misses, so 200 covers wardrobe + outfit thumbnails
// + planned-outfit hero images in the working set with headroom. When we
// overflow, the OLDEST entry is evicted (insertion-order — JavaScript Maps
// iterate in insertion order, so `urlCache.keys().next().value` returns
// the oldest key). N9 (mobile polish bundle).
const MAX_CACHE_ENTRIES = 200;

// Module-scope map. Lives for the lifetime of the JS bundle — survives
// navigation and remounts. Cleared explicitly on sign-out via
// `clearSignedUrlCache` (called by AuthContext). Capped at
// `MAX_CACHE_ENTRIES` via `setCacheEntry` — direct `urlCache.set` calls
// elsewhere in this module bypass the cap so all writes flow through that
// helper.
export const urlCache = new Map<string, CacheEntry>();

function setCacheEntry(key: string, entry: CacheEntry): void {
  // If the key already exists, delete first so the re-set lands at the
  // tail of insertion order (refresh moves it to "most recently used").
  // Without this, refreshing a hot key could leave it at the front and
  // get evicted on the next overflow despite being actively read.
  if (urlCache.has(key)) urlCache.delete(key);
  urlCache.set(key, entry);
  if (urlCache.size > MAX_CACHE_ENTRIES) {
    // Drop the oldest key. Map insertion-order iteration guarantees the
    // first key is the least-recently-set entry.
    const oldest = urlCache.keys().next().value;
    if (oldest !== undefined) urlCache.delete(oldest);
  }
}

// Tracks in-flight fetches keyed by the same `${bucket}:${path}` shape so a
// list rendering 50 cards with overlapping paths fires one request per
// unique path, not one per card. Cleared at the end of each fetch.
const inflight = new Map<string, Promise<string | null>>();

// Monotonic session counter bumped by `clearSignedUrlCache()`. Every fetch
// reads it at start and re-checks before writing into `urlCache` — if the
// generation has advanced (because sign-out fired mid-fetch), the post-await
// write is silently dropped so a pending request from user A cannot
// repopulate the cache after the SIGNED_OUT clear. (Codex P1 round 1 on
// PR #729.) Without this guard, `clearSignedUrlCache()` only wipes the
// currently-known entries; promises that resolve afterwards still execute
// `urlCache.set(...)` and a signed URL embedding user A's JWT would land
// in the cache during user B's session.
let cacheGeneration = 0;

// Per-path generation counters bumped by `bustSignedUrlCache(...)`. The
// global `cacheGeneration` only fires on full clears (sign-out); a render
// completion that busts a single path needs a finer-grained guard so an
// in-flight `createSignedUrl` for that path which started BEFORE the bust
// doesn't repopulate the module cache with a URL minted pre-regeneration.
// (Codex P2 round 3 on PR #729.) Each fetch snapshots its path's counter
// at start and skips the post-await write if the counter has advanced.
// Counters are sparse — only paths that have been busted at least once
// have an entry; missing keys default to 0.
const pathGenerations = new Map<string, number>();

function pathGenerationFor(key: string): number {
  return pathGenerations.get(key) ?? 0;
}

function bumpPathGeneration(key: string): void {
  pathGenerations.set(key, pathGenerationFor(key) + 1);
}

export function cacheKey(bucket: string, path: string): string {
  return `${bucket}:${path}`;
}

// Hoisted response types so the queryFns can reuse them without re-deriving
// the (3-deep) Awaited<ReturnType<...>> chain inline.
type CreateSignedUrlResponse = Awaited<
  ReturnType<ReturnType<typeof supabase.storage.from>['createSignedUrl']>
>;
export type CreateSignedUrlsResponse = Awaited<
  ReturnType<ReturnType<typeof supabase.storage.from>['createSignedUrls']>
>;

class SignedUrlTimeoutError extends Error {
  constructor() {
    super('createSignedUrl timed out');
    this.name = 'SignedUrlTimeoutError';
  }
}

// Race a Supabase storage promise against a timeout so a stalled fetch can't
// wedge the inflight slot indefinitely. Returns the storage result on success;
// rejects with a SignedUrlTimeoutError on timeout so the queryFn throws and
// React Query retries with backoff. The timer is cleared on either path so
// the timeout can't fire after the storage call has already settled.
//
// Promise.race doesn't cancel the loser, so on timeout the underlying
// storage call keeps running until Supabase's internal fetch settles. That's
// not a leak in the GC sense (the resolved value is discarded by the race
// once the timeout fires) but it does mean an extra HTTP round-trip
// completes in the background. supabase-js's `createSignedUrl` doesn't
// expose an AbortSignal in its public type signature, so we accept the
// orphaned request as the cost of the timeout — a 15s p99-already-slow
// fetch finishing late is invisible to the consumer at that point.
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SignedUrlTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Sentry breadcrumb + dev console warn for fetch-level failures. Distinct
// from `useGarmentImage`'s `<Image onError>` breadcrumb (which fires for
// load-time failures on a successfully-minted URL) so dashboards can tell
// systemic mint failures (RLS denial after re-auth, region outage, mass
// 401 on token refresh) apart from per-asset load failures (object missing,
// stale URL). Without this breadcrumb a permanent gradient placeholder gave
// ops zero signal — the user-visible symptom of "everything's a colour
// card" was invisible to telemetry. (Reported 2026-05-09.)
export function logSignedUrlFetchError(path: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (__DEV__) {
    console.warn('[useSignedUrl] createSignedUrl failed', { path, error: message });
  }
  Sentry.addBreadcrumb({
    category: 'image',
    level: 'warning',
    message: 'createSignedUrl failed',
    data: { path, error: message },
  });
}

// Coerce a Supabase StorageError-or-anything-else into a real Error so
// React Query's retry policy can format it consistently. The `error`
// parameter is the structured `error` field from a `{ data, error }`
// envelope (which is `null` on success, `StorageError`-shaped on failure)
// or a thrown value caught upstream. The `fallback` message is used when
// the input is null/undefined or has no `.message` to extract.
export function coerceFetchError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string' && m.length > 0) {
      return new Error(`createSignedUrl failed: ${m}`);
    }
  }
  return new Error(fallback);
}

export function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return !!entry && entry.expiresAt > Date.now();
}

/**
 * Drop every cached URL + every in-flight fetch. Called by AuthContext on
 * SIGNED_OUT so user A's signed URLs (which embed a JWT in the query string)
 * don't carry into user B's session on the same device. Exported as a
 * standalone function rather than a hook because it has to run from the auth
 * listener, which is outside React render scope.
 */
export function clearSignedUrlCache(): void {
  cacheGeneration += 1;
  urlCache.clear();
  inflight.clear();
  // Drop per-path counters too — sign-out is a hard reset and the global
  // generation bump above already invalidates every pending write, so
  // there's no benefit to keeping the per-path bookkeeping around.
  pathGenerations.clear();
}

/**
 * Drop a path's cached URL (or list of paths) so the next read triggers a
 * fresh `createSignedUrl`. Used when the underlying storage object is
 * overwritten at the same path — `render_garment_image` upserts the
 * rendered image at `${user_id}/${garment.id}/rendered.ext`, so a stale
 * cached URL would hand RN's `<Image>` the exact same URI and the native
 * image cache may keep serving the old bytes. Wired into
 * `useRenderJobStatus`'s terminal-success effect for the worker's
 * `result_path`. (Codex P2 round 1 on PR #729.)
 *
 * The QueryClient is required because deleting from the module-scope Map
 * alone is insufficient: React Query keeps its own per-queryKey result
 * fresh for `staleTime`, so observers of `['signed-url', BUCKET, path]`
 * would keep receiving the old `query.data` URL without re-running the
 * queryFn until that staleTime elapses. Invalidating the matching React
 * Query entries forces the next observe to refetch through the (now
 * empty) module cache. (Codex P2 round 2 on PR #729.)
 */
export function bustSignedUrlCache(
  queryClient: QueryClient,
  pathOrPaths: string | readonly string[],
): void {
  const paths = typeof pathOrPaths === 'string' ? [pathOrPaths] : pathOrPaths;
  const bustSet = new Set(paths.filter((p): p is string => Boolean(p)));
  if (bustSet.size === 0) return;

  for (const p of bustSet) {
    const k = cacheKey(BUCKET, p);
    bumpPathGeneration(k);
    urlCache.delete(k);
    inflight.delete(k);
    void queryClient.invalidateQueries({ queryKey: ['signed-url', BUCKET, p] });
  }

  // `useSignedUrls` queries are keyed on a sorted path array, so we can't
  // target them by exact key without reproducing the sort. Sweep with a
  // predicate that invalidates any bulk-cache entry whose path list
  // contains a busted path.
  void queryClient.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey;
      if (!Array.isArray(k) || k[0] !== 'signed-urls' || k[1] !== BUCKET) return false;
      const arr = k[2];
      if (!Array.isArray(arr)) return false;
      return (arr as string[]).some((p) => bustSet.has(p));
    },
  });
}

/**
 * Internal helper — returns a cached URL when fresh, joins an existing
 * inflight fetch when one is racing, otherwise issues a new
 * `createSignedUrl` and writes the result into the cache. Returns `null` only
 * when the fetch was implicitly cancelled by `clearSignedUrlCache()` or
 * `bustSignedUrlCache(path)` mid-flight (sign-out, render-complete bust) —
 * in those cases the result is no longer relevant and React Query shouldn't
 * retry. Throws on transport errors / timeouts / empty responses so React
 * Query treats them as failed queries and applies its retry-with-backoff
 * policy. Pre-2026-05-09 this returned `null` on every error path, which
 * React Query stored as a successful empty result and cached for the full
 * `staleTime` window — a single network blip during a list mount left every
 * thumbnail stuck on a gradient placeholder until the screen unmounted and
 * remounted. The throw-on-error contract is invisible to consumers because
 * `useGarmentImage` and the screens that call `useSignedUrl` directly all
 * use `data ?? null` semantics — `undefined` during retry behaves
 * identically to today's `null` (gradient placeholder renders, <Image>
 * stays unmounted) but unblocks React Query's retry path.
 */
export async function fetchAndCacheSignedUrl(path: string): Promise<string | null> {
  const key = cacheKey(BUCKET, path);
  const cached = urlCache.get(key);
  if (isFresh(cached)) return cached.url;

  const existing = inflight.get(key);
  if (existing) return existing;

  // Snapshot both the global session counter and this path's bust
  // counter BEFORE issuing the request. If `clearSignedUrlCache()` fires
  // while we're awaiting Supabase the global advances and our write is
  // dropped (sign-out leak guard). If `bustSignedUrlCache(qc, path)`
  // fires for this exact path mid-fetch (e.g. M1 render-complete on the
  // path we're already loading) the per-path counter advances and our
  // write is also dropped — without this, the pre-bust URL would
  // repopulate the cache after the bust intended to force a fresh fetch.
  const startedAtGeneration = cacheGeneration;
  const startedAtPathGen = pathGenerationFor(key);

  // Note: we do NOT thread the per-observer `AbortSignal` through here.
  // Multiple observers can join the same in-flight Promise via the
  // `inflight` Map, so wiring one observer's `signal?.aborted` short-
  // circuit into this IIFE would propagate that single observer's abort
  // (e.g. a fast-scrolled list cell unmounting) into every joined caller's
  // `query.data`, leaving them stuck on `null`. Instead the IIFE always
  // resolves to a real URL (or `null` on transport error) so joined
  // observers receive the value; React Query handles per-observer abort
  // externally. (Codex P2 round 2 on PR #729.)
  const promise = (async (): Promise<string | null> => {
    let response: CreateSignedUrlResponse;
    try {
      response = await withTimeout(
        supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRES_IN_SECONDS),
        FETCH_TIMEOUT_MS,
      );
    } catch (err) {
      // Network failure / timeout. Log so ops can spot systemic outages
      // (region down, mass 401 after token refresh, IPv6 misroute) and
      // rethrow so React Query's retry policy kicks in. Without this
      // throw, the queryFn would return `null` and React Query would
      // treat the failure as a successful empty result and cache it for
      // the full `staleTime` window.
      logSignedUrlFetchError(path, err);
      throw coerceFetchError(err, 'createSignedUrl failed');
    }
    const { data, error } = response;
    if (error || !data?.signedUrl) {
      // Supabase returned a structured error (RLS denial, object missing,
      // bucket misconfigured). Surface it to telemetry and throw — same
      // rationale as the catch above. The original soft-fail contract
      // (return null) cached the failure indefinitely; the throw lets
      // React Query retry with exponential backoff, and once it gives
      // up the consumer keeps rendering its gradient placeholder.
      logSignedUrlFetchError(path, error ?? 'createSignedUrl returned no signedUrl');
      throw coerceFetchError(error, 'createSignedUrl returned no signedUrl');
    }
    if (cacheGeneration !== startedAtGeneration) {
      // Sign-out happened mid-fetch — drop the result on the floor.
      // Returning `null` (not throwing) because the fetch was implicitly
      // cancelled by sign-out, not failed. React Query won't observe the
      // null because the consuming hook should already be unmounted or
      // re-rendered against a fresh user.
      return null;
    }
    if (pathGenerationFor(key) !== startedAtPathGen) {
      // This path was busted mid-fetch (e.g. render completed). The
      // URL we just minted predates the bust event; let the next
      // observe trigger a post-bust mint instead of latching this one.
      // Same throw-vs-null rationale as the sign-out path above —
      // implicit cancellation, not a transport failure.
      return null;
    }
    setCacheEntry(key, {
      url: data.signedUrl,
      expiresAt: Date.now() + TTL_MS,
    });
    return data.signedUrl;
  })();

  // The synchronous `inflight.set(key, promise)` below is guaranteed to
  // run before the IIFE's first `await` yields control — the IIFE body up
  // to that await runs synchronously as part of the IIFE call. Concurrent
  // callers that arrive during the network round-trip therefore see this
  // entry on the inflight map and join the same Promise instead of
  // issuing a duplicate request.
  inflight.set(key, promise);
  // Clear the inflight latch only if it's still ours — concurrent
  // `clearSignedUrlCache()` calls (e.g. mid-fetch sign-out) will have
  // already wiped the map; we shouldn't overwrite that.
  //
  // `.catch(() => {})` before `.finally(...)` exists to mute the derived
  // promise we observe purely for cleanup. The original `promise` is
  // returned to the caller (React Query's queryFn) which awaits it and
  // routes rejections into its own retry policy. Without the catch on
  // this derived promise we'd get an "unhandled promise rejection"
  // warning every time `fetchAndCacheSignedUrl` throws. Codex round-8
  // P2 (PR #884) — logging here would double-report failures that the
  // React Query consumer already handles via its retry/error policy.
  void promise
    .catch((_doubleReportSuppressed) => {
      // intentional: original promise's rejection is consumed by the
      // caller's await + RQ retry/error policy; logging here would create
      // duplicate Sentry events.
    })
    .finally(() => {
      if (inflight.get(key) === promise) {
        inflight.delete(key);
      }
    });
  return promise;
}

// Helpers for dynamic staleTime — read remaining lifetime from the module
// cache so React Query refetches just before the underlying URL expires.
const STALE_PAD_MS = 30 * 1000;
// Floor for the dynamic staleTime so a freshly-expired cache entry doesn't
// drop the value to 0 and trigger React Query's "every observation refetches"
// loop on flaky networks. 30s is short enough that an expired URL still
// refetches promptly but long enough to coalesce a burst of observers (list
// scroll, tab switch) into a single round-trip. Codex P2 round on PR #738.
const MIN_STALE_MS = 30 * 1000;

export function signedUrlStaleTimeFor(path: string | null | undefined): number {
  if (!path) return TTL_MS;
  const cached = urlCache.get(cacheKey(BUCKET, path));
  if (!cached) return TTL_MS; // queryFn hasn't populated yet — let it run.
  return Math.max(MIN_STALE_MS, cached.expiresAt - Date.now() - STALE_PAD_MS);
}

export function bulkSignedUrlsStaleTimeFor(paths: readonly string[]): number {
  if (paths.length === 0) return TTL_MS;
  let soonest = Infinity;
  for (const p of paths) {
    const cached = urlCache.get(cacheKey(BUCKET, p));
    if (!cached) return TTL_MS; // any missing entry — let queryFn run.
    if (cached.expiresAt < soonest) soonest = cached.expiresAt;
  }
  if (!Number.isFinite(soonest)) return TTL_MS;
  return Math.max(MIN_STALE_MS, soonest - Date.now() - STALE_PAD_MS);
}

// Snapshot the current cacheGeneration / per-path generation values for
// the bulk fetch path. Returned tuple is consumed verbatim by the bulk
// queryFn so the post-await write gate is identical to the single-path
// path's logic.
export function snapshotGenerations(misses: readonly string[]): {
  startedAtGeneration: number;
  startedAtPathGens: Map<string, number>;
} {
  const startedAtGeneration = cacheGeneration;
  const startedAtPathGens = new Map<string, number>();
  for (const p of misses) {
    startedAtPathGens.set(p, pathGenerationFor(cacheKey(BUCKET, p)));
  }
  return { startedAtGeneration, startedAtPathGens };
}

// Validate the bulk fetch's session-still-valid + per-path-still-valid
// gates. Centralizing the comparison so the queryFn doesn't have to read
// `cacheGeneration` / `pathGenerationFor` directly (those bindings stay
// module-private here).
export function isSessionStillValid(startedAtGeneration: number): boolean {
  return cacheGeneration === startedAtGeneration;
}

export function isPathStillValid(
  path: string,
  startedAtPathGens: Map<string, number>,
): boolean {
  return pathGenerationFor(cacheKey(BUCKET, path)) === startedAtPathGens.get(path);
}

export function commitBulkCacheEntry(path: string, url: string, expiresAt: number): void {
  setCacheEntry(cacheKey(BUCKET, path), { url, expiresAt });
}
