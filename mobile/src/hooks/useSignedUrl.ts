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

type CacheEntry = {
  url: string;
  expiresAt: number;
};

// Module-scope map. Lives for the lifetime of the JS bundle — survives
// navigation and remounts. Cleared explicitly on sign-out via
// `clearSignedUrlCache` (called by AuthContext).
const urlCache = new Map<string, CacheEntry>();

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
 * `createSignedUrl` and writes the result into the cache. Returns `null` on
 * any error (matches the existing soft-failure contract used by GarmentCard
 * et al., which render a gradient placeholder when the URL isn't available).
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
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, EXPIRES_IN_SECONDS);
    if (error || !data?.signedUrl) return null;
    if (cacheGeneration !== startedAtGeneration) {
      // Sign-out happened mid-fetch — drop the result on the floor.
      return null;
    }
    if (pathGenerationFor(key) !== startedAtPathGen) {
      // This path was busted mid-fetch (e.g. render completed). The
      // URL we just minted predates the bust event; let the next
      // observe trigger a post-bust mint instead of latching this one.
      return null;
    }
    urlCache.set(key, {
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
  void promise.finally(() => {
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

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(misses, EXPIRES_IN_SECONDS);
      if (error || !data) {
        // Soft-fail per-path so consumers render placeholders for the
        // missing entries instead of throwing the entire batch away.
        for (const p of misses) out[p] = null;
        return out;
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
            urlCache.set(cacheKey(BUCKET, p), { url, expiresAt });
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
// Retry budget resets only when `imagePath` changes (different garment) — NOT
// when `signedUrl` changes (re-mint succeeded). A naive reset on every URL
// change would create the bust → remint → error → bust → remint loop the
// budget exists to prevent.
const RETRY_BUDGET = 1;

export interface UseGarmentImageResult {
  /** Pass to `<Image source={{ uri }}>`. `null` while loading, after the
   *  retry budget is exhausted, or when no `imagePath` was provided.
   *  Consumers MUST render a gradient placeholder underneath so this null
   *  state stays visually graceful. */
  uri: string | null;
  /** Pass to `<Image onError>`. Logs a Sentry breadcrumb and busts the
   *  signed-URL cache for one re-mint attempt before giving up. Stable
   *  identity — safe to pass directly to `<Image>` without memoising. */
  onError: () => void;
}

export function useGarmentImage(
  imagePath: string | null | undefined,
): UseGarmentImageResult {
  const queryClient = useQueryClient();
  const { data: signedUrl } = useSignedUrl(imagePath);
  const [retries, setRetries] = React.useState(0);

  // Reset the retry budget only when the user navigates to a different
  // garment. Resetting on `signedUrl` change too would re-arm the bust loop
  // every time we successfully re-mint, defeating the budget on permanently-
  // broken paths.
  React.useEffect(() => {
    setRetries(0);
  }, [imagePath]);

  const giveUp = retries > RETRY_BUDGET;
  const uri = giveUp ? null : (signedUrl ?? null);

  const onError = React.useCallback(() => {
    if (__DEV__) {
      console.warn('[useGarmentImage] image load failed', { imagePath, retries });
    }
    Sentry.addBreadcrumb({
      category: 'image',
      level: 'warning',
      message: 'garment image load failed',
      data: { imagePath: imagePath ?? null, retries },
    });
    if (retries < RETRY_BUDGET && imagePath) {
      // First failure: invalidate the cached signed URL so the next
      // observe re-mints. `bustSignedUrlCache` clears the module Map,
      // bumps the per-path generation counter (so any in-flight mint
      // started before this bust is dropped), and invalidates React
      // Query — that triple-step is what makes the new URL actually
      // arrive on the next render rather than serving the stale entry.
      bustSignedUrlCache(queryClient, imagePath);
    }
    setRetries((r) => r + 1);
  }, [imagePath, retries, queryClient]);

  return { uri, onError };
}
