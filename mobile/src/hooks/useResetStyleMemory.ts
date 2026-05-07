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

import { useAuth } from '../contexts/AuthContext';
import { callEdgeFunction } from '../lib/edgeFunctionClient';
import {
  clearActionFromQueue,
  pauseReplaysAndWaitSettled,
  resumeReplays,
} from '../lib/offlineQueue';
import { MEMORY_EVENT_ACTION } from '../lib/memoryIngest';
import { captureMutationError } from '../lib/sentry';

export function useResetStyleMemory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      // Codex P2 round 7 on PR #735: pause queue replays AND wait for
      // any in-flight replay pass to settle before the destructive
      // call. Without this, an already-running replay snapshot could
      // dispatch a queued memory-event mid-reset and write to
      // memory_ingest AFTER the server cleared the user's tables —
      // silently undoing the destructive op the user just confirmed.
      await pauseReplaysAndWaitSettled();
      try {
        // idempotent: true so the server's request_idempotency cache can
        // replay the original response on a same-key retry. The reset
        // server-side path is keyed off X-Idempotency-Key.
        // retries: 0 because the edge function's enforceRateLimit runs
        // BEFORE checkIdempotency — a wrapper-level retry within the
        // rate-limit window 429s instead of replaying the cached response,
        // so the user sees an error even though the first request landed
        // server-side. Codex P2 round 2 on PR #735.
        await callEdgeFunction('reset_style_memory', {
          body: {},
          retries: 0,
          idempotent: true,
        });
        // Drop every pending memory-event queue item AFTER the server-
        // side reset lands. With replays paused above, no new dispatches
        // will fire between the server clear and this drop. Codex P2
        // round 6.
        await clearActionFromQueue(MEMORY_EVENT_ACTION);
      } finally {
        resumeReplays();
      }
    },
    onSuccess: () => {
      // Outfit recommendations + scoring shift after a memory reset.
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      // M29 — Style DNA reads `user_style_summaries.summary_json`, which
      // the server-side reset_style_memory_atomic RPC clears. Without
      // this invalidation Profile + SettingsStyle would keep showing
      // the pre-reset DNA up to staleTime (5min).
      queryClient.invalidateQueries({ queryKey: ['styleDNA', user?.id] });
      // Insights derives utilisation + palette + most-worn — none directly
      // depend on Style Memory today, but `delta` text on a few cards
      // mentions "based on recent saves" so keep this fresh.
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
    },
    onError: captureMutationError('useResetStyleMemory'),
  });
}
