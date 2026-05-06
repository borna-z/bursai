// usePhotoFeedback — M18 photo-feedback hook.
//
// Two-step flow: (1) upload the user's mirror selfie to the existing
// `garments` storage bucket, (2) call the deployed `outfit_photo_feedback`
// edge function with `{ outfit_id, selfie_path }` and surface the structured
// styling notes back to the screen.
//
// **Contract drift, intentional (matches the deployed function, not the
// stale wave skeleton):**
//   - The wave file's hook described the request body as
//     `{ outfit_id, selfie_image_path }` and a response envelope shaped
//     `{ fit_notes, color_callouts, swap_suggestions, overall_score,
//        summary }`. The deployed function at
//     `supabase/functions/outfit_photo_feedback/index.ts` actually:
//       * reads `selfie_path` (not `selfie_image_path`),
//       * writes the row to `outfit_feedback` and returns the row verbatim,
//         shaped `{ fit_score, color_match_score, overall_score,
//                   commentary, ai_raw, ... }`.
//   - We track the deployed contract end-to-end. The hook then **adapts**
//     the response into the wave's UX envelope so the screen stays
//     skeleton-aligned: `commentary → fit_notes`, first sentence →
//     `summary`, `overall_score` passes through, and the as-yet-unused
//     `color_callouts` / `swap_suggestions` lists initialise to empty.
//     Future server work that returns those arrays can flow through the
//     same surface without touching the screen.
//
// **Bucket choice:** the wave file optimistically referenced a
// `selfie-feedback` bucket; verification of `00000000000000_initial_schema.sql`
// shows that bucket does NOT exist. The deployed edge function reads the
// `garments` bucket (it asks `supabase.storage.from('garments')
// .createSignedUrl(selfie_path, ...)` for both the selfie AND the outfit
// thumbnails). We upload to the same bucket under the user's prefix so the
// existing RLS policy (`bucket_id = 'garments' AND folder = auth.uid()`)
// authorises the write — and the function's signed-URL fetch reads the same
// row back without any cross-bucket grant.
//
// Standard pattern from `useSuggestAccessories` / `useGenerateOutfit`:
// AbortController per call, mount-cleanup via ref + abort in useEffect
// teardown, EdgeFunctionSubscriptionLockedError → `'subscription_required'`
// sentinel for paywall surfacing, EdgeFunctionHttpError → parsed body
// `error` field or `HTTP <status>` fallback. Sentry capture skips the
// paywall sentinel + caller aborts — same as every other M9-era hook.

import { useCallback, useEffect, useRef, useState } from 'react';
import { File as FsFile } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';

const SUBSCRIPTION_SENTINEL = 'subscription_required';
const BUCKET = 'garments';
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;

/**
 * UX-shaped photo feedback. Adapted from the deployed `outfit_feedback`
 * row — see file header for the field-mapping rationale.
 *
 * `fit_notes` carries the AI's full styling commentary (2-3 sentences with
 * actionable feedback); `summary` is a short, scan-friendly first
 * sentence derived from `fit_notes`. `color_callouts` and
 * `swap_suggestions` reserve the future server-side fields when the
 * function's tool schema expands; they initialise to empty arrays today.
 */
export interface PhotoFeedback {
  fit_notes: string;
  color_callouts: string[];
  swap_suggestions: { garment_id?: string; reason: string }[];
  overall_score?: number | null;
  summary?: string | null;
}

export interface UsePhotoFeedbackResult {
  feedback: PhotoFeedback | null;
  isUploading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  submitFeedback: (params: { outfitId: string; selfieUri: string }) => Promise<void>;
  reset: () => void;
}

// Minimal shape of the deployed `outfit_feedback` row that the function
// returns verbatim. All fields nullable on the wire — defensive accessors
// throughout the adapter. Extra unrelated columns are ignored via the
// type's open-ended end.
type DeployedOutfitFeedbackRow = {
  fit_score?: number | null;
  color_match_score?: number | null;
  overall_score?: number | null;
  commentary?: string | null;
  ai_raw?: Record<string, unknown> | null;
  error?: string;
};

/**
 * First-sentence extractor. Mirrors the web's `style_chat` truncation
 * heuristic at a smaller scale: split at the first sentence-terminator
 * (`.`, `!`, `?`) followed by whitespace or end-of-string, fall through
 * to the whole string when the commentary is a single phrase. Returns
 * null on empty / whitespace-only input so callers can fall back to a
 * static "Photo feedback" header copy.
 */
function deriveSummary(commentary: string | null | undefined): string | null {
  if (typeof commentary !== 'string') return null;
  const trimmed = commentary.trim();
  if (trimmed.length === 0) return null;
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  if (!match) return trimmed;
  return match[0].trim();
}

/**
 * Adapt a deployed `outfit_feedback` row into the screen-facing
 * `PhotoFeedback` shape. See file header for the mapping rationale.
 * `color_callouts` + `swap_suggestions` reserve the future server fields;
 * we mine `ai_raw` for them when the function eventually returns them
 * under those keys, otherwise initialise empty.
 */
function adaptFeedback(row: DeployedOutfitFeedbackRow): PhotoFeedback {
  const commentary =
    typeof row.commentary === 'string' && row.commentary.trim().length > 0
      ? row.commentary.trim()
      : '';
  const overall =
    typeof row.overall_score === 'number' && Number.isFinite(row.overall_score)
      ? row.overall_score
      : null;

  // Defensive future-proofing: if the AI tool schema ever returns
  // `color_callouts` / `swap_suggestions` in `ai_raw`, surface them
  // without a hook rewrite.
  const aiRaw = row.ai_raw && typeof row.ai_raw === 'object' ? row.ai_raw : {};
  const colorCallouts: string[] = Array.isArray((aiRaw as Record<string, unknown>).color_callouts)
    ? ((aiRaw as Record<string, unknown>).color_callouts as unknown[])
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim())
    : [];
  const swapSuggestions: { garment_id?: string; reason: string }[] = Array.isArray(
    (aiRaw as Record<string, unknown>).swap_suggestions,
  )
    ? ((aiRaw as Record<string, unknown>).swap_suggestions as unknown[])
        .map((v) => {
          if (!v || typeof v !== 'object') return null;
          const obj = v as Record<string, unknown>;
          const reasonRaw = typeof obj.reason === 'string' ? obj.reason.trim() : '';
          if (reasonRaw.length === 0) return null;
          const garmentIdRaw =
            typeof obj.garment_id === 'string' ? obj.garment_id.trim() : '';
          return {
            ...(garmentIdRaw.length > 0 ? { garment_id: garmentIdRaw } : {}),
            reason: reasonRaw,
          };
        })
        .filter((v): v is { garment_id?: string; reason: string } => v !== null)
    : [];

  return {
    fit_notes: commentary,
    color_callouts: colorCallouts,
    swap_suggestions: swapSuggestions,
    overall_score: overall,
    summary: deriveSummary(commentary),
  };
}

/**
 * Resize the user's mirror selfie to the same canonical input the analyze
 * + render pipelines use (longest side 1200 px, JPEG q=0.85). Mirrors
 * `lib/imageUpload.ts`'s `resizeForGarment` recipe; we don't reuse that
 * helper directly because it auto-uploads to a `garments`-bucket path
 * shaped for AddPiece (`<userId>/<timestamp>-<random>.jpg`), and we want
 * a `<userId>/selfie_<timestamp>.jpg` shape so the storage layer can be
 * grepped for selfie uploads vs garment uploads in audits.
 */
async function resizeSelfie(uri: string): Promise<ImageManipulator.ImageResult> {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    },
  );
}

export function usePhotoFeedback(): UsePhotoFeedbackResult {
  const { user, session } = useAuth();
  const [feedback, setFeedback] = useState<PhotoFeedback | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const submitFeedback = useCallback(
    async ({ outfitId, selfieUri }: { outfitId: string; selfieUri: string }) => {
      if (!user || !session?.access_token) {
        setError('Not authenticated');
        return;
      }
      const trimmedOutfitId = outfitId?.trim();
      if (!trimmedOutfitId) {
        setError('Missing outfit_id');
        return;
      }
      if (!selfieUri || selfieUri.length === 0) {
        setError('Missing selfie');
        return;
      }

      // Cancel any in-flight call so the user can re-shoot without the old
      // analysis racing the new one. The controller wires through to both
      // the storage upload (via the AbortController.signal-aware `fetch`
      // inside supabase-js) and the edge function call.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFeedback(null);
      setError(null);
      setIsUploading(true);
      setIsAnalyzing(false);

      // Step 1 — resize + upload selfie. The function reads the
      // `garments` bucket (per the deployed code) and the existing RLS
      // policy authorises the write under `<userId>/...`.
      const timestamp = Date.now();
      const selfiePath = `${user.id}/selfie_${timestamp}.jpg`;
      try {
        const resized = await resizeSelfie(selfieUri);
        if (controller.signal.aborted) return;
        const bytes = await new FsFile(resized.uri).bytes();
        if (controller.signal.aborted) return;

        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(
          selfiePath,
          bytes,
          { contentType: 'image/jpeg', upsert: false },
        );
        if (uploadErr) {
          if (controller.signal.aborted) return;
          setError(uploadErr.message ?? 'Upload failed');
          Sentry.withScope((s) => {
            s.setTag('mutation', 'usePhotoFeedback.upload');
            Sentry.captureException(uploadErr);
          });
          return;
        }
      } catch (uploadEx) {
        if (controller.signal.aborted) return;
        const message =
          uploadEx instanceof Error ? uploadEx.message : 'Upload failed';
        setError(message);
        Sentry.withScope((s) => {
          s.setTag('mutation', 'usePhotoFeedback.upload');
          Sentry.captureException(uploadEx);
        });
        return;
      } finally {
        if (!controller.signal.aborted) setIsUploading(false);
      }

      // Step 2 — call the edge function. M9 wrapper handles auth, retry,
      // 402 paywall surfacing, circuit breaker, AbortSignal threading.
      if (controller.signal.aborted) return;
      setIsAnalyzing(true);
      try {
        let row: DeployedOutfitFeedbackRow;
        try {
          row = await callEdgeFunction<DeployedOutfitFeedbackRow>(
            'outfit_photo_feedback',
            {
              body: { outfit_id: trimmedOutfitId, selfie_path: selfiePath },
              signal: controller.signal,
            },
          );
        } catch (callErr) {
          if (callErr instanceof EdgeFunctionSubscriptionLockedError) {
            setError(SUBSCRIPTION_SENTINEL);
            return;
          }
          if (callErr instanceof EdgeFunctionHttpError) {
            const parsed = (() => {
              try {
                return JSON.parse(callErr.bodyText) as { error?: string };
              } catch {
                return null;
              }
            })();
            setError(parsed?.error ?? `HTTP ${callErr.status}`);
            return;
          }
          throw callErr;
        }

        if (row?.error) {
          setError(row.error);
          return;
        }
        setFeedback(adaptFeedback(row ?? {}));
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : 'Photo feedback failed';
        if (message !== SUBSCRIPTION_SENTINEL) {
          Sentry.withScope((s) => {
            s.setTag('mutation', 'usePhotoFeedback.analyze');
            Sentry.captureException(err);
          });
        }
        setError(message);
      } finally {
        if (!controller.signal.aborted) setIsAnalyzing(false);
      }
    },
    [user, session?.access_token],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setFeedback(null);
    setIsUploading(false);
    setIsAnalyzing(false);
    setError(null);
  }, []);

  // Mount-lifetime cleanup — abort an in-flight upload + edge call when
  // the consumer unmounts (typical case: user backs out of the screen
  // before the analyze step lands). Mirrors every other M9-era hook.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    feedback,
    isUploading,
    isAnalyzing,
    error,
    submitFeedback,
    reset,
  };
}
