// useResetStyleMemory — wraps the `reset_style_memory` edge function +
// `reset_style_memory_atomic` RPC behind a single React Query mutation.
// On success, invalidates every cached query that derives from Style
// Memory so the UI re-renders with the cleared state.
//
// Server-side (per Wave 8.5 PR B): the RPC atomically clears
// feedback_signals, garment_pair_memory, and the daily summary's dirty
// mark for the caller. The wardrobe + outfits stay intact — this is
// "forget what you've learned about me", not "delete everything".
//
// Mobile invalidations: only the queries currently registered in
// `mobile/src/hooks/`. The wave file also listed `['profile']`,
// `['style-dna']`, `['feedback-signals']`, `['ai-suggestions']` — those
// queries don't exist on mobile yet (web parity, but mobile hasn't
// shipped the consuming hooks). Invalidating non-existent keys is a
// no-op, but listing them as if they were real would make this hook
// look load-bearing for queries that don't actually drive any UI here.
// When those hooks land (M14+ chat, M28 style DNA), they own their own
// invalidation contract and re-add their key to this list.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { callEdgeFunction } from '../lib/edgeFunctionClient';
import { captureMutationError } from '../lib/sentry';

export function useResetStyleMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await callEdgeFunction('reset_style_memory', { body: {}, retries: 1 });
    },
    onSuccess: () => {
      // Outfit recommendations + scoring shift after a memory reset.
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      // Insights derives utilisation + palette + most-worn — none directly
      // depend on Style Memory today, but `delta` text on a few cards
      // mentions "based on recent saves" so keep this fresh.
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
    },
    onError: captureMutationError('useResetStyleMemory'),
  });
}
