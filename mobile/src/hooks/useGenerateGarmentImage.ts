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
import { callEdgeFunction } from '../lib/edgeFunctionClient';
import { captureMutationError } from '../lib/sentry';

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
      const data = await callEdgeFunction<GenerateGarmentImagesResponse>(
        'generate_garment_images',
        { body: { garment_ids: [garmentId] } },
      );
      const result = data?.results?.[0];
      if (!result?.success) {
        throw new Error(result?.error || data?.error || 'Image generation failed');
      }
      return result;
    },
    onSuccess: (_data, garmentId) => {
      // Same invalidation set as useAddGarment — the new path lives on the
      // garment row, and any cached signed URL for the previous (empty)
      // path needs to fall through to the next signed-URL fetch.
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['garment', garmentId] });
      queryClient.invalidateQueries({ queryKey: ['signedUrl', garmentId] });
    },
    onError: captureMutationError('useGenerateGarmentImage'),
  });
}
