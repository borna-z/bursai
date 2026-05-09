// Shimmer — looped opacity pulse used as a loading overlay on top of the
// existing colored gradient fallbacks (OutfitCard slot tiles while their
// signed URL is resolving). Stays subtle on purpose: the gradient already
// gives a visual identity per garment, the shimmer just signals "still
// loading" so a permanently-stuck slot reads differently from a fresh one.
//
// Animated.Value drives a sine-ish opacity loop between MIN and MAX over
// PERIOD ms. native driver flag is on so the JS thread isn't taxed during
// long lists. Stops on unmount via the standard cleanup contract.

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

export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
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
    return () => loop.stop();
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
