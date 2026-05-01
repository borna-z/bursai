// Search — full-screen modal-style search experience pushed from Wardrobe's pill.
// Auto-focused TextInput with back + clear at the top. Below: filter chips (category-scoped).
// When the query is empty: Recent searches block. With query (3+ chars): 3-col results grid
// using GarmentCard. Empty results: italic "Nothing found" + caption.
//
// KeyboardAvoidingView wraps the body so results scroll above the keyboard on iOS.

import React from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { GarmentCard, type GarmentCardData } from '../components/GarmentCard';
import { BackIcon, CloseIcon, SearchIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterCat = 'all' | 'tops' | 'bottoms' | 'shoes' | 'outer' | 'dress';
const CAT_LABELS: { id: FilterCat; label: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'tops',    label: 'Tops' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'shoes',   label: 'Shoes' },
  { id: 'outer',   label: 'Outer' },
  { id: 'dress',   label: 'Dress' },
];

const ALL_GARMENTS: (GarmentCardData & { cat: FilterCat })[] = [
  { id: 'g1', name: 'Cream tee',      sub: 'Tops · Cotton',     hue: 32,  cat: 'tops' },
  { id: 'g2', name: 'Navy blazer',    sub: 'Outer · Wool',      hue: 215, cat: 'outer' },
  { id: 'g3', name: 'Linen trouser',  sub: 'Bottoms · Linen',   hue: 38,  cat: 'bottoms' },
  { id: 'g4', name: 'Leather loafer', sub: 'Shoes · Suede',     hue: 28,  cat: 'shoes' },
  { id: 'g5', name: 'Wool overshirt', sub: 'Outer · Wool',      hue: 32,  cat: 'outer' },
  { id: 'g6', name: 'Striped oxford', sub: 'Tops · Cotton',     hue: 200, cat: 'tops' },
  { id: 'g7', name: 'Black denim',    sub: 'Bottoms · Denim',   hue: 220, cat: 'bottoms' },
  { id: 'g8', name: 'Cashmere knit',  sub: 'Tops · Cashmere',   hue: 18,  cat: 'tops' },
  { id: 'g9', name: 'Suede boot',     sub: 'Shoes · Suede',     hue: 18,  cat: 'shoes' },
];

const RECENT_FIXTURE = ['linen trouser', 'beige knit', 'sneakers', 'wool overshirt'];

export function SearchScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<FilterCat>('all');
  const [recent, setRecent] = React.useState<string[]>(RECENT_FIXTURE);

  const trimmed = query.trim();
  const showResults = trimmed.length >= 1;

  const results = React.useMemo(() => {
    if (!showResults) return [];
    const q = trimmed.toLowerCase();
    return ALL_GARMENTS.filter((g) => {
      if (filter !== 'all' && g.cat !== filter) return false;
      return g.name.toLowerCase().includes(q) || g.sub.toLowerCase().includes(q);
    });
  }, [trimmed, filter, showResults]);

  const submitQuery = (q: string) => {
    const next = q.trim();
    if (!next) return;
    setRecent((prev) => [next, ...prev.filter((p) => p !== next)].slice(0, 6));
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={() => nav.goBack()}
            hitSlop={8}
            style={{ padding: 6 }}>
            <BackIcon color={t.fg} />
          </Pressable>
          <View style={[s.searchPill, { backgroundColor: t.bg2, borderColor: t.border }]}>
            <SearchIcon color={t.fg2} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => submitQuery(query)}
              placeholder="Search wardrobe…"
              placeholderTextColor={t.fg3}
              returnKeyType="search"
              style={{
                flex: 1,
                color: t.fg,
                fontFamily: fonts.uiMed,
                fontSize: 13,
                padding: 0,
              }}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                onPress={() => setQuery('')}
                hitSlop={8}>
                <CloseIcon size={14} color={t.fg2} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
          {CAT_LABELS.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              active={filter === c.id}
              onPress={() => setFilter(c.id)}
            />
          ))}
        </ScrollView>

        {!showResults && recent.length > 0 ? (
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 18 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View>
              <View style={s.sectionHead}>
                <Eyebrow>Recent</Eyebrow>
                <Pressable
                  accessibilityLabel="Clear recent searches"
                  accessibilityRole="button"
                  onPress={() => setRecent([])}
                  hitSlop={6}>
                  <Text
                    style={{
                      fontFamily: fonts.uiMed,
                      fontSize: 11.5,
                      color: t.accent,
                      letterSpacing: -0.05,
                    }}>
                    Clear all
                  </Text>
                </Pressable>
              </View>
              <View style={[s.recentList, { backgroundColor: t.card, borderColor: t.border }]}>
                {recent.map((r, i) => (
                  <Pressable
                    key={r}
                    accessibilityRole="button"
                    accessibilityLabel={`Search for ${r}`}
                    onPress={() => setQuery(r)}
                    style={({ pressed }) => [
                      s.recentRow,
                      {
                        borderBottomColor: t.border,
                        borderBottomWidth: i === recent.length - 1 ? 0 : 1,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}>
                    <SearchIcon size={14} color={t.fg3} />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: fonts.uiMed,
                        fontSize: 13,
                        color: t.fg,
                      }}>
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        ) : null}

        {showResults ? (
          <FlatList
            data={results}
            keyExtractor={(g) => g.id ?? g.name}
            numColumns={3}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
                <Eyebrow>
                  {results.length === 0
                    ? 'No matches'
                    : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
                </Eyebrow>
              </View>
            }
            columnWrapperStyle={{ gap: 8, paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text
                  style={{
                    fontFamily: fonts.displayMedium,
                    fontStyle: 'italic',
                    fontSize: 24,
                    fontWeight: '500',
                    color: t.fg,
                    letterSpacing: -0.24,
                    textAlign: 'center',
                  }}>
                  Nothing found
                </Text>
                <Caption style={{ marginTop: 6, textAlign: 'center' }}>
                  Try a different search term.
                </Caption>
              </View>
            }
            renderItem={({ item }) => (
              <View style={{ flex: 1 / 3 }}>
                <GarmentCard
                  garment={item}
                  onPress={() => {
                    submitQuery(query);
                    nav.navigate('GarmentDetail', { id: item.id });
                  }}
                />
              </View>
            )}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchPill: {
    flex: 1,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentList: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  empty: {
    paddingTop: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
});
