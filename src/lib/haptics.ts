/**
 * Haptic-feedback utility using the Vibration API.
 * Falls back silently on unsupported browsers / desktop.
 */

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/** Light tap – button presses, selections */
export function hapticLight() {
  vibrate(10);
}

/** Medium tap – confirmations, saves */
export function hapticMedium() {
  vibrate(20);
}

/** Heavy tap – deletes, errors */
export function hapticHeavy() {
  vibrate([30, 50, 30]);
}

/** Success pattern – outfit generated, garment saved */
export function hapticSuccess() {
  vibrate([10, 60, 20]);
}
