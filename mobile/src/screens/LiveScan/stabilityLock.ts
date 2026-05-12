// Stability-lock detector for LiveScan auto-snap. Rolling ring buffer of the
// last N frame scores; lock fires when the median >= READY_THRESHOLD AND no
// sample in the window is below the FLOOR. ~250 ms of stable green at 30 fps
// with N=8.
//
// After firing, the lock disarms and stays disarmed until a sample below
// SAMPLE_FLOOR is observed — i.e. the user moved the garment out of frame or
// the scene was interrupted. This prevents a user who holds the phone steady
// on the same garment from enqueueing repeated captures of the same item
// once the 700 ms cooldown elapses. The 700 ms cooldown stays as a secondary
// safety net for edge cases (filmstrip animation, weird detector misfires
// before any below-floor sample is observed).

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
  // `null` means "never fired" — distinguishes a fresh detector from one
  // that fired at t=0 (mock clock).  Without this, the cooldown gate has to
  // do a "decay on block" hack to escape; that hack lets a stable garment
  // re-fire on the very next frame after a real auto-snap, enqueueing
  // duplicate uploads.  Skipping the cooldown check entirely while
  // `lockedAt === null` keeps the first fire clean and the cooldown honest
  // for every subsequent fire.
  let lockedAt: number | null = null;
  // Armed gate: starts true, flips to false on a successful fire, flips
  // back to true the next time a below-floor sample is observed. Without
  // this, a user who holds the phone on the same garment after auto-snap
  // would re-fire as soon as the 700 ms cooldown elapsed.
  let armed = true;

  return {
    update(score: number): boolean {
      // Re-arm whenever a below-floor sample is seen — the garment moved
      // out of frame or the scene was interrupted. This is the only way
      // to re-arm post-fire; a stable above-floor score will not.
      if (score < SAMPLE_FLOOR) {
        armed = true;
      }
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
      if (lockedAt !== null && t - lockedAt < COOLDOWN_MS) return false;
      if (!armed) return false;
      armed = false;
      lockedAt = t;
      return true;
    },
  };
}
