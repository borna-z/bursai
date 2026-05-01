// Filters — full-screen modal-style filter sheet pushed from Wardrobe.
// Header: Cancel left · italic "Filters" centered · Reset right (accent).
// Body: Card-grouped filter sections — Category / Color / Material / Fit / Season / Sort by.
// Sticky bottom: "Apply filters" button with active count in label.
//
// Multi-select where it makes sense (Category, Color, Material, Fit, Season). Sort is single-select.
// Source: design_handoff_burs_rn/source/extra-screens.jsx FiltersScreen.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Chip } from '../components/Chip';
import { Button } from '../components/Button';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES = ['Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Dress', 'Accessories'];
const MATERIALS = ['Cotton', 'Linen', 'Wool', 'Silk', 'Leather', 'Denim', 'Cashmere', 'Synthetic'];
const FITS = ['Slim', 'Regular', 'Loose', 'Oversized'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SORTS = [
  { id: 'name_asc', label: 'Name A–Z' },
  { id: 'most_worn', label: 'Most worn' },
  { id: 'recent_added', label: 'Recently added' },
  { id: 'least_worn', label: 'Least worn' },
  { id: 'recent_worn', label: 'Recently worn' },
];

const COLORS: { id: string; label: string; color: string }[] = [
  { id: 'cream',    label: 'Cream',    color: '#F5EBD8' },
  { id: 'beige',    label: 'Beige',    color: '#D9C9A6' },
  { id: 'camel',    label: 'Camel',    color: '#B98E5A' },
  { id: 'brown',    label: 'Brown',    color: '#5C3F2C' },
  { id: 'olive',    label: 'Olive',    color: '#6B6B3F' },
  { id: 'navy',     label: 'Navy',     color: '#1F2D4A' },
  { id: 'charcoal', label: 'Charcoal', color: '#2A2622' },
  { id: 'black',    label: 'Black',    color: '#111111' },
  { id: 'white',    label: 'White',    color: '#F8F4EE' },
  { id: 'grey',     label: 'Grey',     color: '#8B8B8B' },
  { id: 'rust',     label: 'Rust',     color: '#A85432' },
  { id: 'gold',     label: 'Gold',     color: '#C9A445' },
];

export function FiltersScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = React.useState<string[]>([]);
  const [colors, setColors] = React.useState<string[]>([]);
  const [materials, setMaterials] = React.useState<string[]>([]);
  const [fits, setFits] = React.useState<string[]>([]);
  const [seasons, setSeasons] = React.useState<string[]>([]);
  const [sort, setSort] = React.useState<string>('name_asc');

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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.headerRow, { borderBottomColor: t.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => nav.goBack()}
          hitSlop={8}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2 }}>Cancel</Text>
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
            Filters
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset filters"
          onPress={reset}
          hitSlop={8}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 13,
              color: t.accent,
              fontWeight: '600',
            }}>
            Reset
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

        <FilterCard title="Category">
          <View style={s.chipRow}>
            {CATEGORIES.map((v) => (
              <Chip
                key={v}
                label={v}
                active={categories.includes(v)}
                onPress={() => togglePick(v, categories, setCategories)}
              />
            ))}
          </View>
        </FilterCard>

        <FilterCard title="Color">
          <View style={s.colorGrid}>
            {COLORS.map((c) => {
              const active = colors.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
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
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FilterCard>

        <FilterCard title="Material">
          <View style={s.chipRow}>
            {MATERIALS.map((v) => (
              <Chip
                key={v}
                label={v}
                active={materials.includes(v)}
                onPress={() => togglePick(v, materials, setMaterials)}
              />
            ))}
          </View>
        </FilterCard>

        <FilterCard title="Fit">
          <View style={s.chipRow}>
            {FITS.map((v) => (
              <Chip
                key={v}
                label={v}
                active={fits.includes(v)}
                onPress={() => togglePick(v, fits, setFits)}
              />
            ))}
          </View>
        </FilterCard>

        <FilterCard title="Season">
          <View style={s.chipRow}>
            {SEASONS.map((v) => (
              <Chip
                key={v}
                label={v}
                active={seasons.includes(v)}
                onPress={() => togglePick(v, seasons, setSeasons)}
              />
            ))}
          </View>
        </FilterCard>

        <FilterCard title="Sort by">
          <View style={s.chipRow}>
            {SORTS.map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                active={sort === o.id}
                onPress={() => setSort(o.id)}
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
          label={activeCount > 0 ? `Apply filters · ${activeCount}` : 'Apply filters'}
          block
          onPress={() => nav.goBack()}
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
