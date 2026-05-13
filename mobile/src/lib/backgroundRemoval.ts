// On-device background removal — Wave R-B.
//
// Thin JS wrapper around the `BackgroundRemoval` native module shipped by
// `mobile/plugins/with-background-removal/`. The module wraps:
//   - iOS 17+: Vision's `VNGenerateForegroundInstanceMaskRequest`
//   - iOS 15/16: returns status='unavailable' (no native subject seg)
//   - Android 7+ (API 24+): MLKit Subject Segmentation 16.0.0-beta1
//
// API contract (both platforms):
//   maskImage(uri: string) -> Promise<MaskResult>
//   prepare()              -> Promise<void>  // warm-up at app boot
//
// Quality gate: if the native side reports `confidence < 0.5` OR throws,
// it returns the original URI with `status='failed'`. The JS layer always
// receives a usable URI.
//
// Save-time blocking timeout: callers can `await removeBackground(uri)`
// freely, but if the user advances faster than the mask resolves, the
// caller can race against `MASK_SAVE_TIMEOUT_MS` and fall through to the
// raw URI. Mirrors the wave spec's 800ms cap.
//
// Dedupe: rapid-fire requests for the same source URI are coalesced onto
// a single in-flight promise. The wave's batch and rapid-fire LiveScan
// flows can call `removeBackground` aggressively without re-running the
// native segmenter for an identical input.

import { NativeModules, Platform } from 'react-native';

/** Mean alpha confidence threshold below which the native side returns the
 * raw URI with `status='failed'`. Tunable from device tests. */
export const MASK_CONFIDENCE_THRESHOLD = 0.5;

/** Save-time blocking cap. Reserved for the Save-path wiring R-C / R-D
 * will land (Step 3 commit + batch); the LiveScan pipeline currently
 * runs segmentation in parallel with raw upload and never blocks the
 * user on it. Kept as a documented constant so the timeout is single-
 * source-of-truth when those wirings land. */
export const MASK_SAVE_TIMEOUT_MS = 800;

export type MaskStatus = 'masked' | 'unavailable' | 'failed';

export interface MaskResult {
  /** file:// URI to the masked WebP, or to the original on fallback. */
  uri: string;
  status: MaskStatus;
  /** Mean alpha 0..1. Always populated; 0 on fallback. */
  confidence: number;
  /** Native-side wall time in ms. Best-effort telemetry signal. */
  durationMs: number;
}

interface BackgroundRemovalNativeModule {
  maskImage(uri: string): Promise<MaskResult>;
  prepare(): Promise<void>;
}

const native = (NativeModules.BackgroundRemoval as BackgroundRemovalNativeModule | undefined) ?? null;

/** Cache keyed by source URI so rapid-fire callers share a single in-flight
 * native request. Cleared on resolve so a re-segment after a different
 * input still runs. */
const inFlight = new Map<string, Promise<MaskResult>>();

function unavailableResult(uri: string): MaskResult {
  return { uri, status: 'unavailable', confidence: 0, durationMs: 0 };
}

function failedResult(uri: string): MaskResult {
  return { uri, status: 'failed', confidence: 0, durationMs: 0 };
}

/** App-boot warm-up. On Android this triggers the Play Services Subject
 * Segmentation module download (silent, ~10MB, one-time per device).
 * Safe to call multiple times — both platforms are no-op if already
 * prepared. Failures are swallowed: warm-up is an optimization, not a
 * correctness gate. The first `maskImage` call still works (and will
 * trigger the download itself on Android). */
export async function prepare(): Promise<void> {
  if (!native) return;
  try {
    await native.prepare();
  } catch {
    // Warm-up failure is non-fatal — first real call will retry.
  }
}

/** Segment the subject out of the source image. Always resolves: errors
 * fall through to a `{ uri: <raw>, status: 'failed' }` result so callers
 * never have to wrap this in try/catch. */
export function removeBackground(uri: string): Promise<MaskResult> {
  if (!native) {
    return Promise.resolve(unavailableResult(uri));
  }
  // Native modules expose maskImage only when the platform has a usable
  // segmentation API. On iOS 15/16 (no Vision subject seg) the native
  // side returns status='unavailable' directly; we don't have to gate
  // here. Web / unsupported runtimes lose the module entirely → the
  // `!native` branch above handles it.

  const cached = inFlight.get(uri);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const result = await native.maskImage(uri);
      // Defensive coercion: a malformed payload from the native side
      // shouldn't crash callers. Normalize to the documented shape.
      const status: MaskStatus =
        result?.status === 'masked' || result?.status === 'unavailable' || result?.status === 'failed'
          ? result.status
          : 'failed';
      return {
        uri: typeof result?.uri === 'string' && result.uri.length > 0 ? result.uri : uri,
        status,
        confidence: typeof result?.confidence === 'number' ? result.confidence : 0,
        durationMs: typeof result?.durationMs === 'number' ? result.durationMs : 0,
      };
    } catch {
      return failedResult(uri);
    } finally {
      inFlight.delete(uri);
    }
  })();

  inFlight.set(uri, promise);
  return promise;
}

/** Feature detection. Always false on web (the native module is absent),
 * true elsewhere (the native side gates iOS version internally and
 * returns 'unavailable' for iOS 15/16). */
export function isBackgroundRemovalAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return native !== null;
}
