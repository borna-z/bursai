// Shimmer skeleton — base color card2, animated highlight at border opacity 0.4, 1200ms loop.
// Drop in place of any data-loaded UI block until content arrives.

import React, { useEffect, useRef } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { duration } from '../theme/animation';

export function Skeleton({ width, height, radius = 8, style }: { width?: number | string; height?: number | string; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTokens();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: duration.standard, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: duration.standard, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={[{ backgroundColor: t.card2, borderRadius: radius, overflow: 'hidden' }, { width: width as number, height: height as number }, style]}>
      <Animated.View style={{ flex: 1, backgroundColor: t.border, opacity }} />
    </View>
  );
}
