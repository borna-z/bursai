// Pure FIFO state machine for the multi-photo Add-piece pipeline. No I/O,
// no React, no module-scope mutable state — every transition is a pure
// function from (state, event) to (state, side-effect descriptor). The
// concurrency pool layer interprets the descriptors against the real world.
//
// Per-item state:
//   pending → in_flight → ready | needs_review | failed
//   ready → saved | skipped
//   failed → pending (retry) | skipped
//   needs_review → ready (user kept) | skipped (user dismissed)
//
// Wave R-D.1 review threshold is implemented here as a pure predicate so it
// can be unit-tested without RN setup.

import type { AnalysisResult } from '../../hooks/useAnalyzeGarment';

export type BatchItemStatus =
  | 'pending'
  | 'in_flight'
  | 'ready'
  | 'needs_review'
  | 'failed'
  | 'saved'
  | 'skipped';

export interface BatchItemState {
  index: number;
  uri: string;
  status: BatchItemStatus;
  storagePath: string | null;
  analysis: AnalysisResult | null;
  errorMessage: string | null;
}

/**
 * Wave R-D.1 — ambiguous-photo review threshold. Photos that `analyze_garment`
 * flags as containing multiple garments OR returns with low confidence land
 * in `needs_review` rather than `ready`. Web parity.
 */
export const REVIEW_CONFIDENCE_FLOOR = 0.65;

export function shouldNeedReview(analysis: AnalysisResult): boolean {
  if (analysis.image_contains_multiple_garments) return true;
  if (typeof analysis.confidence === 'number' && analysis.confidence < REVIEW_CONFIDENCE_FLOOR) {
    return true;
  }
  return false;
}

export function isTerminalStatus(status: BatchItemStatus): boolean {
  return status === 'saved' || status === 'skipped';
}

export function isSettledStatus(status: BatchItemStatus): boolean {
  return status === 'ready' || status === 'failed' || status === 'needs_review';
}

export function createItems(uris: string[]): BatchItemState[] {
  return uris.map((uri, index) => ({
    index,
    uri,
    status: 'pending',
    storagePath: null,
    analysis: null,
    errorMessage: null,
  }));
}

/**
 * Find the next index after `fromIndex` whose item is not in a terminal
 * (saved / skipped) state. Returns -1 when every item is terminal.
 */
export function nextPendingIndexFrom(items: readonly BatchItemState[], fromIndex: number): number {
  for (let i = fromIndex + 1; i < items.length; i++) {
    const status = items[i]?.status;
    if (status && !isTerminalStatus(status)) return i;
  }
  return -1;
}

/**
 * Pure scheduler: given the current queue, current in-flight count, and a
 * concurrency cap, return the indexes of items that should be started right
 * now. Caller passes any prioritised index (the item the user is staring at).
 * The scheduler never mutates inputs.
 */
export function selectStartCandidates(
  items: readonly BatchItemState[],
  inFlightCount: number,
  maxParallel: number,
  prioritiseIndex?: number,
): number[] {
  const slots = maxParallel - inFlightCount;
  if (slots <= 0) return [];
  const out: number[] = [];
  let remaining = slots;

  if (typeof prioritiseIndex === 'number') {
    const target = items[prioritiseIndex];
    if (target && target.status === 'pending') {
      out.push(prioritiseIndex);
      remaining -= 1;
    }
  }

  if (remaining <= 0) return out;

  for (let i = 0; i < items.length && remaining > 0; i++) {
    if (out.includes(i)) continue;
    if (items[i]?.status !== 'pending') continue;
    out.push(i);
    remaining -= 1;
  }
  return out;
}

// ─── Transition helpers ────────────────────────────────────────────────────
//
// Each transition is a pure function that returns the next state. The caller
// (concurrency pool) applies it to the live registry. Returning `null` means
// the transition is invalid for the current state and should be a no-op.

export function transitionToInFlight(item: BatchItemState): BatchItemState | null {
  if (item.status !== 'pending') return null;
  return { ...item, status: 'in_flight' };
}

export function transitionToReady(
  item: BatchItemState,
  analysis: AnalysisResult,
  storagePath: string,
): BatchItemState | null {
  if (item.status !== 'in_flight') return null;
  return {
    ...item,
    status: shouldNeedReview(analysis) ? 'needs_review' : 'ready',
    analysis,
    storagePath,
  };
}

export function transitionToFailed(item: BatchItemState, message: string): BatchItemState | null {
  if (item.status !== 'in_flight') return null;
  return { ...item, status: 'failed', errorMessage: message };
}

export function transitionToSaved(item: BatchItemState): BatchItemState | null {
  if (item.status !== 'ready') return null;
  return { ...item, status: 'saved' };
}

export function transitionToSkipped(item: BatchItemState): BatchItemState | null {
  if (item.status === 'saved' || item.status === 'skipped') return null;
  return { ...item, status: 'skipped', storagePath: null };
}

export function transitionToReviewKept(item: BatchItemState): BatchItemState | null {
  if (item.status !== 'needs_review') return null;
  return { ...item, status: 'ready' };
}

export function transitionForRetry(item: BatchItemState): BatchItemState | null {
  if (item.status !== 'failed') return null;
  return { ...item, status: 'pending', errorMessage: null, storagePath: null };
}
