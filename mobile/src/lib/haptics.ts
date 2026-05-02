// Tap-feedback wrappers around expo-haptics. Centralized so call-sites
// (`hapticLight()` etc.) stay decoupled from the underlying API — switching to
// react-native-haptic-feedback or a custom native module later is one file.
//
// Usage:
//   import { hapticLight } from '../lib/haptics';
//   <Pressable onPress={() => { hapticLight(); doThing(); }} />
//
// All calls are fire-and-forget. expo-haptics returns a Promise but we never
// await — UI feedback shouldn't block the next action. Errors swallow because
// (a) on web/simulator the API silently no-ops, (b) on a real device a haptic
// failure is never user-visible.

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Web has no haptic surface — skip the no-op call to avoid console noise.
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(fn: () => Promise<unknown>): void {
  if (!supported) return;
  fn().catch(() => {
    // Swallow — haptics are non-critical UI feedback.
  });
}

export function hapticLight(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticMedium(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function hapticHeavy(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

export function hapticSuccess(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticWarning(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function hapticError(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

export function hapticSelection(): void {
  safe(() => Haptics.selectionAsync());
}
