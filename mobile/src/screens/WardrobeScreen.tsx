// Wardrobe — pixel-faithful port of design_handoff_burs_rn/source/screens.jsx WardrobeScreen.
// Sections (top→bottom): page header · Garments/Outfits/Laundry tab chips · search row ·
// smart-access tiles (2x2 then 1x2) · "All garments" eyebrow · 3-col garment FlatList.
// BottomNav lives in MainTabsScreen, not here — every tab screen uses that container's pill.
//
// FlatList over ScrollView+map: garment counts will run into the hundreds; numColumns=3 +
// virtualization gives stable scroll perf without a complex layout calc per row.

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { SearchBar } from '../components/SearchBar';
import { SmartTile } from '../components/SmartTile';
import { GarmentCard, type GarmentCardData } from '../components/GarmentCard';
import { FilterIcon, GridIcon, PlusIcon } from '../components/icons';
import type { RootStackParamList, WardrobeFilters } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Placeholder garment fixtures. Same set + hues as the handoff prototype so the visual
// rhythm matches one-for-one. Real data lands when wardrobe queries are wired.
const GARMENTS: GarmentCardData[] = [
  { id: 'g1', name: 'Cream tee',      sub: 'Tops · Cotton',     hue: 32 },
  { id: 'g2', name: 'Navy blazer',    sub: 'Outer · Wool',      hue: 215 },
  { id: 'g3', name: 'Linen trouser',  sub: 'Bottoms · Linen',   hue: 38 },
  { id: 'g4', name: 'Leather loafer', sub: 'Shoes · Suede',     hue: 28 },
  { id: 'g5', name: 'Wool overshirt', sub: 'Outer · Wool',      hue: 32 },
  { id: 'g6', name: 'Striped oxford', sub: 'Tops · Cotton',     hue: 200 },
  { id: 'g7', name: 'Black denim',    sub: 'Bottoms · Denim',   hue: 220 },
  { id: 'g8', name: 'Cashmere knit',  sub: 'Tops · Cashmere',   hue: 18 },
  { id: 'g9', name: 'Suede boot',     sub: 'Shoes · Suede',     hue: 18 },
];

type TabKey = 'garments' | 'outfits' | 'laundry';

// Map FiltersScreen's `Outerwear` label to the abbreviated `Outer` token used inside this
// fixture's `sub` field ("Outer · Wool"). The wardrobe data uses short category names; the
// filter sheet shows the full name. Without this alias, ticking "Outerwear" would filter to
// zero matches even though Outer items exist. Real-data version of this is server-side or a
// canonical category enum shared across both surfaces.
const CATEGORY_ALIAS: Record<string, string[]> = {
  Outerwear: ['Outer'],
};

const matchesFilters = (garment: GarmentCardData, f: WardrobeFilters): boolean => {
  const [catRaw, matRaw] = garment.sub.split(' · ');
  const cat = (catRaw ?? '').trim();
  const mat = (matRaw ?? '').trim();
  if (f.categories.length > 0) {
    const expandedCats = f.categories.flatMap((c) => [c, ...(CATEGORY_ALIAS[c] ?? [])]);
    if (!expandedCats.some((c) => c.toLowerCase() === cat.toLowerCase())) return false;
  }
  if (f.materials.length > 0) {
    if (!f.materials.some((m) => m.toLowerCase() === mat.toLowerCase())) return false;
  }
  // Color/Fit/Season aren't on the fixture shape yet — the future garment row carries them.
  // Until then, those filters are accepted but no-op against the demo data.
  return true;
};

const filterActiveCount = (f: WardrobeFilters | null): number =>
  f
    ? f.categories.length +
      f.colors.length +
      f.materials.length +
      f.fits.length +
      f.seasons.length
    : 0;

export function WardrobeScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [activeTab, setActiveTab] = React.useState<TabKey>('garments');
  // Filter state lives at the WardrobeScreen scope. FiltersScreen receives the current filters
  // as `initial` (so re-opening preserves picks) and writes back via `onApply`. Without this
  // wiring the Apply button was a silent no-op — Codex P2 round 10. When the wardrobe-query
  // hook lands, this state becomes the input shape for that hook (or a contextual filter
  // store). `null` distinguishes "user has never opened Filters" from "filters are empty".
  const [filters, setFilters] = React.useState<WardrobeFilters | null>(null);

  const visibleGarments = React.useMemo(
    () => (filters ? GARMENTS.filter((g) => matchesFilters(g, filters)) : GARMENTS),
    [filters],
  );
  const activeFilterCount = filterActiveCount(filters);

  // Tab chips that target a real route push onto the parent stack instead of swapping
  // local state — Outfits is its own screen, Laundry stays as a local tab until a route lands.
  const onTab = (key: TabKey) => () => {
    if (key === 'outfits') {
      nav.navigate('Outfits');
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
              ? `Filtered · ${visibleGarments.length} of ${GARMENTS.length}`
              : `Inventory · ${GARMENTS.length}`}
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
          placeholder={`Search ${GARMENTS.length} garments…`}
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
        <SmartTile num="12" label="Recently added" />
        <SmartTile num="38" label="Most worn" onPress={() => nav.navigate('UsedGarments')} />
      </View>
      <View style={s.tileRow}>
        <SmartTile num="7" label="Unworn this season" onPress={() => nav.navigate('UnusedOutfits')} />
        <SmartTile num="4" label="In laundry" />
      </View>

      <View style={s.tileRow}>
        <SmartTile num="4" label="Wishlist" />
        <SmartTile num="5" label="Gaps" onPress={() => nav.navigate('WardrobeGaps')} />
      </View>

      <View style={s.sectionHead}>
        <Eyebrow>All garments</Eyebrow>
        <Caption>A → Z</Caption>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={visibleGarments}
        keyExtractor={(g) => g.id ?? g.name}
        numColumns={3}
        ListHeaderComponent={header}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 130, gap: 8 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={{ flex: 1 / 3 }}>
            <GarmentCard
              garment={item}
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
