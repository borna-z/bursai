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
import { useGarmentCount } from '../hooks/useGarmentCount';
import { useFirstRunCoach, COACH_TOUR_TOTAL } from '../hooks/useFirstRunCoach';
import { CoachOverlay } from '../components/CoachOverlay';
import { t as tr } from '../lib/i18n';
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

// Sort comparator for the FiltersScreen "Sort by" picker. The server query
// always returns rows in `created_at desc` (the `recent_added` default), so
// any non-default selection re-orders the in-memory result post-pagination.
// Codex P2 on PR #738 caught that the sort selection was previously stored
// but never applied. Sort IDs match `SORTS` in `FiltersScreen.tsx`.
function compareForSort(a: Garment, b: Garment, sort: string): number {
  switch (sort) {
    case 'name_asc':
      return (a.title ?? '').localeCompare(b.title ?? '');
    case 'most_worn':
      return (b.wear_count ?? 0) - (a.wear_count ?? 0);
    case 'least_worn':
      return (a.wear_count ?? 0) - (b.wear_count ?? 0);
    case 'recent_worn': {
      // Nulls (never worn) sink to the bottom — a "recently worn" sort that
      // surfaces never-worn rows ahead of recently-worn ones is misleading.
      const aMs = a.last_worn_at ? new Date(a.last_worn_at).getTime() : 0;
      const bMs = b.last_worn_at ? new Date(b.last_worn_at).getTime() : 0;
      return bMs - aMs;
    }
    case 'recent_added':
    default: {
      const aMs = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bMs = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bMs - aMs;
    }
  }
}

export function WardrobeScreen({
  isActive = true,
}: {
  /** True when this screen is the active MainTabs tab. M27 R1 gate — see
   * HomeScreen for the rationale; without this the coach overlay would
   * surface against a display:'none' sibling and the cutout would
   * collapse to 0×0. Defaults to true so callers unaware of the tab
   * system (tests, future direct-route mounts) keep the prior behavior. */
  isActive?: boolean;
} = {}) {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [activeTab, setActiveTab] = React.useState<TabKey>('garments');
  // M27 — first-run coach overlay step 2 (Wardrobe grid). The ref wraps
  // the whole screen content so the cutout reads as "your wardrobe lives
  // here". Targeting a single garment cell would be misleading on a
  // brand-new wardrobe (no garments yet) and racy under FlatList
  // virtualization.
  const coach = useFirstRunCoach();
  const gridRef = React.useRef<View | null>(null);
  const showWardrobeCoach = isActive && coach.shouldShow && coach.currentStep === 1;
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

  // True total — counts ALL garments (including in-laundry) so we can
  // distinguish a brand-new wardrobe (zero garments at all) from a fully-
  // laundered wardrobe (garments exist but every one is currently inLaundry,
  // so the non-laundry query returns []). Without this, washing the whole
  // capsule would silently bounce the user to the new-user empty state +
  // "Add your first piece" CTA. Codex P2 round 6 on PR #738.
  const garmentCountQ = useGarmentCount();
  const trueTotalCount = garmentCountQ.data ?? 0;
  const allInLaundry = trueTotalCount > 0 && garments.length === 0 && !hasNextPage;

  const visibleGarments = React.useMemo(() => {
    if (!filters) return garments;
    const filtered = garments.filter((g) => matchesClientFilters(g, filters));
    // Only apply the sort comparator once the eager-paginate loop has loaded
    // every page (`!hasNextPage`). While pages are still arriving the sort
    // would visibly reshuffle on each fetch as later rows reorder the prefix —
    // keep server order (created_at desc) until the result set is complete.
    // Codex P2 on PR #738.
    if (
      !hasNextPage &&
      filters.sort &&
      filters.sort !== 'recent_added'
    ) {
      // Stable sort against a copy — never mutate React Query's flattened array.
      return [...filtered].sort((a, b) => compareForSort(a, b, filters.sort));
    }
    return filtered;
  }, [garments, filters, hasNextPage]);
  const activeFilterCount = filterActiveCount(filters);

  // Filters run client-side, so partial pagination produces a partial filter
  // result. When ANY filter is active, eagerly fetch every remaining page
  // before the user trusts the count. Without this, a match that lives on
  // page 2+ stays invisible — and the "Filtered · N of M" eyebrow lies.
  // Codex P2 round 2 on PR #738 sharpened the original "only fetch when empty"
  // fix to cover the partial-match case too. The loop terminates because each
  // fetch flips `hasNextPage` to false once the last page lands; `isLoading`
  // gates the very first page so we don't double-trigger before the initial
  // render settles.
  React.useEffect(() => {
    if (filters && hasNextPage && !isFetchingNextPage && !isLoading) {
      void fetchNextPage();
    }
  }, [filters, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

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
            {/* Use the smart-tiles' "—" placeholder until counts are
                authoritative, so a paginated wardrobe doesn't render
                "Inventory · 30" or a filtered total against the same
                undercount. Codex P2 round 9 on PR #738. */}
            {activeFilterCount > 0
              ? `Filtered · ${countsAuthoritative ? visibleGarments.length : '—'} of ${fmtCount(totalCount)}`
              : `Inventory · ${fmtCount(totalCount)}`}
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
          placeholder={
            countsAuthoritative
              ? `Search ${totalCount} garments…`
              : 'Search your wardrobe…'
          }
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

  // M27 — wraps every return path in the same fragment so the coach
  // overlay surfaces regardless of which Wardrobe state the user lands on.
  // Centered fallback (no targetRef.current) is intentional for non-grid
  // states (error / loading / empty).
  const coachOverlay = (
    <CoachOverlay
      visible={showWardrobeCoach}
      targetRef={gridRef}
      caption={tr('coachTour.step.wardrobe')}
      ctaLabel={tr('coachTour.next')}
      onNext={coach.advance}
      onSkip={coach.skip}
      step={2}
      total={COACH_TOUR_TOTAL}
    />
  );

  if (isError) {
    return (
      <>
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
        {coachOverlay}
      </>
    );
  }

  if (isLoading) {
    return (
      <>
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
        {coachOverlay}
      </>
    );
  }

  // Empty wardrobe — distinct cases:
  //   1. trueTotalCount === 0  → genuinely new user, "Add your first piece"
  //   2. trueTotalCount > 0    → wardrobe exists but every garment is inLaundry,
  //      "All in laundry"        send the user to LaundryScreen instead of an
  //                              "Add your first piece" CTA they don't need.
  // The "filters narrow it to zero" case is handled below via filteredEmpty
  // — it keeps the filter chips visible and just renders the no-matches state.
  if (totalCount === 0 && !hasNextPage) {
    const isAllLaundry = allInLaundry;
    return (
      <>
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
              {isAllLaundry ? tr('wardrobe.allLaundry.title') : tr('wardrobe.empty.title')}
            </Text>
            <Caption style={{ textAlign: 'center', maxWidth: 260 }}>
              {isAllLaundry
                ? tr('wardrobe.allLaundry.body', { count: trueTotalCount })
                : tr('wardrobe.empty.body')}
            </Caption>
            {isAllLaundry ? (
              <Button label={tr('wardrobe.allLaundry.cta')} onPress={() => nav.navigate('Laundry')} />
            ) : (
              <Button label={tr('wardrobe.empty.cta')} onPress={() => nav.navigate('AddPieceStep1')} />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      {coachOverlay}
    </>
    );
  }

  // Filtered to zero — when filters narrow `visibleGarments` to nothing but the
  // wardrobe itself isn't empty. Distinct from the new-user empty state above:
  // here we show what to do (clear filters), not a "get started" CTA.
  const filteredEmpty = totalCount > 0 && visibleGarments.length === 0 && activeFilterCount > 0;

  return (
    <>
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View ref={gridRef} collapsable={false} style={{ flex: 1 }}>
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
          // When filters are active the eager-paginate effect above already
          // walks every page; firing fetchNextPage from the FlatList scroll
          // callback as well races the effect on every render where
          // `hasNextPage` is still true. The infinite-query dedupes by key,
          // but skipping the redundant trigger keeps the two paths from
          // fighting over `isFetchingNextPage`. Codex P2 on PR #738.
          if (filters) return;
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
                {tr('wardrobe.filtered.empty.title')}
              </Text>
              <Caption style={{ textAlign: 'center', maxWidth: 260 }}>
                {tr('wardrobe.filtered.empty.body')}
              </Caption>
              <Button label={tr('wardrobe.filtered.clear')} variant="outline" onPress={() => setFilters(null)} />
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
      </View>
    </SafeAreaView>
    {coachOverlay}
    </>
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
