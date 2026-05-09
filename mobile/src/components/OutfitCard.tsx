// Reusable outfit result card.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx OutfitCard + styles.css `.outfit-card`.
// Used in StyleChat (inline AI attachments), StyleMe results, MoodFlow result, Outfits list.
//
// Layout: a row of 3-4 thumb tiles, then a meta block with uppercase sub +
// italic Playfair name. Optional action row (Wear this / Save) when handlers
// are passed.
//
// Tile content comes from one of two props:
//   • `garments` — array of garment row shapes. Each tile fetches the
//     garment's signed URL via `useGarmentImage` and renders the photo on
//     top of a stable per-id gradient. While the URL resolves a Shimmer
//     overlay pulses so the slot reads as "loading" rather than "empty."
//     This is what every consumer should pass when the outfit's actual
//     garments are known (StyleMe results, recent outfits, travel per-day).
//   • `hues` — legacy fallback, plain coloured gradient tiles. Kept so
//     callers that don't have garment data yet (e.g. MoodFlow placeholder
//     cards) keep rendering. Default seeds match the design prototype's
//     `hsl(${h} 38% 78%) → hsl(${(h+30)%360} 30% 62%)` recipe.
// When both are passed, `garments` wins. Empty `garments` falls back to `hues`.

import React from 'react';
import { Image, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { useGarmentImage } from '../hooks/useSignedUrl';
import { Button } from './Button';
import { Shimmer } from './Shimmer';

// Approximate the design prototype's `hsl(${h} 38% 78%) → hsl(${(h+30)%360} 30% 62%)` recipe.
// RN doesn't take HSL strings in StyleSheet, but expo-linear-gradient happily accepts CSS-style
// `hsl()` strings in the `colors` array. Same recipe as the Add piece flow's photo placeholders.
function hslGradient(h: number): [string, string] {
  return [`hsl(${h}, 38%, 78%)`, `hsl(${(h + 30) % 360}, 30%, 62%)`];
}

// Stable hue from id — matches GarmentCard's hueFromId so a garment renders
// the same colour family whether it's shown solo or as one tile in an outfit.
function hueFromId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export type OutfitCardGarment = {
  id: string;
  rendered_image_path?: string | null;
  original_image_path?: string | null;
  /** Optional explicit hue 0-360 for the slot's gradient fallback; otherwise
   *  derived from `id` so distinct garments still get distinct colours. */
  hue?: number;
};

export type OutfitCardProps = {
  name: string;
  sub: string;
  /** Real garment data — each tile shows the photo when its signed URL
   *  resolves, gradient placeholder underneath. Preferred over `hues`. */
  garments?: OutfitCardGarment[];
  /** Legacy gradient seeds (0-359). Used when `garments` is absent or empty. */
  hues?: number[];
  onUse?: () => void;
  onSave?: () => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// One tile of the top row. Pulled out as a child component so each slot can
// own its `useGarmentImage` call (hooks can't run inside a map without one
// component per iteration). The tile renders the gradient first, the image
// on top when the URL resolves, and a Shimmer overlay while the URL is
// still loading so the loading state is visually distinct from a permanently
// missing image.
function GarmentSlot({ garment }: { garment: OutfitCardGarment }) {
  const imagePath = garment.rendered_image_path ?? garment.original_image_path ?? null;
  const { uri: imageUri, onError: onImageError } = useGarmentImage(imagePath);
  const showImage = imageUri != null;
  // Resolving = we have a path to fetch but the hook hasn't handed back a URI
  // yet. The hook also returns null after the retry budget is spent on a
  // permanently-broken path, so we cap the shimmer to the case where the
  // path was provided AND we don't have a URI — the gradient takes over
  // afterwards either way. False when no path was ever provided (genuinely
  // empty slot) so the gradient sits still.
  const resolving = imagePath != null && !showImage;

  const baseHue = garment.hue ?? hueFromId(garment.id);
  const grad = hslGradient(baseHue);

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {showImage ? (
        <Image
          source={{ uri: imageUri }}
          // Same retry contract as GarmentCard: `useGarmentImage` logs a
          // Sentry breadcrumb and busts the signed-URL cache once before
          // surrendering to the gradient.
          onError={onImageError}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : null}
      {resolving ? <Shimmer /> : null}
    </View>
  );
}

export function OutfitCard({
  name,
  sub,
  garments,
  hues = [32, 28, 200, 18],
  onUse,
  onSave,
  onPress,
  style,
}: OutfitCardProps) {
  const t = useTokens();
  const showActions = Boolean(onUse || onSave);
  const useGarments = garments && garments.length > 0;
  // aspectRatio is set to the tile count so the row is always 1 tile tall
  // (each tile renders square). Falls back to `hues.length` for the legacy
  // path; both are guaranteed > 0 by the gate above + the default `hues`.
  const tileCount = useGarments ? garments!.length : hues.length;

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
      <View style={{ flexDirection: 'row', aspectRatio: tileCount, gap: 0 }}>
        {useGarments
          ? garments!.map((g, i) => <GarmentSlot key={g.id || `slot-${i}`} garment={g} />)
          : hues.map((h, i) => {
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
