// Unused outfits — garments not worn this season. Reachable from the Wardrobe "Unworn this season"
// smart tile (already wired). Same vocabulary as UsedGarments: header (eyebrow + italic title),
// caption row, filter chips, then a 3-col GarmentCard grid with an "Unworn" overlay badge.
//
// Sticky bottom: full-width "Generate outfit from unused" CTA → routes to StyleMe so the user can
// quickly build a look around them.
//
// Source: design_handoff_burs_rn/source/audit-screens.jsx UnusedOutfitsScreen + the user brief.

import React from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterKey = 'all' | 'tops' | 'bottoms' | 'shoes' | 'outer' | 'accessory';

type UnusedItem = {
  id: string;
  name: string;
  category: string;
  hue: number;
  cat: FilterKey;
};

const ITEMS: UnusedItem[] = [
  { id: 'u1',  name: 'Beach linen shirt', category: 'Tops · Linen',     hue: 200, cat: 'tops' },
  { id: 'u2',  name: 'Striped polo',      category: 'Tops · Cotton',    hue: 215, cat: 'tops' },
  { id: 'u3',  name: 'Wool trouser',      category: 'Bottoms · Wool',   hue: 28,  cat: 'bottoms' },
  { id: 'u4',  name: 'Linen short',       category: 'Bottoms · Linen',  hue: 38,  cat: 'bottoms' },
  { id: 'u5',  name: 'Suede chelsea',     category: 'Shoes · Suede',    hue: 18,  cat: 'shoes' },
  { id: 'u6',  name: 'Espadrille',        category: 'Shoes · Canvas',   hue: 32,  cat: 'shoes' },
  { id: 'u7',  name: 'Leather belt',      category: 'Accessory',        hue: 45,  cat: 'accessory' },
  { id: 'u8',  name: 'Linen blazer',      category: 'Outer · Linen',    hue: 32,  cat: 'outer' },
  { id: 'u9',  name: 'Denim jacket',      category: 'Outer · Denim',    hue: 220, cat: 'outer' },
];

export function UnusedOutfitsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = React.useState<FilterKey>('all');

  const visible = filter === 'all' ? ITEMS : ITEMS.filter((i) => i.cat === filter);

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
        Garments you haven't worn this season — reshuffle a look around one of them.
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
        renderItem={({ item }) => (
          <View style={{ flex: 1 / 3 }}>
            <View
              style={[
                s.card,
                {
                  backgroundColor: t.bg2,
                  borderColor: t.border,
                },
              ]}
              accessible
              accessibilityLabel={`${item.name}, unworn`}>
              <LinearGradient
                colors={[`hsl(${item.hue}, 38%, 78%)`, `hsl(${(item.hue + 30) % 360}, 30%, 62%)`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.cardThumb}
              />
              <View style={[s.unwornBadge, { backgroundColor: t.accentSoft }]}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 9,
                    color: t.accent,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                  }}>
                  Unworn
                </Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: t.fg,
                    letterSpacing: -0.13,
                  }}>
                  {item.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 10,
                    color: t.fg2,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                  }}>
                  {item.category}
                </Text>
              </View>
            </View>
          </View>
        )}
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

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cardThumb: {
    aspectRatio: 1,
    width: '100%',
  },
  unwornBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
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
