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
import { t as tr } from '../lib/i18n';
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
  const {
    uri: imageUri,
    onError: onImageError,
    isResolving,
  } = useGarmentImage(imagePath);
  const showImage = imageUri != null;
  // `isResolving` comes from the hook and turns FALSE on every settled state
  // — URL resolved, fetch errored after retries, OR <Image> failed past the
  // retry budget — so the shimmer stops on permanently-broken paths instead
  // of looping forever (Codex P2 round 1 on PR #786). The gradient
  // underneath remains visible in those terminal-failure cases. Genuine
  // empty slots (no path) also return `isResolving === false`.
  const resolving = isResolving && !showImage;

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
  // Layout: 4 garments render as a 2×2 square grid (the canonical outfit
  // composition — top, bottom, layer, footwear — per the G6 acceptance
  // gate and the web reference at `src/components/outfits/OutfitComposition.tsx`).
  // 1-3 garments fall back to a single tall row of N square tiles since a
  // partial 2×2 would leave dead space. The legacy `hues` path keeps the
  // single-row layout unchanged so existing callers don't shift visually.
  const tileCount = useGarments ? garments!.length : hues.length;
  const isGrid = useGarments && garments!.length === 4;
  // aspectRatio: row layout is N tiles wide × 1 tall (each tile square).
  // 2×2 is 2 tiles wide × 2 tiles tall, so the wrapper is square (ratio 1).
  const wrapperAspect = isGrid ? 1 : tileCount;

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
      {/* Top tile area — single row OR 2×2 grid depending on garment count */}
      {isGrid ? (
        // 2×2 grid via two stacked rows. flexWrap on a flex-row would also
        // work but rows give us deterministic row sizing without relying on
        // tile width to wrap correctly under different parent widths.
        <View style={{ aspectRatio: wrapperAspect, flexDirection: 'column' }}>
          {[0, 2].map((rowStart) => (
            <View key={`row-${rowStart}`} style={{ flex: 1, flexDirection: 'row' }}>
              {garments!.slice(rowStart, rowStart + 2).map((g, i) => (
                <GarmentSlot key={g.id || `slot-${rowStart + i}`} garment={g} />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View
          style={{ flexDirection: 'row', aspectRatio: wrapperAspect, gap: 0 }}>
          {useGarments
            ? garments!.map((g, i) => (
                <GarmentSlot key={g.id || `slot-${i}`} garment={g} />
              ))
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
      )}

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
    // Synthesize a meaningful a11y label so VoiceOver/TalkBack announce
    // the outfit's identity instead of just "button". Falls back to the
    // bare name when piece count is unknown (legacy hues-only callers).
    const a11yPieces = useGarments ? garments!.length : 0;
    const a11yLabel =
      a11yPieces > 0
        ? tr('a11y.outfitCard', { name, pieceCount: a11yPieces })
        : tr('a11y.outfitCard.nameOnly', { name });
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={({ pressed }) => [{ transform: pressed ? [{ scale: 0.98 }] : [] }]}>
        {card}
      </Pressable>
    );
  }
  return card;
}
