import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Frame-differencing hook that detects when the camera view stabilizes
 * (i.e. a garment is held still in front of it).
 *
 * Returns a stability progress (0–1) and fires onStable() when the
 * scene has been still for `stableMs` milliseconds.
 */

const SAMPLE_SIZE = 64; // downscale to 64×64 for diffing
const DIFF_THRESHOLD = 0.04; // max avg pixel diff to count as "stable" (0–1)
const SAMPLE_INTERVAL = 150; // ms between samples
const STABLE_DURATION = 600; // ms of stability before firing
const COOLDOWN = 800; // ms after firing before re-arming

interface UseAutoDetectOptions {
  enabled: boolean;
  videoEl: HTMLVideoElement | null;
  busy: boolean; // true when processing/showing result
  onStable: () => void;
}

export function useAutoDetect({ enabled, videoEl, busy, onStable }: UseAutoDetectOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevDataRef = useRef<Uint8ClampedArray | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const cooldownUntilRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastSampleRef = useRef(0);
  const [progress, setProgress] = useState(0); // 0–1

  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      const c = document.createElement('canvas');
      c.width = SAMPLE_SIZE;
      c.height = SAMPLE_SIZE;
      canvasRef.current = c;
    }
    return canvasRef.current;
  }, []);

  useEffect(() => {
    if (!enabled || !videoEl || busy) {
      setProgress(0);
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

        const canvas = getCanvas();
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(videoEl, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const currentData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;

        if (prevDataRef.current) {
          // Calculate average pixel difference (luminance only for speed)
          let totalDiff = 0;
          const len = SAMPLE_SIZE * SAMPLE_SIZE;
          for (let i = 0; i < len; i++) {
            const idx = i * 4;
            // Approximate luminance diff
            const dR = Math.abs(currentData[idx] - prevDataRef.current[idx]);
            const dG = Math.abs(currentData[idx + 1] - prevDataRef.current[idx + 1]);
            const dB = Math.abs(currentData[idx + 2] - prevDataRef.current[idx + 2]);
            totalDiff += (dR + dG + dB) / 3;
          }
          const avgDiff = totalDiff / len / 255; // normalize to 0–1

          if (avgDiff < DIFF_THRESHOLD) {
            // Scene is stable
            if (!stableSinceRef.current) {
              stableSinceRef.current = now;
            }
            const elapsed = now - stableSinceRef.current;
            const p = Math.min(elapsed / STABLE_DURATION, 1);
            setProgress(p);

            if (p >= 1) {
              // Fire!
              stableSinceRef.current = null;
              prevDataRef.current = null;
              cooldownUntilRef.current = now + COOLDOWN;
              setProgress(0);
              onStable();
              rafRef.current = requestAnimationFrame(tick);
              return;
            }
          } else {
            // Scene changed — reset
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
    };
  }, [enabled, videoEl, busy, onStable, getCanvas]);

  return { progress };
}
