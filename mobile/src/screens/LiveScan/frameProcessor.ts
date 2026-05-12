// On-device object detector + scoring bridge for LiveScan v2.
//
// react-native-vision-camera v5 replaces the old `useFrameProcessor` /
// `VisionCameraProxy.initFrameProcessorPlugin` worklet API with Nitro-based
// outputs. Native on-device object detection (Apple Vision on iOS, the
// equivalent on Android once Nitro support lands) is exposed via
// `VisionCamera.createObjectOutput` and the `useObjectOutput` hook, which
// fires `onObjectsScanned` on the JS thread with bounding boxes already
// normalized to camera space (0..1).
//
// We drive the vision-camera v5 native object output directly. We pass
// `'salient-object'` to surface the most prominent foreground subject —
// that maps well to a hand-held garment in the LiveScan flow. Android is
// not yet supported by v5's CameraObjectOutput; the screen falls back to
// manual-shutter-only mode when `hasDetectorPlugin` is false.
//
// Each scanned batch:
//   1. Convert ScannedObject[] -> DetectedObject[] (already 0..1 coords).
//   2. Synthesize FrameMetrics (the native object output does not surface
//      luminance/sharpness — defaults of 0.5/0.7 keep the scoring math
//      stable; a future iteration can layer a parallel useFrameOutput
//      worklet to compute real exposure/sharpness).
//   3. scoreFrame() computes the FrameScore.
//   4. score + quality are written to shared values the UI reads.
//
// If the platform cannot create a CameraObjectOutput (e.g. Android in the
// current v5 preview, or a misconfigured native build), `hasDetectorPlugin`
// is flipped to false and the hook returns `objectOutput: null` so the
// screen renders the camera + manual shutter without the auto-snap path.

import { useEffect, useMemo, useRef } from 'react';
import { type SharedValue } from 'react-native-reanimated';
import { VisionCamera } from 'react-native-vision-camera';
import type {
  CameraObjectOutput,
  ScannedObject,
} from 'react-native-vision-camera';

import { scoreFrame } from './scoring';
import type { DetectedObject, FrameMetrics, Quality } from './types';

// Default metrics used when the native detector does not expose luminance
// or sharpness. Picked so the scoring math reduces cleanly to a "good
// enough" mid-range — neither penalising nor over-rewarding the frame.
const DEFAULT_EXPOSURE = 0.5;
const DEFAULT_SHARPNESS = 0.7;

export interface FrameProcessorSharedValues {
  score: SharedValue<number>;
  quality: SharedValue<Quality>;
  hasDetectorPlugin: SharedValue<boolean>;
}

export interface LiveScanFrameProcessor {
  /**
   * The CameraObjectOutput to attach to `<Camera outputs={[objectOutput]} />`,
   * or `null` if native object detection could not be initialised on this
   * platform / build (screen should fall back to manual shutter only).
   */
  objectOutput: CameraObjectOutput | null;
  /**
   * Drop stale detector state when `onObjectsScanned` hasn't fired in
   * `staleMs`. Vision Camera only emits the callback when at least one
   * object is detected — between garments the viewfinder may be empty for
   * hundreds of ms, during which `score.value` would otherwise hold the
   * last well-framed garment's value and prevent the stability lock from
   * re-arming. Call this from the screen's heartbeat tick before reading
   * `score.value`.
   */
  markStaleIfNoRecentScan: (staleMs?: number) => void;
}

const DEFAULT_STALE_MS = 500;

function toDetectedObjects(objects: ScannedObject[]): DetectedObject[] {
  const out: DetectedObject[] = [];
  for (const o of objects) {
    const bb = o.boundingBox;
    if (
      !bb ||
      typeof bb.width !== 'number' ||
      typeof bb.height !== 'number' ||
      bb.width <= 0 ||
      bb.height <= 0
    ) {
      continue;
    }
    out.push({
      x: bb.x,
      y: bb.y,
      width: bb.width,
      height: bb.height,
      // The v5 ScannedObject API does not surface a confidence value, so
      // we default to a mid-high value when the detector returned anything
      // at all. Down-stream scoring treats this as a soft prior.
      confidence: 0.8,
    });
  }
  return out;
}

/**
 * Create the LiveScan v2 frame-processing pipeline.
 *
 * Returns a `CameraObjectOutput` (or `null` on unsupported platforms) to
 * attach to the `<Camera />` view. As the native detector emits batches of
 * scanned objects, the hook writes the computed score + quality back to
 * the supplied shared values. The shared values are read on the UI thread
 * by overlay components (BracketOverlay, QualityHint) and on the JS thread
 * by the stability lock.
 *
 * We replicate `useObjectOutput` inline rather than calling it directly
 * because `VisionCamera.createObjectOutput()` may throw on platforms that
 * have not yet implemented the Nitro CameraObjectOutput; wrapping the
 * creation in try/catch here lets the screen degrade to manual-shutter
 * mode instead of crashing.
 */
export function useLiveScanFrameProcessor(
  shared: FrameProcessorSharedValues,
): LiveScanFrameProcessor {
  // Keep the latest shared-value refs accessible from the (long-lived)
  // onObjectsScanned closure without forcing the output to be recreated
  // every render. This mirrors the ref pattern used inside
  // vision-camera's own `useFrameOutput`.
  const sharedRef = useRef(shared);
  sharedRef.current = shared;

  // Wall-clock timestamp of the last `onObjectsScanned` callback. Used by
  // `markStaleIfNoRecentScan` to detect empty-viewfinder gaps and force
  // the score back to 0 so the stability lock can re-arm for the next
  // garment. `0` means "never scanned yet" — also treated as stale once
  // the detector hook has confirmed it's available.
  const lastScannedAtRef = useRef<number>(0);

  const objectOutput = useMemo<CameraObjectOutput | null>(() => {
    try {
      return VisionCamera.createObjectOutput({
        enabledObjectTypes: ['salient-object'],
      });
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (objectOutput == null) {
      shared.hasDetectorPlugin.value = false;
      shared.score.value = 0;
      shared.quality.value = 'searching';
      return;
    }
    shared.hasDetectorPlugin.value = true;

    const callback = (objects: ScannedObject[]): void => {
      // Record fire timestamp first — even an empty / malformed batch
      // counts as "the detector is alive", which keeps the staleness
      // reset from clobbering a legitimate low-score frame.
      lastScannedAtRef.current = Date.now();
      const s = sharedRef.current;
      try {
        const boxes = toDetectedObjects(objects);
        const metrics: FrameMetrics = {
          exposure: DEFAULT_EXPOSURE,
          sharpness: DEFAULT_SHARPNESS,
        };
        const { score, quality } = scoreFrame(boxes, metrics);
        s.score.value = score;
        s.quality.value = quality;
      } catch {
        // Never propagate detector errors into the render loop — the screen
        // must keep working even if a single frame's payload is malformed.
        s.score.value = 0;
        s.quality.value = 'searching';
      }
    };

    try {
      objectOutput.setOnObjectsScannedCallback(callback);
    } catch {
      // Defensive: if the callback hook itself rejects, fall back to
      // manual-shutter mode rather than tearing down the screen.
      shared.hasDetectorPlugin.value = false;
    }

    return () => {
      try {
        objectOutput.setOnObjectsScannedCallback(undefined);
      } catch {
        // Output may already be torn down — nothing actionable.
      }
    };
  }, [objectOutput, shared.hasDetectorPlugin, shared.score, shared.quality]);

  // Stable reference (via useRef) so the screen can include this in
  // `useEffect` / `useCallback` dep arrays without retriggering on every
  // render. The underlying behaviour reads the latest shared values out
  // of `sharedRef`, so the snapshot taken at hook init stays correct.
  const markStaleIfNoRecentScanRef = useRef<(staleMs?: number) => void>(
    (staleMs?: number) => {
      const last = lastScannedAtRef.current;
      // First-tick guard: if we haven't received any callback yet, don't
      // reset. Two reasons: (1) the detector hook may not have wired the
      // callback up at all (Android in v5, or a failed init) — in which
      // case the `detectorAvailable === false` path on the screen pins
      // score/quality directly. (2) On a fresh cold start the detector
      // may legitimately need a few hundred ms to spin up its first
      // scan; we don't want to fight that warmup.
      if (last === 0) return;
      const ms = staleMs ?? DEFAULT_STALE_MS;
      if (Date.now() - last <= ms) return;
      const s = sharedRef.current;
      s.score.value = 0;
      s.quality.value = 'too_far';
    },
  );

  return {
    objectOutput,
    markStaleIfNoRecentScan: markStaleIfNoRecentScanRef.current,
  };
}
