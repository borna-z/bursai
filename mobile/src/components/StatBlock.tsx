import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

// Italic Playfair numerals + uppercase label. Pressable when onPress is supplied.
export function StatBlock({
  num,
  label,
  onPress,
  style,
  accessibilityLabel,
}: {
  num: string | number;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Optional override for the screen-reader announcement. When omitted,
   * the assembled "<num> <label>" is used. Templates like
   * `'12 garments'` give a friendlier read than the uppercased label. */
  accessibilityLabel?: string;
}) {
  const t = useTokens();
  const Wrap: React.ElementType = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${num} ${label}`}
      style={[
        {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.card,
        },
        style,
      ]}>
      <Text
        style={{
          fontFamily: fonts.displayMedium,
          fontStyle: 'italic',
          fontSize: 28,
          lineHeight: 28,
          fontWeight: '500',
          color: t.fg,
        }}>
        {num}
      </Text>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 10.5,
          marginTop: 6,
          textTransform: 'uppercase',
          letterSpacing: 1.7,
          color: t.fg2,
        }}>
        {label}
      </Text>
    </Wrap>
  );
}
