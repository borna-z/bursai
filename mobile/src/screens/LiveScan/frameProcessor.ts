// On-device object detector + scoring bridge for LiveScan v2.
//
// react-native-vision-camera v5 replaces the v4 worklet API
// (`useFrameProcessor` / `VisionCameraProxy.initFrameProcessorPlugin`) with
// Nitro-based outputs:
//
//   - iOS uses `useObjectOutput`, the native CameraObjectOutput backed by
//     Apple Vision; it emits scanned-object batches on the JS thread.
//   - Android has NO `CameraObjectOutput` implementation in v5. R-A originally
//     wrapped Google MLKit Object Detection in a Kotlin Nitro module driven by
//     `useFrameOutput`, but that path required `react-native-vision-camera-worklets@5`
//     which crashes RN bridgeless boot ("PlatformConstants" TurboModule missing)
//     on Expo SDK 54. See memory: project-vc-worklets-rn-bridgeless-conflict.
//
//     Until that upstream conflict is fixed, Android drives auto-detect
//     from a 2 fps JS polling loop: each tick captures a low-quality
//     photo via the CameraPhotoOutput, resizes to 256 px, then feeds a
//     local stability lock with a synthetic centered box gated on the
//     thumbnail's JPEG byte count. On lock fire, the screen-injected
//     `setCaptureCallback` triggers the same full-quality `capture()`
//     path the iOS auto-snap uses. JP/KR are excluded — those locales
//     force a mandatory shutter sound on every photo capture, which
//     would make the polling loop unusably noisy.
//
// Both platforms write the same three shared values (`score`, `quality`,
// `hasDetectorPlugin`) and run the same `scoreFrame` scoring logic. The
// Android polling loop also writes those values so the bracket overlay
// animates; the screen-side `tickLock` heartbeat is gated to iOS to
// avoid double-firing the stability lock.

import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';
import { useObjectOutput } from 'react-native-vision-camera';
import type {
  CameraObjectOutput,
  CameraOutput,
  CameraPhotoOutput,
  ScannedObject,
} from 'react-native-vision-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { File as FsFile } from 'expo-file-system';
import * as Localization from 'expo-localization';

import { log } from '../../lib/log';
import { scoreFrame } from './scoring';
import { createStabilityLock } from './stabilityLock';
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
   * this is a `CameraObjectOutput` driven by `useObjectOutput`. Android
   * returns `null` (no native object output available in vc v5) and drives
   * auto-snap from a JS polling loop instead — see file header.
   */
  output: CameraOutput | null;
  /**
   * Drop stale detector state when the detector hasn't fired in `staleMs`.
   * Used by the JS-thread heartbeat to re-arm the stability lock between
   * garments on iOS, where `onObjectsScanned` only fires when objects are
   * present. The Android implementation returns a no-op — its polling loop
   * recreates the lock after every fire so staleness has no role.
   */
  markStaleIfNoRecentScan: (staleMs?: number) => void;
  /**
   * Android-only — register the screen's full-quality `capture()` function.
   * The polling loop calls this on lock-fire to trigger auto-snap. iOS does
   * not surface this method; the iOS path drives `capture()` via the
   * screen-side `tickLock` instead.
   */
  setCaptureCallback?: (cb: () => void | Promise<void>) => void;
  /**
   * Android-only — re-arm the auto-snap lock after the user dismisses
   * the review card. With a synthetic high-score signal the lock would
   * otherwise stay disarmed forever (no natural below-floor sample to
   * trigger re-arm) when transitioning between two textured garments.
   * iOS doesn't need this — its lock re-arms via the 250 ms heartbeat
   * + `markStaleIfNoRecentScan`.
   */
  resetLock?: () => void;
}

const DEFAULT_STALE_MS = 500;

// Android JS-poll tuning. 2 fps keeps the final-quality photo output
// (the same one `capture()` uses for real scans) from saturating the
// camera and competing with manual/auto captures on slower devices.
// At 500 ms the stability-lock 8-sample buffer fills in ~4 s, giving
// a framed garment a deliberate "hold steady" feel without permanently
// occupying the photo pipeline. The 256 px thumbnail is small enough
// that expo-image-manipulator stays under one frame budget on mid-tier
// hardware. We use the thumbnail's JPEG byte-count as a coarse "is
// this frame real content?" signal — since we can't run MLKit on the
// bridgeless runtime, JPEG size is the cheapest on-device proxy for
// "did the camera see anything at all?".
const ANDROID_POLL_INTERVAL_MS = 500;
const ANDROID_THUMB_SIZE_PX = 256;
const ANDROID_THUMB_COMPRESS = 0.3;
// Buffer-fill at 2 fps is already ≥ 4 s, so this gate is essentially
// belt-and-suspenders — keep it as a defensive floor against future
// fps changes.
const ANDROID_AUTO_SNAP_COOLDOWN_MS = 2_000;
// Empty-viewfinder gate. At 256 px / quality 0.3, a uniformly dark or
// uniformly bright frame (lens covered, ceiling, blank wall) compresses
// to ~3 KB; a real garment with texture lands at 10–20 KB. Below this
// threshold we feed `scoreFrame` an empty box array — which short-circuits
// to `{ score: 0, quality: 'too_far' }` per scoring.ts. Score = 0 keeps
// the stability lock disarmed AND re-arms it via the SAMPLE_FLOOR rule
// in `stabilityLock.ts`, so the next real garment fires cleanly. This
// prevents the lock from firing on empty rooms or uniform scenes.
const ANDROID_MIN_CONTENT_BYTES = 5_000;
// Mandatory-shutter-sound regions. Android's
// `CameraInfo.mustPlayShutterSound()` returns true in these locales by
// regulation — JP and KR are the canonical cases — and Vision Camera
// honours that even when we pass `enableShutterSound: false`. Polling
// would therefore audibly fire the shutter every 500 ms, which is
// unusable. Detect via `Localization.getLocales()[0].regionCode` and
// disable the JS polling loop in those regions; users there fall back
// to the manual shutter (which makes one sound per intentional
// capture). The set is best-effort — OEMs in other regions sometimes
// mandate sound too, but JP/KR cover the well-documented cases.
const ANDROID_MANDATORY_SHUTTER_REGIONS = new Set(['JP', 'KR']);

// Synthetic centered detected object — 50 % area, perfectly centered.
// We have no real bounding box on Android (no native detector), so this
// stand-in only satisfies the scoring module's geometry checks once
// the JPEG-size gate above has decided the frame is real.
const ANDROID_SYNTHETIC_BOX: DetectedObject = {
  x: 0.25,
  y: 0.25,
  width: 0.5,
  height: 0.5,
  confidence: 0.85,
};

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
    } catch (err) {
      log.error(err, { context: 'LiveScan.frameProcessor.score_frame_failed' });
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
  } catch (err) {
    log.error(err, { context: 'LiveScan.frameProcessor.use_object_output_failed' });
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
// Android path — 2 fps JS polling loop (vc-worklets bypass).
//
// Each tick: capturePhotoToFile (low-quality) → resize to 256 px →
// JPEG-byte content gate → scoreFrame with a synthetic centered box →
// local stability lock. On lock fire, the screen-injected capture
// callback runs the full-quality auto-snap. JP/KR regions are gated out
// to avoid mandatory shutter sound. See file header for the deferred
// Nitro/MLKit path this replaces.
// ---------------------------------------------------------------------------

function useAndroidFrameProcessor(
  shared: FrameProcessorSharedValues,
  photoOutput?: CameraPhotoOutput,
  cameraReady: boolean = false,
): LiveScanFrameProcessor {
  const sharedRef = useRef(shared);
  sharedRef.current = shared;
  // photoOutput lives on the screen and may not exist on first render
  // (camera permission denied, no device, etc.). Read it via a ref so the
  // polling effect doesn't restart when its identity changes — the next
  // tick will simply see the updated value and proceed.
  const photoOutputRef = useRef<CameraPhotoOutput | undefined>(photoOutput);
  photoOutputRef.current = photoOutput;
  // Camera-ready gate. The `<Camera>` JSX only mounts when permission +
  // device + photo output are wired (LiveScanScreen.cameraReady).
  // Without this, the native side throws "Photo Output is not yet
  // attached to the CameraSession!" every tick while the permission
  // fallback is on screen. We read it via a ref + restart the interval
  // when it flips so the loop kicks in immediately on attach.
  const cameraReadyRef = useRef(cameraReady);
  cameraReadyRef.current = cameraReady;

  // Auto-snap callback injected by LiveScanScreen once its `capture` function
  // is defined. Held in a ref so the polling effect can read the latest value
  // without re-running when the callback identity churns.
  const captureCallbackRef = useRef<(() => void | Promise<void>) | null>(null);
  const setCaptureCallback = useCallback(
    (cb: () => void | Promise<void>) => {
      captureCallbackRef.current = cb;
    },
    [],
  );

  // Mutex against overlapping polling captures + last auto-snap timestamp
  // for the 2 s cooldown gate. The screen's auto-snap is awaited inside the
  // tick so a single inFlight flag covers both polling and auto-snap.
  const inFlightRef = useRef(false);
  const lastAutoSnapAtRef = useRef<number>(0);
  // Local stability lock — independent of the screen-side `tickLock`
  // lock (which is iOS-only). One instance per mount; do NOT recreate
  // after fire. The lock's built-in `armed = false` state is what
  // prevents repeated captures of the same still-framed garment; it
  // re-arms only when a below-floor sample arrives, which the byte gate
  // produces when the user moves between garments. The explicit
  // `ANDROID_AUTO_SNAP_COOLDOWN_MS` gate is belt-and-suspenders for
  // pathological re-fires only. `resetLock` (returned below) is the
  // documented out-of-band re-arm path for screen-driven transitions.
  const lockRef = useRef(createStabilityLock());

  useEffect(() => {
    // Region gate: in JP/KR the OS forces shutter sound on every photo
    // capture (see ANDROID_MANDATORY_SHUTTER_REGIONS). Polling there
    // would be unusably noisy, so we leave the detector-unavailable
    // state pinned and let the screen fall back to manual-shutter-only.
    // iOS is unaffected (different photo pipeline).
    const region = Localization.getLocales()[0]?.regionCode ?? '';
    if (ANDROID_MANDATORY_SHUTTER_REGIONS.has(region)) {
      shared.hasDetectorPlugin.value = false;
      shared.score.value = 0;
      shared.quality.value = 'searching';
      return;
    }

    // Pin detector-available so the screen renders the bracket overlay and
    // the JS-poll loop drives `score.value` for the bracket animation. The
    // screen gates `tickLock` + its 250 ms heartbeat behind
    // `Platform.OS === 'ios'` so they don't double-fire on Android.
    shared.hasDetectorPlugin.value = true;
    shared.score.value = 0;
    shared.quality.value = 'searching';

    // Don't start the polling interval until the screen has actually
    // mounted the <Camera> view. The native CameraPhotoOutput is only
    // attached at that point; firing capturePhotoToFile before then throws
    // "Photo Output is not yet attached to the CameraSession!" every tick.
    if (!cameraReady) {
      return () => {
        shared.hasDetectorPlugin.value = false;
        shared.score.value = 0;
        shared.quality.value = 'searching';
      };
    }

    let cancelled = false;

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      if (inFlightRef.current) return;
      if (!cameraReadyRef.current) return;
      const photoOut = photoOutputRef.current;
      if (!photoOut) return;

      inFlightRef.current = true;
      let rawUri: string | null = null;
      let thumbUri: string | null = null;
      try {
        const photo = await photoOut.capturePhotoToFile(
          { flashMode: 'off', enableShutterSound: false },
          {},
        );
        if (cancelled) return;
        rawUri = photo.filePath.startsWith('file://')
          ? photo.filePath
          : `file://${photo.filePath}`;
        const resized = await ImageManipulator.manipulateAsync(
          rawUri,
          [{ resize: { width: ANDROID_THUMB_SIZE_PX } }],
          {
            compress: ANDROID_THUMB_COMPRESS,
            format: ImageManipulator.SaveFormat.JPEG,
          },
        );
        thumbUri = resized.uri;
        if (cancelled) return;

        // Frame-content gate. The synthetic box would otherwise score
        // every frame the same — empty rooms, ceilings, lens-covered
        // shots would all fire the lock. Read the thumbnail's JPEG
        // size: below ANDROID_MIN_CONTENT_BYTES the scene is uniform
        // (low entropy compresses small), so feed `scoreFrame` an
        // empty box array and let it short-circuit to `score = 0`.
        // That keeps the lock disarmed AND re-arms it via the
        // SAMPLE_FLOOR rule in stabilityLock.ts.
        let thumbBytes = 0;
        try {
          const fInfo = new FsFile(thumbUri).info();
          thumbBytes = fInfo.size ?? 0;
        } catch {
          /* swallow — info() is best-effort; we treat unknown as 0 */
        }
        const hasContent = thumbBytes >= ANDROID_MIN_CONTENT_BYTES;

        const metrics: FrameMetrics = {
          exposure: DEFAULT_EXPOSURE,
          sharpness: DEFAULT_SHARPNESS,
        };
        const { score, quality } = scoreFrame(
          hasContent ? [ANDROID_SYNTHETIC_BOX] : [],
          metrics,
        );
        const s = sharedRef.current;
        s.score.value = score;
        s.quality.value = quality;

        const fired = lockRef.current.update(score);
        if (!fired) return;

        // Defensive cooldown — at 2 fps + an 8-sample buffer the natural
        // floor between fires is already ≥ 4 s, so this only catches a
        // pathological re-fire. Don't recreate the lock here; the lock's
        // own armed=false state is what prevents repeated captures of
        // the same still-framed garment, and recreating it bypasses
        // that guard. See `resetLock` for the out-of-band re-arm path.
        const elapsed = Date.now() - lastAutoSnapAtRef.current;
        if (
          lastAutoSnapAtRef.current > 0 &&
          elapsed < ANDROID_AUTO_SNAP_COOLDOWN_MS
        ) {
          return;
        }

        lastAutoSnapAtRef.current = Date.now();
        // Keep the same lock instance: `armed = false` until a real
        // below-floor sample arrives, which the byte-gate produces
        // naturally when the user transitions between garments (lens
        // moves → JPEG byte count drops → score = 0 → re-arms via
        // stabilityLock.ts:54). Without this, a user holding the same
        // garment in frame while analysis is still in flight would
        // trigger another fire every buffer refill.

        const cb = captureCallbackRef.current;
        if (cb) {
          try {
            await cb();
          } catch (err) {
            log.error(err, {
              context: 'LiveScan.frameProcessor.android_auto_snap_failed',
            });
          }
        }
      } catch (err) {
        log.error(err, {
          context: 'LiveScan.frameProcessor.android_poll_tick_failed',
        });
      } finally {
        // Best-effort cleanup of both the raw capture and the resized
        // thumbnail. The raw photo can be a few MB; over a long session
        // it would fill the OS cache directory if left around.
        if (rawUri) {
          try {
            const f = new FsFile(rawUri);
            if (f.exists) f.delete();
          } catch {
            /* swallow — cleanup is best-effort */
          }
        }
        if (thumbUri && thumbUri !== rawUri) {
          try {
            const f = new FsFile(thumbUri);
            if (f.exists) f.delete();
          } catch {
            /* swallow */
          }
        }
        inFlightRef.current = false;
      }
    };

    const id = setInterval(() => {
      void tick();
    }, ANDROID_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
      shared.hasDetectorPlugin.value = false;
      shared.score.value = 0;
      shared.quality.value = 'searching';
    };
  }, [cameraReady, shared.hasDetectorPlugin, shared.score, shared.quality]);

  // No detector → nothing for the stability lock to mark stale. The
  // screen-side `markStaleIfNoRecentScan` heartbeat is iOS-only.
  const markStaleIfNoRecentScanRef = useRef<(staleMs?: number) => void>(
    () => {},
  );

  // Re-arm the lock when the screen signals "user moved on to next
  // garment" (handleNext on review-card dismiss). The natural re-arm
  // via a below-floor sample doesn't fire for textured-to-textured
  // garment transitions — synthetic high scores produce no low samples
  // — so the explicit reset is the only way the lock can fire on the
  // next garment after the first auto-snap.
  const resetLock = useCallback(() => {
    lockRef.current = createStabilityLock();
    lastAutoSnapAtRef.current = 0;
  }, []);

  return {
    output: null,
    markStaleIfNoRecentScan: markStaleIfNoRecentScanRef.current,
    setCaptureCallback,
    resetLock,
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
  photoOutput?: CameraPhotoOutput,
  cameraReady: boolean = false,
): LiveScanFrameProcessor {
  if (Platform.OS === 'android') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAndroidFrameProcessor(shared, photoOutput, cameraReady);
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useIOSFrameProcessor(shared);
}
