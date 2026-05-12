// On-device object detector + scoring bridge for LiveScan v2.
//
// react-native-vision-camera v5 replaces the v4 worklet API
// (`useFrameProcessor` / `VisionCameraProxy.initFrameProcessorPlugin`) with
// Nitro-based outputs:
//
//   - iOS uses `useObjectOutput`, the native CameraObjectOutput backed by
//     Apple Vision; it emits scanned-object batches on the JS thread.
//   - Android has NO `CameraObjectOutput` implementation in v5, so we wrap
//     Google MLKit Object Detection in a Kotlin Nitro module
//     (`HybridGarmentDetector`) and call it from a `useFrameOutput` worklet
//     on the frame-processor thread.
//
// Both paths converge on the same three shared values
// (`score`, `quality`, `hasDetectorPlugin`) and the same `scoreFrame`
// scoring logic, so `LiveScanScreen.tsx` is platform-agnostic.
//
// Returned shape — `{ output: CameraOutput | null, markStaleIfNoRecentScan }`
// — lets `LiveScanScreen.tsx` build its `outputs` array without a
// `Platform.OS` check. `output` is whatever output (object or frame) drives
// the detector on this platform, or `null` if creation failed.

import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';
import { useFrameOutput, useObjectOutput } from 'react-native-vision-camera';
import type {
  CameraFrameOutput,
  CameraObjectOutput,
  CameraOutput,
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
   * The CameraOutput to attach to `<Camera outputs={[…, output]} />`. On iOS
   * this is a `CameraObjectOutput` driven by `useObjectOutput`; on Android
   * it is a `CameraFrameOutput` driven by `useFrameOutput` that calls the
   * Nitro MLKit detector inside a worklet. `null` when creation failed and
   * the screen should fall back to manual-shutter-only mode.
   */
  output: CameraOutput | null;
  /**
   * Drop stale detector state when the detector hasn't fired in `staleMs`.
   * Used by the JS-thread heartbeat to re-arm the stability lock between
   * garments. The Android path is driven by `useFrameOutput` which fires
   * every frame regardless of detection presence, so staleness is only
   * meaningful on the iOS path (where `onObjectsScanned` only fires when
   * objects are present). The Android implementation returns a no-op.
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

// ---------------------------------------------------------------------------
// iOS path — `useObjectOutput` driven by Apple Vision
// ---------------------------------------------------------------------------

function useIOSFrameProcessor(
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

  // Stable callback — `useObjectOutput` re-registers via useEffect when
  // its identity changes, so keep this identity stable across renders.
  // We read the latest shared refs through `sharedRef.current` to avoid
  // tearing down and recreating the object output every render.
  const onObjectsScanned = useCallback((objects: ScannedObject[]): void => {
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
  }, []);

  // v5 public API: pass `types` + `onObjectsScanned` at hook-creation time.
  // The hook handles the createObjectOutput + setOnObjectsScannedCallback
  // wiring internally. If the underlying native output cannot be created
  // (unsupported platform / misconfigured build), the call throws
  // synchronously and we fall back to manual-shutter mode.
  //
  // rules-of-hooks: the try/catch here does NOT change the hook call
  // ordering — `useObjectOutput` is invoked in the same position on every
  // render. We only catch the synchronous platform-unsupported throw from
  // its internal `VisionCamera.createObjectOutput()` so the screen can
  // degrade gracefully instead of crashing inside React render. If the
  // hook throws on render N, render N+1 will throw at the same call site
  // again — hook count stays consistent. The lint rule is a heuristic and
  // can't distinguish this safe pattern from a true conditional hook.
  let objectOutput: CameraObjectOutput | null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    objectOutput = useObjectOutput({
      types: ['salient-object'],
      onObjectsScanned,
    });
  } catch {
    objectOutput = null;
  }

  useEffect(() => {
    if (objectOutput == null) {
      shared.hasDetectorPlugin.value = false;
      shared.score.value = 0;
      shared.quality.value = 'searching';
      return;
    }
    shared.hasDetectorPlugin.value = true;
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
    output: objectOutput,
    markStaleIfNoRecentScan: markStaleIfNoRecentScanRef.current,
  };
}

// ---------------------------------------------------------------------------
// Android path — `useFrameOutput` worklet driving the Nitro MLKit detector
// ---------------------------------------------------------------------------

function useAndroidFrameProcessor(
  shared: FrameProcessorSharedValues,
): LiveScanFrameProcessor {
  // Lazy-require so iOS bundles never execute `NitroModules.createHybridObject`
  // — the `GarmentDetector` hybrid is only registered on the Android native
  // side. Inside an `android` Platform.OS branch this is safe; bundlers keep
  // the require call but `Platform.OS` is constant per platform so the iOS
  // build can tree-shake / never reach this line.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { garmentDetector } = require('./garmentDetector') as typeof import('./garmentDetector');

  // Capture once at hook init: the detector is registered at native module
  // load. If the require above succeeded, the Nitro hybrid is callable.
  // This mirrors the iOS path's `hasDetectorPlugin = true` semantics.
  useEffect(() => {
    shared.hasDetectorPlugin.value = true;
  }, [shared.hasDetectorPlugin]);

  let frameOutput: CameraFrameOutput | null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    frameOutput = useFrameOutput({
      pixelFormat: 'yuv',
      onFrame(frame) {
        'worklet';
        // Call the Nitro detector synchronously on the frame-processor
        // thread. Returns `DetectedBox[]` with normalized coordinates
        // already — the shape exactly matches `DetectedObject` (the
        // scoring layer's input contract).
        try {
          const boxes = garmentDetector.detect(frame);
          const metrics: FrameMetrics = {
            exposure: DEFAULT_EXPOSURE,
            sharpness: DEFAULT_SHARPNESS,
          };
          const { score, quality } = scoreFrame(boxes, metrics);
          shared.score.value = score;
          shared.quality.value = quality;
        } catch {
          // Swallow per-frame detector errors — the next frame's worklet
          // invocation will retry. We don't reset the shared values here
          // (a transient throw shouldn't clobber the last good frame).
        } finally {
          // ALWAYS dispose the frame, even on detector failure. Skipping
          // dispose stalls the vision-camera pipeline (see Frame.dispose
          // docstring) and frames start dropping.
          frame.dispose();
        }
      },
    });
  } catch {
    frameOutput = null;
  }

  useEffect(() => {
    if (frameOutput == null) {
      shared.hasDetectorPlugin.value = false;
      shared.score.value = 0;
      shared.quality.value = 'searching';
    }
  }, [frameOutput, shared.hasDetectorPlugin, shared.score, shared.quality]);

  // The Android worklet fires on every frame (not just when objects are
  // present), so staleness has no useful meaning here — the shared values
  // are updated continuously. Provide a stable no-op for the union contract.
  const markStaleIfNoRecentScanRef = useRef<(staleMs?: number) => void>(
    () => {},
  );

  return {
    output: frameOutput,
    markStaleIfNoRecentScan: markStaleIfNoRecentScanRef.current,
  };
}

// ---------------------------------------------------------------------------
// Platform dispatcher
// ---------------------------------------------------------------------------

/**
 * Create the LiveScan v2 frame-processing pipeline.
 *
 * Returns a `CameraOutput` (or `null` on unsupported platforms / failed
 * native init) to attach to the `<Camera />` view. As the native detector
 * emits per-frame scores, the hook writes them back to the supplied shared
 * values. The shared values are read on the UI thread by overlay components
 * (BracketOverlay, QualityHint) and on the JS thread by the stability lock.
 *
 * `Platform.OS` is constant at runtime for the lifetime of the JS bundle,
 * so calling different hooks on different platforms does not violate React's
 * hook ordering rules — each render on a given platform calls the same hook
 * sequence in the same order.
 */
export function useLiveScanFrameProcessor(
  shared: FrameProcessorSharedValues,
): LiveScanFrameProcessor {
  if (Platform.OS === 'android') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAndroidFrameProcessor(shared);
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useIOSFrameProcessor(shared);
}
