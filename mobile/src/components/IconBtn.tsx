import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { radii } from '../theme/tokens';

type Variant = 'default' | 'solid' | 'ghost';

export function IconBtn({
  children,
  onPress,
  variant = 'default',
  size = 36,
  ariaLabel,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: number;
  ariaLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  const palette = (() => {
    switch (variant) {
      case 'solid': return { bg: t.accent, border: 'transparent' };
      case 'ghost': return { bg: 'transparent', border: 'transparent' };
      default:      return { bg: t.card, border: t.border };
    }
  })();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radii.pill,
          backgroundColor: palette.bg,
          borderWidth: variant === 'ghost' ? 0 : 1,
          borderColor: palette.border,
          alignItems: 'center',
          justifyContent: 'center',
          transform: pressed ? [{ scale: 0.96 }] : [],
        },
        style,
      ]}>
      {children}
    </Pressable>
  );
}
