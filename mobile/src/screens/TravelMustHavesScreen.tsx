// Travel Capsule — Step 2 of 4. Pick the wardrobe pieces that must come.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx capsule must-haves panel.
//
// 3-col GarmentCard grid with checkmark overlay on selected items + sticky bottom
// continue bar. Once the wardrobe hook lands, swap GARMENT_FIXTURES for the live
// query result.

import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { radii } from '../theme/tokens';
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

// Mock fixtures — TravelMustHaves runs entirely off these for now since the
// TravelCapsule wizard isn't backend-wired yet. Keeping the data here means we
// can still demo the flow before Wave 9. Fields use the post-W2 GarmentCardData
// shape (title / category) — when this screen migrates to a real query the
// fixture list goes away and `useFlatGarments({ inLaundry: false })` replaces it.
const GARMENT_FIXTURES: GarmentFixture[] = [
  { id: 'g1',  title: 'Wool overshirt',   category: 'Outer',   hue: 32 },
  { id: 'g2',  title: 'Sand chore',       category: 'Outer',   hue: 45 },
  { id: 'g3',  title: 'Cream tee',        category: 'Tops',    hue: 32 },
  { id: 'g4',  title: 'Linen henley',     category: 'Tops',    hue: 38 },
  { id: 'g5',  title: 'Black tee',        category: 'Tops',    hue: 28 },
  { id: 'g6',  title: 'Striped knit',     category: 'Tops',    hue: 200 },
  { id: 'g7',  title: 'Oxford shirt',     category: 'Tops',    hue: 220 },
  { id: 'g8',  title: 'Linen trouser',    category: 'Bottoms', hue: 38 },
  { id: 'g9',  title: 'Black denim',      category: 'Bottoms', hue: 28 },
  { id: 'g10', title: 'Wool trouser',     category: 'Bottoms', hue: 220 },
  { id: 'g11', title: 'Walk shorts',      category: 'Bottoms', hue: 32 },
  { id: 'g12', title: 'Bone sneaker',     category: 'Shoes',   hue: 32 },
  { id: 'g13', title: 'Chocolate loafer', category: 'Shoes',   hue: 18 },
  { id: 'g14', title: 'Leather sandal',   category: 'Shoes',   hue: 38 },
  { id: 'g15', title: 'Cream slip dress', category: 'Dress',   hue: 38 },
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

  const toggle = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const header = (
    <View style={{ paddingHorizontal: 20, paddingBottom: 14, gap: 14 }}>
      <View style={s.headerRow}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Step 2 of 3</Eyebrow>
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

  // Memoised renderTile — preserves FlatList row memoisation across parent re-renders.
  // Codex audit P2.2.
  const renderTile = React.useCallback(({ item }: { item: GarmentFixture }) => {
    const isSelected = selected.has(item.id);
    return (
      <Pressable
        onPress={() => toggle(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={item.title}
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
  }, [selected, toggle, t.accent, t.accentFg, t.border]);

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
