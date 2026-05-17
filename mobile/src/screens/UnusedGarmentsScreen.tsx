// UnusedGarmentsScreen — bucket-detail view for the M22 Wardrobe Aging
// panel. Reachable from InsightsScreen.WardrobeAgingPanel: tapping a
// row pushes here with `{ bucketId }`. The screen reads the cached
// useWardrobeAging() result for the matching bucket's garmentIds, then
// hydrates the rows into full Garment records via a one-shot
// `garments.in(id, [...])` select. Cards behave like Wardrobe — tap →
// GarmentDetail.
//
// Why a dedicated screen and not a UnusedOutfitsScreen overload:
// UnusedOutfits filters smartFilter='rarely_worn' over the user's
// entire wardrobe with chip filters and a sticky CTA. The aging
// buckets are AI-curated subsets (aged / retire) plus a
// derived-locally subset (unworn) — not a wardrobe slice, not a
// pivot to "outfits". Different pattern, different screen.

import React from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { IconBtn } from '../components/IconBtn';
import { GarmentCard } from '../components/GarmentCard';
import { GarmentGridSkeleton } from '../components/skeletons';
import { ErrorState } from '../components/ErrorState';
import { BackIcon } from '../components/icons';
import { CACHE_KEYS } from '../hooks/cacheKeys';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { t as tr } from '../lib/i18n';
import {
  useWardrobeAging,
  WardrobeAgingSubscriptionError,
  type WardrobeAgingBucketId,
} from '../hooks/useWardrobeAging';
import type { Garment } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'UnusedGarments'>;

function bucketTitleKey(id: WardrobeAgingBucketId): string {
  if (id === 'aged') return 'unusedGarments.title.aged';
  if (id === 'unworn') return 'unusedGarments.title.unworn';
  return 'unusedGarments.title.retire';
}

function isValidBucketId(value: unknown): value is WardrobeAgingBucketId {
  return value === 'aged' || value === 'unworn' || value === 'retire_candidates';
}

export function UnusedGarmentsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Defensive: a malformed deep-link or a stale route param (an enum
  // change in a later wave) shouldn't crash the screen. Default to
  // 'aged' so the user still lands somewhere sensible — we'll show its
  // empty state if no ids exist.
  const bucketId: WardrobeAgingBucketId = isValidBucketId(route.params?.bucketId)
    ? route.params.bucketId
    : 'aged';

  const aging = useWardrobeAging();

  // Subscription gate — direct deep link into this screen (e.g. from a
  // future notification or saved route) must paywall the same way the
  // InsightsScreen entry point does. Sticky-ref + focus-effect reset
  // pattern mirrors InsightsScreen so the gate looks identical wherever
  // a paid surface is reached.
  const subscriptionLocked = aging.error instanceof WardrobeAgingSubscriptionError;
  const paywallShownRef = React.useRef(false);
  React.useEffect(() => {
    if (subscriptionLocked && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
    }
  }, [subscriptionLocked, nav]);
  // Reset the sticky ref on focus so a returning user (back from paywall
  // without subscribing → re-enters this screen later) gets the same
  // gate again on the next subscription error.
  useFocusEffect(
    React.useCallback(() => {
      if (!subscriptionLocked) {
        paywallShownRef.current = false;
      }
    }, [subscriptionLocked]),
  );

  const bucket = aging.data?.buckets.find((b) => b.id === bucketId) ?? null;
  const ids = bucket?.garmentIds ?? [];

  // One-shot id-list hydrate — `garments.in('id', ids)` returns only
  // the rows the user owns (RLS) and that still exist (so deletes
  // since the prediction was cached are silently dropped). Sort the
  // result back into the AI's order so the most-urgent prediction
  // stays at the top of the list. `enabled` gates on user + ids.
  const hydrate = useQuery<Garment[], Error>({
    queryKey: CACHE_KEYS.wardrobeAgingGarments(user?.id, bucketId, ids.join(',')),
    queryFn: async () => {
      if (!user || ids.length === 0) return [];
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .eq('user_id', user.id)
        .in('id', ids);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Garment[];
      const order = new Map(ids.map((id, idx) => [id, idx]));
      return [...rows].sort(
        (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
    },
    enabled: !!user && ids.length > 0,
    staleTime: 60 * 1000,
  });

  const items = hydrate.data ?? [];

  const onRefresh = React.useCallback(() => {
    void aging.refetch();
    void hydrate.refetch();
  }, [aging, hydrate]);

  // M42 — id-keyed handler so the cell row's `onPress` reference stays
  // stable across parent re-renders (refetches, focus events).
  const handleGarmentPress = React.useCallback(
    (id: string) => {
      nav.navigate('GarmentDetail', { id });
    },
    [nav],
  );

  const header = (
    <View>
      <View style={s.headerRow}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>{tr('wardrobeAging.eyebrow')}</Eyebrow>
          <PageTitle>{tr(bucketTitleKey(bucketId))}</PageTitle>
        </View>
      </View>
      {bucket?.rationale ? (
        <Caption
          numberOfLines={3}
          style={{ paddingHorizontal: 20, paddingTop: 4, lineHeight: 18 }}>
          {bucket.rationale}
        </Caption>
      ) : null}
    </View>
  );

  // Subscription-locked → the effect above is opening the paywall. Render
  // a quiet shell (header only, no ErrorState surface) so the screen
  // doesn't flash a generic error before the paywall slides up.
  if (subscriptionLocked) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
      </SafeAreaView>
    );
  }

  // Aging hook errored OR hydrate errored → unified error surface with
  // a retry that re-runs both queries. Subscription errors are handled
  // above. The aging error is more useful to surface than the hydrate
  // one (the latter is a simple PostgREST call), so we prefer it.
  const composedError = aging.error ?? hydrate.error ?? null;
  if (composedError) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <ErrorState onRetry={() => onRefresh()} />
      </SafeAreaView>
    );
  }

  if (aging.isLoading || hydrate.isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={aging.isRefetching || hydrate.isRefetching}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
            />
          }>
          {header}
          <GarmentGridSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={s.emptyWrap}>
          <PageTitle size={22}>{tr('unusedGarments.empty')}</PageTitle>
          <Caption style={{ marginTop: 6, textAlign: 'center', maxWidth: 240 }}>
            {tr('wardrobeAging.empty.body')}
          </Caption>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={header}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: 20 }}
        contentContainerStyle={{
          paddingTop: 4,
          paddingBottom: insets.bottom + 24,
          gap: 8,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={aging.isRefetching || hydrate.isRefetching}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent]}
          />
        }
        renderItem={({ item }) => (
          <UnusedGarmentCell item={item} onPress={handleGarmentPress} />
        )}
        // M42 — virtualization tuning. See WardrobeScreen.
        removeClippedSubviews
        windowSize={5}
        initialNumToRender={12}
      />
    </SafeAreaView>
  );
}

// M42 — memoised cell. Mirrors WardrobeScreen's WardrobeGarmentCell.
const UnusedGarmentCell = React.memo(function UnusedGarmentCell({
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
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
});
