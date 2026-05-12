import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

/**
 * One detected object box from MLKit Object Detection.
 * Coordinates are normalized to the frame's logical bounds (0..1).
 */
export interface DetectedBox {
  /** Normalized 0..1 top-left X coordinate. */
  x: number;
  /** Normalized 0..1 top-left Y coordinate. */
  y: number;
  /** Normalized 0..1 width. */
  width: number;
  /** Normalized 0..1 height. */
  height: number;
  /** Detection confidence in 0..1. */
  confidence: number;
}

/**
 * Android Nitro module wrapping MLKit Object Detection for the BURS LiveScan
 * auto-detect / auto-snap flow.
 *
 * iOS uses `useObjectOutput` from `react-native-vision-camera` directly; this
 * spec is therefore Android-only.
 */
export interface GarmentDetector
  extends HybridObject<{ android: 'kotlin' }> {
  /**
   * Run MLKit Object Detection on a vision-camera v5 Frame.
   * Returns zero or more detected boxes with normalized coordinates.
   *
   * Synchronous from the worklet thread; the underlying MLKit `Task` is
   * awaited inline via `Tasks.await(...)` on the frame-processor thread
   * (~15-30ms on a Pixel 6 per R-A.1 findings).
   */
  detect(frame: Frame): DetectedBox[];
}
