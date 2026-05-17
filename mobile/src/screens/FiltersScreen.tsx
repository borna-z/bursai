// Filters — full-screen modal-style filter sheet pushed from Wardrobe.
// Header: Cancel left · italic "Filters" centered · Reset right (accent).
// Body: Card-grouped filter sections — Category / Color / Material / Fit / Season / Sort by.
// Sticky bottom: "Apply filters" button with active count in label.
//
// Multi-select where it makes sense (Category, Color, Material, Fit, Season). Sort is single-select.
// Source: design_handoff_burs_rn/source/extra-screens.jsx FiltersScreen.

import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Chip } from '../components/Chip';
import { Button } from '../components/Button';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList, WardrobeFilters } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Filters'>;

// Audit FIX 6 (2026-05-18). The state values below stay English so they
// match the filter contract `WardrobeFilters` (consumed by the wardrobe
// query) and round-trip cleanly through navigation params; only the
// rendered chip / section labels go through `tr()`. Adding a new value to
// any axis requires (a) appending the ID here AND (b) adding the matching
// `filters.<axis>.<id>` key to `mobile/src/i18n/locales/{en,sv}.ts`.
const CATEGORIES = ['Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Dress', 'Accessories'] as const;
const MATERIALS = ['Cotton', 'Linen', 'Wool', 'Silk', 'Leather', 'Denim', 'Cashmere', 'Synthetic'] as const;
const FITS = ['Slim', 'Regular', 'Loose', 'Oversized'] as const;
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
const SORT_IDS = ['name_asc', 'most_worn', 'recent_added', 'least_worn', 'recent_worn'] as const;

const CATEGORY_LABEL_KEY: Record<typeof CATEGORIES[number], string> = {
  Outerwear: 'filters.category.outerwear',
  Tops: 'filters.category.tops',
  Bottoms: 'filters.category.bottoms',
  Shoes: 'filters.category.shoes',
  Dress: 'filters.category.dress',
  Accessories: 'filters.category.accessories',
};
const MATERIAL_LABEL_KEY: Record<typeof MATERIALS[number], string> = {
  Cotton: 'filters.material.cotton',
  Linen: 'filters.material.linen',
  Wool: 'filters.material.wool',
  Silk: 'filters.material.silk',
  Leather: 'filters.material.leather',
  Denim: 'filters.material.denim',
  Cashmere: 'filters.material.cashmere',
  Synthetic: 'filters.material.synthetic',
};
const FIT_LABEL_KEY: Record<typeof FITS[number], string> = {
  Slim: 'filters.fit.slim',
  Regular: 'filters.fit.regular',
  Loose: 'filters.fit.loose',
  Oversized: 'filters.fit.oversized',
};
const SEASON_LABEL_KEY: Record<typeof SEASONS[number], string> = {
  Spring: 'filters.season.spring',
  Summer: 'filters.season.summer',
  Autumn: 'filters.season.autumn',
  Winter: 'filters.season.winter',
};
const SORT_LABEL_KEY: Record<typeof SORT_IDS[number], string> = {
  name_asc: 'filters.sort.nameAsc',
  most_worn: 'filters.sort.mostWorn',
  recent_added: 'filters.sort.recentAdded',
  least_worn: 'filters.sort.leastWorn',
  recent_worn: 'filters.sort.recentWorn',
};

// Color id ↔ swatch hex. Labels resolve via `filters.color.<id>` at render
// time. Keeping ids stable (lowercase English) preserves filter-state round-
// tripping through navigation params.
const COLORS: { id: string; color: string }[] = [
  { id: 'cream',    color: '#F5EBD8' },
  { id: 'beige',    color: '#D9C9A6' },
  { id: 'camel',    color: '#B98E5A' },
  { id: 'brown',    color: '#5C3F2C' },
  { id: 'olive',    color: '#6B6B3F' },
  { id: 'navy',     color: '#1F2D4A' },
  { id: 'charcoal', color: '#2A2622' },
  { id: 'black',    color: '#111111' },
  { id: 'white',    color: '#F8F4EE' },
  { id: 'grey',     color: '#8B8B8B' },
  { id: 'rust',     color: '#A85432' },
  { id: 'gold',     color: '#C9A445' },
];

export function FiltersScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();

  // Hydrate from `route.params.initial` so re-opening the sheet preserves the prior selection
  // (e.g. tapping "Filters" twice in a row from Wardrobe shouldn't reset the user's picks).
  // Codex P2 round 8: previously these all initialised to empty + sort='name_asc' regardless
  // of the caller's prior state. We freeze the initial state in a ref so subsequent renders
  // (e.g. caused by a parent re-mounting the screen with a refreshed `onApply` callback) don't
  // wipe the user's in-progress edits.
  const initialRef = React.useRef<WardrobeFilters | undefined>(route.params?.initial);
  const [categories, setCategories] = React.useState<string[]>(initialRef.current?.categories ?? []);
  const [colors, setColors] = React.useState<string[]>(initialRef.current?.colors ?? []);
  const [materials, setMaterials] = React.useState<string[]>(initialRef.current?.materials ?? []);
  const [fits, setFits] = React.useState<string[]>(initialRef.current?.fits ?? []);
  const [seasons, setSeasons] = React.useState<string[]>(initialRef.current?.seasons ?? []);
  const [sort, setSort] = React.useState<string>(initialRef.current?.sort ?? 'name_asc');

  const togglePick = (val: string, list: string[], setList: (xs: string[]) => void) =>
    setList(list.includes(val) ? list.filter((v) => v !== val) : [...list, val]);

  const reset = () => {
    setCategories([]);
    setColors([]);
    setMaterials([]);
    setFits([]);
    setSeasons([]);
    setSort('name_asc');
  };

  const activeCount =
    categories.length + colors.length + materials.length + fits.length + seasons.length;

  // N3.10 F-007 — back-without-Apply guard. Compare current selections to
  // the snapshot taken at mount; if anything changed, surface a confirm
  // alert before popping. Without this the user loses all in-progress
  // picks the moment they tap Cancel/back to glance at Wardrobe behind
  // the sheet. Sort lists are sorted-compared because the togglePick
  // helper appends in tap-order — ['black','navy'] == ['navy','black'].
  const isDirty = React.useMemo(() => {
    const initial = initialRef.current;
    const sameList = (a: string[], b: string[]) => {
      if (a.length !== b.length) return false;
      const sa = [...a].sort();
      const sb = [...b].sort();
      for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
      return true;
    };
    return !(
      sameList(categories, initial?.categories ?? [])
      && sameList(colors, initial?.colors ?? [])
      && sameList(materials, initial?.materials ?? [])
      && sameList(fits, initial?.fits ?? [])
      && sameList(seasons, initial?.seasons ?? [])
      && sort === (initial?.sort ?? 'name_asc')
    );
  }, [categories, colors, materials, fits, seasons, sort]);

  const handleCancel = () => {
    if (!isDirty) {
      nav.goBack();
      return;
    }
    Alert.alert(
      tr('filters.discardChanges.title'),
      tr('filters.discardChanges.body'),
      [
        { text: tr('filters.discardChanges.keepEditing'), style: 'cancel' },
        {
          text: tr('filters.discardChanges.discard'),
          style: 'destructive',
          onPress: () => nav.goBack(),
        },
      ],
    );
  };

  const apply = () => {
    // Hand the chosen filters back to the caller (typically Wardrobe). If no callback was
    // supplied we still goBack so the screen remains usable as a standalone preview, but the
    // selection is dropped — which is what the no-caller flow always does anyway. When the
    // wardrobe filtering hook lands, the caller passes a setter from `useWardrobeFilters()`
    // here.
    route.params?.onApply?.({ categories, colors, materials, fits, seasons, sort });
    nav.goBack();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.headerRow, { borderBottomColor: t.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('common.cancel')}
          onPress={handleCancel}
          hitSlop={8}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2 }}>{tr('common.cancel')}</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 18,
              lineHeight: 22,
              fontWeight: '500',
              color: t.fg,
              letterSpacing: -0.18,
            }}>
            {tr('filters.title')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('filters.reset.aria')}
          onPress={reset}
          hitSlop={8}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 13,
              color: t.accent,
              fontWeight: '600',
            }}>
            {tr('filters.reset.label')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 96,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}>

        <FilterCard title={tr('filters.section.category')}>
          <View style={s.chipRow}>
            {CATEGORIES.map((v) => (
              <Chip
                key={v}
                label={tr(CATEGORY_LABEL_KEY[v])}
                active={categories.includes(v)}
                onPress={() => togglePick(v, categories, setCategories)}
              />
            ))}
          </View>
        </FilterCard>

        <FilterCard title={tr('filters.section.color')}>
          <View style={s.colorGrid}>
            {COLORS.map((c) => {
              const active = colors.includes(c.id);
              const colorLabel = tr(`filters.color.${c.id}`);
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={colorLabel}
                  accessibilityState={{ selected: active }}
                  onPress={() => togglePick(c.id, colors, setColors)}
                  style={({ pressed }) => [
                    s.colorCell,
                    {
                      borderColor: active ? t.accent : t.border,
                      borderWidth: active ? 2 : 1,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <View style={[s.colorInner, { backgroundColor: c.color }]} />
                  <Text
                    numberOfLines={1}
                    style={{
                      marginTop: 6,
                      fontFamily: fonts.uiMed,
                      fontSize: 10,
                      color: t.fg2,
                      letterSpacing: 0.4,
                      textAlign: 'center',
                    }}>
                    {colorLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FilterCard>

        <FilterCard title={tr('filters.section.material')}>
          <View style={s.chipRow}>
            {MATERIALS.map((v) => (
              <Chip
                key={v}
                label={tr(MATERIAL_LABEL_KEY[v])}
                active={materials.includes(v)}
                onPress={() => togglePick(v, materials, setMaterials)}
              />
            ))}
          </View>
        </FilterCard>

        <FilterCard title={tr('filters.section.fit')}>
          <View style={s.chipRow}>
            {FITS.map((v) => (
              <Chip
                key={v}
                label={tr(FIT_LABEL_KEY[v])}
                active={fits.includes(v)}
                onPress={() => togglePick(v, fits, setFits)}
              />
            ))}
          </View>
        </FilterCard>

        <FilterCard title={tr('filters.section.season')}>
          <View style={s.chipRow}>
            {SEASONS.map((v) => (
              <Chip
                key={v}
                label={tr(SEASON_LABEL_KEY[v])}
                active={seasons.includes(v)}
                onPress={() => togglePick(v, seasons, setSeasons)}
              />
            ))}
          </View>
        </FilterCard>

        <FilterCard title={tr('filters.section.sort')}>
          <View style={s.chipRow}>
            {SORT_IDS.map((id) => (
              <Chip
                key={id}
                label={tr(SORT_LABEL_KEY[id])}
                active={sort === id}
                onPress={() => setSort(id)}
              />
            ))}
          </View>
        </FilterCard>
      </ScrollView>

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
          label={
            activeCount > 0
              ? tr('filters.apply.withCount', { count: activeCount })
              : tr('filters.apply.label')
          }
          block
          onPress={apply}
        />
      </View>
    </SafeAreaView>
  );
}

function FilterCard({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTokens();
  return (
    <View
      style={[
        s.filterCard,
        {
          backgroundColor: t.card,
          borderColor: t.border,
        },
      ]}>
      <Eyebrow style={{ marginBottom: 12 }}>{title}</Eyebrow>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterCard: {
    padding: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorCell: {
    width: '14%',
    flexGrow: 0,
    borderRadius: 999,
    padding: 3,
    alignItems: 'center',
  },
  colorInner: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 999,
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
});
