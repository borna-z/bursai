// Unused garments — pieces not worn in the last 30 days (or never worn).
// Reachable from the Wardrobe "Unworn this season" smart tile.
//
// W2 wires real Supabase data via useFlatGarments({smartFilter:'rarely_worn'}). The category
// filter chips run client-side over the loaded page set — same trade-off as UsedGarments.
// Sticky bottom CTA generates an outfit anchored on the unused pieces (Wave 9 will pass the
// selected garment through to OutfitGenerate).

import React from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { GarmentCard } from '../components/GarmentCard';
import { GarmentGridSkeleton } from '../components/skeletons';
import { ErrorState } from '../components/ErrorState';
import { BackIcon } from '../components/icons';
import { useFlatGarments } from '../hooks/useGarments';
import type { Garment, GarmentFilters } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Hoisted to module scope so React Query's queryKey identity stays stable
// across re-renders.
const UNUSED_FILTERS: GarmentFilters = { smartFilter: 'rarely_worn' };

type FilterKey = 'all' | 'tops' | 'bottoms' | 'shoes' | 'outer' | 'accessory';

const FILTER_TO_CATEGORIES: Record<Exclude<FilterKey, 'all'>, string[]> = {
  tops: ['Top', 'Tops'],
  bottoms: ['Bottom', 'Bottoms'],
  shoes: ['Shoes', 'Shoe'],
  outer: ['Outer', 'Outerwear'],
  accessory: ['Accessory', 'Accessories'],
};

function matchesFilter(g: Garment, key: FilterKey): boolean {
  if (key === 'all') return true;
  const allowed = FILTER_TO_CATEGORIES[key].map((c) => c.toLowerCase());
  const cat = (g.category ?? '').trim().toLowerCase();
  return allowed.includes(cat);
}

export function UnusedOutfitsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = React.useState<FilterKey>('all');

  const {
    data: items,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useFlatGarments(UNUSED_FILTERS);

  const onRefresh = React.useCallback(() => void refetch(), [refetch]);

  // M42 — id-keyed press handler (stable across parent re-renders) so
  // the memoised cell row keeps its prop reference identity.
  const handleGarmentPress = React.useCallback(
    (id: string) => {
      nav.navigate('GarmentDetail', { id });
    },
    [nav],
  );

  const visible = React.useMemo(
    () => items.filter((g) => matchesFilter(g, filter)),
    [items, filter],
  );

  const header = (
    <View>
      <View style={s.headerRow}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Rediscover</Eyebrow>
          <PageTitle>Unused pieces</PageTitle>
        </View>
      </View>
      <Caption style={{ paddingHorizontal: 20, paddingTop: 4, lineHeight: 18 }}>
        Garments you haven't worn in the last 30 days — reshuffle a look around one of them.
      </Caption>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <Chip label="All"        active={filter === 'all'}       onPress={() => setFilter('all')} />
        <Chip label="Tops"       active={filter === 'tops'}      onPress={() => setFilter('tops')} />
        <Chip label="Bottoms"    active={filter === 'bottoms'}   onPress={() => setFilter('bottoms')} />
        <Chip label="Shoes"      active={filter === 'shoes'}     onPress={() => setFilter('shoes')} />
        <Chip label="Outer"      active={filter === 'outer'}     onPress={() => setFilter('outer')} />
        <Chip label="Accessory"  active={filter === 'accessory'} onPress={() => setFilter('accessory')} />
      </ScrollView>
    </View>
  );

  if (isError) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <ErrorState onRetry={() => void refetch()} />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 92 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
          }>
          {header}
          <GarmentGridSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (visible.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={s.emptyWrap}>
          <PageTitle size={22}>Everything's been worn lately</PageTitle>
          <Caption style={{ marginTop: 6, textAlign: 'center', maxWidth: 240 }}>
            Nothing in this category has been left on the rail.
          </Caption>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={header}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 92, gap: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
        }
        renderItem={({ item }) => (
          <UnusedOutfitGarmentCell item={item} onPress={handleGarmentPress} />
        )}
        // M42 — virtualization tuning. See WardrobeScreen.
        removeClippedSubviews
        windowSize={5}
        initialNumToRender={12}
      />
      <View
        style={[
          s.stickyBar,
          {
            backgroundColor: t.bg,
            borderTopColor: t.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}>
        <Button
          label="Generate outfit from unused"
          block
          onPress={() => nav.navigate('OutfitGenerate')}
        />
      </View>
    </SafeAreaView>
  );
}

// M42 — memoised cell. Same shape as WardrobeGarmentCell.
const UnusedOutfitGarmentCell = React.memo(function UnusedOutfitGarmentCell({
  item,
  onPress,
}: {
  item: Garment;
  onPress: (id: string) => void;
}) {
  const press = React.useCallback(() => onPress(item.id), [item.id, onPress]);
  return (
    <View style={{ flex: 1 / 3 }}>
      <GarmentCard
        garment={{
          id: item.id,
          title: item.title,
          category: item.category,
          color_primary: item.color_primary,
          wear_count: item.wear_count,
          in_laundry: item.in_laundry,
          rendered_image_path: item.rendered_image_path,
          original_image_path: item.original_image_path,
          created_at: item.created_at,
        }}
        onPress={press}
      />
    </View>
  );
});

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
});
