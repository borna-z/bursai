// Signed-URL hooks for the private `garments` bucket.
//
// M2 — TTL-aware in-memory cache. Wardrobe / outfits / used-garments lists
// render dozens of garment thumbnails per scroll; without a process-wide cache
// every re-render and every list mount issued a fresh `createSignedUrl`
// request. The web app solved this with `src/hooks/useSignedUrlCache.ts` — a
// module-scope `Map<bucket:path, { url, expiresAt }>` that survives navigation
// and dedupes concurrent fetches via in-flight Promise reuse. We port that
// here so React Query continues to drive React updates while the underlying
// `createSignedUrl` round-trips are bounded by the cache.
//
// Why a module-scope Map (not React Query alone):
//   • React Query caches per `queryKey` — `['signed-url', path]` already
//     dedupes within a single mount cycle, but a list that unmounts +
//     remounts (tab switch, navigation) re-runs the queryFn against a fresh
//     `signal` even though the URL is still valid. Module-scope memoisation
//     is independent of the query lifecycle.
//   • The bulk variant (`useSignedUrls`) batches misses into a single
//     `createSignedUrls` call — but that batch round-trip is wasted if the
//     same paths are already cached. Reading the module Map first lets the
//     bulk hook skip the batch entirely on a full-cache hit.
//
// TTL math: Supabase signed URLs expire after `EXPIRES_IN_SECONDS` (1 hour).
// We mark cache entries stale 10 minutes before that — `TTL_MS = 50 min` —
// so a URL pulled from cache always has at least 10 minutes of remaining
// validity. That covers the worst case where the consumer holds the URL,
// navigates away, comes back, and renders the <Image> against the same
// reference. (Matches web's pattern; web hard-coded 10 min in
// `useSignedUrlCache` but mobile errs longer because RN's image cache makes
// re-fetches more visibly disruptive than web's blob cache.)
//
// Cache lifecycle:
//   • Populated by either `useSignedUrl` (single) or `useSignedUrls` (bulk
//     batch). Both write the same `${bucket}:${path}` key shape.
//   • Cleared by `clearSignedUrlCache()` on `SIGNED_OUT` from `AuthContext`
//     (subscribed there alongside `queryClient.clear()`). User A's URLs must
//     not survive into user B's session on the same device, even if RLS would
//     reject the request — the URL itself contains a JWT and signed-URL
//     access can outlive the session token's revocation window.
//
// AbortController: React Query's `queryFn` receives `{ signal }` and we
// thread that through to the cache layer so a fast list scroll that unmounts
// rows mid-fetch doesn't wedge the inflight Promise — `supabase-js`'s
// `createSignedUrl` accepts `AbortSignal` via the underlying `fetch`.

import React from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';

const BUCKET = 'garments';
const EXPIRES_IN_SECONDS = 60 * 60; // signed URL TTL — 1 hour
const TTL_MS = 50 * 60 * 1000; // cache TTL — 10 min before signed URL expiry
// Hard ceiling on a single `createSignedUrl` round-trip. Without this a network
// stall on the storage endpoint could leave the inflight Promise pending
// forever, leaving every sharing observer wedged on `data === undefined` —
// which, before the throw-on-error contract below, was indistinguishable from
// a permanent `null` result. 15s is well above the p99 latency we see for the
// storage edge in eu-central-1 but short enough that the consumer's gradient
// placeholder doesn't stay up for a noticeably long time on a flaky network.
const FETCH_TIMEOUT_MS = 15 * 1000;

type CacheEntry = {
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
const urlCache = new Map<string, CacheEntry>();

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

function cacheKey(bucket: string, path: string): string {
  return `${bucket}:${path}`;
}

// Hoisted response types so the queryFns can reuse them without re-deriving
// the (3-deep) Awaited<ReturnType<...>> chain inline.
type CreateSignedUrlResponse = Awaited<
  ReturnType<ReturnType<typeof supabase.storage.from>['createSignedUrl']>
>;
type CreateSignedUrlsResponse = Awaited<
  ReturnType<ReturnType<typeof supabase.storage.from>['createSignedUrls']>
>;

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
class SignedUrlTimeoutError extends Error {
  constructor() {
    super('createSignedUrl timed out');
    this.name = 'SignedUrlTimeoutError';
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
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
function logSignedUrlFetchError(path: string, error: unknown): void {
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
function coerceFetchError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string' && m.length > 0) {
      return new Error(`createSignedUrl failed: ${m}`);
    }
  }
  return new Error(fallback);
}

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
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
async function fetchAndCacheSignedUrl(path: string): Promise<string | null> {
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
  // warning every time `fetchAndCacheSignedUrl` throws.
  void promise
    .catch(() => {
      /* rejection consumed by the caller's await; ignored here */
    })
    .finally(() => {
      if (inflight.get(key) === promise) {
        inflight.delete(key);
      }
    });
  return promise;
}

/**
 * Returns a React Query result whose `data` is the signed URL (or `null` if
 * the path is missing / the request failed). Cache hits short-circuit the
 * Supabase round-trip; cache misses populate the module-scope cache and
 * dedupe against any concurrent fetch for the same path.
 */
export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', BUCKET, path],
    queryFn: async () => {
      if (!path) return null;
      return fetchAndCacheSignedUrl(path);
    },
    enabled: !!path,
    // Cap freshness at the underlying signed URL's actual remaining
    // lifetime (less a 30 s pad so refetch can complete before the URL
    // 401s). A static `staleTime: TTL_MS` would start a fresh 50-min
    // window from each cache-hit observation, so a screen remounted near
    // the end of the module cache's TTL could keep serving the same URL
    // well past Supabase's 60-min expiry. (Codex P2 round 2 on PR #729.)
    staleTime: () => signedUrlStaleTimeFor(path),
  });
}

/**
 * Bulk variant for screens that show many garment images at once. Reads the
 * module-scope cache first, batches only the misses through `createSignedUrls`
 * (single round-trip), and merges the results back into the cache. On a
 * full-cache hit no network call is made.
 */
export function useSignedUrls(paths: (string | null | undefined)[]) {
  // Stable cache key so identical path lists hit the same query entry across
  // re-renders. De-duped + sorted so order/duplicates don't fragment the cache.
  const validPaths = paths.filter((p): p is string => Boolean(p));
  const sorted = Array.from(new Set(validPaths)).sort();

  return useQuery({
    queryKey: ['signed-urls', BUCKET, sorted],
    queryFn: async () => {
      if (sorted.length === 0) return {} as Record<string, string | null>;

      const out: Record<string, string | null> = {};
      const misses: string[] = [];
      for (const p of sorted) {
        const cached = urlCache.get(cacheKey(BUCKET, p));
        if (isFresh(cached)) {
          out[p] = cached.url;
        } else {
          misses.push(p);
        }
      }
      if (misses.length === 0) return out;

      // Snapshot the global generation AND each miss path's per-path
      // counter BEFORE the batch round-trip. Same rationale as the
      // single-fetch path: a sign-out clears the global; a render-bust
      // for any one of the misses bumps that path's counter; the
      // post-await per-entry write is gated on both staying unchanged.
      const startedAtGeneration = cacheGeneration;
      const startedAtPathGens = new Map<string, number>();
      for (const p of misses) {
        startedAtPathGens.set(p, pathGenerationFor(cacheKey(BUCKET, p)));
      }

      let response: CreateSignedUrlsResponse;
      try {
        response = await withTimeout(
          supabase.storage.from(BUCKET).createSignedUrls(misses, EXPIRES_IN_SECONDS),
          FETCH_TIMEOUT_MS,
        );
      } catch (err) {
        // Same throw-on-transport-error rationale as the single-URL path.
        // Pre-2026-05-09 this branch soft-failed every miss to `null`, which
        // React Query cached as a successful empty result for the full
        // `staleTime` — a flaky network on a list mount left the entire
        // grid stuck on gradient placeholders. Throwing routes the failure
        // through React Query's retry policy; the cache hits we already
        // populated above into `out` are discarded with the rejection,
        // which is correct because the next retry will re-read the cache
        // and re-batch only the still-missing paths.
        for (const p of misses) logSignedUrlFetchError(p, err);
        throw coerceFetchError(err, 'createSignedUrls failed');
      }
      const { data, error } = response;
      if (error || !data) {
        for (const p of misses) logSignedUrlFetchError(p, error ?? 'createSignedUrls returned no data');
        throw coerceFetchError(error, 'createSignedUrls returned no data');
      }

      const sessionStillValid = cacheGeneration === startedAtGeneration;
      const expiresAt = Date.now() + TTL_MS;
      for (const entry of data) {
        const p = entry.path ?? '';
        const url = entry.signedUrl ?? null;
        if (url) {
          const pathStillValid =
            pathGenerationFor(cacheKey(BUCKET, p)) === startedAtPathGens.get(p);
          if (sessionStillValid && pathStillValid) {
            setCacheEntry(cacheKey(BUCKET, p), { url, expiresAt });
          }
          out[p] = url;
        } else {
          out[p] = null;
        }
      }
      // Defensive: any miss not in the response gets explicit null so the
      // returned record is total over `sorted`.
      for (const p of misses) {
        if (!(p in out)) out[p] = null;
      }
      return out;
    },
    enabled: sorted.length > 0,
    // Cap freshness at the soonest-expiring URL in the batch (less a 30 s
    // pad). Same rationale as the single-URL hook — a static `TTL_MS` would
    // outlive the underlying signed URLs on long-lived list mounts.
    staleTime: () => bulkSignedUrlsStaleTimeFor(sorted),
  });
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

function signedUrlStaleTimeFor(path: string | null | undefined): number {
  if (!path) return TTL_MS;
  const cached = urlCache.get(cacheKey(BUCKET, path));
  if (!cached) return TTL_MS; // queryFn hasn't populated yet — let it run.
  return Math.max(MIN_STALE_MS, cached.expiresAt - Date.now() - STALE_PAD_MS);
}

function bulkSignedUrlsStaleTimeFor(paths: readonly string[]): number {
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

// `useGarmentImage` — shared hook for every component that renders a garment
// image on top of a gradient placeholder (GarmentCard, OutfitSlotRow,
// OutfitsScreen, OutfitDetailScreen). Encapsulates three behaviours that were
// previously duplicated (and silently broken) at every call site:
//
//   1. <Image> `onError` was a no-op `setBroken(true)` — failures were
//      invisible, so a stale signed URL could leave every garment thumbnail
//      stuck on a coloured gradient with no telemetry. Now: a Sentry
//      breadcrumb is logged on every load failure so dashboards can spot the
//      systemic-failure case (RLS denial after re-auth, region outage,
//      mass-401 on token refresh) instead of hearing about it through user
//      reports of "everything's a colour card."
//   2. No retry. A 401/404 on a stale signed URL stayed broken until the
//      consumer scrolled the row out and back in (forcing a remount). Now:
//      the first failure busts the per-path module cache via
//      `bustSignedUrlCache`, which invalidates React Query and forces a
//      fresh `createSignedUrl` mint — the new URL replaces the stale one in
//      the same mount cycle.
//   3. No retry budget. A genuinely-permanently-broken path (object deleted
//      from storage, RLS rejecting after an account move) would loop forever
//      under (2) without a budget. Now: one retry per garment, then we
//      surrender and the consumer renders the gradient placeholder.
//
// Cap on own-initiated cache busts per garment. After this many failures we
// stop busting from inside this hook — further attempts have to come from
// outside (render-complete bust, sign-in refresh, TTL refetch). This caps
// the bust → remint → fail → bust loop on a genuinely-broken path.
//
// We do NOT use this as a "give up forever" counter — that would lock the
// gradient on permanently even after an external event mints a genuinely-
// different URL that might work. Instead we track *which URLs have failed*
// and only suppress those specific URLs; any fresh URL from outside still
// gets one shot. (Codex P2 round 2 on PR #774.)
const RETRY_BUDGET = 1;

// FIFO cap on the per-mount failed-URL ledger. The hook accepts unbounded
// fresh URLs from external busts — over a long-lived screen mount that
// could grow without bound on a permanently-broken path (TTL refetches +
// render-complete busts each minting a new URL). Cap the ledger so the
// per-render `includes` check stays O(1)-ish and React state doesn't carry
// arbitrarily long arrays. 8 is plenty: the only realistic way to fill it
// is N consecutive minted-and-failed URLs, which already implies the
// thumbnail is broken — at that point dropping the oldest entry just
// retries it, and either it works (good) or fails again (we record it
// again). 8 strikes a balance between bounded memory and not so small
// that we constantly re-test the same handful of failed URLs.
const FAILED_URL_CAP = 8;

// Hoisted empty array reused as initial state across every cell mount, so
// we don't allocate a fresh `[]` per <Image>. (Self-review P2 on PR #774.)
const EMPTY_FAILED_URLS: readonly string[] = [];

export interface UseGarmentImageResult {
  /** Pass to `<Image source={{ uri }}>`. `null` while loading, when the
   *  current signed URL is one that has already failed for this garment,
   *  or when no `imagePath` was provided. Consumers MUST render a gradient
   *  placeholder underneath so this null state stays visually graceful. */
  uri: string | null;
  /** Pass to `<Image onError>`. Logs a Sentry breadcrumb and busts the
   *  signed-URL cache for up to `RETRY_BUDGET` re-mint attempts. Identity
   *  is NOT stable — `useCallback` deps include `failedUrls` and `signedUrl`
   *  so a fresh function lands on every re-render where either changes.
   *  RN's `<Image>` doesn't remount on `onError` prop identity changes, so
   *  this isn't a perf concern, but a downstream memoiser MUST NOT rely on
   *  reference equality. */
  onError: () => void;
  /** True iff a path was provided AND the signed-URL fetch has not yet
   *  settled (no data and no error yet, OR React Query is actively retrying
   *  in the background). False once the URL has resolved successfully, once
   *  React Query has surrendered after its retry budget, or once the image
   *  itself has failed to load past `RETRY_BUDGET` (in which case `uri` is
   *  permanently `null` for this mount). Consumers use this to gate loading-
   *  affordances like Shimmer overlays — without it, a settled-but-failed
   *  state is indistinguishable from "still loading" because both surface as
   *  `uri === null`, and a Shimmer keyed on `uri == null` would animate
   *  forever on a broken path. (Codex P2 round 1 on PR #786.) */
  isResolving: boolean;
}

export function useGarmentImage(
  imagePath: string | null | undefined,
): UseGarmentImageResult {
  const queryClient = useQueryClient();
  const { data: signedUrl, isError, fetchStatus } = useSignedUrl(imagePath);
  // URLs that have failed to load in this mount cycle for this garment.
  // Suppresses any of these URLs from being handed back to <Image> if React
  // Query happens to serve the same value again (which it does between an
  // onError and the post-bust refetch completing — TanStack keeps `data`
  // populated during refetch). Cleared only on `imagePath` change. Storing
  // an array rather than a Set keeps state value-equal across renders so
  // React's structural sharing skips unnecessary re-renders.
  const [failedUrls, setFailedUrls] = React.useState<readonly string[]>(
    EMPTY_FAILED_URLS,
  );
  // Synchronous in-tick dedupe ledger. State updates batch, so the closure-
  // captured `failedUrls.includes(signedUrl)` check is render-stale: RN can
  // fire onError twice in the same tick (the comment below documents this)
  // and both invocations would see the same captured array, both pass the
  // inclusion gate, both log a Sentry breadcrumb, and both call
  // `bustSignedUrlCache` — defeating the dedupe. The ref is updated
  // synchronously inside onError BEFORE any side effects, so the second
  // invocation in the same tick bails. Mirrored to `failedUrls` state so
  // `isKnownFailed` recomputes after the commit. (Self-review round 2 on
  // PR #774.)
  const failedUrlsRef = React.useRef<Set<string>>(new Set());
  // Track which `imagePath` the ledger belongs to so a late onError fired
  // by a recycled FlatList cell after the parent re-bound to a different
  // garment can't write into the new garment's ledger or bust the new
  // garment's cache. (Self-review round 2 on PR #774.)
  const ledgerImagePathRef = React.useRef<string | null | undefined>(imagePath);

  // Reset the failed-URL set only when the user navigates to a different
  // garment. Resetting on `signedUrl` change too would un-suppress the URL
  // we just recorded as failed — TanStack still serves it during the post-
  // bust refetch window — and <Image> would re-fire onError on an unchanged
  // source, growing the set without progress.
  React.useEffect(() => {
    failedUrlsRef.current = new Set();
    ledgerImagePathRef.current = imagePath;
    setFailedUrls(EMPTY_FAILED_URLS);
  }, [imagePath]);

  const isKnownFailed = signedUrl != null && failedUrls.includes(signedUrl);
  const uri = isKnownFailed ? null : (signedUrl ?? null);
  // `isResolving` distinguishes "fetch still in flight" from "fetch settled
  // but no usable URI" so loading affordances (Shimmer in OutfitCard) can
  // turn off once we've reached a terminal state on a permanently-broken
  // path. A path is resolving when (a) we have a path at all and the query
  // is enabled — `fetchStatus !== 'idle'` filters out the no-path case
  // where the query is disabled — AND (b) one of: still actively fetching,
  // or no data has arrived yet without a recorded error. Once React Query
  // surrenders (`isError` true after retry budget), or the URL has loaded
  // and the <Image> has reported failure past `RETRY_BUDGET`
  // (`isKnownFailed` true), or we have a usable signed URL (`uri` non-null),
  // the slot is settled and consumers can stop the shimmer.
  const isResolving =
    imagePath != null &&
    fetchStatus !== 'idle' &&
    !isError &&
    !isKnownFailed &&
    signedUrl == null;

  const onError = React.useCallback(() => {
    if (!signedUrl) return;
    // Bail if a FlatList recycle has rebound this hook to a different
    // garment while an old <Image> request is still in flight. Without
    // this, the in-flight load's late onError would (a) grow the new
    // garment's ledger with an unrelated URL and (b) bust the new
    // imagePath's cache wastefully.
    if (ledgerImagePathRef.current !== imagePath) return;
    // In-tick dedupe via ref. Returns synchronously so a same-tick repeat
    // doesn't run side effects twice; the ref is mirrored to state below
    // so `isKnownFailed` updates render-time on the next commit.
    if (failedUrlsRef.current.has(signedUrl)) return;
    failedUrlsRef.current.add(signedUrl);
    const attempts = failedUrlsRef.current.size - 1;
    if (__DEV__) {
      console.warn('[useGarmentImage] image load failed', { imagePath, attempts });
    }
    Sentry.addBreadcrumb({
      category: 'image',
      level: 'warning',
      message: 'garment image load failed',
      data: { imagePath: imagePath ?? null, attempts },
    });
    // Cap own-initiated cache busts at RETRY_BUDGET. After that we stop
    // busting from inside the hook — but we keep the per-URL failed set
    // active, so any fresh signed URL minted by external means (render-
    // complete bust, sign-in refresh, TTL refetch) still gets one shot
    // through `isKnownFailed === false`.
    if (attempts < RETRY_BUDGET && imagePath) {
      // Invalidate the cached signed URL so the next observe re-mints.
      // `bustSignedUrlCache` clears the module Map, bumps the per-path
      // generation counter (so any in-flight mint started before this
      // bust is dropped), and invalidates React Query — that triple-step
      // is what makes the new URL actually arrive on the next render
      // rather than serving the stale entry.
      bustSignedUrlCache(queryClient, imagePath);
    }
    // Append, capped FIFO at FAILED_URL_CAP so external busts on a
    // permanently-broken path can't grow the ledger unbounded over a
    // long-lived screen mount. (Self-review P1 round 1 on PR #774.)
    // The state update only drives `isKnownFailed`; the authoritative
    // dedupe ledger is the ref above.
    setFailedUrls((prev) => {
      const next = [...prev, signedUrl];
      return next.length > FAILED_URL_CAP ? next.slice(-FAILED_URL_CAP) : next;
    });
  }, [imagePath, queryClient, signedUrl]);

  return { uri, onError, isResolving };
}
