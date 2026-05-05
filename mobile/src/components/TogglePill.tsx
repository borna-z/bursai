// Labeled pill toggle. Pressing the pill flips the on/off state.
// Active: fg background with bg text (the same visual contract as `Chip` active state).
// Inactive: card background with fg2 text + border.
//
// Use for binary settings rendered inline (EditGarment "In laundry" / "Archive",
// EditGarmentScreen status section). For section-level iOS-style switches inside
// SettingsRow, use the dedicated switch primitive instead.

import React from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

export function TogglePill({
  label,
  active,
  onToggle,
  disabled = false,
  style,
}: {
  label: string;
  active: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  const bg = active ? t.fg : t.card;
  const fg = active ? t.bg : t.fg2;
  const border = active ? 'transparent' : t.border;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onToggle(!active)}
      style={({ pressed }) => [
        {
          height: 36,
          paddingHorizontal: 16,
          borderRadius: radii.pill,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 4,
          alignSelf: 'flex-start',
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: pressed ? [{ scale: 0.97 }] : [],
        },
        style,
      ]}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 12,
          color: fg,
          letterSpacing: -0.1,
          fontWeight: '600',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
