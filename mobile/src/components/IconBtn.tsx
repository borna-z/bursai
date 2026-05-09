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
  // N8 a11y — IconBtn defaults to 36pt which is below Apple's 44pt + Google's
  // 48dp touch-target guidelines. Pad the press area by 8pt on every side
  // so smaller circular buttons (Settings header back chevron, OutfitDetail
  // close, AddPiece bottom-sheet dismiss, etc.) are reliably tappable
  // without growing the visual chrome.
  const hitSlopPad = Math.max(0, 8 - Math.max(0, (44 - size) / 2));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      onPress={onPress}
      hitSlop={{
        top: hitSlopPad,
        bottom: hitSlopPad,
        left: hitSlopPad,
        right: hitSlopPad,
      }}
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
