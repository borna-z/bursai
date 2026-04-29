// Garment grid card — used in the 3-col Wardrobe grid.
// Aspect ratio 0.78 matches design_handoff_burs_rn/source/styles.css `.garment-card`.
// Top: gradient placeholder (135deg, hsl-pair derived from a deterministic per-garment hue).
// Bottom: meta-row with name (semibold, single-line ellipsis) + uppercase sub-label.
//
// Once garments are wired up the gradient will be replaced by the rendered/original photo
// — the meta row + aspect ratio + outer chrome stay identical.

import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

export type GarmentCardData = {
  id?: string;
  name: string;
  sub: string;
  /** 0-360. Drives the gradient placeholder colour. */
  hue: number;
};

export function GarmentCard({
  garment,
  onPress,
  style,
}: {
  garment: GarmentCardData;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  const hueA = garment.hue;
  const hueB = (garment.hue + 30) % 360;
  // RN supports hsl()/rgba() colour strings — same recipe as the design's CSS gradient.
  const colors: [string, string] = [`hsl(${hueA}, 38%, 78%)`, `hsl(${hueB}, 30%, 62%)`];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${garment.name}, ${garment.sub}`}
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bg2,
          overflow: 'hidden',
          transform: pressed ? [{ scale: 0.98 }] : [],
        },
        style,
      ]}>
      {/* Image placeholder — 0.78 aspect ratio, top corners only. */}
      <View style={{ aspectRatio: 1, width: '100%', overflow: 'hidden' }}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>

      {/* Meta row — sits below the gradient inside the bordered shell. */}
      <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 12.5,
            fontWeight: '600',
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {garment.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 10,
            color: t.fg2,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
          }}>
          {garment.sub}
        </Text>
      </View>
    </Pressable>
  );
}
