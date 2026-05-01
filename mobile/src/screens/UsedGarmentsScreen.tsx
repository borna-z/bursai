// Used garments — list of every garment with wear count > 0, sorted descending.
// Reachable from the Wardrobe "Most worn" smart tile (already wired) and from the future Insights
// "Most worn → See all" link.
//
// Header (eyebrow + italic title), sort chips, FlatList of rows. Each row: 52x68 gradient thumb
// + name + category caption + wear count badge in accent colour + chevron. FlatList covers >10 rows.
//
// Source: design_handoff_burs_rn/source/audit-screens.jsx UsedGarmentsScreen + the user brief.

import React from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, ChevronIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type SortKey = 'most_worn' | 'recent_worn' | 'category';

type Used = {
  id: string;
  name: string;
  category: string;
  wearCount: number;
  hue: number;
  /** Days since last worn — used for the recent_worn sort path. */
  lastWornDays: number;
};

const USED: Used[] = [
  { id: 'g6',  name: 'Linen tee',         category: 'Tops · Cotton',     wearCount: 31, lastWornDays: 2,  hue: 32 },
  { id: 'g1',  name: 'Wool overshirt',    category: 'Outer · Wool',      wearCount: 23, lastWornDays: 18, hue: 38 },
  { id: 'g3',  name: 'Linen trouser',     category: 'Bottoms · Linen',   wearCount: 14, lastWornDays: 4,  hue: 200 },
  { id: 'g7',  name: 'Black denim',       category: 'Bottoms · Denim',   wearCount: 11, lastWornDays: 9,  hue: 220 },
  { id: 'g2',  name: 'White oxford',      category: 'Tops · Cotton',     wearCount: 9,  lastWornDays: 1,  hue: 200 },
  { id: 'g8',  name: 'Cashmere knit',     category: 'Tops · Cashmere',   wearCount: 7,  lastWornDays: 21, hue: 18 },
  { id: 'g5',  name: 'Sand chore',        category: 'Outer · Cotton',    wearCount: 6,  lastWornDays: 5,  hue: 45 },
  { id: 'g4',  name: 'Bone leather sneaker', category: 'Shoes · Leather', wearCount: 5,  lastWornDays: 3,  hue: 32 },
  { id: 'g9',  name: 'Charcoal trouser',  category: 'Bottoms · Wool',    wearCount: 4,  lastWornDays: 30, hue: 28 },
  { id: 'g10', name: 'Navy blazer',       category: 'Outer · Wool',      wearCount: 3,  lastWornDays: 45, hue: 220 },
  { id: 'g11', name: 'Striped knit',      category: 'Tops · Cotton',     wearCount: 2,  lastWornDays: 12, hue: 215 },
  { id: 'g12', name: 'Suede loafer',      category: 'Shoes · Suede',     wearCount: 1,  lastWornDays: 60, hue: 28 },
];

export function UsedGarmentsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [sort, setSort] = React.useState<SortKey>('most_worn');

  const items = React.useMemo(() => {
    const list = [...USED];
    if (sort === 'most_worn')   return list.sort((a, b) => b.wearCount - a.wearCount);
    if (sort === 'recent_worn') return list.sort((a, b) => a.lastWornDays - b.lastWornDays);
    if (sort === 'category')    return list.sort((a, b) => a.category.localeCompare(b.category));
    return list;
  }, [sort]);

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 }}>
        <Chip label="Most worn"     active={sort === 'most_worn'}   onPress={() => setSort('most_worn')} />
        <Chip label="Recently worn" active={sort === 'recent_worn'} onPress={() => setSort('recent_worn')} />
        <Chip label="By category"   active={sort === 'category'}    onPress={() => setSort('category')} />
      </ScrollView>
    </View>
  );

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
        ItemSeparatorComponent={() => <View style={[s.sep, { backgroundColor: t.border }]} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.wearCount} wears`}
            onPress={() => nav.navigate('GarmentDetail', { id: item.id })}
            style={({ pressed }) => [s.rowWrap, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={s.rowInner}>
              <LinearGradient
                colors={[`hsl(${item.hue}, 38%, 78%)`, `hsl(${(item.hue + 30) % 360}, 30%, 62%)`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.thumb}
              />
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
                  {item.name}
                </Text>
                <Caption>{item.category}</Caption>
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
                  {item.wearCount}
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
