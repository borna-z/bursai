// useVisualSearch — M19 visual search hook.
//
// Flow: (1) resize the reference photo to the canonical analyze input
// (longest side 1200 px, JPEG q=0.85), base64-encoded; (2) call the
// deployed `visual_search` edge function with `{ image_base64, locale }`;
// (3) adapt the response into the wave's UX envelope
// (`{ wardrobeMatches, webMatches }`).
//
// **Contract drift, intentional (matches the deployed function, not the
// wave skeleton):**
//   - The wave file's hook described the request body as a storage path
//     and a response envelope shaped `{ wardrobe_matches, web_matches }`.
//     The deployed function at `supabase/functions/visual_search/index.ts`
//     actually:
//       * reads `{ image_base64, locale }` directly (no storage round-trip),
//       * returns `{ description, matches: [{detected_item, garment_id,
//         confidence (0-100), reason}], gaps: [{detected_item, suggestion}] }`.
//     There are no web product matches today — the function only matches
//     against the user's own wardrobe. The wave file's "Found online" row
//     is a forward-looking surface that lights up when the server side
//     gains a product-search step (M20-adjacent work).
//   - We track the deployed contract end-to-end, then adapt the response
//     into `{ wardrobeMatches, webMatches: [] }` so the screen layout
//     stays skeleton-aligned and a future server expansion can flow
//     through the same surface without touching the screen. M18's
//     `usePhotoFeedback` set the precedent for this pattern.
//
// **No upload, no cleanup ref:** because the deployed function takes
// inline base64 (not a storage path), there is no reference image
// uploaded to the `garments` bucket — the user instructions' reminder to
// track `lastReferencePathRef` and best-effort delete on abort/reset is
// moot here (there's no orphan blob to sweep). We still sweep the
// manipulator's resized temp file on abort/reset/error/unmount so a
// cancelled try-on doesn't leave a multi-hundred-KB JPEG in the cache
// directory (M18 P2.2 precedent).
//
// Standard pattern from `usePhotoFeedback` / `useGenerateOutfit`:
// AbortController per call, mount-cleanup via ref + abort in useEffect
// teardown, EdgeFunctionSubscriptionLockedError → `'subscription_required'`
// sentinel for paywall surfacing, EdgeFunctionHttpError → parsed body
// `error` field or `HTTP <status>` fallback, Sentry capture skips the
// paywall sentinel + caller aborts.

import { useCallback, useEffect, useRef, useState } from 'react';
import { File as FsFile } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { getLocale, t as tr } from '../lib/i18n';
import { log } from '../lib/log';
import { Sentry } from '../lib/sentry';
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;
// M19 Codex round 1 P2.1 — payload guard. The deployed function inlines
// the base64 payload inside the JSON body; Supabase edge functions reject
// payloads above ~6 MB. base64 inflates binary by ~33 %, so we cap the
// base64 string at 3 MB (≈ 2.25 MB binary) to leave headroom for the
// JSON envelope and any additional fields.
const MAX_BASE64_LENGTH = 3_000_000;

export interface VisualSearchWardrobeMatch {
  garment_id: string;
  /** Cosine-similarity-style score in [0, 1]. Adapted from the function's
   * 0-100 confidence value by dividing by 100; clamped to the [0, 1]
   * range so a malformed server payload can't break consumer math. */
  score: number;
}

export interface VisualSearchWebMatch {
  /** Stable key for FlatList. Today this is moot (the function returns
   * no web matches), but the type stays so the screen's row
   * implementation doesn't need to be rewritten when M20-adjacent work
   * lights up the product-search side. */
  id: string;
  title: string;
  image_url: string;
  product_url: string;
  price?: { amount: number; currency: string } | null;
  merchant?: string | null;
  score: number;
}

export interface VisualSearchResult {
  wardrobeMatches: VisualSearchWardrobeMatch[];
  webMatches: VisualSearchWebMatch[];
}

export interface UseVisualSearchResult {
  result: VisualSearchResult | null;
  isUploading: boolean;
  isSearching: boolean;
  error: string | null;
  submitSearch: (params: { referenceImageUri: string }) => Promise<void>;
  reset: () => void;
}

// Open-ended type — defensive accessors handle every field. The function
// returns a JSON object whose shape is stable for `matches` but tolerant
// of additions (`description`, `gaps`, future `web_matches` etc).
type DeployedVisualSearchResponse = {
  description?: string | null;
  matches?: unknown;
  gaps?: unknown;
  web_matches?: unknown;
  error?: string;
};

/**
 * Best-effort delete of the manipulator's resized temp file. The image
 * manipulator writes a JPEG into the cache directory; if abort fires
 * between the resize and the bytes-read (or any other early-return on
 * the way out), we leave a multi-hundred-KB temp behind. Synchronous
 * delete via the new `expo-file-system` `File` API; failures are
 * swallowed (file already gone, app sandbox quirk, etc.).
 */
function bestEffortDeleteTemp(uri: string | null): void {
  if (!uri) return;
  try {
    const f = new FsFile(uri);
    if (f.exists) f.delete();
  } catch (err) {
    log.error(err, { context: 'useVisualSearch.delete_temp_failed' });
    /* swallow — cleanup is best-effort */
  }
}

/**
 * Resize the reference photo to the canonical analyze input format.
 * Returns the manipulator output WITH base64 so we can hand the bytes
 * directly to the edge function (single resize pass; no second
 * round-trip through storage). Mirrors `lib/imageUpload.ts`'s
 * `resizeForGarment(uri, { wantBase64: true })` recipe but stays inline
 * so a future change to the visual-search input format doesn't ripple
 * across every caller of that helper.
 */
async function resizeReference(uri: string): Promise<ImageManipulator.ImageResult> {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
}

/**
 * Adapt the function's `matches[]` into the wave's `wardrobeMatches[]`.
 * Open-ended `unknown` input → defensive per-field validation; rows that
 * don't have a non-empty string `garment_id` are dropped (a malformed
 * server payload can't get through to the screen as a render-breaking
 * undefined key).
 */
function adaptWardrobeMatches(raw: unknown): VisualSearchWardrobeMatch[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: VisualSearchWardrobeMatch[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const garmentIdRaw = typeof obj.garment_id === 'string' ? obj.garment_id.trim() : '';
    if (garmentIdRaw.length === 0) continue;
    // De-dupe by garment_id — the function shouldn't emit duplicates
    // but guard against the case anyway so the screen doesn't render
    // two rows for the same item.
    if (seen.has(garmentIdRaw)) continue;
    seen.add(garmentIdRaw);
    // Confidence is 0-100 in the function's tool schema; clamp to [0,1].
    const confidenceRaw = typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
      ? obj.confidence
      : NaN;
    const score = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, confidenceRaw / 100))
      : 0;
    out.push({
      garment_id: garmentIdRaw,
      score,
    });
  }
  return out;
}

/**
 * Adapt a possible `web_matches[]` payload into `webMatches[]`. The
 * deployed function doesn't emit this today, so the helper exists for
 * the forward-looking surface only — a future server expansion that
 * returns `{ web_matches: [...] }` flows through here without touching
 * the screen. Defensive across every field; rows missing the basics
 * (id, title, image_url, product_url) are dropped.
 */
function adaptWebMatches(raw: unknown): VisualSearchWebMatch[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: VisualSearchWebMatch[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const idRaw = typeof obj.id === 'string' ? obj.id.trim() : '';
    const titleRaw = typeof obj.title === 'string' ? obj.title.trim() : '';
    const imageUrlRaw = typeof obj.image_url === 'string' ? obj.image_url.trim() : '';
    const productUrlRaw = typeof obj.product_url === 'string' ? obj.product_url.trim() : '';
    if (idRaw.length === 0 || titleRaw.length === 0 || imageUrlRaw.length === 0 || productUrlRaw.length === 0) {
      continue;
    }
    if (seen.has(idRaw)) continue;
    seen.add(idRaw);
    const merchantRaw = typeof obj.merchant === 'string' ? obj.merchant.trim() : '';
    const scoreRaw = typeof obj.score === 'number' && Number.isFinite(obj.score) ? obj.score : 0;
    const score = Math.max(0, Math.min(1, scoreRaw));
    let price: { amount: number; currency: string } | null = null;
    if (obj.price && typeof obj.price === 'object') {
      const p = obj.price as Record<string, unknown>;
      const amountRaw =
        typeof p.amount === 'number' && Number.isFinite(p.amount) ? p.amount : NaN;
      const currencyRaw = typeof p.currency === 'string' ? p.currency.trim() : '';
      if (Number.isFinite(amountRaw) && currencyRaw.length > 0) {
        price = { amount: amountRaw, currency: currencyRaw };
      }
    }
    out.push({
      id: idRaw,
      title: titleRaw,
      image_url: imageUrlRaw,
      product_url: productUrlRaw,
      price,
      merchant: merchantRaw.length > 0 ? merchantRaw : null,
      score,
    });
  }
  return out;
}

export function useVisualSearch(): UseVisualSearchResult {
  const { user, session } = useAuth();
  const [result, setResult] = useState<VisualSearchResult | null>(null);
  // `isUploading` here covers the resize+base64 step (the wave names it
  // "uploading" because the original skeleton planned a storage upload;
  // we keep the name so consumers don't have to change). The resize is
  // CPU-bound and can take 100-400 ms on older devices, so the screen
  // surfaces a spinner during that window.
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const submitSearch = useCallback(
    async ({ referenceImageUri }: { referenceImageUri: string }) => {
      if (!user || !session?.access_token) {
        setError('Not authenticated');
        return;
      }
      if (!referenceImageUri || referenceImageUri.length === 0) {
        setError('Missing reference image');
        return;
      }

      // Cancel any in-flight call so the user can re-pick a reference
      // photo without the old search racing the new one. The controller
      // wires through to the edge function call.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setResult(null);
      setError(null);
      setIsUploading(true);
      setIsSearching(false);

      // Step 1 — resize + base64 the reference photo. Track the temp
      // uri so we can sweep it on abort/error.
      let resizedTempUri: string | null = null;
      let imageBase64Payload: string | null = null;
      try {
        try {
          const resized = await resizeReference(referenceImageUri);
          resizedTempUri = resized.uri;
          if (controller.signal.aborted) return;
          if (typeof resized.base64 !== 'string' || resized.base64.length === 0) {
            setError('Could not encode reference image');
            return;
          }
          // M19 Codex round 1 P2.1 — payload size guard. Inline base64
          // payloads above ~3 MB push the JSON envelope past Supabase's
          // edge-function body limit; surface a typed user-facing error
          // before we attempt the request.
          if (resized.base64.length >= MAX_BASE64_LENGTH) {
            setError(tr('visualSearch.imageTooLarge'));
            return;
          }
          // The function expects a data URL or raw base64; pass a data URL
          // so the OpenAI-compatible image_url surface accepts it directly
          // (the deployed function forwards the value as `image_url.url`).
          imageBase64Payload = `data:image/jpeg;base64,${resized.base64}`;
        } catch (resizeEx) {
          if (controller.signal.aborted) return;
          const message =
            resizeEx instanceof Error ? resizeEx.message : 'Could not prepare reference image';
          setError(message);
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useVisualSearch.resize');
            Sentry.captureException(resizeEx);
          });
          return;
        }
      } finally {
        setIsUploading(false);
        if (controller.signal.aborted) {
          bestEffortDeleteTemp(resizedTempUri);
        }
      }

      if (controller.signal.aborted || !imageBase64Payload) {
        bestEffortDeleteTemp(resizedTempUri);
        return;
      }

      // Step 2 — call the edge function. M9 wrapper handles auth, retry,
      // 402 paywall surfacing, circuit breaker, AbortSignal threading.
      setIsSearching(true);
      try {
        let response: DeployedVisualSearchResponse;
        try {
          const raw = await callEdgeFunction<DeployedVisualSearchResponse>('visual_search', {
            body: {
              image_base64: imageBase64Payload,
              // `getLocale()` is non-nullable (returns the active `Locale`
              // union via i18n.ts), so the prior `?? 'en'` was dead.
              locale: getLocale(),
            },
            signal: controller.signal,
          });
          if (!raw) {
            // 2xx with unparseable JSON body — surface as a real failure
            // rather than a silent empty match list.
            setError('Visual search failed');
            return;
          }
          response = raw;
        } catch (callErr) {
          if (callErr instanceof EdgeFunctionSubscriptionLockedError) {
            setError(SUBSCRIPTION_SENTINEL);
            return;
          }
          if (callErr instanceof EdgeFunctionHttpError) {
            const parsed = (() => {
              try {
                return JSON.parse(callErr.bodyText) as { error?: string };
              } catch (parseErr) {
                log.error(parseErr, { context: 'useVisualSearch.error_body_parse_failed' });
                return null;
              }
            })();
            setError(parsed?.error ?? `HTTP ${callErr.status}`);
            return;
          }
          throw callErr;
        }

        if (response?.error) {
          setError(response.error);
          return;
        }

        setResult({
          wardrobeMatches: adaptWardrobeMatches(response?.matches),
          webMatches: adaptWebMatches(response?.web_matches),
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : 'Visual search failed';
        if (message !== SUBSCRIPTION_SENTINEL) {
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useVisualSearch.search');
            Sentry.captureException(err);
          });
        }
        setError(message);
      } finally {
        setIsSearching(false);
        // Drop the temp file no matter what — bytes were read long ago.
        bestEffortDeleteTemp(resizedTempUri);
      }
    },
    [user, session?.access_token],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setResult(null);
    setIsUploading(false);
    setIsSearching(false);
    setError(null);
  }, []);

  // Mount-lifetime cleanup — abort an in-flight resize + edge call when
  // the consumer unmounts (typical case: user backs out of the screen
  // before the search lands). Mirrors every other M9-era hook.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    result,
    isUploading,
    isSearching,
    error,
    submitSearch,
    reset,
  };
}
