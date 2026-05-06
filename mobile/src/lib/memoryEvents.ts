// Mobile mirror of `src/lib/memoryEvents.ts` (web). The edge-function body
// contract for `memory_ingest` is the same on both platforms — this file
// keeps the input type, the idempotency-key derivation, and the
// quick_reaction value guard byte-for-byte aligned so a future test suite
// can compare both code paths without subtle drift.
//
// Note (Wave 8.5 P0 caught in PR #712): the wire field is `signal_type`,
// NOT `event_type`. The pre-M10 mobile `MemoryIngestEvent` shape used the
// wrong field, which the server silently 400'd. Migrating to this type
// also fixes that latent bug.

import type { CanonicalStyleMemorySignal } from '../../../src/types/styleMemory';

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
   * fails to update memory.
   */
  value?: string;
  /** Free-form metadata bag. */
  metadata?: Record<string, unknown>;
  /** Analytics tag identifying the call site. */
  source?: string;
}

/**
 * Stable idempotency key for a `memory_ingest` call. Mirrors web's
 * derivation (lib/memoryEvents.ts) so both clients collide on identical
 * events but distinct events on the same outfit/garment within the same
 * minute still pass through.
 *
 * Shape: `${userId}:${signal_type}:${target}:${discriminator}:${minute_bucket}`
 *   - `target` = first non-empty of `outfit_id`, `garment_id`, sorted
 *     `garment_ids.join(',')`, else literal `'_'`.
 *   - `discriminator` = stable serialization of payload fields that
 *     differentiate semantic events (`value`, `rating`,
 *     `added_garment_ids`, `removed_garment_ids`, `feedback_text`,
 *     `metadata`). Empty when no differentiating fields are set.
 *   - `minute_bucket` = `floor(now_ms / 60_000)`.
 */
export function buildMemoryIdempotencyKey(
  userId: string,
  input: RecordMemoryEventInput,
  nowMs: number = Date.now(),
): string {
  const outfitTarget =
    input.outfit_id != null && input.outfit_id !== '' ? input.outfit_id : null;
  const singleGarmentTarget =
    input.garment_id != null && input.garment_id !== '' ? input.garment_id : null;
  const target =
    outfitTarget ??
    singleGarmentTarget ??
    (input.garment_ids && input.garment_ids.length > 0
      ? [...input.garment_ids].sort().join(',')
      : '_');
  const discriminator = buildPayloadDiscriminator(input);
  const bucket = Math.floor(nowMs / 60_000);
  return `${userId}:${input.signal_type}:${target}:${discriminator}:${bucket}`;
}

function buildPayloadDiscriminator(input: RecordMemoryEventInput): string {
  const parts: string[] = [];
  if (input.added_garment_ids != null && input.added_garment_ids.length > 0) {
    parts.push(`a=${[...input.added_garment_ids].sort().join(',')}`);
  }
  if (input.feedback_text != null && input.feedback_text !== '') {
    const t = input.feedback_text;
    parts.push(`f=${t.length}:${t.slice(0, 64)}`);
  }
  if (input.metadata != null && Object.keys(input.metadata).length > 0) {
    parts.push(`m=${stableStringify(input.metadata)}`);
  }
  if (input.rating != null) {
    parts.push(`r=${input.rating}`);
  }
  if (input.value != null && input.value !== '') {
    parts.push(`v=${input.value}`);
  }
  if (input.removed_garment_ids != null && input.removed_garment_ids.length > 0) {
    parts.push(`x=${[...input.removed_garment_ids].sort().join(',')}`);
  }
  return parts.join('|');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

/** Quick-reaction value guard — drop calls that would silently collapse to
 * a 0 pair_delta on the server. Mirrors web. */
export function isQuickReactionMissingValue(input: RecordMemoryEventInput): boolean {
  return (
    input.signal_type === 'quick_reaction' &&
    (input.value == null || input.value === '')
  );
}

// ─── typed event creators ─────────────────────────────────────────────
// Thin helpers so call sites don't have to remember the field names. Each
// returns a `RecordMemoryEventInput` ready for `recordMemoryEvent`.

export function saveOutfitEvent(
  outfitId: string,
  source: string,
): RecordMemoryEventInput {
  return { signal_type: 'save_outfit', outfit_id: outfitId, source };
}

export function unsaveOutfitEvent(
  outfitId: string,
  source: string,
): RecordMemoryEventInput {
  return { signal_type: 'unsave_outfit', outfit_id: outfitId, source };
}

export function wearOutfitEvent(
  outfitId: string,
  garmentIds: string[],
  source: string,
): RecordMemoryEventInput {
  return {
    signal_type: 'wear_outfit',
    outfit_id: outfitId,
    ...(garmentIds.length > 0 ? { garment_ids: garmentIds } : {}),
    source,
  };
}

export function skipOutfitEvent(
  outfitId: string,
  source: string,
): RecordMemoryEventInput {
  return { signal_type: 'skip_outfit', outfit_id: outfitId, source };
}

export function rejectOutfitEvent(
  outfitId: string,
  feedbackText: string | undefined,
  source: string,
): RecordMemoryEventInput {
  return {
    signal_type: 'reject_outfit',
    outfit_id: outfitId,
    ...(feedbackText && feedbackText.trim().length > 0
      ? { feedback_text: feedbackText.trim() }
      : {}),
    source,
  };
}

export function rateOutfitEvent(
  outfitId: string,
  rating: number,
  source: string,
): RecordMemoryEventInput {
  return { signal_type: 'rate_outfit', outfit_id: outfitId, rating, source };
}

export function swapGarmentEvent(
  outfitId: string,
  removed: string[],
  added: string[],
  source: string,
): RecordMemoryEventInput {
  return {
    signal_type: 'swap_garment',
    outfit_id: outfitId,
    removed_garment_ids: removed,
    added_garment_ids: added,
    source,
  };
}

export function neverSuggestGarmentEvent(
  garmentId: string,
  source: string,
): RecordMemoryEventInput {
  return { signal_type: 'never_suggest_garment', garment_id: garmentId, source };
}

export function quickReactionEvent(
  outfitId: string,
  value: 'like' | 'dislike' | 'love' | 'meh' | 'thumbs_up' | 'thumbs_down',
  source: string,
): RecordMemoryEventInput {
  return { signal_type: 'quick_reaction', outfit_id: outfitId, value, source };
}

export function likePairEvent(
  garmentIds: [string, string],
  source: string,
): RecordMemoryEventInput {
  return { signal_type: 'like_pair', garment_ids: garmentIds, source };
}

export function dislikePairEvent(
  garmentIds: [string, string],
  source: string,
): RecordMemoryEventInput {
  return { signal_type: 'dislike_pair', garment_ids: garmentIds, source };
}
