// Search — full-screen modal-style search experience pushed from Wardrobe's pill.
// Auto-focused TextInput with back + clear at the top. Below: filter chips (category-scoped).
// When the query is empty: Recent searches block. With query (2+ chars): 3-col results grid
// using GarmentCard. Empty results: italic "Nothing found" + caption.
//
// W2 wires real Supabase data via useFlatGarments({search}) with a 300ms debounce.
// Recent searches persist across app launches in AsyncStorage.
//
// KeyboardAvoidingView wraps the body so results scroll above the keyboard on iOS.

import React from 'react';
import {
  ActivityIndicator,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { GarmentCard } from '../components/GarmentCard';
import { ErrorState } from '../components/ErrorState';
import { BackIcon, CloseIcon, SearchIcon } from '../components/icons';
import { useFlatGarments } from '../hooks/useGarments';
import { t as tr } from '../lib/i18n';
import type { Garment, GarmentFilters } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterCat = 'all' | 'tops' | 'bottoms' | 'shoes' | 'outer' | 'dress';
// Labels resolved through i18n at render time. The id stays a stable enum
// so the filter ⇄ category mapping below doesn't have to follow locale.
const CAT_LABEL_KEYS: { id: FilterCat; key: string }[] = [
  { id: 'all',     key: 'search.cat.all' },
  { id: 'tops',    key: 'search.cat.tops' },
  { id: 'bottoms', key: 'search.cat.bottoms' },
  { id: 'shoes',   key: 'search.cat.shoes' },
  { id: 'outer',   key: 'search.cat.outer' },
  { id: 'dress',   key: 'search.cat.dress' },
];

// Map our filter pill ids to the canonical category enums in `garments.category`.
// The column historically stores short-form values authored by AI enrichment
// ("Top", "Bottom", "Outer"). This map is the single source of truth for that
// translation in the search screen.
const FILTER_TO_CATEGORY: Record<Exclude<FilterCat, 'all'>, string> = {
  tops: 'Top',
  bottoms: 'Bottom',
  shoes: 'Shoes',
  outer: 'Outer',
  dress: 'Dress',
};

const RECENTS_KEY = 'burs:recent_searches';
const MAX_RECENTS = 5;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

async function loadRecents(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

async function saveRecents(values: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(values.slice(0, MAX_RECENTS)));
  } catch {
    // best-effort
  }
}

export function SearchScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [filter, setFilter] = React.useState<FilterCat>('all');
  const [recent, setRecent] = React.useState<string[]>([]);

  // Hydrate recents on mount.
  React.useEffect(() => {
    void loadRecents().then(setRecent);
  }, []);

  // 300ms debounce so we don't hammer Supabase on every keystroke. Clean
  // up on unmount — RN dev would otherwise log a setState-on-unmount warning
  // if the user taps a result and the screen pops mid-debounce.
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const trimmed = debouncedQuery;
  const showResults = trimmed.length >= MIN_QUERY_LEN;
  // The user has typed enough to search but the debounce hasn't elapsed yet,
  // OR the debounced value has elapsed but is still mid-flight. In both
  // states we hide the recent-searches block and show a spinner so the
  // "I'm waiting" feedback is instant rather than gated on the 300 ms timer
  // + RTT (audit UX#7).
  const trimmedTyped = query.trim();
  const isPendingSearch = trimmedTyped.length >= MIN_QUERY_LEN && trimmedTyped !== trimmed;

  const queryFilters: GarmentFilters | undefined = showResults
    ? {
        search: trimmed,
        ...(filter !== 'all' ? { category: FILTER_TO_CATEGORY[filter] } : {}),
      }
    : undefined;

  // Gate the hook with `showResults` so opening Search doesn't silently fire
  // an unfiltered "all garments" round-trip before the user types anything.
  // The auth-only guard inside useGarments still issued a request for the
  // first page on every mount. Codex P2 on PR #718.
  const {
    data: results,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFlatGarments(queryFilters, showResults);

  // Disable the query when no search is active so we don't fire an
  // unnecessary "all garments" request as soon as the screen mounts. The
  // hook does early-out on enabled=!!user, but we'd still pay one round-trip
  // before the user types anything.
  // `isPendingSearch` covers the debounce window before the request fires —
  // showing the spinner during that window means typing → spinner is
  // immediate (no 300ms feedback gap).
  const showLoading = isPendingSearch || (showResults && isLoading);
  const showError = showResults && isError;
  const visibleResults = showResults && !isPendingSearch ? results : [];

  const submitQuery = React.useCallback(
    (q: string) => {
      const next = q.trim();
      if (!next) return;
      const updated = [next, ...recent.filter((p) => p !== next)].slice(0, MAX_RECENTS);
      setRecent(updated);
      void saveRecents(updated);
    },
    [recent],
  );

  const clearRecents = () => {
    setRecent([]);
    void saveRecents([]);
  };

  // M42 — id-keyed press handler so the memoised cell row's `onPress`
  // reference stays stable across parent re-renders (debounce ticks,
  // refetch settles). Without this, every keystroke re-renders all
  // visible cells.
  const handleResultPress = React.useCallback(
    (id: string) => {
      submitQuery(query);
      nav.navigate('GarmentDetail', { id });
    },
    [submitQuery, query, nav],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <Pressable
            accessibilityLabel={tr('common.back')}
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
              placeholder={tr('search.placeholder')}
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
                accessibilityLabel={tr('search.clear')}
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
          {CAT_LABEL_KEYS.map((c) => (
            <Chip
              key={c.id}
              label={tr(c.key)}
              active={filter === c.id}
              onPress={() => setFilter(c.id)}
            />
          ))}
        </ScrollView>

        {!showResults && !isPendingSearch && recent.length > 0 ? (
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 18 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View>
              <View style={s.sectionHead}>
                <Eyebrow>{tr('search.recent.eyebrow')}</Eyebrow>
                <Pressable
                  accessibilityLabel={tr('search.recent.clearAria')}
                  accessibilityRole="button"
                  onPress={clearRecents}
                  hitSlop={6}>
                  <Text
                    style={{
                      fontFamily: fonts.uiMed,
                      fontSize: 11.5,
                      color: t.accent,
                      letterSpacing: -0.05,
                    }}>
                    {tr('search.recent.clear')}
                  </Text>
                </Pressable>
              </View>
              <View style={[s.recentList, { backgroundColor: t.card, borderColor: t.border }]}>
                {recent.map((r, i) => (
                  <Pressable
                    key={r}
                    accessibilityRole="button"
                    accessibilityLabel={tr('search.recent.itemAria', { query: r })}
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

        {!showResults && !isPendingSearch && recent.length === 0 ? (
          <View style={s.emptyHint}>
            <Caption style={{ textAlign: 'center', maxWidth: 240 }}>
              {tr('search.hint.minChars', { count: MIN_QUERY_LEN })}
            </Caption>
          </View>
        ) : null}

        {showLoading ? (
          <View style={s.loadingShell}>
            <ActivityIndicator size="small" color={t.accent} />
          </View>
        ) : null}

        {showError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : null}

        {showResults && !showLoading && !showError ? (
          <FlatList
            data={visibleResults}
            keyExtractor={(g) => g.id}
            numColumns={3}
            keyboardShouldPersistTaps="handled"
            // Drive pagination from the underlying infinite query — without
            // this, results > PAGE_SIZE (30) were silently truncated to page 1.
            // Codex P2 on PR #718.
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={t.accent} />
                </View>
              ) : null
            }
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
                <Eyebrow>
                  {visibleResults.length === 0
                    ? tr('search.results.noMatches')
                    : tr(
                        visibleResults.length === 1
                          ? 'search.results.countOne'
                          : 'search.results.countOther',
                        {
                          count: `${visibleResults.length}${hasNextPage ? '+' : ''}`,
                        },
                      )}
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
                  {tr('search.empty.title')}
                </Text>
                <Caption style={{ marginTop: 6, textAlign: 'center' }}>
                  {tr('search.empty.body')}
                </Caption>
              </View>
            }
            renderItem={({ item }) => (
              <SearchResultCell item={item} onPress={handleResultPress} />
            )}
            // M42 — virtualization tuning. See WardrobeScreen — same 3-col
            // grid, same heavy GarmentCard rows; trim the mounted window
            // from ~21 viewports to ~5.
            removeClippedSubviews
            windowSize={5}
            initialNumToRender={12}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// M42 — memoised cell. Mirrors WardrobeGarmentCell. The id-keyed
// `onPress` from the parent keeps the prop reference stable so the
// downstream `GarmentCard.memo` doesn't churn on every keystroke.
const SearchResultCell = React.memo(function SearchResultCell({
  item,
  onPress,
}: {
  item: Garment;
  onPress: (id: string) => void;
}) {
  const press = React.useCallback(() => onPress(item.id), [item.id, onPress]);
  return (
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
        onPress={press}
      />
    </View>
  );
});

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
  emptyHint: {
    paddingTop: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  loadingShell: {
    paddingTop: 40,
    alignItems: 'center',
  },
});
