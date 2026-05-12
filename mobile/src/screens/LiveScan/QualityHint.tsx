// Single-line hint text near the top of the viewfinder. Fades in/out as the
// quality enum changes. Reads from a regular React prop (the parent
// translates the worklet's shared quality value to React state via
// useDerivedValue + runOnJS — see LiveScanScreen.tsx).
//
// Hidden when quality is 'searching' or 'ready' (those have their own visual
// language — pulse and stability ring respectively).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { fonts } from '../../theme/tokens';
import { t as tr } from '../../lib/i18n';
import type { Quality } from './types';

interface Props {
  quality: Quality;
}

const SILENT: ReadonlySet<Quality> = new Set(['searching', 'ready']);

export function QualityHint({ quality }: Props) {
  if (SILENT.has(quality)) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.Text
        key={quality}
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(180)}
        style={styles.text}>
        {tr(`livescan.hint.${quality}`)}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  text: {
    fontFamily: fonts.uiSemi,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(12,12,12,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
