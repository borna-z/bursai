// useGenerateFlatlay — M17 composition helper.
//
// Wraps the deployed `generate_flatlay` edge function. The function takes
// `{ outfit_id }`, performs the AI image-gen synchronously, uploads the PNG
// to the `garments` bucket under `<userId>/flatlay_<outfitId>.png`, stamps
// `outfits.flatlay_image_path`, and returns
// `{ success: true, flatlay_image_path: <path> }` directly.
//
// No render-job polling is required — the response carries the final
// storage path. Consumers resolve the path to a signed URL via
// `useSignedUrl(flatlay_image_path)` for display. Subscription gating
// surfaces the same `'subscription_required'` sentinel pattern that
// `useGenerateOutfit` and `useOutfitPool` raise so screens can route to
// PaywallScreen consistently.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';

type GenerateFlatlayResponse = {
  success?: boolean;
  flatlay_image_path?: string;
  error?: string;
};

export interface UseGenerateFlatlayResult {
  /** Storage path inside the `garments` bucket (NOT a signed URL). Resolve
   *  to a renderable URL via `useSignedUrl(flatlayPath)`. */
  flatlayPath: string | null;
  isGenerating: boolean;
  error: string | null;
  generate: (outfitId: string) => Promise<void>;
  reset: () => void;
}

export function useGenerateFlatlay(): UseGenerateFlatlayResult {
  const { session } = useAuth();
  const [flatlayPath, setFlatlayPath] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Codex P2.1 on PR #743 — track the in-flight outfit id so a rapid
  // double-tap on "Generate flatlay" doesn't fire two image-gen calls
  // (each one bills the AI provider). The first `generate(id)` enters,
  // sets isGenerating=true; a second tap with the same id is short-
  // circuited. A different id (the user navigated to another outfit
  // mid-flight) cancels the prior request via abortRef.
  const lastOutfitIdRef = useRef<string | null>(null);

  const generate = useCallback(
    async (outfitId: string) => {
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }
      const trimmed = outfitId?.trim();
      if (!trimmed) {
        setError('Missing outfit_id');
        return;
      }

      // Idempotency: if we're already generating for the same outfit, no-op.
      // The current flight will resolve and update `flatlayPath` on its own.
      if (isGenerating && lastOutfitIdRef.current === trimmed) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      lastOutfitIdRef.current = trimmed;

      setIsGenerating(true);
      setError(null);

      try {
        let data: GenerateFlatlayResponse;
        try {
          // Flatlay generation runs an image model end-to-end; the wrapper's
          // 90s default timeout matches the wave's "renders within ~15s"
          // gate plus headroom for cold-start / fallback chain.
          data = await callEdgeFunction<GenerateFlatlayResponse>('generate_flatlay', {
            body: { outfit_id: trimmed },
            signal: controller.signal,
          });
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

        if (data?.error) {
          setError(data.error);
          return;
        }
        const path = data?.flatlay_image_path;
        if (typeof path !== 'string' || path.length === 0) {
          setError('No flatlay returned');
          return;
        }
        setFlatlayPath(path);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Flatlay generation failed';
        if (message !== SUBSCRIPTION_SENTINEL) {
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useGenerateFlatlay');
            Sentry.captureException(err);
          });
        }
        setError(message);
      } finally {
        // Codex P2.8 on PR #743 — always reset isGenerating regardless of
        // abort state. The previous gate left the flag stuck `true` when
        // a request was aborted (e.g. the user re-tapped with a different
        // outfit id mid-flight, or the screen unmounted), which then
        // wedged the idempotency check above into a permanent skip even
        // after the user navigated back. Mirror `useOutfitPool`'s
        // unconditional reset. lastOutfitIdRef is allowed to persist —
        // the idempotency check is `isGenerating && id === ref`, so once
        // isGenerating flips false here, a follow-up tap with the same
        // id (intentional re-generation) will fall through.
        setIsGenerating(false);
      }
    },
    [session?.access_token, isGenerating],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    lastOutfitIdRef.current = null;
    setFlatlayPath(null);
    setIsGenerating(false);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { flatlayPath, isGenerating, error, generate, reset };
}
