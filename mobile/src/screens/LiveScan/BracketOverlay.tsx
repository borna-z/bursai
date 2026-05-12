// Animated viewfinder brackets + stability ring for LiveScan.
//
// Reads two shared values: `score` (0–1, drives bracket color + opacity) and
// `lockProgress` (0–1, drives the stability ring fill). Both are written by
// the parent screen — this component is pure presentation, no logic.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const ACCENT_GOLD = '#FFD96B';
const WHITE = '#FFFFFF';
const BRACKET_SIZE = 28;
const BRACKET_INSET = 24;
const STROKE = 2;

interface Props {
  score: SharedValue<number>;
  lockProgress: SharedValue<number>;
}

export function BracketOverlay({ score, lockProgress }: Props) {
  // Pulse opacity when score is low (searching state)
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.6, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const opacity = useDerivedValue(() => {
    return score.value > 0.5 ? 1 : pulse.value;
  });

  const color = useDerivedValue(() => {
    return interpolateColor(score.value, [0, 1], [WHITE, ACCENT_GOLD]);
  });

  const bracketStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    borderColor: color.value,
  }));

  const ringStyle = useAnimatedStyle(() => {
    const p = lockProgress.value;
    return {
      opacity: p > 0 ? 1 : 0,
      transform: [{ scale: interpolate(p, [0, 1], [0.95, 1.0]) }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Stability ring — a thin gold rounded-rect outline that scales in */}
      <Animated.View style={[styles.ring, ringStyle]} />

      {/* Corner brackets */}
      <Animated.View style={[styles.bracket, styles.bracketTL, bracketStyle]} />
      <Animated.View style={[styles.bracket, styles.bracketTR, bracketStyle]} />
      <Animated.View style={[styles.bracket, styles.bracketBL, bracketStyle]} />
      <Animated.View style={[styles.bracket, styles.bracketBR, bracketStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bracket: {
    position: 'absolute',
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
  },
  bracketTL: { top: BRACKET_INSET, left: BRACKET_INSET, borderTopWidth: STROKE, borderLeftWidth: STROKE },
  bracketTR: { top: BRACKET_INSET, right: BRACKET_INSET, borderTopWidth: STROKE, borderRightWidth: STROKE },
  bracketBL: { bottom: BRACKET_INSET, left: BRACKET_INSET, borderBottomWidth: STROKE, borderLeftWidth: STROKE },
  bracketBR: { bottom: BRACKET_INSET, right: BRACKET_INSET, borderBottomWidth: STROKE, borderRightWidth: STROKE },
  ring: {
    position: 'absolute',
    top: BRACKET_INSET - 4,
    left: BRACKET_INSET - 4,
    right: BRACKET_INSET - 4,
    bottom: BRACKET_INSET - 4,
    borderWidth: 1.5,
    borderColor: ACCENT_GOLD,
    borderRadius: 12,
  },
});
