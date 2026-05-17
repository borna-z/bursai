// Circular progress gauge — pure SVG, animates strokeDashoffset on mount.
// Mirrors design_handoff_burs_rn/source/screens.jsx Gauge() + styles.css `.gauge` block.
//
// Sizing: 78×78 SVG container, r=30, strokeWidth=6 (matches the prototype's viewBox 0..72 ratio).
// Animation: 600ms cubic-bezier(0.32, 0.72, 0, 1) — same easing as `.gauge .fill` in the CSS.
// Track ring uses bg2 (subtle behind-card surface), fill ring uses accent.
// Center label is italic Playfair, optional uppercase unit beneath.
// Below the SVG: uppercase label (g-label), and an optional delta line — accent-colored "↑" up,
// muted fg3 "↓" down, mirroring `.g-delta` / `.g-delta.down`.

import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { duration, easing } from '../theme/animation';
import Svg, { Circle } from 'react-native-svg';
import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type GaugeProps = {
  value: number;
  max?: number;
  unit?: string;
  label: string;
  delta?: string;
  /**
   * `'up'` shows the accent ↑, `'down'` shows the muted ↓, `'neutral'` renders
   * the delta text without an arrow (used for "in-rotation count" style metrics
   * where direction has no meaning until there's a prior point to compare to).
   */
  deltaDir?: 'up' | 'down' | 'neutral';
  /**
   * Controls whether the gauge is currently shown. When this flips from false → true,
   * the ring resets to "empty" and re-animates to its target offset. Required because
   * MainTabsScreen keeps every tab mounted (`display: 'none'` for inactive tabs), so a
   * plain mount-time animation would run while Insights is hidden — and the user would
   * see the ring already at its final position when they navigate to the tab.
   * Defaults to `true` so a standalone usage (tests / future screens) animates on mount.
   */
  visible?: boolean;
};

export function Gauge({
  value,
  max = 100,
  unit,
  label,
  delta,
  deltaDir = 'up',
  visible = true,
}: GaugeProps) {
  const t = useTokens();
  const SIZE = 78;
  const R = 30;
  const STROKE = 6;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(1, value / max));
  const targetOffset = C * (1 - pct);

  // Animate from "empty" (full circumference offset) to target whenever the gauge becomes
  // visible. While hidden, the ring is parked at `C` so the next reveal animates fresh.
  const offset = useRef(new Animated.Value(C)).current;
  useEffect(() => {
    if (!visible) {
      offset.setValue(C);
      return;
    }
    Animated.timing(offset, {
      toValue: targetOffset,
      duration: duration.standard,
      easing: easing.smooth,
      // SVG props can't use the native driver — strokeDashoffset isn't a transform/opacity.
      useNativeDriver: false,
    }).start();
  }, [offset, targetOffset, visible, C]);

  const showPct = unit === '%';
  const showUnit = unit && unit !== '%';

  return (
    <View
      style={{
        paddingTop: 14,
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.card,
        alignItems: 'center',
        gap: 8,
      }}>
      <View style={{ width: SIZE, height: SIZE, position: 'relative' }}>
        <Svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          // Rotate the whole SVG so 0° starts at the top, mirrors `.gauge svg { transform: rotate(-90deg) }`.
          style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={t.bg2}
            strokeWidth={STROKE}
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={t.accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={offset as unknown as number}
          />
        </Svg>

        {/* Center label sits over the SVG. */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 20,
              lineHeight: 22,
              fontWeight: '500',
              color: t.fg,
              fontVariant: ['tabular-nums'],
            }}>
            {value}
            {showPct ? '%' : ''}
          </Text>
          {showUnit ? (
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 8.5,
                letterSpacing: 1.2,
                color: t.fg3,
                textTransform: 'uppercase',
              }}>
              {unit}
            </Text>
          ) : null}
        </View>
      </View>

      <Text
        numberOfLines={2}
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 10.5,
          letterSpacing: 1.7,
          color: t.fg2,
          textTransform: 'uppercase',
          textAlign: 'center',
          lineHeight: 13,
        }}>
        {label}
      </Text>

      {delta ? (
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 10,
            fontWeight: '600',
            // Neutral takes `fg2` (slightly stronger than fg3) so it reads as
            // "informational, not trending down" — a metric without direction
            // shouldn't visually alias with the down state.
            color:
              deltaDir === 'up'
                ? t.accent
                : deltaDir === 'neutral'
                  ? t.fg2
                  : t.fg3,
            letterSpacing: 0.2,
          }}>
          {deltaDir === 'up' ? '↑ ' : deltaDir === 'down' ? '↓ ' : ''}
          {delta}
        </Text>
      ) : null}
    </View>
  );
}
