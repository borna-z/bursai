// HomeScreen — recent outfits row (N13 split).
//
// Horizontal carousel of saved outfits below the hero. Each tile renders a
// 2×2 mosaic of the outfit's first four garment photos via signed URLs,
// falling back to per-garment gradient hues while loading or when no
// image_path is set.

import React from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { GarmentImageTile } from '../components/GarmentImageTile';
import { ChevronIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import { outfitDisplayName } from '../lib/outfitDisplay';
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
// to `OutfitThumb`: renders the shared GarmentImageTile (neutral bg + signed-URL
// photo + faded Tshirt icon fallback). No border or label since four of these
// compose the recent-tile thumb rather than each reading as a standalone card.
function RecentMosaicSlot({ item }: { item: OutfitItemWithGarment | null }) {
  const garment = item?.garment ?? null;
  return <GarmentImageTile garment={garment} iconSize={18} />;
}

function RecentOutfitTile({
  outfit,
  onPress,
}: {
  outfit: OutfitWithItems;
  onPress: () => void;
}) {
  const t = useTokens();
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
          <RecentMosaicSlot item={slots[0]} />
          <RecentMosaicSlot item={slots[1]} />
        </View>
        <View style={{ flexDirection: 'row', flex: 1 }}>
          <RecentMosaicSlot item={slots[2]} />
          <RecentMosaicSlot item={slots[3]} />
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
