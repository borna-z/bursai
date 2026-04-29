// Mood selection tile — used in MoodOutfitScreen 3-col grid and MoodFlowScreen.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx MoodOutfitScreen + MoodGlyph.
//
// Layout: gold-soft icon tile (36×36, r-md) at top with a custom SVG glyph rendered in accent,
// italic Playfair label below, uppercase sub caption beneath. 1:1.05 aspect ratio.
//
// Active state: 2px accent border + accentSoft background. Inactive: card surface + 1px border.
//
// All 12 prototype glyphs live here — pure SVG, no emojis. Each glyph receives a `color`
// (the accent token) via the parent so the icon tile + glyph stay theme-aware.

import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

export type MoodId =
  | 'Calm' | 'Sharp' | 'Cool' | 'Bold' | 'Soft' | 'Bright'
  | 'Moody' | 'Tender' | 'Grounded' | 'Polished' | 'Easy' | 'Rich'
  | 'Confident' | 'Relaxed' | 'Creative' | 'Professional' | 'Romantic' | 'Energetic' | 'Cosy';

export type MoodCardProps = {
  name: MoodId | string;
  sub?: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// 28×28 stroke-based SVG glyphs in the design's editorial line-weight (1.4). Each one
// returns a stable shape independent of the parent `color` prop, which threads through
// from `useTokens().accent`.
function MoodGlyph({ name, color }: { name: string; color: string }) {
  const sw = 1.4;
  const props = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'Calm':
      return (
        <Svg {...props}>
          <Path d="M4 8c2-1 4-1 6 0s4 1 6 0 4-1 4-1" />
          <Path d="M4 13c2-1 4-1 6 0s4 1 6 0 4-1 4-1" />
          <Path d="M4 18c2-1 4-1 6 0s4 1 6 0 4-1 4-1" />
        </Svg>
      );
    case 'Sharp':
      return (
        <Svg {...props}>
          <Path d="M14 3 6 13h5l-2 8 9-11h-5l1-7z" />
        </Svg>
      );
    case 'Cool':
      return (
        <Svg {...props}>
          <Path d="M3 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
          <Path d="M3 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
        </Svg>
      );
    case 'Bold':
      return (
        <Svg {...props}>
          <Circle cx={12} cy={12} r={9} />
          <Circle cx={12} cy={12} r={4} fill={color} />
        </Svg>
      );
    case 'Soft':
      return (
        <Svg {...props}>
          <Path d="M19 14A8 8 0 1 1 10 5a6 6 0 0 0 9 9z" />
        </Svg>
      );
    case 'Bright':
    case 'Energetic':
      return (
        <Svg {...props}>
          <Circle cx={12} cy={12} r={4} />
          <Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </Svg>
      );
    case 'Moody':
      return (
        <Svg {...props}>
          <Path d="M12 3 21 12 12 21 3 12z" fill={color} />
        </Svg>
      );
    case 'Tender':
    case 'Romantic':
      return (
        <Svg {...props}>
          <Path d="M12 4c2 0 4 2 4 4s-2 4-4 4-4-2-4-4 2-4 4-4z" />
          <Path d="M12 12c2 0 4 2 4 4s-2 4-4 4-4-2-4-4 2-4 4-4z" />
          <Path d="M4 12c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4z" />
          <Path d="M12 12c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4z" />
        </Svg>
      );
    case 'Grounded':
    case 'Confident':
      return (
        <Svg {...props}>
          <Path d="M3 19h18L15 8l-3 5-2-3-7 9z" />
        </Svg>
      );
    case 'Polished':
    case 'Professional':
      return (
        <Svg {...props}>
          <Path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
        </Svg>
      );
    case 'Easy':
    case 'Relaxed':
      return (
        <Svg {...props}>
          <Path d="M12 21V8" />
          <Path d="M12 12c-3-1-5-3-5-6 3 0 5 2 5 5" />
          <Path d="M12 14c3-1 5-3 5-6-3 0-5 2-5 5" />
        </Svg>
      );
    case 'Rich':
    case 'Cosy':
      return (
        <Svg {...props}>
          <Path d="M7 4h10c0 5-2 8-5 8s-5-3-5-8z" />
          <Path d="M12 12v7M9 19h6" />
        </Svg>
      );
    case 'Creative':
      // Sparkle / four-point star — adopted from Polished but with a softened diamond underlay.
      return (
        <Svg {...props}>
          <Path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
          <Path d="M12 3c0 5 4 9 9 9-5 0-9 4-9 9 0-5-4-9-9-9 5 0 9-4 9-9z" fill={color} fillOpacity={0.15} />
        </Svg>
      );
    default:
      return (
        <Svg {...props}>
          <Circle cx={12} cy={12} r={6} />
        </Svg>
      );
  }
}

export function MoodCard({ name, sub, active = false, onPress, style }: MoodCardProps) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [
        {
          aspectRatio: 1 / 1.05,
          padding: 14,
          borderRadius: radii.xl,
          borderWidth: active ? 2 : 1,
          borderColor: active ? t.accent : t.border,
          backgroundColor: active ? t.accentSoft : t.card,
          gap: 10,
          transform: pressed ? [{ scale: 0.97 }] : [],
        },
        style,
      ]}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.md,
          backgroundColor: t.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <MoodGlyph name={String(name)} color={t.accent} />
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: 2 }}>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: 18,
            lineHeight: 20,
            color: t.fg,
            letterSpacing: -0.18,
          }}>
          {name}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 10,
              letterSpacing: 1.5,
              color: t.fg2,
              textTransform: 'uppercase',
            }}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
