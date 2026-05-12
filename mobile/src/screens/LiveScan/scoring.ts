// Pure frame-scoring logic for LiveScan auto-detect. Runs in the Vision
// Camera frame processor worklet (no React imports, no platform APIs).
//
// Inputs: detected object boxes + per-frame luminance/sharpness metrics.
// Output: a 0–1 score and a quality enum the UI consumes.
//
// Tuning constants live at the top so a one-line edit moves thresholds.

import type { DetectedObject, FrameMetrics, FrameScore, Quality } from './types';

export const SCORING_WEIGHTS = {
  centered: 0.30,
  size: 0.30,
  sharp: 0.25,
  light: 0.15,
} as const;

// Area (width*height) thresholds — all in normalized 0–1 units.
const SIZE_IDEAL_MIN = 0.09; // box must cover at least 9% of the frame
const SIZE_IDEAL_MAX = 0.60; // beyond 60% the garment is uncomfortably close
const SIZE_TOO_CLOSE = 0.70; // above 70% → "too close" feedback
const SIZE_TOO_FAR = 0.06;   // below 6%  → "too far"  feedback

// Luminance below this fraction of max → low-light warning.
const EXPOSURE_LOW = 0.3;

// Fraction of the unit diagonal below which the garment is off-center.
const CENTERED_THRESHOLD = 0.50;

// Composite score at which the UI shows the "ready" indicator.
const READY_THRESHOLD = 0.85;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clamp = (v: number): number => Math.max(0, Math.min(1, v));

/** Return the box with the largest area, or null for an empty array. */
function pickLargest(boxes: DetectedObject[]): DetectedObject | null {
  if (boxes.length === 0) return null;
  let best = boxes[0];
  let bestArea = best.width * best.height;
  for (let i = 1; i < boxes.length; i++) {
    const area = boxes[i].width * boxes[i].height;
    if (area > bestArea) {
      best = boxes[i];
      bestArea = area;
    }
  }
  return best;
}

/**
 * Centeredness score (0–1). 1 = box center coincides with frame center.
 * Falls off linearly to 0 at the corners of the unit frame (half-diagonal
 * ≈ 0.707).
 */
function centerednessOf(box: DetectedObject): number {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = cx - 0.5;
  const dy = cy - 0.5;
  // Max possible distance from center to corner of unit square = sqrt(0.5^2+0.5^2)
  const dist = Math.sqrt(dx * dx + dy * dy);
  return clamp(1 - dist / 0.7071);
}

/**
 * Size-fit score (0–1). 1 inside [SIZE_IDEAL_MIN, SIZE_IDEAL_MAX]; linear
 * ramps outside.
 */
function sizeFitOf(box: DetectedObject): number {
  const area = box.width * box.height;
  if (area >= SIZE_IDEAL_MIN && area <= SIZE_IDEAL_MAX) return 1;
  if (area < SIZE_IDEAL_MIN) return clamp(area / SIZE_IDEAL_MIN);
  // Linear falloff: 1 at SIZE_IDEAL_MAX → 0 at 1.0
  return clamp((1 - area) / (1 - SIZE_IDEAL_MAX));
}

/** Sharpness sub-score: already 0–1, just clamped defensively. */
function sharpnessScore(m: FrameMetrics): number {
  return clamp(m.sharpness);
}

/**
 * Exposure sub-score: triangular peak at 0.5 (ideal), falls to 0 at 0.0 and
 * 1.0 (pure black / pure white).
 */
function exposureScore(m: FrameMetrics): number {
  return clamp(1 - Math.abs(m.exposure - 0.5) * 2);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Input shape for the standalone quality derivation helper. */
export interface DerivationInput {
  score: number;
  sizeFit: number;
  centeredness: number;
  exposure: number;
}

/**
 * Derive a Quality enum from pre-computed sub-scores.
 *
 * Priority order (first match wins):
 *   1. low_light  — exposure too dark regardless of framing
 *   2. too_close  — sizeFit component signals oversized box
 *   3. not_centered — center score below threshold
 *   4. ready      — composite score high enough
 *   5. searching  — catch-all
 *
 * Note: `too_far` cannot be derived from sizeFit alone because sizeFit is
 * symmetric (low value means either too-far OR too-close). The `scoreFrame`
 * function uses the raw area value for that distinction.
 */
export function deriveQuality(input: DerivationInput): Quality {
  if (input.exposure < EXPOSURE_LOW) return 'low_light';
  if (input.sizeFit > 0.85) return 'too_close';
  if (input.centeredness < CENTERED_THRESHOLD) return 'not_centered';
  if (input.score >= READY_THRESHOLD) return 'ready';
  return 'searching';
}

/**
 * Score a single frame given detected bounding boxes and luminance/sharpness
 * metrics.
 *
 * - Picks the largest detected box (most likely the primary garment).
 * - Returns score=0 / quality='too_far' when no boxes are present so the UI
 *   immediately shows a "move closer" hint on an empty frame.
 */
export function scoreFrame(boxes: DetectedObject[], metrics: FrameMetrics): FrameScore {
  const box = pickLargest(boxes);
  if (!box) {
    return { score: 0, quality: 'too_far' };
  }

  const area = box.width * box.height;
  const c = centerednessOf(box);
  const s = sizeFitOf(box);
  const sharp = sharpnessScore(metrics);
  const light = exposureScore(metrics);

  const score = clamp(
    SCORING_WEIGHTS.centered * c +
      SCORING_WEIGHTS.size * s +
      SCORING_WEIGHTS.sharp * sharp +
      SCORING_WEIGHTS.light * light,
  );

  // Priority order: exposure and box size dominate; centeredness next; then
  // composite score; catch-all is 'searching'.
  let quality: Quality;
  if (metrics.exposure < EXPOSURE_LOW) {
    quality = 'low_light';
  } else if (area > SIZE_TOO_CLOSE) {
    quality = 'too_close';
  } else if (area < SIZE_TOO_FAR) {
    quality = 'too_far';
  } else if (c < CENTERED_THRESHOLD) {
    quality = 'not_centered';
  } else if (score >= READY_THRESHOLD) {
    quality = 'ready';
  } else {
    quality = 'searching';
  }

  return { score, quality };
}
