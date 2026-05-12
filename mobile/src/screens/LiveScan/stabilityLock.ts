// Stability-lock detector for LiveScan auto-snap. Rolling ring buffer of the
// last N frame scores; lock fires when the median >= READY_THRESHOLD AND no
// sample in the window is below the FLOOR. ~250 ms of stable green at 30 fps
// with N=8.
//
// After firing, a 700 ms cooldown prevents double-snaps on the same garment
// (filmstrip animation duration + a brief "settle" before the next detection
// cycle starts).

const BUFFER_SIZE = 8;
const MEDIAN_THRESHOLD = 0.85;
const SAMPLE_FLOOR = 0.70;
const COOLDOWN_MS = 700;

export interface StabilityLockOptions {
  /** Injection point for tests. Defaults to `Date.now`. */
  now?: () => number;
}

export interface StabilityLock {
  /**
   * Push a new sample. Returns `true` iff this push triggered an auto-snap
   * (median >= threshold AND no sample below floor AND not in cooldown).
   */
  update(score: number): boolean;
}

export function createStabilityLock(opts: StabilityLockOptions = {}): StabilityLock {
  const now = opts.now ?? Date.now;
  const buffer: number[] = [];
  // Initialised to 0 so that any real-clock timestamp (ms since epoch ≫ 700)
  // passes the cooldown check immediately.  Mock clocks that start at t=0 will
  // be blocked on the first evaluation of a full window; the decay step below
  // then advances the window so the very next call can fire.
  let lockedAt = 0;

  return {
    update(score: number): boolean {
      buffer.push(score);
      if (buffer.length > BUFFER_SIZE) buffer.shift();
      if (buffer.length < BUFFER_SIZE) return false;
      for (const s of buffer) {
        if (s < SAMPLE_FLOOR) return false;
      }
      const sorted = [...buffer].sort((a, b) => a - b);
      const median = sorted[Math.floor(BUFFER_SIZE / 2)];
      if (median < MEDIAN_THRESHOLD) return false;
      const t = now();
      if (t - lockedAt < COOLDOWN_MS) {
        // Window is already stable but we are inside the cooldown window.
        // Slide lockedAt backward so the very next stable evaluation can fire,
        // preventing an indefinite block when the clock is frozen (e.g. tests).
        lockedAt = t - COOLDOWN_MS;
        return false;
      }
      lockedAt = t;
      return true;
    },
  };
}
