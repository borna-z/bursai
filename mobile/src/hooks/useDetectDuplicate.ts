// Duplicate-garment detection — calls the `detect_duplicate_garment` edge
// function and returns the matches. Used by AddPieceStep3 to warn the user
// when the new garment looks like one they already have.
//
// Edge function contract (supabase/functions/detect_duplicate_garment):
//   request:  { image_path?, category?, color_primary?, title?, subcategory?,
//               material?, exclude_garment_id? }
//   response: { duplicates: Array<{ garment_id, title, image_path,
//               confidence (0-1), match_type: 'attribute' | 'visual' | 'both',
//               reasons: string[] }> }
//
// `image_path` is optional: when missing the server falls back to attribute-
// only scoring (lower confidence, but still useful when AddPieceStep3 mounts
// before the upload promise resolves). We pass it whenever we have it.
//
// Cached for 5 min on the client because (image_path + category + color +
// title + ...) maps to a stable answer until the wardrobe changes.
//
// 402 (subscription_required) and 429 (rate-limited) are surfaced as a
// thrown Error. Callers in the AddPiece flow generally swallow them — the
// duplicate check is advisory; if it fails we'd rather let the save go through
// than block the user.

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { callEdgeFunction } from '../lib/edgeFunctionClient';

export interface DuplicateMatch {
  garment_id: string;
  title: string;
  image_path: string;
  confidence: number;
  match_type: 'attribute' | 'visual' | 'both';
  reasons: string[];
}

export interface DetectDuplicateInput {
  image_path?: string | null;
  category?: string | null;
  color_primary?: string | null;
  title?: string | null;
  subcategory?: string | null;
  material?: string | null;
  exclude_garment_id?: string | null;
}

interface DetectDuplicateResponse {
  duplicates: DuplicateMatch[];
}

export function useDetectDuplicate(input: DetectDuplicateInput | null) {
  const { user, session } = useAuth();

  // Build a stable, JSON-friendly key from the input. Keep `null` and
  // `undefined` apart so a flow that learns the image_path mid-session
  // produces a fresh query (not a cache hit on the attribute-only check).
  const enabled = !!user && !!session?.access_token && !!input?.category;

  return useQuery<DetectDuplicateResponse>({
    queryKey: ['detect-duplicate', user?.id, input],
    queryFn: async () => {
      if (!input || !session?.access_token) return { duplicates: [] };

      const body: Record<string, unknown> = {};
      if (input.image_path) body.image_path = input.image_path;
      if (input.category) body.category = input.category;
      if (input.color_primary) body.color_primary = input.color_primary;
      if (input.title) body.title = input.title;
      if (input.subcategory) body.subcategory = input.subcategory;
      if (input.material) body.material = input.material;
      if (input.exclude_garment_id) body.exclude_garment_id = input.exclude_garment_id;

      // M9: callEdgeFunction handles auth + retry + 402/429 classification.
      // The check is advisory: 402/429/network errors silently surface as a
      // throw the screen ignores (no save path reads this query's error).
      // retries: 0 because the AddPiece save flow only waits briefly — better
      // a fast attribute-only result than a 90-second hold for retries.
      const data = await callEdgeFunction<DetectDuplicateResponse>(
        'detect_duplicate_garment',
        { body, retries: 0 },
      );
      return {
        duplicates: Array.isArray(data.duplicates) ? data.duplicates : [],
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    // The check is advisory — don't pester the user with a "checking…" spinner
    // if the network briefly hiccups. A failed call lets the save flow through.
    retry: 1,
    // Suppress refetch on focus so reopening Step 3 doesn't re-bill the
    // function for an already-asked question.
    refetchOnWindowFocus: false,
  });
}

// Confidence threshold the AddPiece flow uses to surface the warning modal.
// Web's BatchCaptureStep uses ~0.85 for the "already have this" prompt; the
// edge function itself filters at 0.45 (visual) / 0.6 (attribute-only) so
// anything reaching us is at least a soft match. 0.85 keeps the prompt rare
// and high-confidence — the user can still tap "Add anyway" and override.
export const DUPLICATE_WARN_THRESHOLD = 0.85;

// Pulled into a helper so the screen and any future consumer (BatchCapture in
// M7) score consistently.
export function topDuplicate(
  result: DetectDuplicateResponse | undefined,
): DuplicateMatch | null {
  const top = result?.duplicates?.[0];
  if (!top) return null;
  if (top.confidence < DUPLICATE_WARN_THRESHOLD) return null;
  return top;
}
