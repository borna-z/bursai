// useImportFromLinks — M20 hook around the deployed
// `import_garments_from_links` edge function.
//
// **Contract reality (verified against
// `supabase/functions/import_garments_from_links/index.ts`):**
//   The function is a one-shot scrape + persist. Per URL it: fetches the
//   page HTML, extracts JSON-LD Product → og:image → twitter:image →
//   og:title → <title>, downloads the cover image, uploads it to the
//   `garments` Storage bucket, and INSERTs a `garments` row with default
//   `category: 'top'` + `color_primary: 'grey'` + `imported_via: 'link'`.
//   The user is expected to refine the row inline from GarmentDetail /
//   EditGarment afterwards.
//
//   Request body: `{ userId: string, urls: string[] }` (max 30 urls).
//   Response: `{
//     results: Array<{
//       url: string,
//       status: 'ok' | 'failed',
//       garment_id?: string,
//       title?: string,
//       image_path?: string,
//       reason?: string,
//     }>,
//     summary: { total, success, failed }
//   }`.
//
// **Why no client-side proposal/confirm screen:** the deployed function
// already commits the garment row before returning — there's no
// "proposal" stage to surface to the user. The wave file's "user
// confirms" copy describes an aspirational flow that would require
// changing the edge function (out of M20 scope per CLAUDE.md "no new
// edge functions"). We mirror the web `LinkImportForm.tsx` pattern
// instead: per-URL status timeline, inline error captions, and a tap-
// through to the saved garment for refinement.
//
// **Batched-by-5 dispatch (Codex round 1 P1.4):** the deployed function
// processes URLs serially server-side and a single page-fetch can take
// 10+ seconds. Sending one URL per request capped wall-clock at
// `30 * round-trip` for a full batch (5+ minutes worst case). We now
// batch URLs in groups of 5 per server call and fan the per-URL results
// back into individual rows. Trade-off: progress is updated per-batch
// (5-row chunks flip together) instead of per-row, but worst-case
// wall-clock drops to `6 * round-trip`. Each batch stays well under the
// 90 s edge-function budget.
//
// Standard pattern from `useVisualSearch` / `usePhotoFeedback`:
// AbortController per call, unmount cleanup via ref + abort in
// useEffect teardown, EdgeFunctionSubscriptionLockedError →
// `'subscription_required'` sentinel for paywall surfacing,
// EdgeFunctionHttpError → parsed body `error` field or `HTTP <status>`
// fallback, Sentry capture skips the paywall sentinel + caller aborts.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';
/** Per-batch ceiling. Server enforces the same limit (`urls.length > 30`
 * → 400) at `import_garments_from_links/index.ts:316`. We surface a
 * client-side guard so a paste of 200 URLs doesn't hit the wire. */
export const MAX_LINKS_PER_BATCH = 30;
/** URLs per server call. The deployed function loops internally; sending
 * 5 at a time keeps each round-trip well under the 90 s edge budget while
 * cutting the worst-case wall-clock from `30 * RTT` (per-URL) down to
 * `6 * RTT` (Codex round 1 P1.4). */
const URLS_PER_REQUEST = 5;

/** Per-URL status surfaced to the consumer. Mirrors the web
 * `LinkItem.status` shape so the screen layer can render a familiar
 * timeline. */
export type ImportStatus = 'waiting' | 'importing' | 'success' | 'failed';

/**
 * One row in the import timeline. The screen renders these as a list;
 * `status === 'success'` rows expose a `garment_id` and `title` for tap-
 * through to GarmentDetail; `status === 'failed'` rows expose `error`
 * for inline diagnostic copy. Stable `id` is the trimmed URL itself —
 * the function rejects empty / invalid URLs upstream so a non-empty
 * trimmed URL is unique within a single batch (the function also
 * de-dupes on `source_url` against the user's existing wardrobe via the
 * Set built at `import_garments_from_links/index.ts:330`).
 */
export interface ImportItem {
  /** React list key — also the user-pasted URL after `.trim()`. */
  id: string;
  /** Same as `id`, surfaced separately for clarity at call sites. */
  url: string;
  status: ImportStatus;
  /** Set when status === 'success'. Lets the screen route a tap to
   * GarmentDetail without an extra DB lookup. */
  garment_id?: string;
  /** Title extracted from the scraped page (JSON-LD Product `name` →
   * og:title → <title>). The function falls back to "Imported garment"
   * server-side if everything is missing — that fallback flows through
   * here unchanged. */
  title?: string;
  /** Storage path under the `garments` bucket. Useful for thumbnail
   * display via `useSignedUrl`. */
  image_path?: string;
  /** User-facing failure copy. Examples from the function:
   * "Already imported", "No image found", "HTTP 403",
   * "Timeout - page did not respond", "Image URL blocked". */
  error?: string;
  /** Cached hostname derived from `url` at adapt time so the screen
   * doesn't re-parse the URL every render (Codex round 1 P3.2). Falls
   * back to the raw URL if parsing fails. */
  displayHost?: string;
}

export interface UseImportFromLinksResult {
  items: ImportItem[];
  /** True while at least one URL is being processed. Drives the
   * "Looking up X links…" spinner copy on the screen. */
  isImporting: boolean;
  /** 1-indexed position within the active batch — drives the
   * "X of Y" copy on the importing button. Zero when idle. */
  currentIndex: number;
  /** Total count of URLs in the active batch. Drives the "X of Y" copy
   * on the importing button. Zero when idle. */
  totalCount: number;
  /** Top-level error — surfaces non-per-URL failures (auth, paywall,
   * circuit open, etc.). Per-URL failures live on the matching
   * `items[].error` field. */
  error: string | null;
  submit: (urls: string[]) => Promise<void>;
  reset: () => void;
}

// Open-ended response type — defensive accessors handle every field.
type DeployedImportResponse = {
  results?: unknown;
  summary?: unknown;
  error?: string;
};

type DeployedResultRow = {
  url?: unknown;
  status?: unknown;
  garment_id?: unknown;
  title?: unknown;
  image_path?: unknown;
  reason?: unknown;
};

/** Compute a hostname for display from a URL string. Falls back to the
 * raw URL if `new URL(...)` rejects. Centralised so both the hook (cache
 * at adapt time) and any defensive consumer can reuse the same logic. */
function deriveDisplayHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Validate + de-dupe a list of URL strings. Used by both `parseUrlList`
 * (the textarea helper) and `submit` (the hook's last-line defence so a
 * caller that bypasses the helper still gets the same guarantees). The
 * https-only filter matches the M19 web-match guard precedent at
 * `mobile/src/i18n/locales/en.ts:visualSearch.invalidWebUrl`. (Codex round 1
 * P3.1.) */
function validateAndDedupeUrls(input: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const candidate of input) {
    const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
    if (trimmed.length === 0) continue;
    if (!trimmed.startsWith('https://')) continue;
    if (seen.has(trimmed)) continue;
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:') continue;
    if (!parsed.hostname || parsed.hostname.length === 0) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Parse a multi-line textarea into a clean URL list. Mirrors the web
 * helper at `src/components/LinkImportForm.tsx:44-49` — split on
 * newlines, then run through `validateAndDedupeUrls` to apply the
 * https-only + de-dupe guarantees.
 */
export function parseUrlList(text: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  return validateAndDedupeUrls(text.split('\n'));
}

/** Adapt one `results[]` entry into an `ImportItem`. Defensive across
 * every field; rows that don't have a usable URL are dropped (the
 * server shouldn't emit them but a malformed payload shouldn't crash
 * the screen). */
function adaptResultRow(raw: DeployedResultRow): ImportItem | null {
  const urlRaw = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (urlRaw.length === 0) return null;
  const statusRaw = typeof raw.status === 'string' ? raw.status : '';
  const status: ImportStatus = statusRaw === 'ok' ? 'success' : 'failed';
  const item: ImportItem = {
    id: urlRaw,
    url: urlRaw,
    status,
    displayHost: deriveDisplayHost(urlRaw),
  };
  if (status === 'success') {
    if (typeof raw.garment_id === 'string' && raw.garment_id.trim().length > 0) {
      item.garment_id = raw.garment_id.trim();
    }
    if (typeof raw.title === 'string' && raw.title.trim().length > 0) {
      item.title = raw.title.trim();
    }
    if (typeof raw.image_path === 'string' && raw.image_path.trim().length > 0) {
      item.image_path = raw.image_path.trim();
    }
  } else if (typeof raw.reason === 'string' && raw.reason.trim().length > 0) {
    item.error = raw.reason.trim();
  }
  return item;
}

export function useImportFromLinks(): UseImportFromLinksResult {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Mounted latch — flipped false in the unmount cleanup so any post-await
  // setState that resolves after the consumer leaves the screen is a no-op.
  // Codex round 1 P2.2.
  const isMountedRef = useRef(true);

  const submit = useCallback(
    async (urls: string[]) => {
      if (!user || !session?.access_token) {
        if (isMountedRef.current) setError('Not authenticated');
        return;
      }

      // Re-validate inside the hook so a caller that builds the URL list
      // without going through `parseUrlList` (or a test harness) still
      // gets the https-only + de-dupe guarantees. (Codex round 1 P3.1
      // — shared helper.)
      const cleaned = validateAndDedupeUrls(urls).slice(0, MAX_LINKS_PER_BATCH);

      if (cleaned.length === 0) {
        if (isMountedRef.current) setError('invalid_url');
        return;
      }

      // Cancel any in-flight call so a re-submit doesn't race the prior
      // batch.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Seed the timeline with the staged URLs in 'waiting' state so the
      // user sees the full list immediately and watches each row flip.
      // Pre-compute `displayHost` once so the screen never re-parses
      // `new URL(item.url)` on every render. Codex round 1 P3.2.
      const initial: ImportItem[] = cleaned.map((u) => ({
        id: u,
        url: u,
        status: 'waiting' as ImportStatus,
        displayHost: deriveDisplayHost(u),
      }));
      if (!isMountedRef.current) return;
      setItems(initial);
      setError(null);
      setIsImporting(true);
      setCurrentIndex(0);
      setTotalCount(cleaned.length);

      let anySuccess = false;
      let topLevelError: string | null = null;

      // Helper: gate every post-await setState on (a) the active controller
      // not being superseded by a later `submit()` (Codex round 1 P1.2),
      // (b) the controller not being aborted (P1.1), and (c) the consumer
      // still being mounted (P2.2). Returning false means the caller
      // should bail before touching state.
      const isCurrentBatch = () =>
        isMountedRef.current &&
        !controller.signal.aborted &&
        abortRef.current === controller;

      try {
        for (let batchStart = 0; batchStart < cleaned.length; batchStart += URLS_PER_REQUEST) {
          if (!isCurrentBatch()) return;
          const batchUrls = cleaned.slice(batchStart, batchStart + URLS_PER_REQUEST);
          // Update progress to the first URL in this batch — the UI
          // shows "X of Y" which advances per-batch now (Codex round 1
          // P1.4 trade-off documented at file head).
          setCurrentIndex(batchStart + 1);
          // Flip every row in this batch to 'importing' before the
          // round-trip so the spinner shows on each pending row.
          const batchUrlSet = new Set(batchUrls);
          setItems((prev) =>
            prev.map((row) =>
              batchUrlSet.has(row.url) ? { ...row, status: 'importing' } : row,
            ),
          );

          let response: DeployedImportResponse | null = null;
          let batchError: string | null = null;
          try {
            response = await callEdgeFunction<DeployedImportResponse>(
              'import_garments_from_links',
              {
                body: {
                  // Function reads `user.id` from the verified JWT
                  // server-side, but the request body shape still
                  // requires `userId` (typed as `ImportRequest`). Sending
                  // the matching value keeps any future cross-check
                  // server-side honest.
                  userId: user.id,
                  urls: batchUrls,
                },
                signal: controller.signal,
              },
            );
          } catch (callErr) {
            // First and foremost — if the controller was aborted, swallow
            // the rejection silently. This catches BOTH DOMException
            // AbortError AND RN's TypeError "Network request aborted"
            // variant that the underlying fetch surfaces. Codex round 1
            // P1.1.
            if (controller.signal.aborted) return;
            // Top-level failure modes — surface immediately and stop
            // the batch (no point burning the next URL on the same
            // auth failure).
            if (callErr instanceof EdgeFunctionSubscriptionLockedError) {
              topLevelError = SUBSCRIPTION_SENTINEL;
              break;
            }
            if (callErr instanceof EdgeFunctionHttpError) {
              const parsed = (() => {
                try {
                  return JSON.parse(callErr.bodyText) as { error?: string };
                } catch {
                  return null;
                }
              })();
              const parsedErr = parsed?.error;
              // Per-batch paywall envelope — the wrapper normally throws
              // EdgeFunctionSubscriptionLockedError on 402, but if the
              // server ever surfaces the sentinel through an HTTP body
              // instead, propagate it as a global paywall (not a per-row
              // failure). Codex round 1 P1.3.
              if (parsedErr === SUBSCRIPTION_SENTINEL) {
                topLevelError = SUBSCRIPTION_SENTINEL;
                break;
              }
              batchError = parsedErr ?? `HTTP ${callErr.status}`;
            } else {
              batchError =
                callErr instanceof Error ? callErr.message : 'Could not import this link';
              if (batchError !== SUBSCRIPTION_SENTINEL) {
                Sentry.withScope((s) => {
                  s.setTag('mutation', 'useImportFromLinks.callEdge');
                  Sentry.captureException(callErr);
                });
              }
            }
          }

          if (!isCurrentBatch()) return;

          if (batchError !== null) {
            const failureCopy = batchError;
            setItems((prev) =>
              prev.map((row) =>
                batchUrlSet.has(row.url)
                  ? { ...row, status: 'failed', error: failureCopy }
                  : row,
              ),
            );
            setCurrentIndex(Math.min(batchStart + batchUrls.length, cleaned.length));
            continue;
          }

          // Top-level body-shape error (function emitted `{ error: '...' }`
          // with status 200 — rare, but the body parser surfaces it).
          if (response?.error) {
            // Same paywall propagation as the HTTP-body case above —
            // global, not per-row. Codex round 1 P1.3.
            if (response.error === SUBSCRIPTION_SENTINEL) {
              topLevelError = SUBSCRIPTION_SENTINEL;
              break;
            }
            const bodyErr = response.error;
            setItems((prev) =>
              prev.map((row) =>
                batchUrlSet.has(row.url) ? { ...row, status: 'failed', error: bodyErr } : row,
              ),
            );
            setCurrentIndex(Math.min(batchStart + batchUrls.length, cleaned.length));
            continue;
          }

          const resultsRaw = Array.isArray(response?.results) ? response?.results : [];
          // Build URL → adapted-row map so we can fan results back into
          // the matching timeline rows in O(n) regardless of server order.
          const adaptedByUrl = new Map<string, ImportItem>();
          for (const raw of resultsRaw) {
            const adapted = adaptResultRow(raw as DeployedResultRow);
            if (adapted) adaptedByUrl.set(adapted.url, adapted);
          }

          let batchAnySuccess = false;
          setItems((prev) =>
            prev.map((row) => {
              if (!batchUrlSet.has(row.url)) return row;
              const matched = adaptedByUrl.get(row.url);
              if (!matched) {
                return { ...row, status: 'failed', error: 'No response from importer' };
              }
              if (matched.status === 'success') batchAnySuccess = true;
              // Preserve the original row's `id` (already the URL) and
              // the pre-computed `displayHost`; everything else flows
              // from the server response.
              return { ...matched, id: row.id };
            }),
          );
          if (batchAnySuccess) anySuccess = true;
          setCurrentIndex(Math.min(batchStart + batchUrls.length, cleaned.length));
        }
      } finally {
        if (isMountedRef.current && abortRef.current === controller) {
          setIsImporting(false);
          if (controller.signal.aborted) {
            // Reset progress counters on abort so a re-submit starts clean.
            setCurrentIndex(0);
            setTotalCount(0);
          }
        }
      }

      if (!isCurrentBatch() && topLevelError === null) return;

      if (topLevelError !== null) {
        if (isMountedRef.current) setError(topLevelError);
        return;
      }

      if (anySuccess) {
        // Mirror useAddGarment's invalidation set so every wardrobe
        // surface picks up the new rows immediately.
        queryClient.invalidateQueries({ queryKey: ['garments'] });
        queryClient.invalidateQueries({ queryKey: ['garments-count'] });
        queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
      }
    },
    [user, session?.access_token, queryClient],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setItems([]);
    setIsImporting(false);
    setCurrentIndex(0);
    setTotalCount(0);
    setError(null);
  }, []);

  // Mount-lifetime cleanup — abort an in-flight batch when the consumer
  // unmounts (typical case: user backs out of the screen mid-import) and
  // flip the mounted latch so any post-await setState becomes a no-op
  // (Codex round 1 P2.2). Mirrors every other M9-era hook.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  return {
    items,
    isImporting,
    currentIndex,
    totalCount,
    error,
    submit,
    reset,
  };
}
