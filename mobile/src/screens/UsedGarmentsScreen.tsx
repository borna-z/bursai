// Used garments — list of every garment with wear_count > 0, sorted by wear_count desc.
// Reachable from the Wardrobe "Most worn" smart tile and the future Insights link.
//
// W2 wires real Supabase data via useFlatGarments({smartFilter:'most_worn'}). Sort chips
// switch between most-worn / recently-worn / by-category — they all stay client-side over
// the loaded page set; a future Wave 9 server-sort hook can replace this when the wardrobe
// outgrows a single page.

import React from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { IconBtn } from '../components/IconBtn';
import { GarmentImageTile } from '../components/GarmentImageTile';
import { GarmentListSkeleton } from '../components/skeletons';
import { ErrorState } from '../components/ErrorState';
import { BackIcon, ChevronIcon } from '../components/icons';
import { useFlatGarments } from '../hooks/useGarments';
import type { Garment, GarmentFilters } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Hoisted to module scope so the queryKey for `useFlatGarments` stays
// referentially stable across re-renders.
const USED_FILTERS: GarmentFilters = { smartFilter: 'most_worn', sortBy: 'wear_count' };

function UsedRow({ item, onPress }: { item: Garment; onPress: () => void }) {
  const t = useTokens();
  const subtitle = [item.category, item.material].filter(Boolean).join(' · ');
  const wearCount = item.wear_count ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${wearCount} wears`}
      onPress={onPress}
      style={({ pressed }) => [s.rowWrap, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={s.rowInner}>
        <View style={[s.thumb, { overflow: 'hidden' }]}>
          <GarmentImageTile garment={item} iconSize={20} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 14,
              fontWeight: '600',
              color: t.fg,
              letterSpacing: -0.14,
            }}>
            {item.title}
          </Text>
          {subtitle ? <Caption>{subtitle}</Caption> : null}
        </View>
        <View style={[s.wearBadge, { backgroundColor: t.accentSoft }]}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 16,
              fontWeight: '500',
              color: t.accent,
              letterSpacing: -0.16,
            }}>
            {wearCount}
          </Text>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 9,
              color: t.accent,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginTop: 1,
            }}>
            Wears
          </Text>
        </View>
        <View style={{ paddingLeft: 4 }}>
          <ChevronIcon color={t.fg3} />
        </View>
      </View>
    </Pressable>
  );
}

export function UsedGarmentsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const {
    data: items,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useFlatGarments(USED_FILTERS);

  const onRefresh = React.useCallback(() => void refetch(), [refetch]);

  // Server returns rows already sorted wear_count desc. Earlier revisions of
  // this screen offered "Recently worn" + "By category" client-side sort
  // chips, but those mis-sorted across paginated subsets (page 2 only
  // contains the wear-count-paginated next 30 — so re-sorting by recency
  // produced a misleading top-30) — audit findings UX#2. The chips are gone
  // until a server-side sort hook lands; the screen's intent ("Most worn")
  // matches the server order honestly.

  const header = (
    <View>
      <View style={s.headerRow}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Most loved</Eyebrow>
          <PageTitle>Used pieces</PageTitle>
        </View>
      </View>
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
          contentContainerStyle={{ paddingBottom: 130 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
          }
          showsVerticalScrollIndicator={false}>
          {header}
          <GarmentListSkeleton rows={5} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={s.emptyWrap}>
          <PageTitle size={22}>No worn garments yet</PageTitle>
          <Caption style={{ marginTop: 6, textAlign: 'center', maxWidth: 240 }}>
            Once you start logging wears they'll show up here.
          </Caption>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={items}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
        }
        ItemSeparatorComponent={() => <View style={[s.sep, { backgroundColor: t.border }]} />}
        renderItem={({ item }) => (
          <UsedRow item={item} onPress={() => nav.navigate('GarmentDetail', { id: item.id })} />
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  rowWrap: {
    paddingHorizontal: 20,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 84,
  },
  thumb: {
    width: 52,
    height: 68,
    borderRadius: radii.md,
  },
  wearBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.lg,
    alignItems: 'center',
    minWidth: 48,
  },
  sep: {
    height: 1,
    marginLeft: 84,
    marginRight: 20,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
});
