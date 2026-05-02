/**
 * Wave 8.5 PR B — caller-facing types + helpers for memory_ingest invocation.
 *
 * The `memory_ingest` edge function (P85, shipped in PR A #709) accepts the
 * same shape via JSON body; this module is the TS-typed counterpart used by
 * the rewritten `useRecordMemoryEvent` hook + the IndexedDB offline queue.
 *
 * Shape uses snake_case to match the wire contract — the edge fn doesn't
 * camelCase-transform.
 */

import type { CanonicalStyleMemorySignal } from "@/types/styleMemory";

/**
 * Caller input to `useRecordMemoryEvent.record(...)`. Mirrors the
 * `memory_ingest` edge function body shape.
 *
 * Notes per audit fold-ins:
 *
 * - `metadata` is `Record<string, unknown>` end-to-end (NOT `Record<string,
 *   string>` — the legacy hook had a wrong cast that Postgres tolerated but
 *   downstream readers couldn't trust). Numeric values, arrays, nested
 *   objects all pass through unchanged.
 * - For `signal_type === "quick_reaction"`, `value` is REQUIRED (one of
 *   `"like" | "dislike" | "love" | "meh" | "thumbs_up" | "thumbs_down"`).
 *   The hook enforces this and silently drops events that omit it — the
 *   pair-memory derivation in the `ingest_memory_event` RPC depends on
 *   polarity, and a value-less reaction collapses to zero pair delta.
 */
export interface RecordMemoryEventInput {
  /** Canonical or legacy name; normalized server-side via the P83 helper. */
  signal_type: CanonicalStyleMemorySignal | string;
  /** Outfit-level identifier — required for outfit-level signals. */
  outfit_id?: string;
  /**
   * Single-garment identifier — currently used for `never_suggest_garment`.
   * Outfit-level signals should use `garment_ids` instead.
   */
  garment_id?: string;
  /** Full garment roster involved in the event. */
  garment_ids?: string[];
  /** swap_garment: ids removed from the outfit. */
  removed_garment_ids?: string[];
  /** swap_garment: ids added to the outfit. */
  added_garment_ids?: string[];
  /** rate_outfit: 1-5 star value. */
  rating?: number;
  /** Free-text feedback (rejected outfit explanation, etc.). */
  feedback_text?: string;
  /**
   * Direction or polarity. REQUIRED when `signal_type === "quick_reaction"`
   * — without it the pair-memory delta defaults to 0 and the signal silently
   * fails to update memory. The hook's mutationFn enforces this.
   */
  value?: string;
  /** Free-form metadata bag. */
  metadata?: Record<string, unknown>;
  /** Analytics tag identifying the call site. */
  source?: string;
}

/**
 * Build the idempotency key for a `memory_ingest` call.
 *
 * The key collapses double-tap, React StrictMode double-invokes, and React
 * Query retry within a 60-second window so the server-side
 * `request_idempotency` cache returns the same response without burning
 * rate-limit quota.
 *
 * Shape: `${userId}:${signal_type}:${target}:${minute_bucket}` where
 *
 *   - `target` = `outfit_id` if set, else sorted
 *     `garment_ids.join(',')`, else literal `'_'`.
 *   - `minute_bucket` = `floor(now_ms / 60_000)`.
 *
 * @param userId  Verified user id — pass from the auth context. NEVER trust
 *   client-supplied user_id.
 * @param input   `RecordMemoryEventInput`.
 * @param nowMs   Clock injection for tests; defaults to `Date.now()`.
 */
export function buildMemoryIdempotencyKey(
  userId: string,
  input: RecordMemoryEventInput,
  nowMs: number = Date.now(),
): string {
  const target =
    input.outfit_id != null && input.outfit_id !== ""
      ? input.outfit_id
      : input.garment_ids && input.garment_ids.length > 0
        ? [...input.garment_ids].sort().join(",")
        : "_";
  const bucket = Math.floor(nowMs / 60_000);
  return `${userId}:${input.signal_type}:${target}:${bucket}`;
}

/**
 * Quick-reaction value guard — enforced at the hook layer.
 *
 * The `ingest_memory_event` RPC derives `pair_delta` from `value` for
 * `quick_reaction`. A reaction with no value collapses to 0 delta and
 * silently fails to update pair memory. Surfaced by the PR A
 * pre-implementation audit.
 *
 * @returns true when the input is a quick_reaction without a value.
 */
export function isQuickReactionMissingValue(
  input: RecordMemoryEventInput,
): boolean {
  return (
    input.signal_type === "quick_reaction" &&
    (input.value == null || input.value === "")
  );
}
