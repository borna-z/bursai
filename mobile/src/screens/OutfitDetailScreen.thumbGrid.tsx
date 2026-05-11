// OutfitDetailScreen — 2×2 thumbnail grid + meta chips (N13 split).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { GarmentImageTile } from '../components/GarmentImageTile';
import type { OutfitItemWithGarment, OutfitWithItems } from '../types/outfit';

export function DetailThumbGrid({ outfit }: { outfit: OutfitWithItems }) {
  const items = (outfit.outfit_items ?? []).slice(0, 4);
  const fillerCount = Math.max(0, 4 - items.length);
  return (
    <View style={s.thumbGrid}>
      {items.map((item) => (
        <DetailThumbCell key={item.id} item={item} />
      ))}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <DetailThumbCell key={`filler-${i}`} item={null} />
      ))}
    </View>
  );
}

function DetailThumbCell({ item }: { item: OutfitItemWithGarment | null }) {
  const t = useTokens();
  const garment = item?.garment ?? null;

  return (
    <View style={[s.thumbCell, { borderColor: t.border }]}>
      <GarmentImageTile garment={garment} iconSize={32} />
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
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
