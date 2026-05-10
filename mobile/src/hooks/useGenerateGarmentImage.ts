// useGenerateGarmentImage — N12 wire.
//
// Mobile counterpart for the deployed `generate_garment_images` edge function.
// Use case: a garment was added without a photo (manual entry) and the user
// wants an AI-generated catalog-style image. The function builds a prompt
// from the garment's color / material / category metadata, calls Gemini's
// image model, uploads the PNG to `garments/<userId>/<garmentId>.png`, and
// stamps `garments.image_path` with the new path.
//
// Single-garment shape on this hook keeps the UI simple — `generate_garment_images`
// accepts a `garment_ids[]` array, and we wrap with a one-element list so a
// future "regenerate selected" surface can lean on the same hook by accepting
// `string[]` directly.
//
// Rate-limit / paywall behaviour mirrors `useGenerateFlatlay`: 429 raises
// `EdgeFunctionRateLimitError`; 402 raises `EdgeFunctionSubscriptionLockedError`.
// Callers route to PaywallScreen via the same sentinel.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';

type GenerateGarmentImageResult = {
  id: string;
  success: boolean;
  error?: string;
};

type GenerateGarmentImagesResponse = {
  results: GenerateGarmentImageResult[];
  error?: string;
};

export function useGenerateGarmentImage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (garmentId: string) => {
      if (!user) throw new Error('Not authenticated');
      try {
        const data = await callEdgeFunction<GenerateGarmentImagesResponse>(
          'generate_garment_images',
          { body: { garment_ids: [garmentId] } },
        );
        const result = data?.results?.[0];
        if (!result?.success) {
          throw new Error(result?.error || data?.error || 'Image generation failed');
        }
        return result;
      } catch (err) {
        // Codex P2 round 1 on PR #816 — the wrapper raises
        // EdgeFunctionSubscriptionLockedError on a 402; surface it as the
        // shared SUBSCRIPTION_SENTINEL so GarmentDetailScreen's existing
        // paywall effect can route to PaywallScreen instead of leaving the
        // mutation to fail silently. Mirrors useAssessCondition's pattern.
        if (err instanceof EdgeFunctionSubscriptionLockedError) {
          throw new Error(SUBSCRIPTION_SENTINEL);
        }
        throw err;
      }
    },
    onSuccess: (_data, garmentId) => {
      // Codex P2 round 1 on PR #816 — useGarment keys rows as
      // ['garment', user?.id, id] (see useGarments.ts:138), not
      // ['garment', id]; an unscoped invalidation misses the active detail
      // query and leaves the screen showing the stale row until manual
      // refetch / remount. Mirror useAssessCondition (line 229) and
      // useRenderJobStatus (lines 155, 216).
      //
      // Self-review round 1 — the prior `['signedUrl', garmentId]`
      // invalidate was a no-op: useSignedUrl keys with
      // ['signed-url', BUCKET, path] (useSignedUrl.ts:83). Once the
      // garment refetch lands the new image_path, useSignedUrl picks a
      // fresh query key and the previous null-path cache entry is
      // unreachable. No explicit signed-url invalidate needed.
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garment', user?.id, garmentId] });
    },
    onError: (err: unknown) => {
      // Don't ship the paywall sentinel to Sentry — it's a controlled flow
      // signal, not a real failure. Same shape as useAddGarment's
      // OfflineQueuedError swallow.
      const message = err instanceof Error ? err.message : '';
      if (message === SUBSCRIPTION_SENTINEL) return;
      Sentry.withScope((s) => {
        s.setTag('mutation', 'useGenerateGarmentImage');
        Sentry.captureException(err);
      });
    },
  });
}
