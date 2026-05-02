// Travel Capsule — Step 2 of 4. Pick the wardrobe pieces that must come.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx capsule must-haves panel.
//
// 3-col GarmentCard grid with checkmark overlay on selected items + sticky bottom
// continue bar. Once the wardrobe hook lands, swap GARMENT_FIXTURES for the live
// query result.

import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { GarmentCard, type GarmentCardData } from '../components/GarmentCard';
import { BackIcon, CheckIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type GarmentFixture = GarmentCardData & {
  id: string;
  category: 'Tops' | 'Bottoms' | 'Shoes' | 'Outer' | 'Dress';
};

const GARMENT_FIXTURES: GarmentFixture[] = [
  { id: 'g1', name: 'Wool overshirt', sub: 'Outer · Beige', hue: 32, category: 'Outer' },
  { id: 'g2', name: 'Sand chore', sub: 'Outer · Sand', hue: 45, category: 'Outer' },
  { id: 'g3', name: 'Cream tee', sub: 'Top · Cream', hue: 32, category: 'Tops' },
  { id: 'g4', name: 'Linen henley', sub: 'Top · Off-white', hue: 38, category: 'Tops' },
  { id: 'g5', name: 'Black tee', sub: 'Top · Black', hue: 28, category: 'Tops' },
  { id: 'g6', name: 'Striped knit', sub: 'Top · Navy', hue: 200, category: 'Tops' },
  { id: 'g7', name: 'Oxford shirt', sub: 'Top · Blue', hue: 220, category: 'Tops' },
  { id: 'g8', name: 'Linen trouser', sub: 'Bottom · Cream', hue: 38, category: 'Bottoms' },
  { id: 'g9', name: 'Black denim', sub: 'Bottom · Black', hue: 28, category: 'Bottoms' },
  { id: 'g10', name: 'Wool trouser', sub: 'Bottom · Charcoal', hue: 220, category: 'Bottoms' },
  { id: 'g11', name: 'Walk shorts', sub: 'Bottom · Khaki', hue: 32, category: 'Bottoms' },
  { id: 'g12', name: 'Bone sneaker', sub: 'Shoe · Bone', hue: 32, category: 'Shoes' },
  { id: 'g13', name: 'Chocolate loafer', sub: 'Shoe · Brown', hue: 18, category: 'Shoes' },
  { id: 'g14', name: 'Leather sandal', sub: 'Shoe · Tan', hue: 38, category: 'Shoes' },
  { id: 'g15', name: 'Cream slip dress', sub: 'Dress · Cream', hue: 38, category: 'Dress' },
];

const FILTERS = ['All', 'Tops', 'Bottoms', 'Shoes', 'Outer', 'Dress'] as const;
type FilterKey = (typeof FILTERS)[number];

export function TravelMustHavesScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [filter, setFilter] = React.useState<FilterKey>('All');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const visible = React.useMemo(() => {
    if (filter === 'All') return GARMENT_FIXTURES;
    return GARMENT_FIXTURES.filter((g) => g.category === filter);
  }, [filter]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const header = (
    <View style={{ paddingHorizontal: 20, paddingBottom: 14, gap: 14 }}>
      <View style={s.headerRow}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Step 2 of 4</Eyebrow>
          <PageTitle>Must-haves</PageTitle>
        </View>
      </View>
      <Caption>Which pieces must come with you?</Caption>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map((key) => (
          <Chip key={key} label={key} active={filter === key} onPress={() => setFilter(key)} />
        ))}
      </View>
      <Eyebrow>{selected.size} selected</Eyebrow>
    </View>
  );

  const renderTile = ({ item }: { item: GarmentFixture }) => {
    const isSelected = selected.has(item.id);
    return (
      <Pressable
        onPress={() => toggle(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={item.name}
        style={({ pressed }) => [
          {
            flex: 1,
            transform: pressed ? [{ scale: 0.98 }] : [],
          },
        ]}>
        <View
          style={[
            s.tile,
            {
              borderColor: isSelected ? t.accent : t.border,
              borderWidth: isSelected ? 2 : 1,
              borderRadius: radii.lg,
              overflow: 'hidden',
            },
          ]}>
          <GarmentCard garment={item} />
          {isSelected ? (
            <View style={[s.checkBadge, { backgroundColor: t.accent }]}>
              <CheckIcon color={t.accentFg} size={14} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={visible}
        keyExtractor={(g) => g.id}
        numColumns={3}
        ListHeaderComponent={header}
        renderItem={renderTile}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: 20 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      />

      {/* ============ STICKY CONTINUE BAR ============ */}
      <View style={[s.stickyBar, { backgroundColor: t.bg, borderTopColor: t.border }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{selected.size} pieces selected</Eyebrow>
          <Caption style={{ marginTop: 2 }}>
            {selected.size === 0
              ? 'Pick at least one to continue'
              : selected.size < 5
                ? 'Add a few more for variety'
                : 'Looking good — ready to pack'}
          </Caption>
        </View>
        <Button
          label="Continue"
          variant="accent"
          disabled={selected.size === 0}
          onPress={() => nav.navigate('TravelPackingList')}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  tile: {
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
