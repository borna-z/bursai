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
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';
import {
  BUCKET,
  EXPIRES_IN_SECONDS,
  FETCH_TIMEOUT_MS,
  TTL_MS,
  bulkSignedUrlsStaleTimeFor,
  bustSignedUrlCache,
  cacheKey,
  coerceFetchError,
  commitBulkCacheEntry,
  fetchAndCacheSignedUrl,
  isFresh,
  isPathStillValid,
  isSessionStillValid,
  logSignedUrlFetchError,
  signedUrlStaleTimeFor,
  snapshotGenerations,
  urlCache,
  withTimeout,
  type CreateSignedUrlsResponse,
} from './useSignedUrl.helpers';

export { bustSignedUrlCache, clearSignedUrlCache } from './useSignedUrl.helpers';

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
      const { startedAtGeneration, startedAtPathGens } = snapshotGenerations(misses);

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

      const sessionStillValid = isSessionStillValid(startedAtGeneration);
      const expiresAt = Date.now() + TTL_MS;
      for (const entry of data) {
        const p = entry.path ?? '';
        const url = entry.signedUrl ?? null;
        if (url) {
          const pathStillValid = isPathStillValid(p, startedAtPathGens);
          if (sessionStillValid && pathStillValid) {
            commitBulkCacheEntry(p, url, expiresAt);
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
