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
 * rate-limit quota — while still letting *distinct* events on the same
 * outfit/garment within the same minute pass through (e.g. quick_reaction
 * "like" → "love", rating 2 → 5, swap with different garment sets,
 * different rejected-outfit feedback). The payload-discriminator segment
 * keeps true replays colliding while letting genuinely different events
 * earn their own server-side cache row.
 *
 * Shape: `${userId}:${signal_type}:${target}:${discriminator}:${bucket}` where
 *
 *   - `target` = first non-empty of `outfit_id`, `garment_id`, sorted
 *     `garment_ids.join(',')`, else literal `'_'`.
 *   - `discriminator` = stable serialization of the payload fields that
 *     differentiate semantic events (`value`, `rating`,
 *     `added_garment_ids`, `removed_garment_ids`, `feedback_text`,
 *     `metadata`). Empty when no differentiating fields are set, so simple
 *     events keep terse keys.
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
  const outfitTarget =
    input.outfit_id != null && input.outfit_id !== "" ? input.outfit_id : null;
  const singleGarmentTarget =
    input.garment_id != null && input.garment_id !== ""
      ? input.garment_id
      : null;
  const target =
    outfitTarget ??
    singleGarmentTarget ??
    (input.garment_ids && input.garment_ids.length > 0
      ? [...input.garment_ids].sort().join(",")
      : "_");
  const discriminator = buildPayloadDiscriminator(input);
  const bucket = Math.floor(nowMs / 60_000);
  return `${userId}:${input.signal_type}:${target}:${discriminator}:${bucket}`;
}

/**
 * Stable serialization of the payload fields that differentiate semantic
 * events. Empty string when no differentiating fields are set.
 *
 * Field order is fixed (alphabetical-by-prefix) so that callers passing
 * the same fields in different declaration order produce identical keys.
 * Arrays are sorted before joining; metadata keys are sorted before
 * stringification. `feedback_text` is truncated to its length + first 64
 * chars to keep the key bounded — distinct user-typed feedback within a
 * minute is rare and the server-side cache TTL is short.
 */
function buildPayloadDiscriminator(input: RecordMemoryEventInput): string {
  const parts: string[] = [];
  if (
    input.added_garment_ids != null &&
    input.added_garment_ids.length > 0
  ) {
    parts.push(`a=${[...input.added_garment_ids].sort().join(",")}`);
  }
  if (input.feedback_text != null && input.feedback_text !== "") {
    const t = input.feedback_text;
    parts.push(`f=${t.length}:${t.slice(0, 64)}`);
  }
  if (input.metadata != null && Object.keys(input.metadata).length > 0) {
    parts.push(`m=${stableStringify(input.metadata)}`);
  }
  if (input.rating != null) {
    parts.push(`r=${input.rating}`);
  }
  if (input.value != null && input.value !== "") {
    parts.push(`v=${input.value}`);
  }
  if (
    input.removed_garment_ids != null &&
    input.removed_garment_ids.length > 0
  ) {
    parts.push(`x=${[...input.removed_garment_ids].sort().join(",")}`);
  }
  return parts.join("|");
}

/**
 * Stable JSON stringify with sorted object keys. Recursive over nested
 * objects + arrays so callers passing the same logical metadata in
 * different key order produce identical output.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
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
