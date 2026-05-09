// Reusable outfit result card.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx OutfitCard + styles.css `.outfit-card`.
// Used in StyleChat (inline AI attachments), StyleMe results, MoodFlow result, Outfits list.
//
// Layout: 3 or 4 thumb tiles in a top row, then a meta block with uppercase sub +
// italic Playfair name. Optional action row (Wear this / Save) when handlers are passed.
//
// Two render modes for the tile row:
//   • `items` provided → real garment thumbnails sourced via `useGarmentImage`.
//     Each tile renders the gradient as a placeholder UNDER the <Image>, so a
//     mid-load tile shows the gradient and the image fades in on top once the
//     signed URL resolves. Empty/null imagePath stays on the gradient, which
//     mirrors the rest of the app (GarmentCard, OutfitSlotRow do the same).
//   • `items` not provided → gradient-only, driven by the legacy `hues`
//     prop. Used by RevealStep (mock onboarding card with no real garments)
//     and any call site that doesn't yet have item-level image paths handy.
//
// 2026-05-09 reported: outfit cards on StyleMe / MoodFlow / OutfitDetail
// variations were rendering only gradients because this component never
// rendered images at all — the original comment said the wardrobe loader
// would land later. Now the loader lives in the consumer (each call site
// passes already-resolved `items`), and the component just wires them
// through to `useGarmentImage` like every other thumb in the app.

import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { useGarmentImage } from '../hooks/useSignedUrl';
import { Button } from './Button';

// Approximate the design prototype's `hsl(${h} 38% 78%) → hsl(${(h+30)%360} 30% 62%)` recipe.
// RN doesn't take HSL strings in StyleSheet, but expo-linear-gradient happily accepts CSS-style
// `hsl()` strings in the `colors` array. Same recipe as the Add piece flow's photo placeholders.
function hslGradient(h: number): [string, string] {
  return [`hsl(${h}, 38%, 78%)`, `hsl(${(h + 30) % 360}, 30%, 62%)`];
}

// Stable hue derived from the garment id when the consumer can't supply one.
// djb2 — same recipe as `outfitGradientHue` so the gradient placeholder
// underneath an unloaded tile colour-matches the equivalent thumbnail
// elsewhere in the app instead of drifting per-mount.
function hueFromKey(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

export type OutfitCardItem = {
  /** Stable identifier — used as the React key and as the gradient seed
   *  when no explicit hue is provided. Falls back to the slot index when
   *  missing, but pass the garment_id when you have it so navigation keys
   *  remain stable across scrolls / re-renders. */
  id?: string;
  /** Storage path inside the `garments` bucket (rendered_image_path or
   *  original_image_path). `null` / `undefined` keeps the slot on its
   *  gradient placeholder — same fallback as GarmentCard / OutfitSlotRow. */
  imagePath?: string | null;
};

export type OutfitCardProps = {
  name: string;
  sub: string;
  /** Real garment payload — when present, drives the tile row with actual
   *  thumbnails. Up to 4 visible tiles; longer arrays are truncated. The
   *  number of tiles equals `items.length` so a 3-piece outfit gets a 3-up
   *  layout and a 4-piece outfit gets a 4-up layout. */
  items?: readonly OutfitCardItem[];
  /** Legacy gradient-only fallback. Used by call sites that don't have
   *  per-item image paths handy (RevealStep onboarding mock, etc.). When
   *  `items` is also passed, the corresponding hue (by index) is used as
   *  the tile's placeholder gradient under the <Image>; when absent we
   *  derive a stable hue from `item.id` so the placeholder still looks
   *  consistent across re-renders. */
  hues?: number[];
  onUse?: () => void;
  onSave?: () => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// Per-tile component — kept inline so each tile can call `useGarmentImage`
// at the top of its own render. RN's hook rules forbid loops over a
// variable-length list of hooks, but a child component with a fixed hook
// shape (one `useGarmentImage` per mount) sidesteps that and lets the
// parent map `items` of any length up to MAX_TILES.
function OutfitTile({ imagePath, hue }: { imagePath: string | null | undefined; hue: number }) {
  const { uri, onError } = useGarmentImage(imagePath ?? null);
  const showImage = uri != null;
  const grad = hslGradient(hue);
  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {showImage ? (
        <Image
          source={{ uri }}
          onError={onError}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

const MAX_TILES = 4;
const DEFAULT_HUES = [32, 28, 200, 18] as const;

export function OutfitCard({
  name,
  sub,
  items,
  hues,
  onUse,
  onSave,
  onPress,
  style,
}: OutfitCardProps) {
  const t = useTokens();
  const showActions = Boolean(onUse || onSave);

  // Decide layout: real items if any non-empty, else fall back to legacy
  // hue-only gradients. `items.length === 0` is treated as "no items" so
  // an empty array doesn't collapse the row to zero tiles — RevealStep's
  // mock and anything else that forgets to pass items gets the standard
  // 4-tile gradient.
  const tileItems = items && items.length > 0 ? items.slice(0, MAX_TILES) : null;
  const hueList = hues ?? DEFAULT_HUES;

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
      {tileItems ? (
        <View style={{ flexDirection: 'row', aspectRatio: tileItems.length, gap: 0 }}>
          {tileItems.map((item, i) => {
            const hue = hueList[i] ?? hueFromKey(item.id ?? `slot-${i}`);
            return (
              <OutfitTile
                key={item.id ?? `slot-${i}`}
                imagePath={item.imagePath ?? null}
                hue={hue}
              />
            );
          })}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', aspectRatio: hueList.length, gap: 0 }}>
          {hueList.map((h, i) => {
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
