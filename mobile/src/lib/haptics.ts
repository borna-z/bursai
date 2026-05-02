// Tap-feedback shim. The real implementation will use `expo-haptics`
// (`Haptics.impactAsync(...)`) once the package is added — adding new packages
// requires explicit user approval per CLAUDE.md, so this file is a no-op stub
// today. The point: every Pressable in the app calls one of these helpers, so
// the day expo-haptics is added is a one-line wire-up at the bottom of this
// file rather than a 30-site sweep.
//
// Usage:
//   import { hapticLight } from '../lib/haptics';
//   <Pressable onPress={() => { hapticLight(); doThing(); }} />
//
// Helpers map onto Expo's intensity scale:
//   light    → Haptics.ImpactFeedbackStyle.Light
//   medium   → Haptics.ImpactFeedbackStyle.Medium
//   heavy    → Haptics.ImpactFeedbackStyle.Heavy
//   success  → Haptics.NotificationFeedbackType.Success
//   warning  → Haptics.NotificationFeedbackType.Warning
//   error    → Haptics.NotificationFeedbackType.Error
//   selection→ Haptics.selectionAsync()

export function hapticLight(): void {
  // no-op until expo-haptics is wired
}

export function hapticMedium(): void {
  // no-op
}

export function hapticHeavy(): void {
  // no-op
}

export function hapticSuccess(): void {
  // no-op
}

export function hapticWarning(): void {
  // no-op
}

export function hapticError(): void {
  // no-op
}

export function hapticSelection(): void {
  // no-op
}
