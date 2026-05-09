// Shimmer — looped opacity pulse used as a loading overlay on top of the
// existing colored gradient fallbacks (OutfitCard slot tiles while their
// signed URL is resolving). Stays subtle on purpose: the gradient already
// gives a visual identity per garment, the shimmer just signals "still
// loading" so a permanently-stuck slot reads differently from a fresh one.
//
// Animated.Value drives a sine-ish opacity loop between MIN and MAX over
// PERIOD ms. native driver flag is on so the JS thread isn't taxed during
// long lists. Stops on unmount via the standard cleanup contract.
//
// N3.5 (2026-05-09) — cleanup hardening for long-list virtualisation:
//   • The cleanup arrow closes over the local `loop` const created by the
//     same effect run, so an unmount synchronously stops the loop it
//     started. The dep array is `[opacity]` (NOT `[]`) to satisfy
//     `react-hooks/exhaustive-deps` without `eslint-disable` — `opacity` is
//     `useRef(...).current` whose identity is stable for the component's
//     lifetime, so the effect runs exactly once on mount and once on
//     unmount even with the dep listed.
//   • Cleanup explicitly stops the loop AND resets the opacity to MIN. RN's
//     native animation driver doesn't always emit a final frame on `stop()`
//     for in-flight timings; without `setValue(MIN)` the underlying value
//     can be left at the in-progress interpolation point. (Defensive
//     against future refactors that hoist `opacity` outside the component.)
//   • Wrapped in `React.memo` because Shimmer renders inside `OutfitCard`'s
//     `GarmentSlot`, which is itself rendered N times per outfit row in
//     long lists (recent-outfits carousel, outfits screen, plan grid). The
//     component takes a single optional `style` prop; both current call
//     sites (`<Shimmer />` in OutfitCard.GarmentSlot and HomeScreen's
//     RecentMosaicSlot) pass no style, so the default shallow-equal check
//     short-circuits reliably. Future callers passing inline-object styles
//     would defeat memo — pass a stable reference (`StyleSheet.create` or
//     module-scope literal) if the perf matters at that call site.

import React from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';

const PERIOD_MS = 1200;
const MIN = 0.0;
// Subtle pulse — the gradient underneath already gives the slot an identity;
// a stronger overlay just looks like a flash. Tuned by eye against the warm
// gold + neutral palette so the effect reads as "still loading" without
// fighting the photo that lands when the URL resolves.
const MAX = 0.18;

function ShimmerInner({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTokens();
  const opacity = React.useRef(new Animated.Value(MIN)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: MAX,
          duration: PERIOD_MS / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: MIN,
          duration: PERIOD_MS / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      // Stop the loop AND reset the value. `loop.stop()` halts the next
      // frame's interpolation, but on the native driver an in-flight
      // timing can still advance once before the stop propagates. Calling
      // `setValue(MIN)` after stop snaps the value back to baseline so a
      // future refactor that hoists `opacity` outside the component (e.g.
      // for shared-shimmer perf) wouldn't see a stale non-zero value.
      loop.stop();
      opacity.setValue(MIN);
    };
    // `opacity` is `useRef(...).current` — identity stable for the lifetime
    // of the component. PERIOD_MS / MIN / MAX are module-scope constants
    // and don't change. We list `opacity` (not `[]`) to satisfy
    // `react-hooks/exhaustive-deps` without an `eslint-disable`; because
    // its identity never changes, the effect still runs exactly once.
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: t.fg,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Memoised so a parent re-render that doesn't change `style` identity
// (the common case in long lists where the parent re-renders because a
// sibling query settled) skips the Shimmer reconciliation. The default
// shallow-equal check on `style` is correct here because callers pass
// either `undefined` or a stable style object.
export const Shimmer = React.memo(ShimmerInner);
