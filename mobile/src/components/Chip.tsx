import React from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { radii, text } from '../theme/tokens';

export function Chip({
  label,
  active = false,
  onPress,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  const bg = active ? t.fg : t.card;
  const fg = active ? t.bg : t.fg2;
  const border = active ? 'transparent' : t.border;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: 30,
          paddingHorizontal: 12,
          borderRadius: radii.pill,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 4,
          alignSelf: 'flex-start',
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}>
      <Text style={[text.chipLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}
