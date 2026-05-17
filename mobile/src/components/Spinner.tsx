// 22px circular gold spinner — 900ms linear rotate.
// Used inline inside buttons + sticky CTAs while a request is in flight.

import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTokens } from '../theme/ThemeProvider';
import { duration, easing } from '../theme/animation';

export function Spinner({ size = 22 }: { size?: number }) {
  const t = useTokens();
  const rot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: duration.slow, useNativeDriver: true, easing: easing.linear })
    );
    loop.start();
    return () => loop.stop();
  }, [rot]);

  const transform = [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }];
  const r = size / 2 - 2;
  const C = 2 * Math.PI * r;

  return (
    <Animated.View style={{ width: size, height: size, transform }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.accentSoft} strokeWidth={1.4} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t.accent}
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * 0.7}
        />
      </Svg>
    </Animated.View>
  );
}
