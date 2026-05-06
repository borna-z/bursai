import React from 'react';
import { Pressable, Text, View, type AccessibilityState, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

type Variant = 'primary' | 'outline' | 'quiet' | 'accent';
type Size = 'sm' | 'md';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  destructive = false,
  leadingIcon,
  trailingIcon,
  style,
  accessibilityLabel,
  accessibilityState,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  /** When true, overrides the variant palette with the destructive token
   * surface. Used for delete/reset confirmations where a single visual
   * affordance (red fill + light text) is the App-Store-grade signal. */
  destructive?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}) {
  const t = useTokens();

  const palette = (() => {
    if (destructive) {
      // M11: shared destructive surface across delete/reset confirmations.
      // Wins over variant so the destructive intent reads consistently.
      return { bg: t.destructive, color: t.accentFg, border: 'transparent' };
    }
    switch (variant) {
      case 'primary':
        return { bg: t.fg,         color: t.bg,        border: 'transparent' };
      case 'accent':
        return { bg: t.accent,     color: t.accentFg,  border: 'transparent' };
      case 'outline':
        return { bg: 'transparent', color: t.fg,        border: t.border2 };
      case 'quiet':
        return { bg: 'transparent', color: t.fg2,       border: 'transparent' };
    }
  })();

  const dims = size === 'sm' ? { height: 36, paddingX: 14, fontSize: 12.5 } : { height: 44, paddingX: 20, fontSize: 13 };

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [
        {
          height: dims.height,
          paddingHorizontal: dims.paddingX,
          borderRadius: radii.pill,
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: palette.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: disabled ? 0.45 : 1,
          alignSelf: block ? 'stretch' : 'flex-start',
          transform: pressed ? [{ scale: 0.97 }] : [],
        },
        block ? { width: '100%' } : null,
        style,
      ]}>
      {leadingIcon ? <View style={{ marginRight: 4 }}>{leadingIcon}</View> : null}
      <Text style={{ fontFamily: fonts.uiSemi, fontSize: dims.fontSize, lineHeight: dims.fontSize, letterSpacing: -0.13, color: palette.color, fontWeight: '600' }}>
        {label}
      </Text>
      {trailingIcon ? <View style={{ marginLeft: 4 }}>{trailingIcon}</View> : null}
    </Pressable>
  );
}
