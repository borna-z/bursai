/**
 * Wave 8.5 PR B (P86) — canonical Style Memory write hook.
 *
 * Replaces the legacy fire-and-forget direct-INSERT pattern with a typed
 * React Query mutation around `invokeEdgeFunction('memory_ingest', ...)`.
 * The edge function (P85, shipped in PR A #709) normalizes signal names,
 * dedupes via DB-backed idempotency, gates on rate-limit + subscription,
 * and atomically writes feedback_signals + garment_pair_memory + summary
 * dirty-mark inside one transaction.
 *
 * Key design decisions (driven by Wave 8.5 PR B pre-implementation audit):
 *
 * - Stable `record` callback identity: depends on `user?.id` only — NOT
 *   `user` (object identity flips on every auth refresh) and NOT
 *   `mutation.mutate` (TanStack v5 returns a stable reference, but adding
 *   it to deps invites future drift). Audit P86 P0-1.
 *
 * - `metadata: Record<string, unknown>` end-to-end. The legacy hook cast
 *   to `Record<string, string>` which Postgres tolerated but corrupted
 *   typed downstream readers (numeric `garment_count`, etc.). Audit P86 P0-2.
 *
 * - quick_reaction value guard: when `signal_type === 'quick_reaction'`
 *   and `value` is missing/empty, the hook logs + drops the call WITHOUT
 *   invoking memory_ingest. The `ingest_memory_event` RPC derives
 *   pair_delta from value; missing value silently collapses to zero
 *   delta and the signal fails to update memory. Audit PR A P0-1.
 *
 * - 4xx-class errors are NOT enqueued for retry (client mistake — retry
 *   futile). 5xx / transport / unclassified errors enqueue to the
 *   localStorage queue; AuthContext drains on next SIGNED_IN.
 *
 * Backwards compatibility: the legacy `useFeedbackSignals()` API is
 * preserved as an alias for file-by-file migration. Once every caller is
 * migrated this PR completes that work — the alias can be removed in a
 * follow-up.
 */

import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuthOrNull } from "@/contexts/AuthContext";
import { invokeEdgeFunction } from "@/lib/edgeFunctionClient";
import { enqueueMemoryEvent } from "@/lib/memoryEventQueue";
import { logger } from "@/lib/logger";
import {
  buildMemoryIdempotencyKey,
  isQuickReactionMissingValue,
  type RecordMemoryEventInput,
} from "@/lib/memoryEvents";

const FOUR_XX_PATTERN = /\b(400|401|402|403|404)\b/;

export function useRecordMemoryEvent() {
  // useAuthOrNull returns null instead of throwing when no AuthProvider
  // is in scope — keeps the hook safe to mount inside isolated component
  // tests that don't wrap with AuthProvider (existing AIChat / MoodOutfit
  // / OutfitGenerate tests don't).
  const auth = useAuthOrNull();
  const userId = auth?.user?.id;

  const mutation = useMutation({
    mutationFn: async (input: RecordMemoryEventInput) => {
      if (!userId) throw new Error("not_authenticated");

      // Pre-flight: drop quick_reaction events with no value to avoid the
      // silent pair-memory bypass (RPC pair_delta derivation depends on
      // polarity).
      if (isQuickReactionMissingValue(input)) {
        logger.warn(
          "useRecordMemoryEvent: dropped quick_reaction without value",
          { signal_type: input.signal_type, source: input.source },
        );
        return null;
      }

      const idempotency_key = buildMemoryIdempotencyKey(userId, input);
      const { data, error } = await invokeEdgeFunction("memory_ingest", {
        body: { ...input, idempotency_key },
        retries: 3,
        timeout: 8000,
      });
      if (error) throw error;
      return data;
    },
    onError: (err, input) => {
      const msg = err instanceof Error ? err.message : String(err);
      // 4xx-class — client mistake (validation failure, locked subscription,
      // 401 stale-JWT after retry). Retrying via the offline queue won't
      // help; drop with a logged warning.
      if (FOUR_XX_PATTERN.test(msg)) {
        logger.warn("memory_ingest 4xx (not enqueueing):", msg);
        return;
      }
      // 5xx / transport / unclassified — enqueue for next-session drain.
      if (!userId) return;
      void enqueueMemoryEvent(userId, input);
      logger.warn("memory_ingest enqueued for retry:", msg);
    },
  });

  // Stable callback identity: depend ONLY on userId. mutate is stable per
  // TanStack v5 contract; we don't list it to avoid future-proofing risk.
  const record = useCallback(
    (input: RecordMemoryEventInput) => {
      if (!userId) return;
      mutation.mutate(input);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );

  return { record, mutation };
}

// ─────────────────────────────────────────────────────────────────
// Backwards-compatible alias for in-flight callers.
// New code should use `useRecordMemoryEvent` directly.
//
// `SignalType` accepts both canonical and legacy names; the edge fn
// normalizes via the P83 helper. Legacy name → canonical mappings are
// the source of truth at `supabase/functions/_shared/style-memory-signals.ts`.
// ─────────────────────────────────────────────────────────────────

export type SignalType =
  | "save_outfit"
  | "unsave_outfit"
  | "rate_outfit"
  | "wear_outfit"
  | "skip_outfit"
  | "reject_outfit"
  | "swap_garment"
  | "quick_reaction"
  | "never_suggest_garment"
  | "like_pair"
  | "dislike_pair"
  | "save"
  | "unsave"
  | "wear_confirm"
  | "swap_choice"
  | "rating"
  | "ignore";

export const useFeedbackSignals = useRecordMemoryEvent;
