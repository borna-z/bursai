// Reusable outfit result card.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx OutfitCard + styles.css `.outfit-card`.
// Used in StyleChat (inline AI attachments), StyleMe results, MoodFlow result, Outfits list.
//
// Layout: 3 or 4 gradient thumb tiles in a top row, then a meta block with uppercase sub +
// italic Playfair name. Optional action row (Wear this / Save) when handlers are passed.
//
// `hues` are placeholder gradient seeds (0-359) — the real impl will swap these for the
// actual garment thumbs once a wardrobe loader is wired. Kept as raw data here, not a
// theme-token concern, so 4 inline LinearGradient seeds are fine to compute per-render.

import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Button } from './Button';

// Approximate the design prototype's `hsl(${h} 38% 78%) → hsl(${(h+30)%360} 30% 62%)` recipe.
// RN doesn't take HSL strings in StyleSheet, but expo-linear-gradient happily accepts CSS-style
// `hsl()` strings in the `colors` array. Same recipe as the Add piece flow's photo placeholders.
function hslGradient(h: number): [string, string] {
  return [`hsl(${h}, 38%, 78%)`, `hsl(${(h + 30) % 360}, 30%, 62%)`];
}

export type OutfitCardProps = {
  name: string;
  sub: string;
  hues?: number[];
  onUse?: () => void;
  onSave?: () => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function OutfitCard({
  name,
  sub,
  hues = [32, 28, 200, 18],
  onUse,
  onSave,
  onPress,
  style,
}: OutfitCardProps) {
  const t = useTokens();
  const showActions = Boolean(onUse || onSave);

  const card = (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.card,
          borderRadius: radii.xl,
          overflow: 'hidden',
        },
        style,
      ]}>
      {/* Top tile row */}
      <View style={{ flexDirection: 'row', aspectRatio: hues.length, gap: 0 }}>
        {hues.map((h, i) => {
          const grad = hslGradient(h);
          return (
            <LinearGradient
              key={`${h}-${i}`}
              colors={grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          );
        })}
      </View>

      {/* Meta */}
      <View style={{ padding: 14, gap: 4 }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 10,
            letterSpacing: 1.8,
            color: t.fg2,
            textTransform: 'uppercase',
          }}>
          {sub}
        </Text>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: 18,
            lineHeight: 22,
            letterSpacing: -0.18,
            color: t.fg,
          }}>
          {name}
        </Text>
        {showActions ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {onUse ? <Button label="Wear this" size="sm" onPress={onUse} block style={{ flex: 1 }} /> : null}
            {onSave ? <Button label="Save" size="sm" variant="outline" onPress={onSave} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (onPress && !showActions) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [{ transform: pressed ? [{ scale: 0.98 }] : [] }]}>
        {card}
      </Pressable>
    );
  }
  return card;
}
