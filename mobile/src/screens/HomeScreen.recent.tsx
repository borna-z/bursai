// HomeScreen — recent outfits row (N13 split).
//
// Horizontal carousel of saved outfits below the hero. Each tile renders a
// 2×2 mosaic of the outfit's first four garment photos via signed URLs,
// falling back to per-garment gradient hues while loading or when no
// image_path is set.

import React from 'react';
import { Image, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Shimmer } from '../components/Shimmer';
import { ChevronIcon } from '../components/icons';
import { useGarmentImage } from '../hooks/useSignedUrl';
import { t as tr } from '../lib/i18n';
import { outfitDisplayName, outfitGradientHue } from '../lib/outfitDisplay';
import type { OutfitItemWithGarment, OutfitWithItems } from '../types/outfit';

export type RecentOutfitsRowProps = {
  outfits: OutfitWithItems[];
  onSeeAll: () => void;
  onPressOutfit: (id: string) => void;
};

export function RecentOutfitsRow({ outfits, onSeeAll, onPressOutfit }: RecentOutfitsRowProps) {
  const t = useTokens();
  if (outfits.length === 0) return null;
  return (
    <View>
      <View style={s.sectionHead}>
        <Text style={[s.sectionTitle, { color: t.fg, fontFamily: fonts.displayMedium }]}>
          {tr('home.recent.eyebrow')}
        </Text>
        <Pressable
          onPress={onSeeAll}
          accessibilityLabel={tr('home.recent.eyebrow')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <ChevronIcon color={t.accent} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
        {outfits.map((outfit) => (
          <RecentOutfitTile
            key={outfit.id}
            outfit={outfit}
            onPress={() => onPressOutfit(outfit.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// One cell of the 2×2 mosaic inside `RecentOutfitTile`. Borderless companion
// to `OutfitThumb`: same gradient + signed-URL <Image> recipe, no border or
// label since four of these compose the recent-tile thumb rather than each
// reading as a standalone garment card.
//
// G-008 (2026-05-09) — parity with `OutfitCard.GarmentSlot`: while the signed
// URL is resolving we overlay a Shimmer pulse so a loading mosaic cell reads
// differently from a permanently-broken one.
function RecentMosaicSlot({
  item,
  fallbackHue,
}: {
  item: OutfitItemWithGarment | null;
  fallbackHue: number;
}) {
  const garment = item?.garment ?? null;
  const imagePath =
    garment?.rendered_image_path ??
    garment?.original_image_path ??
    garment?.image_path ??
    null;
  const {
    uri: imageUri,
    onError: onImageError,
    isResolving,
  } = useGarmentImage(imagePath);
  const showImage = imageUri != null;
  // Same gating as `OutfitCard.GarmentSlot`: only animate while the URL is
  // actually in flight AND we don't yet have an image to show.
  const resolving = isResolving && !showImage;
  const hue = garment?.id ? outfitGradientHue(garment.id) : fallbackHue;
  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <LinearGradient
        colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {showImage ? (
        <Image
          source={{ uri: imageUri }}
          onError={onImageError}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : null}
      {resolving ? <Shimmer /> : null}
    </View>
  );
}

function RecentOutfitTile({
  outfit,
  onPress,
}: {
  outfit: OutfitWithItems;
  onPress: () => void;
}) {
  const t = useTokens();
  const hue = outfitGradientHue(outfit.id);
  const items = (outfit.outfit_items ?? []).slice(0, 4);
  const slots: (OutfitItemWithGarment | null)[] = [
    items[0] ?? null,
    items[1] ?? null,
    items[2] ?? null,
    items[3] ?? null,
  ];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.recentTile,
        {
          borderColor: t.border,
          backgroundColor: t.card,
          transform: pressed ? [{ scale: 0.98 }] : [],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={outfitDisplayName(outfit)}>
      <View style={s.recentThumb}>
        <View style={{ flexDirection: 'row', flex: 1 }}>
          <RecentMosaicSlot item={slots[0]} fallbackHue={hue} />
          <RecentMosaicSlot item={slots[1]} fallbackHue={hue} />
        </View>
        <View style={{ flexDirection: 'row', flex: 1 }}>
          <RecentMosaicSlot item={slots[2]} fallbackHue={hue} />
          <RecentMosaicSlot item={slots[3]} fallbackHue={hue} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 10, paddingVertical: 8, gap: 2 }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 9,
            letterSpacing: 1.5,
            color: t.fg2,
            textTransform: 'uppercase',
          }}
          numberOfLines={1}>
          {(outfit.occasion || outfit.style_vibe || tr('home.recent.savedFallback')).toUpperCase()}
        </Text>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 13.5,
            lineHeight: 16,
            fontWeight: '500',
            letterSpacing: -0.13,
            color: t.fg,
          }}
          numberOfLines={1}>
          {outfitDisplayName(outfit)}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 19, fontStyle: 'italic', fontWeight: '500', letterSpacing: -0.19 },
  recentTile: {
    width: 130,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recentThumb: {
    width: '100%',
    aspectRatio: 1,
  },
});
