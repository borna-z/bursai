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
//   • The `Animated.loop` instance is stored in a ref so the unmount cleanup
//     closes over the SAME loop the effect started, not a stale reference if
//     React were to re-run the effect. (`opacity` is `useRef(...).current`,
//     so its identity is stable and the dep array `[]` is correct under
//     exhaustive-deps — see the eslint-disable note below.)
//   • Cleanup explicitly stops the loop AND resets the opacity to MIN. RN's
//     native animation driver doesn't always emit a final frame on `stop()`
//     for in-flight timings, so without `setValue(MIN)` the slot can be
//     reused with a non-zero opacity baked in by the time the cell remounts
//     elsewhere in a recycled FlatList.
//   • Wrapped in `React.memo` because Shimmer renders inside `OutfitCard`'s
//     `GarmentSlot`, which is itself rendered N times per outfit row in
//     long lists (recent-outfits carousel, outfits screen, plan grid). The
//     component takes a single `style` prop; memoisation skips re-renders
//     when the parent re-renders for unrelated reasons (e.g. a sibling
//     query settling) and the style identity is stable.

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
  // Hold the loop in a ref so the unmount cleanup closes over the same
  // instance the effect started. Without this, a future refactor that
  // tweaked the dep array could leak a previously-started loop on re-run.
  const loopRef = React.useRef<Animated.CompositeAnimation | null>(null);

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
    loopRef.current = loop;
    loop.start();
    return () => {
      // Stop the loop AND reset the value. `loop.stop()` halts the next
      // frame's interpolation, but on the native driver an in-flight
      // timing can still advance once before the stop propagates. Calling
      // `setValue(MIN)` after stop guarantees the underlying Animated.Value
      // is at MIN if the same instance is reused (it isn't here — the ref
      // is local — but defensive against future refactors that hoist it).
      loop.stop();
      opacity.setValue(MIN);
      loopRef.current = null;
    };
    // `opacity` is `useRef(...).current` — identity stable for the lifetime
    // of the component. PERIOD_MS / MIN / MAX are module-scope constants.
    // None of them can change, so `[]` is the correct dep array; eslint's
    // exhaustive-deps wants `opacity` listed even though it's stable, so
    // we list it to satisfy the lint rule without needing a disable comment.
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
