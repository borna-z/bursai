// Square garment photo tile used by the Add piece flow grid + future EditGarment image swap.
// Mirrors design_handoff_burs_rn/source/styles.css `.photo-tile` + `.ph-num` + `.ph-x`.
//
// Three variants:
//   - default      : gradient placeholder (driven by `hue`) with optional index badge + ✕ button
//   - withBadge    : same plus the dark scrim "01" / "02" pill top-left
//   - add          : dashed border + accent + sign + "Add" label — used as the trailing tile
//
// Number badge + remove button sit over a colourful gradient and need to read from any hue,
// so they use the theme-invariant `scrimBg` / `scrimFg` token pair (added in PR #708 — Wave
// 8.5 P82). Same values in light + dark.

import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { CloseIcon, PlusIcon } from './icons';

type PhotoTileProps = {
  /** Tile index, rendered as a 2-digit dark scrim badge at top-left. Hidden if undefined. */
  index?: number;
  /** Hue 0-360 for the gradient placeholder. Required unless variant === 'add'. */
  hue?: number;
  /** Show a circular ✕ remove button at top-right. */
  onRemove?: () => void;
  /** Render as the trailing "+ Add" tile with dashed border. */
  variant?: 'default' | 'add';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PhotoTile({
  index,
  hue,
  onRemove,
  variant = 'default',
  onPress,
  style,
}: PhotoTileProps) {
  const t = useTokens();

  if (variant === 'add') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add photo"
        onPress={onPress}
        style={({ pressed }) => [
          {
            aspectRatio: 1,
            borderRadius: radii.md,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: t.accent,
            backgroundColor: t.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            opacity: pressed ? 0.7 : 1,
          },
          style,
        ]}>
        <PlusIcon color={t.accent} size={22} />
        <Text style={{ fontFamily: fonts.uiSemi, fontSize: 11, color: t.accent, letterSpacing: -0.1 }}>
          Add
        </Text>
      </Pressable>
    );
  }

  const safeHue = typeof hue === 'number' ? hue : 32;
  const colors: [string, string] = [
    `hsl(${safeHue}, 38%, 78%)`,
    `hsl(${(safeHue + 30) % 360}, 30%, 62%)`,
  ];

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={index != null ? `Photo ${index}` : 'Photo'}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          aspectRatio: 1,
          borderRadius: radii.md,
          overflow: 'hidden',
          opacity: pressed && onPress ? 0.92 : 1,
        },
        style,
      ]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      />

      {index != null ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: radii.pill,
            backgroundColor: t.scrimBg,
          }}>
          <Text
            style={{
              fontFamily: fonts.uiBold,
              fontSize: 9,
              fontWeight: '700',
              color: t.scrimFg,
              letterSpacing: 0.4,
            }}>
            {String(index).padStart(2, '0')}
          </Text>
        </View>
      ) : null}

      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove photo"
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }) => [
            {
              position: 'absolute',
              top: 6,
              right: 6,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: t.scrimBg,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <CloseIcon size={12} color={t.scrimFg} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
