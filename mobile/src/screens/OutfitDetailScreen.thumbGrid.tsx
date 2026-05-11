// OutfitDetailScreen — 2×2 thumbnail grid + meta chips (N13 split).

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { useGarmentImage } from '../hooks/useSignedUrl';
import { outfitGradientHue } from '../lib/outfitDisplay';
import type { OutfitItemWithGarment, OutfitWithItems } from '../types/outfit';

export function DetailThumbGrid({ outfit }: { outfit: OutfitWithItems }) {
  const items = (outfit.outfit_items ?? []).slice(0, 4);
  const fillerCount = Math.max(0, 4 - items.length);
  const fallbackHue = outfitGradientHue(outfit.id);
  return (
    <View style={s.thumbGrid}>
      {items.map((item) => (
        <DetailThumbCell key={item.id} item={item} fallbackHue={fallbackHue} />
      ))}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <DetailThumbCell key={`filler-${i}`} item={null} fallbackHue={fallbackHue} />
      ))}
    </View>
  );
}

function DetailThumbCell({
  item,
  fallbackHue,
}: {
  item: OutfitItemWithGarment | null;
  fallbackHue: number;
}) {
  const t = useTokens();
  const garment = item?.garment ?? null;
  const imagePath = garment?.rendered_image_path ?? garment?.original_image_path ?? null;
  const { uri: imageUri, onError: onImageError } = useGarmentImage(imagePath);
  const showImage = imageUri != null;
  const hue = garment?.id ? outfitGradientHue(garment.id) : fallbackHue;
  const label = (item?.slot ?? garment?.category ?? '').toString().toUpperCase();

  return (
    <View style={[s.thumbCell, { borderColor: t.border }]}>
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
      {label ? (
        <View style={[s.thumbLabel, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[s.thumbLabelText, { color: t.fg2 }]}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function MetaChip({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View style={[s.metaChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 10,
          color: t.fg2,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbCell: {
    width: '48%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  thumbLabelText: {
    fontFamily: fonts.uiSemi,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
