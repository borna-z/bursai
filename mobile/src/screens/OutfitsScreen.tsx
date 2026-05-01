// Outfits — saved looks list. Sourced from design_handoff_burs_rn/source/extra-screens.jsx OutfitsScreen
// + handoff README §"Outfits". Top: header (eyebrow / italic title) plus filter chips and a grid/list
// toggle. Below: 2-col grid of outfit cards (gradient placeholder + name + meta chips + wear count).
// Empty state mirrors handoff "no outfits yet" — italic title + caption + Style me CTA.
//
// FlatList over ScrollView+map: outfit lists can grow into the dozens; numColumns=2 keeps perf flat
// once a backend hook lands. The fixed fixture below visually rhymes with the handoff prototype.

import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { Button } from '../components/Button';
import { BackIcon, GridIcon, ListIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type OutfitFixture = {
  id: string;
  name: string;
  occasion: string;
  formality: string;
  wearCount: number;
  /** Four hues for the 2x2 garment thumb grid. */
  hues: [number, number, number, number];
};

const OUTFITS: OutfitFixture[] = [
  { id: 'o1', name: 'Studio brunch',  occasion: 'Brunch',  formality: 'Smart casual', wearCount: 12, hues: [32, 38, 200, 28] },
  { id: 'o2', name: 'Sunday casual',  occasion: 'Casual',  formality: 'Casual',       wearCount: 8,  hues: [200, 220, 28, 45] },
  { id: 'o3', name: 'Boardroom',      occasion: 'Office',  formality: 'Business',     wearCount: 4,  hues: [220, 28, 200, 18] },
  { id: 'o4', name: 'Gallery night',  occasion: 'Evening', formality: 'Smart',        wearCount: 6,  hues: [280, 28, 18, 200] },
  { id: 'o5', name: 'Weekend run',    occasion: 'Active',  formality: 'Casual',       wearCount: 0,  hues: [120, 200, 32, 45] },
  { id: 'o6', name: 'Date — soft',    occasion: 'Date',    formality: 'Smart',        wearCount: 2,  hues: [350, 32, 28, 18] },
];

type FilterKey = 'all' | 'recent' | 'with_notes';
type ViewMode = 'grid' | 'list';

export function OutfitsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [filter, setFilter] = React.useState<FilterKey>('all');
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');

  // Filter is presentational only for now — swap when an outfits hook lands.
  const visible = OUTFITS;

  const header = (
    <View style={{ paddingHorizontal: 20, paddingBottom: 14, gap: 14 }}>
      <View style={s.headerRow}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Saved looks</Eyebrow>
          <PageTitle>Outfits</PageTitle>
        </View>
        <IconBtn
          ariaLabel={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          onPress={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}>
          {viewMode === 'grid' ? <ListIcon color={t.fg} /> : <GridIcon color={t.fg} />}
        </IconBtn>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Recent" active={filter === 'recent'} onPress={() => setFilter('recent')} />
        <Chip label="With notes" active={filter === 'with_notes'} onPress={() => setFilter('with_notes')} />
      </View>
    </View>
  );

  const renderCard = ({ item }: { item: OutfitFixture }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.occasion}`}
      onPress={() => nav.navigate('OutfitDetail', { id: item.id })}
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          transform: pressed ? [{ scale: 0.97 }] : [],
        },
      ]}>
      <View style={s.cardThumbWrap}>
        {item.hues.map((h, i) => (
          <LinearGradient
            key={i}
            colors={[`hsl(${h}, 38%, 78%)`, `hsl(${(h + 30) % 360}, 30%, 62%)`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.cardThumbCell}
          />
        ))}
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 16,
            fontWeight: '500',
            color: t.fg,
            letterSpacing: -0.16,
          }}
          numberOfLines={1}>
          {item.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          <View style={[s.metaChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
            <Text style={[s.metaChipText, { color: t.fg2 }]}>{item.occasion}</Text>
          </View>
          <View style={[s.metaChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
            <Text style={[s.metaChipText, { color: t.fg2 }]}>{item.formality}</Text>
          </View>
        </View>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 10,
            color: t.fg3,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
          }}>
          {item.wearCount === 0 ? 'Never worn' : `${item.wearCount} wears`}
        </Text>
      </View>
    </Pressable>
  );

  if (visible.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={s.emptyWrap}>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 26,
              lineHeight: 30,
              fontWeight: '500',
              color: t.fg,
              textAlign: 'center',
              letterSpacing: -0.26,
            }}>
            No outfits yet
          </Text>
          <Caption style={{ textAlign: 'center', marginTop: 6, marginBottom: 18, maxWidth: 240 }}>
            Generate your first look from your wardrobe.
          </Caption>
          <Button label="Style me" onPress={() => nav.navigate('StyleMe')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={visible}
        keyExtractor={(o) => o.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        // numColumns must remount the FlatList when toggled — key forces a fresh layout.
        key={viewMode}
        ListHeaderComponent={header}
        columnWrapperStyle={viewMode === 'grid' ? { gap: 10, paddingHorizontal: 20 } : undefined}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: 130,
          gap: 10,
          paddingHorizontal: viewMode === 'list' ? 20 : 0,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={renderCard}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 4,
  },
  card: {
    flex: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardThumbWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    aspectRatio: 1,
    width: '100%',
  },
  cardThumbCell: {
    width: '50%',
    height: '50%',
  },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  metaChipText: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
});
