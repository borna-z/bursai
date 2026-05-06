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
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';

const SUBSCRIPTION_SENTINEL = 'subscription_required';

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

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

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
        if (!controller.signal.aborted) {
          setIsGenerating(false);
        }
      }
    },
    [session?.access_token],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
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
