// Wraps newly-loaded content for a 220ms cubic-bezier(.32,.72,0,1) translateY(8 → 0) + opacity 0 → 1.
// Stagger child entries by passing `delay`.

import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { duration, easing } from '../theme/animation';

export function FadeUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: duration.fast, delay, easing: easing.smooth, useNativeDriver: true }),
      Animated.timing(ty,      { toValue: 0, duration: duration.fast, delay, easing: easing.smooth, useNativeDriver: true }),
    ]).start();
  }, [opacity, ty, delay]);

  return <Animated.View style={[{ opacity, transform: [{ translateY: ty }] }, style]}>{children}</Animated.View>;
}
