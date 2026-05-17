// N17 / Copilot #1 — animation tokens.
//
// Pulled out of `tokens.ts` to keep that file free of React Native runtime
// imports (it's a pure data module consumed by `ThemeProvider`). This file
// is the equivalent for motion: shared duration scale + named easings used
// across Gauge, FadeUp, Shimmer, Spinner, Skeleton, ChatHistorySheet so
// future motion tweaks happen in one place.
//
// Conventions:
// - `duration.fast` (220ms): UI feedback — fade-in, sheet open/close
// - `duration.standard` (600ms): primary motion — gauge fill, skeleton breath
// - `duration.slow` (900ms): ambient — spinner rotation
// - `easing.smooth`: design system's signature curve, matches the HTML
//   prototype's `cubic-bezier(0.32, 0.72, 0, 1)` (also called "ease-out-quint")
// - `easing.linear`: only for spinners and similar uniform motion

import { Easing } from 'react-native';

export const duration = {
  fast: 220,
  standard: 600,
  slow: 900,
} as const;

export const easing = {
  smooth: Easing.bezier(0.32, 0.72, 0, 1),
  linear: Easing.linear,
} as const;
