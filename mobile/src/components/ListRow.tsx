// Standard list row used in detail screens, settings, and search results.
// Shape: optional 44x44 left thumb (gradient or icon) · title + optional subtitle · right chevron
// or custom right element. Border-bottom separator unless `last={true}`.
//
// Mirrors design_handoff_burs_rn/source/styles.css `.list-row` + `.lr-thumb` + `.lr-meta`.
// Used by OutfitDetail's "Pieces" list, GarmentDetail's Info tab field rows, and
// WardrobeGaps' result list — all share the same shape vocabulary so promote it once.

import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { ChevronIcon } from './icons';

type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Provide a hue 0-360 to render the standard 44x44 gradient thumb. */
  hue?: number;
  /** Custom left element (icon tile, avatar, etc.). Wins over `hue` if both passed. */
  left?: React.ReactNode;
  /** Custom right element. Defaults to chevron when `onPress` is provided. */
  right?: React.ReactNode;
  /** Hide chevron — use when `right` already implies trailing affordance. */
  hideChevron?: boolean;
  /** Suppress the bottom hairline (last row in a group). */
  last?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({
  title,
  subtitle,
  hue,
  left,
  right,
  hideChevron = false,
  last = false,
  onPress,
  style,
}: ListRowProps) {
  const t = useTokens();

  const leftEl =
    left ??
    (typeof hue === 'number' ? (
      <LinearGradient
        colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 44, height: 44, borderRadius: radii.md }}
      />
    ) : null);

  const showChevron = !hideChevron && (onPress != null || right == null);

  const inner = (
    <>
      {leftEl}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13.5,
            fontWeight: '600',
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.ui,
              fontSize: 11.5,
              color: t.fg2,
              letterSpacing: -0.05,
            }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {showChevron ? <ChevronIcon color={t.fg3} /> : null}
    </>
  );

  const shellStyle: StyleProp<ViewStyle> = [
    {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: last ? 0 : 1,
      borderBottomColor: t.border,
    },
    style,
  ];

  if (!onPress) {
    return <View style={shellStyle}>{inner}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [shellStyle, { opacity: pressed ? 0.7 : 1 }]}>
      {inner}
    </Pressable>
  );
}
