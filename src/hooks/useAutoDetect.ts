import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Frame-differencing hook that detects when the camera view stabilizes
 * (i.e. a garment is held still in front of it).
 *
 * Returns a stability progress (0–1), framing guidance, lockConfidence (0–1),
 * and fires onStable() when the scene has been still for `stableMs` milliseconds.
 */

const SAMPLE_SIZE = 64; // downscale to 64×64 for diffing
const DIFF_THRESHOLD = 0.04; // max avg pixel diff to count as "stable" (0–1)
const SAMPLE_INTERVAL = 100; // ms between samples
const STABLE_DURATION = 250; // ms of stability before firing (tightened for snappy lock)
const COOLDOWN = 350; // ms after firing before re-arming

export type FramingHint = 'ready' | 'more_light' | 'too_close' | 'too_far' | 'multiple_objects' | null;

interface UseAutoDetectOptions {
  enabled: boolean;
  videoEl: HTMLVideoElement | null;
  busy: boolean; // true when processing/showing result
  onStable: () => void;
}

/** Simple Sobel-ish edge count on greyscale 64×64 data */
function computeEdgeDensity(data: Uint8ClampedArray): { overall: number; border: number; center: number } {
  const w = SAMPLE_SIZE;
  const h = SAMPLE_SIZE;
  let edgeCount = 0;
  let borderEdgeCount = 0;
  let centerEdgeCount = 0;
  const borderZone = 8; // pixels from edge considered "border"
  const centerZone = 12; // pixels from center considered "center"
  const cx0 = Math.floor(w / 2) - centerZone;
  const cx1 = Math.floor(w / 2) + centerZone;
  const cy0 = Math.floor(h / 2) - centerZone;
  const cy1 = Math.floor(h / 2) + centerZone;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const l = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      const idxR = (y * w + x + 1) * 4;
      const lR = (data[idxR] + data[idxR + 1] + data[idxR + 2]) / 3;
      const idxD = ((y + 1) * w + x) * 4;
      const lD = (data[idxD] + data[idxD + 1] + data[idxD + 2]) / 3;

      const grad = Math.abs(l - lR) + Math.abs(l - lD);
      if (grad > 30) {
        edgeCount++;
        if (x < borderZone || x >= w - borderZone || y < borderZone || y >= h - borderZone) {
          borderEdgeCount++;
        }
        if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) {
          centerEdgeCount++;
        }
      }
    }
  }

  const totalPixels = (w - 2) * (h - 2);
  const borderPixels = totalPixels - (w - 2 - 2 * borderZone) * (h - 2 - 2 * borderZone);
  const centerPixels = (cx1 - cx0) * (cy1 - cy0);
  return {
    overall: edgeCount / totalPixels,
    border: borderPixels > 0 ? borderEdgeCount / borderPixels : 0,
    center: centerPixels > 0 ? centerEdgeCount / centerPixels : 0,
  };
}

function computeBrightness(data: Uint8ClampedArray): number {
  // Sample center 50% region
  const w = SAMPLE_SIZE;
  const h = SAMPLE_SIZE;
  const x0 = Math.floor(w * 0.25);
  const x1 = Math.floor(w * 0.75);
  const y0 = Math.floor(h * 0.25);
  const y1 = Math.floor(h * 0.75);
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * w + x) * 4;
      sum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      count++;
    }
  }
  return count > 0 ? sum / count : 128;
}

/**
 * Compute lock confidence (0–1) based on edge density quality.
 * High center edges + low border edges = focused garment = high confidence.
 * High border edges = cluttered background or too close.
 */
function computeLockConfidence(edges: { overall: number; border: number; center: number }): number {
  if (edges.overall < 0.03) return 0; // nothing visible
  // Ideal: high center, low border
  const centerSignal = Math.min(edges.center / 0.3, 1); // saturates at 0.3
  const borderPenalty = Math.min(edges.border / 0.5, 1); // penalize cluttered borders
  return Math.max(0, Math.min(1, centerSignal * (1 - borderPenalty * 0.5)));
}

export function useAutoDetect({ enabled, videoEl, busy, onStable }: UseAutoDetectOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevDataRef = useRef<Uint8ClampedArray | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const cooldownUntilRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastSampleRef = useRef(0);
  const [progress, setProgress] = useState(0); // 0–1
  const [framingHint, setFramingHint] = useState<FramingHint>(null);
  const [lockConfidence, setLockConfidence] = useState(0);
  const hintDebounceRef = useRef<FramingHint>(null);
  const hintTimerRef = useRef<number>(0);

  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      const c = document.createElement('canvas');
      c.width = SAMPLE_SIZE;
      c.height = SAMPLE_SIZE;
      canvasRef.current = c;
    }
    return canvasRef.current;
  }, []);

  // Debounced hint setter to prevent flickering
  const setHintDebounced = useCallback((hint: FramingHint) => {
    if (hint === hintDebounceRef.current) return;
    hintDebounceRef.current = hint;
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => {
      setFramingHint(hint);
    }, 300);
  }, []);

  useEffect(() => {
    if (!enabled || !videoEl || busy) {
      setProgress(0);
      setFramingHint(null);
      setLockConfidence(0);
      stableSinceRef.current = null;
      prevDataRef.current = null;
      return;
    }

    let active = true;

    function tick() {
      if (!active || !videoEl) return;
      const now = performance.now();

      if (now - lastSampleRef.current >= SAMPLE_INTERVAL) {
        lastSampleRef.current = now;

        if (now < cooldownUntilRef.current) {
          setProgress(0);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        if (videoEl.readyState < 2 || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
          stableSinceRef.current = null;
          prevDataRef.current = null;
          setProgress(0);
          setLockConfidence(0);
          setHintDebounced(null);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const canvas = getCanvas();
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(videoEl, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const currentData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;

        // Compute framing guidance
        const brightness = computeBrightness(currentData);
        const edges = computeEdgeDensity(currentData);
        const confidence = computeLockConfidence(edges);
        setLockConfidence(confidence);

        if (brightness < 60) {
          setHintDebounced('more_light');
        } else if (edges.border > 0.6) {
          setHintDebounced('too_close');
        } else if (edges.overall < 0.05) {
          setHintDebounced('too_far');
        } else if (edges.border > 0.35 && edges.overall > 0.2) {
          setHintDebounced('multiple_objects');
        } else {
          setHintDebounced('ready');
        }

        if (prevDataRef.current) {
          // Calculate average pixel difference (luminance only for speed)
          let totalDiff = 0;
          const len = SAMPLE_SIZE * SAMPLE_SIZE;
          for (let i = 0; i < len; i++) {
            const idx = i * 4;
            const dR = Math.abs(currentData[idx] - prevDataRef.current[idx]);
            const dG = Math.abs(currentData[idx + 1] - prevDataRef.current[idx + 1]);
            const dB = Math.abs(currentData[idx + 2] - prevDataRef.current[idx + 2]);
            totalDiff += (dR + dG + dB) / 3;
          }
          const avgDiff = totalDiff / len / 255;

          if (avgDiff < DIFF_THRESHOLD) {
            if (!stableSinceRef.current) {
              stableSinceRef.current = now;
            }
            const elapsed = now - stableSinceRef.current;
            const p = Math.min(elapsed / STABLE_DURATION, 1);
            setProgress(p);

            if (p >= 1) {
              stableSinceRef.current = null;
              prevDataRef.current = null;
              cooldownUntilRef.current = now + COOLDOWN;
              setProgress(0);
              onStable();
              rafRef.current = requestAnimationFrame(tick);
              return;
            }
          } else {
            stableSinceRef.current = null;
            setProgress(0);
          }
        }

        prevDataRef.current = new Uint8ClampedArray(currentData);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      clearTimeout(hintTimerRef.current);
    };
  }, [enabled, videoEl, busy, onStable, getCanvas, setHintDebounced]);

  return { progress, framingHint, lockConfidence };
}
