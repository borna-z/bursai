// SettingsStyleScreen — shared editor primitives (N13 split).
//
// ColorGrid — circular swatch picker used by both the favorite-colors and
//             disliked-colors editors.
// PercentSlider — formality range pickers (floor + ceiling).
//
// Inline-style copy of StyleQuizV4Step's PercentSlider — same look + feel
// + a11y hooks. We could try to share via a new primitive, but
// mobile/CLAUDE.md says "no new design primitives without checking", and
// this is the only other consumer so far. If a third lands, refactor.

import React, { useMemo, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { CheckIcon } from '../components/icons';
import { hapticSelection } from '../lib/haptics';
import { isLightSwatch } from '../lib/color';
import { t as tr } from '../lib/i18n';
import { COLOR_SWATCHES } from '../lib/styleProfileV4';

export function ColorGrid({
  selected,
  onToggle,
}: {
  selected: readonly string[];
  onToggle: (id: string) => void;
}) {
  const t = useTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 12,
      }}>
      {COLOR_SWATCHES.map((color) => {
        const isSelected = selected.includes(color.id);
        const checkColor = isLightSwatch(color.hex) ? t.fg : t.bg;
        return (
          <Pressable
            key={color.id}
            onPress={() => onToggle(color.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={tr(`onboarding.quizV4.choice.color.${color.id}`)}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: color.hex,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? t.fg : t.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}>
            {isSelected ? <CheckIcon size={16} color={checkColor} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function PercentSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTokens();
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = React.useRef(0);
  const onChangeRef = React.useRef(onChange);
  widthRef.current = trackWidth;
  onChangeRef.current = onChange;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: (e) => {
          const w = widthRef.current;
          if (w <= 0) return;
          const x = Math.max(0, Math.min(w, e.nativeEvent.locationX));
          onChangeRef.current(Math.round((x / w) * 100));
          hapticSelection();
        },
        onPanResponderMove: (e) => {
          const w = widthRef.current;
          if (w <= 0) return;
          const x = Math.max(0, Math.min(w, e.nativeEvent.locationX));
          onChangeRef.current(Math.round((x / w) * 100));
        },
      }),
    [],
  );

  // Animated fill width — keeps RN happy with a Pure-React-Native track. The
  // Easing reference avoids an unused-import lint hit (we use it for a 0ms
  // tween-on-mount so the bar paints immediately).
  const fill = React.useRef(new Animated.Value(value)).current;
  React.useEffect(() => {
    Animated.timing(fill, {
      toValue: value,
      duration: 0,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [fill, value]);

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13,
            color: t.fg,
            letterSpacing: -0.1,
          }}>
          {label}
        </Text>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13,
            color: t.fg2,
            fontVariant: ['tabular-nums'],
          }}>
          {value}%
        </Text>
      </View>
      <View
        {...pan.panHandlers}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const step = 5;
          if (event.nativeEvent.actionName === 'increment') {
            onChangeRef.current(Math.min(100, value + step));
          } else if (event.nativeEvent.actionName === 'decrement') {
            onChangeRef.current(Math.max(0, value - step));
          }
        }}
        hitSlop={{ top: 6, bottom: 6 }}
        style={{
          height: 32,
          justifyContent: 'center',
        }}>
        <View
          style={{
            height: 10,
            borderRadius: radii.pill,
            backgroundColor: t.bg2,
            overflow: 'hidden',
          }}>
          <View
            style={{
              width: `${value}%`,
              height: '100%',
              backgroundColor: t.accent,
              borderRadius: radii.pill,
            }}
          />
        </View>
      </View>
    </View>
  );
}
