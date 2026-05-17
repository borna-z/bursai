// N3b — Lightweight toast helper wrapping `react-native-toast-message`.
//
// Why a wrapper rather than calling `Toast.show()` directly: the call sites
// scatter across ~15 screens, each picking up its own props quirks. Funnelling
// every toast through `showToast()` (a) gives us one place to swap the
// implementation if we ever drop the dep, (b) gives us one place to fold in
// haptics / a11y / analytics later, and (c) keeps callers terse — a single
// argument for the message, optional kind.
//
// Classification rule (mirrors N3b spec):
//   - Toast: non-blocking success / transient errors / "Saved" / "Failed,
//     retry". The user can keep using the app while the toast fades.
//   - Alert.alert: confirmation dialogs (delete, mark all worn, sign out),
//     error states that block flow, native permission prompts. Anything that
//     needs an explicit acknowledge or an action choice.
//
// The companion `<Toast />` host lives in App.tsx at the bottom of the tree
// (after NavigationContainer) so toasts paint above every screen.

import Toast from 'react-native-toast-message';

export type ToastKind = 'success' | 'error' | 'info';

/**
 * Show a transient, non-blocking toast.
 *
 * @param kind — visual style; mapped onto the underlying lib's `type`.
 * @param message — primary line. Required.
 * @param description — optional secondary line. Use sparingly.
 *
 * Errors swallowed silently — toasts must never themselves crash the app.
 * If the host `<Toast />` isn't mounted yet (cold launch race), the call
 * is a no-op rather than a throw.
 */
export function showToast(
  kind: ToastKind,
  message: string,
  description?: string,
): void {
  try {
    Toast.show({
      type: kind,
      text1: message,
      text2: description,
      // 3 s for success, 4 s for errors — gives the user enough to read
      // a one-line failure without lingering forever.
      visibilityTime: kind === 'error' ? 4000 : 3000,
      // Bottom is friendlier on RN — top can collide with the navigation
      // header and the iOS notch. Bottom sits clear of the bottom-tab nav
      // because we host the toast layer above the tab bar in App.tsx.
      position: 'bottom',
      bottomOffset: 80,
    });
  } catch (_toastHostNotMounted) {
    // intentional silent: the documented cold-launch race where the toast
    // host isn't mounted yet is the only realistic failure path here, and
    // it is not user-impacting. Codex round-8 P3 (PR #884) — instrumenting
    // would pollute the production error dashboard with non-actionable noise.
  }
}

/** Hide any visible toast. Useful when navigating away mid-toast. */
export function hideToast(): void {
  try {
    Toast.hide();
  } catch (_toastHostNotMounted) {
    // intentional silent: same reasoning as showToast — never crash the host.
  }
}
