/**
 * Haptic-feedback utility.
 * Uses Median.co native haptics when available, falls back to Vibration API.
 */
import { isMedianApp } from './median';

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

function medianHaptic(style: 'light' | 'medium' | 'heavy') {
  if (isMedianApp() && window.median?.haptics?.impact) {
    window.median.haptics.impact(style);
    return true;
  }
  return false;
}

/** Light tap – button presses, selections */
export function hapticLight() {
  if (!medianHaptic('light')) vibrate(10);
}

/** Medium tap – confirmations, saves */
export function hapticMedium() {
  if (!medianHaptic('medium')) vibrate(20);
}

/** Heavy tap – deletes, errors */
export function hapticHeavy() {
  if (!medianHaptic('heavy')) vibrate([30, 50, 30]);
}

/** Success pattern – outfit generated, garment saved */
export function hapticSuccess() {
  if (!medianHaptic('medium')) vibrate([10, 60, 20]);
}
