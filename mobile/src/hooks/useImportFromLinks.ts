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
// **Sequential per-URL processing:** the deployed function happily
// accepts `urls: string[]` up to 30 in a single call, but processes
// them serially server-side — and a single page-fetch can take 10+
// seconds. Sending one URL per request lets the UI update progress
// smoothly and keeps each round-trip well under the 90 s edge-function
// budget. Matches the web flow at
// `src/components/LinkImportForm.tsx:99-132`.
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
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';

const SUBSCRIPTION_SENTINEL = 'subscription_required';
/** Per-batch ceiling. Server enforces the same limit (`urls.length > 30`
 * → 400) at `import_garments_from_links/index.ts:316`. We surface a
 * client-side guard so a paste of 200 URLs doesn't hit the wire. */
export const MAX_LINKS_PER_BATCH = 30;

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

/**
 * Parse a multi-line textarea into a clean URL list. Mirrors the web
 * helper at `src/components/LinkImportForm.tsx:44-49` — split on
 * newlines, trim, drop empties, drop lines that don't begin with the
 * https:// allowlist. The web filter accepts http:// too; we tighten
 * to https-only to match the M19 web-match guard precedent
 * (`mobile/src/i18n/en.ts:visualSearch.invalidWebUrl`).
 */
export function parseUrlList(text: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (!line.startsWith('https://')) continue;
    if (seen.has(line)) continue;
    // `new URL(...)` parse — rejects malformed inputs (missing host,
    // invalid escapes, etc.) before they go on the wire. Catches
    // lines like `https://` (no host) that pass the prefix check.
    let parsed: URL;
    try {
      parsed = new URL(line);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:') continue;
    if (!parsed.hostname || parsed.hostname.length === 0) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
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

  const submit = useCallback(
    async (urls: string[]) => {
      if (!user || !session?.access_token) {
        setError('Not authenticated');
        return;
      }

      // Re-validate inside the hook so a caller that builds the URL list
      // without going through `parseUrlList` (or a test harness) still
      // gets the https-only + de-dupe guarantees.
      const cleaned: string[] = [];
      const seen = new Set<string>();
      for (const candidate of urls) {
        const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
        if (trimmed.length === 0) continue;
        if (!trimmed.startsWith('https://')) continue;
        if (seen.has(trimmed)) continue;
        try {
          const parsed = new URL(trimmed);
          if (parsed.protocol !== 'https:') continue;
          if (!parsed.hostname || parsed.hostname.length === 0) continue;
        } catch {
          continue;
        }
        seen.add(trimmed);
        cleaned.push(trimmed);
        if (cleaned.length >= MAX_LINKS_PER_BATCH) break;
      }

      if (cleaned.length === 0) {
        setError('invalid_url');
        return;
      }

      // Cancel any in-flight call so a re-submit doesn't race the prior
      // batch.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Seed the timeline with the staged URLs in 'waiting' state so the
      // user sees the full list immediately and watches each row flip.
      const initial: ImportItem[] = cleaned.map((u) => ({
        id: u,
        url: u,
        status: 'waiting' as ImportStatus,
      }));
      setItems(initial);
      setError(null);
      setIsImporting(true);
      setCurrentIndex(0);
      setTotalCount(cleaned.length);

      let anySuccess = false;
      let topLevelError: string | null = null;

      try {
        for (let i = 0; i < cleaned.length; i++) {
          if (controller.signal.aborted) return;
          setCurrentIndex(i + 1);
          // Flip the active row to 'importing' before we start the
          // round-trip so the UI shows the spinner on the right line.
          setItems((prev) =>
            prev.map((row, idx) => (idx === i ? { ...row, status: 'importing' } : row)),
          );

          let response: DeployedImportResponse | null = null;
          let perUrlError: string | null = null;
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
                  urls: [cleaned[i]],
                },
                signal: controller.signal,
              },
            );
          } catch (callErr) {
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
              perUrlError = parsed?.error ?? `HTTP ${callErr.status}`;
            } else if (
              callErr &&
              typeof callErr === 'object' &&
              (callErr as { name?: string }).name === 'AbortError'
            ) {
              return;
            } else {
              perUrlError =
                callErr instanceof Error ? callErr.message : 'Could not import this link';
              if (perUrlError !== SUBSCRIPTION_SENTINEL) {
                Sentry.withScope((s) => {
                  s.setTag('mutation', 'useImportFromLinks.callEdge');
                  Sentry.captureException(callErr);
                });
              }
            }
          }

          if (controller.signal.aborted) return;

          if (perUrlError !== null) {
            setItems((prev) =>
              prev.map((row, idx) =>
                idx === i
                  ? { ...row, status: 'failed', error: perUrlError ?? 'Could not import' }
                  : row,
              ),
            );
            continue;
          }

          // Top-level body-shape error (function emitted `{ error: '...' }`
          // with status 200 — rare, but the body parser surfaces it).
          if (response?.error) {
            setItems((prev) =>
              prev.map((row, idx) =>
                idx === i ? { ...row, status: 'failed', error: response?.error } : row,
              ),
            );
            continue;
          }

          const resultsRaw = Array.isArray(response?.results) ? response?.results : [];
          // Single-URL request → expect at most one row back. Match by
          // URL anyway in case the function ever batches replies.
          const matched = resultsRaw
            .map((row) => adaptResultRow(row as DeployedResultRow))
            .find((row) => row?.url === cleaned[i]);

          if (!matched) {
            setItems((prev) =>
              prev.map((row, idx) =>
                idx === i
                  ? { ...row, status: 'failed', error: 'No response from importer' }
                  : row,
              ),
            );
            continue;
          }

          if (matched.status === 'success') anySuccess = true;
          setItems((prev) => prev.map((row, idx) => (idx === i ? { ...matched, id: row.id } : row)));
        }
      } finally {
        setIsImporting(false);
        if (controller.signal.aborted) {
          // Reset progress counters on abort so a re-submit starts clean.
          setCurrentIndex(0);
          setTotalCount(0);
        }
      }

      if (topLevelError !== null) {
        setError(topLevelError);
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
  // unmounts (typical case: user backs out of the screen mid-import).
  // Mirrors every other M9-era hook.
  useEffect(() => {
    return () => {
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
