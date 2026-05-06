// Wardrobe — pixel-faithful port of design_handoff_burs_rn/source/screens.jsx WardrobeScreen.
// Sections (top→bottom): page header · Garments/Outfits/Laundry tab chips · search row ·
// smart-access tiles (2x2 then 1x2) · "All garments" eyebrow · 3-col garment FlatList.
// BottomNav lives in MainTabsScreen, not here — every tab screen uses that container's pill.
//
// W2 wires real Supabase data via useFlatGarments + paginate-on-end + invalidate-on-mutation.
// FlatList over ScrollView+map: garment counts will run into the hundreds; numColumns=3 +
// virtualization gives stable scroll perf without a complex layout calc per row.

import React from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { Button } from '../components/Button';
import { SearchBar } from '../components/SearchBar';
import { SmartTile } from '../components/SmartTile';
import { GarmentCard } from '../components/GarmentCard';
import { GarmentGridSkeleton } from '../components/skeletons';
import { ErrorState } from '../components/ErrorState';
import { FilterIcon, GridIcon, PlusIcon } from '../components/icons';
import { useFlatGarments } from '../hooks/useGarments';
import type { Garment, GarmentFilters } from '../types/garment';
import type { RootStackParamList, WardrobeFilters } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TabKey = 'garments' | 'outfits' | 'laundry';

// Hoisted to module scope so the queryKey for `useFlatGarments` is stable
// across re-renders. An inline object would make React Query treat each
// render as a fresh query (deep-equal still hits the same cache entry but
// pays the comparison cost on every parent re-render — and FlatList parents
// re-render constantly).
const WARDROBE_FILTERS: GarmentFilters = { inLaundry: false };

// Map FiltersScreen's free-text labels to canonical category enums in the
// `garments.category` column. The wardrobe filter sheet exposes friendly
// labels ("Outerwear", "Tops") but the column stores short-form values
// historically authored by the AI enrichment pipeline ("Outer", "Top"). We
// lower-case both sides at compare time and accept either label/canonical
// shape so a future migration to enum-only doesn't break the UX immediately.
const CATEGORY_ALIAS: Record<string, string[]> = {
  Outerwear: ['Outer'],
  Tops: ['Top'],
  Bottoms: ['Bottom'],
};

function matchesClientFilters(garment: Garment, f: WardrobeFilters): boolean {
  if (f.categories.length > 0) {
    const cat = (garment.category ?? '').trim().toLowerCase();
    const expanded = f.categories.flatMap((c) => [c, ...(CATEGORY_ALIAS[c] ?? [])]);
    if (!expanded.some((c) => c.toLowerCase() === cat)) return false;
  }
  if (f.colors.length > 0) {
    const color = (garment.color_primary ?? '').trim().toLowerCase();
    if (!f.colors.some((c) => c.toLowerCase() === color)) return false;
  }
  if (f.materials.length > 0) {
    const mat = (garment.material ?? '').trim().toLowerCase();
    if (!f.materials.some((m) => m.toLowerCase() === mat)) return false;
  }
  if (f.fits.length > 0) {
    const fit = (garment.fit ?? '').trim().toLowerCase();
    if (!f.fits.some((x) => x.toLowerCase() === fit)) return false;
  }
  if (f.seasons.length > 0) {
    const tags = (garment.season_tags ?? []).map((s) => s.toLowerCase());
    if (!f.seasons.some((x) => tags.includes(x.toLowerCase()))) return false;
  }
  return true;
}

function filterActiveCount(f: WardrobeFilters | null): number {
  if (!f) return 0;
  return f.categories.length + f.colors.length + f.materials.length + f.fits.length + f.seasons.length;
}

export function WardrobeScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [activeTab, setActiveTab] = React.useState<TabKey>('garments');
  // Filter state lives at the WardrobeScreen scope. FiltersScreen receives the current filters
  // as `initial` (so re-opening preserves picks) and writes back via `onApply`.
  const [filters, setFilters] = React.useState<WardrobeFilters | null>(null);

  // Server query — non-laundry, default sort. Filter constant is module-level
  // so the queryKey identity stays stable across re-renders.
  const {
    data: garments,
    isLoading,
    isError,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFlatGarments(WARDROBE_FILTERS);

  const visibleGarments = React.useMemo(
    () => (filters ? garments.filter((g) => matchesClientFilters(g, filters)) : garments),
    [garments, filters],
  );
  const activeFilterCount = filterActiveCount(filters);

  const onRefresh = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  // Smart-tile counts. These read from the loaded pages, so they're only
  // authoritative when the entire wardrobe fits in page 1 (`!hasNextPage`).
  // For larger wardrobes we render "—" instead of a misleading lower bound
  // — the audit flagged "In laundry: 1" rendering when the user actually
  // has 4+ as actively misleading. A real server-side counts hook
  // (parallel HEAD count queries) lands in W9.
  const totalCount = garments.length;
  const countsAuthoritative = !hasNextPage;
  const mostWornCount = garments.filter((g) => (g.wear_count ?? 0) > 3).length;
  const unwornCount = garments.filter((g) => !g.last_worn_at).length;
  // In-laundry count intentionally not derived here — see the tile below.
  const fmtCount = (n: number) => (countsAuthoritative ? String(n) : '—');

  // Tab chips that target a real route push onto the parent stack instead of swapping
  // local state — Outfits is its own screen, Laundry now has its own LaundryScreen route.
  const onTab = (key: TabKey) => () => {
    if (key === 'outfits') {
      nav.navigate('Outfits');
      return;
    }
    if (key === 'laundry') {
      nav.navigate('Laundry');
      return;
    }
    setActiveTab(key);
  };

  const openFilters = () => {
    nav.navigate('Filters', {
      initial: filters ?? undefined,
      onApply: (next: WardrobeFilters) => setFilters(next),
    });
  };

  const header = (
    <View style={{ gap: 14, paddingHorizontal: 20, paddingBottom: 16 }}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>
            {activeFilterCount > 0
              ? `Filtered · ${visibleGarments.length} of ${totalCount}`
              : `Inventory · ${totalCount}`}
          </Eyebrow>
          <PageTitle>Your wardrobe</PageTitle>
        </View>
        <IconBtn
          ariaLabel="Add piece"
          variant="solid"
          onPress={() => nav.navigate('AddPieceStep1')}>
          <PlusIcon color={t.accentFg} />
        </IconBtn>
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Chip label="Garments" active={activeTab === 'garments'} onPress={onTab('garments')} />
        <Chip label="Outfits" onPress={onTab('outfits')} />
        <Chip label="Laundry" active={activeTab === 'laundry'} onPress={onTab('laundry')} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SearchBar
          placeholder={`Search ${totalCount} garments…`}
          onPress={() => nav.navigate('Search')}
        />
        <IconBtn
          ariaLabel={
            activeFilterCount > 0 ? `Filter · ${activeFilterCount} active` : 'Filter'
          }
          variant={activeFilterCount > 0 ? 'solid' : 'default'}
          onPress={openFilters}>
          <FilterIcon color={activeFilterCount > 0 ? t.accentFg : t.fg} />
        </IconBtn>
        <IconBtn ariaLabel="Grid">
          <GridIcon color={t.fg} />
        </IconBtn>
      </View>

      <View style={s.tileRow}>
        <SmartTile num={fmtCount(totalCount)} label="Recently added" onPress={() => nav.navigate('Search')} />
        <SmartTile num={fmtCount(mostWornCount)} label="Most worn" onPress={() => nav.navigate('UsedGarments')} />
      </View>
      <View style={s.tileRow}>
        <SmartTile num={fmtCount(unwornCount)} label="Unworn this season" onPress={() => nav.navigate('UnusedOutfits')} />
        {/* In-laundry count can't be derived from the wardrobe page set
            (which is filtered to inLaundry=false), so the tile is purely
            navigational — tap to jump to LaundryScreen which has the real
            number. Showing "—" is more honest than rendering "0" when the
            user might have 5 items in the wash. */}
        <SmartTile num="—" label="In laundry" onPress={() => nav.navigate('Laundry')} />
      </View>

      <View style={s.tileRow}>
        <SmartTile
          num="—"
          label="Wishlist"
          onPress={() => Alert.alert('Coming soon', 'Wishlist feature coming soon.')}
        />
        <SmartTile num="—" label="Gaps" onPress={() => nav.navigate('WardrobeGaps')} />
      </View>

      <View style={s.sectionHead}>
        <Eyebrow>All garments</Eyebrow>
        <Caption>A → Z</Caption>
      </View>
    </View>
  );

  if (isError) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 130 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
          }>
          {header}
          <ErrorState onRetry={() => void refetch()} />
        </ScrollView>
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
          <GarmentGridSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Empty wardrobe — no items at all (not the "filters narrow it to zero"
  // case; that one keeps the filter chips visible and just renders nothing).
  if (totalCount === 0) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 130 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
          }
          showsVerticalScrollIndicator={false}>
          {header}
          <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 32, gap: 14 }}>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 26,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.26,
                textAlign: 'center',
              }}>
              Your wardrobe is empty
            </Text>
            <Caption style={{ textAlign: 'center', maxWidth: 260 }}>
              Add your first piece to get started.
            </Caption>
            <Button label="Add piece" onPress={() => nav.navigate('AddPieceStep1')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Filtered to zero — when filters narrow `visibleGarments` to nothing but the
  // wardrobe itself isn't empty. Distinct from the new-user empty state above:
  // here we show what to do (clear filters), not a "get started" CTA.
  const filteredEmpty = totalCount > 0 && visibleGarments.length === 0 && activeFilterCount > 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={visibleGarments}
        keyExtractor={(g) => g.id}
        numColumns={3}
        ListHeaderComponent={header}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 130, gap: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          filteredEmpty ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 32, gap: 14 }}>
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 22,
                  fontWeight: '500',
                  color: t.fg,
                  letterSpacing: -0.22,
                  textAlign: 'center',
                }}>
                No matches for these filters
              </Text>
              <Caption style={{ textAlign: 'center', maxWidth: 260 }}>
                Try a different combination, or clear filters to see your full wardrobe.
              </Caption>
              <Button label="Clear filters" variant="outline" onPress={() => setFilters(null)} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
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
              onPress={() => nav.navigate('GarmentDetail', { id: item.id })}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
});
