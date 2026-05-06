// useRecordMemoryEvent — typed React Query mutation that lets the M14
// chat memory panel fire inline "forget this piece" actions.
//
// Wraps `recordMemoryEvent` (the queue-aware Style Memory ingest) with
// the canonical `useAddGarment.ts` hook shape: auth-gated mutationFn,
// `captureMutationError` on the error branch, query invalidation on
// success so the chip row refreshes from the live tables.
//
// Scope decision (see findings-log 2026-05-06): only the
// `'never_suggest_garment'` variant ships in M14. The free-text
// "forget that I prefer X" path the wave plan called for would need
// either a new `preference_correction` signal type server-side or an
// in-chat preference-extraction tweak — neither is in scope for this
// wave. Garment-level forget is fully wired.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { recordMemoryEvent } from '../lib/memoryIngest';
import { neverSuggestGarmentEvent } from '../lib/memoryEvents';
import { captureMutationError } from '../lib/sentry';

export interface ForgetMemoryInput {
  /**
   * Memory-forget kind. Only `'never_suggest_garment'` ships in M14;
   * free-text `'reject_outfit'` correction is deferred (see
   * findings-log 2026-05-06 — needs a target outfit_id which the
   * panel doesn't have).
   */
  kind: 'never_suggest_garment';
  garmentId: string;
  /** Analytics tag identifying the call site. */
  source?: string;
}

export function useRecordMemoryEvent(): UseMutationResult<void, Error, ForgetMemoryInput> {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, ForgetMemoryInput>({
    mutationFn: async (input) => {
      if (!user) throw new Error('Not authenticated');
      await recordMemoryEvent(
        neverSuggestGarmentEvent(input.garmentId, input.source ?? 'StyleChat:forget'),
      );
    },
    onSuccess: () => {
      // Refresh the "what burs remembers" chip row so the just-forgotten
      // piece either disappears (when the next summary build drops it)
      // or surfaces as a fresh feedback_signals chip if the panel is
      // already showing summary-derived rows.
      queryClient.invalidateQueries({ queryKey: ['styleMemoryFacts'] });
    },
    onError: captureMutationError('useRecordMemoryEvent'),
  });
}
