// 2-column grid tile — used by Wardrobe's "Recently added / Most worn / Unworn / In laundry"
// row and the secondary "Wishlist / Gaps" row. Mirrors design_handoff_burs_rn/source/styles.css
// `.smart-tile`: padding 12/14, radius 14, border, italic Playfair number on top, uppercase
// caption-style label below.

import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

export function SmartTile({
  num,
  label,
  onPress,
  muted = false,
  style,
}: {
  /** Big italic number (or short glyph like ⌀ / !). */
  num: string;
  /** Uppercase tracking-wide caption. */
  label: string;
  onPress?: () => void;
  /** Faded "this is a hint, not data" treatment used for empty/offline tiles. */
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();

  const inner = (
    <>
      <Text
        style={{
          fontFamily: fonts.displayMedium,
          fontStyle: 'italic',
          fontSize: 22,
          lineHeight: 22,
          fontWeight: '500',
          color: t.fg,
          letterSpacing: -0.22,
        }}>
        {num}
      </Text>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 11,
          color: t.fg2,
          letterSpacing: 1.55,
          textTransform: 'uppercase',
          marginTop: 4,
        }}>
        {label}
      </Text>
    </>
  );

  const shellStyle = {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.card,
    opacity: muted ? 0.7 : 1,
  };

  if (!onPress) {
    return <View style={[shellStyle, style]}>{inner}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${num} ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        shellStyle,
        { transform: pressed ? [{ scale: 0.98 }] : [] },
        style,
      ]}>
      {inner}
    </Pressable>
  );
}
