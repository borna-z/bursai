// Outfits — saved looks list. Sourced from design_handoff_burs_rn/source/extra-screens.jsx OutfitsScreen
// + handoff README §"Outfits". Top: header (eyebrow / italic title) plus filter chips and a grid/list
// toggle. Below: 2-col grid of outfit cards (gradient placeholder + name + meta chips + wear count).
// Empty state mirrors handoff "no outfits yet" — italic title + caption + Style me CTA.
//
// FlatList over ScrollView+map: outfit lists can grow into the dozens; numColumns=2 keeps perf flat
// once a backend hook lands. The fixed fixture below visually rhymes with the handoff prototype.

import React from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { OutfitGridSkeleton } from '../components/skeletons';
import { ErrorState } from '../components/ErrorState';
import { BackIcon, GridIcon, ListIcon } from '../components/icons';
import { useOutfits } from '../hooks/useOutfits';
import { useGarmentImage } from '../hooks/useSignedUrl';
import { useFirstRunCoach, COACH_TOUR_TOTAL } from '../hooks/useFirstRunCoach';
import { CoachOverlay } from '../components/CoachOverlay';
import { t as tr } from '../lib/i18n';
import { localISODate, outfitDisplayName, outfitGradientHue } from '../lib/outfitDisplay';
import type { OutfitItemWithGarment, OutfitWithItems } from '../types/outfit';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// `with_notes` removed from the chip set: it was reading `outfits.feedback`
// (an AI-generated insights array, not user notes), so the filter never
// matched what the chip label promised. The user-notes surface lives in
// `outfit_feedback.commentary` — wiring that up is a future-wave task.
// Audit M on PR #718.
type FilterKey = 'all' | 'recent';
type ViewMode = 'grid' | 'list';

// "Recent" cutoff: outfits worn in the last 14 calendar days. Tunable.
const RECENT_DAYS = 14;

// Build the "14 calendar days ago" reference iso. Calendar arithmetic via
// `setDate(getDate() - N)` rather than ms-subtraction so DST transitions
// don't shift the cutoff by an hour and silently drop / include rows
// across the spring-forward / fall-back days. Codex P2 on PR #738.
function recentCutoffIso(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return localISODate(d);
}

function wornDateIso(o: OutfitWithItems): string | null {
  if (!o.worn_at) return null;
  const d = new Date(o.worn_at);
  if (Number.isNaN(d.getTime())) return null;
  return localISODate(d);
}

export function OutfitsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [filter, setFilter] = React.useState<FilterKey>('all');
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  // M27 — first-run coach overlay step 4 (Outfits grid header). Final
  // step in the sequence; advance() persists `coach_tour_completed_at`
  // and the overlay never surfaces again. Targeting the header keeps
  // the empty-state and loaded-state visually anchored to the same
  // region so the cutout stays recognizable across both.
  const coach = useFirstRunCoach();
  const headerRef = React.useRef<View | null>(null);
  const showOutfitsCoach = coach.shouldShow && coach.currentStep === 3;

  const outfitsQ = useOutfits(true);
  // Memoise the fallback so the `outfits` reference is stable across renders
  // when the query has no data yet — avoids re-running the `visible` useMemo
  // on every render (react-hooks/exhaustive-deps would otherwise warn that the
  // `?? []` literal is a fresh reference each render).
  const outfits = React.useMemo<OutfitWithItems[]>(() => outfitsQ.data ?? [], [outfitsQ.data]);
  const loading = outfitsQ.isLoading;
  const refreshing = outfitsQ.isRefetching;
  const error = outfitsQ.isError;
  const onRefresh = React.useCallback(() => {
    void outfitsQ.refetch();
  }, [outfitsQ]);
  const retry = onRefresh;

  // Apply the active filter chip on the live outfit list.
  const visible = React.useMemo<OutfitWithItems[]>(() => {
    if (filter === 'recent') {
      const cutoffIso = recentCutoffIso(new Date(), RECENT_DAYS);
      return outfits.filter((o) => {
        const wornIso = wornDateIso(o);
        return wornIso != null && wornIso >= cutoffIso;
      });
    }
    return outfits;
  }, [filter, outfits]);

  const header = (
    <View ref={headerRef} collapsable={false} style={{ paddingHorizontal: 20, paddingBottom: 14, gap: 14 }}>
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
      </View>
    </View>
  );

  const renderCard = ({ item }: { item: OutfitWithItems }) => (
    <OutfitListCard
      outfit={item}
      onPress={() => nav.navigate('OutfitDetail', { id: item.id })}
    />
  );

  // M27 — single overlay element shared across every return path so
  // the coachmark surfaces regardless of which Outfits state lands.
  const coachOverlay = (
    <CoachOverlay
      visible={showOutfitsCoach}
      targetRef={headerRef}
      caption={tr('coachTour.step.outfits')}
      ctaLabel={tr('coachTour.done')}
      onNext={coach.advance}
      onSkip={coach.skip}
      step={4}
      total={COACH_TOUR_TOTAL}
    />
  );

  if (error) {
    return (
      <>
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 130 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
            }>
            {header}
            <ErrorState onRetry={retry} />
          </ScrollView>
        </SafeAreaView>
        {coachOverlay}
      </>
    );
  }

  if (loading) {
    return (
      <>
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 130 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
            }
            showsVerticalScrollIndicator={false}>
            {header}
            <OutfitGridSkeleton />
          </ScrollView>
        </SafeAreaView>
        {coachOverlay}
      </>
    );
  }

  if (visible.length === 0) {
    // Empty branch — wraps in fragment so the coach overlay still
    // surfaces on a brand-new account that lands on Outfits with no
    // saved looks yet.
    // Filter-aware empty state. The "No outfits yet" / "Style me" copy is reserved for the
    // genuine zero-data case (filter==='all'); filter-specific misses get their own quiet
    // copy + a "Show all" reset CTA so the user understands the filter is the cause.
    const isFiltered = filter !== 'all';
    const title = !isFiltered ? 'No outfits yet' : 'Nothing worn lately';
    const body = !isFiltered
      ? 'Generate your first look from your wardrobe.'
      : `Nothing logged in the last ${RECENT_DAYS} days. Try wearing one of your saved looks.`;
    return (
      <>
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
            {title}
          </Text>
          <Caption style={{ textAlign: 'center', marginTop: 6, marginBottom: 18, maxWidth: 260 }}>
            {body}
          </Caption>
          {isFiltered ? (
            <Button label="Show all" variant="outline" onPress={() => setFilter('all')} />
          ) : (
            <Button label="Style me" onPress={() => nav.navigate('StyleMe')} />
          )}
        </View>
      </SafeAreaView>
      {coachOverlay}
      </>
    );
  }

  return (
    <>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
        }
        renderItem={renderCard}
      />
    </SafeAreaView>
    {coachOverlay}
    </>
  );
}

function OutfitListCard({ outfit, onPress }: { outfit: OutfitWithItems; onPress: () => void }) {
  const t = useTokens();
  const items = (outfit.outfit_items ?? []).slice(0, 4);
  const fillerCount = Math.max(0, 4 - items.length);
  const fallbackHue = outfitGradientHue(outfit.id);
  // Schema has no per-outfit wear-count column. The closest signal we have is
  // `worn_at` (last wear timestamp). Showing "1 wear" after 50 actual wears is
  // misleading, so collapse to a binary "Worn"/"Never worn" until wear_logs
  // aggregation lands. Audit G on PR #718.
  const everWorn = Boolean(outfit.worn_at);
  const occasion = outfit.occasion?.trim() ?? '';
  const vibe = outfit.style_vibe?.trim() ?? '';
  const name = outfitDisplayName(outfit);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}${occasion ? `, ${occasion}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          transform: pressed ? [{ scale: 0.97 }] : [],
        },
      ]}>
      <View style={s.cardThumbWrap}>
        {items.map((item) => (
          <CardThumb key={item.id} item={item} fallbackHue={fallbackHue} />
        ))}
        {Array.from({ length: fillerCount }).map((_, i) => (
          <CardThumb key={`filler-${i}`} item={null} fallbackHue={fallbackHue} />
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
          {name}
        </Text>
        {(occasion || vibe) ? (
          <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {occasion ? (
              <View style={[s.metaChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
                <Text style={[s.metaChipText, { color: t.fg2 }]}>{occasion}</Text>
              </View>
            ) : null}
            {vibe ? (
              <View style={[s.metaChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
                <Text style={[s.metaChipText, { color: t.fg2 }]}>{vibe}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 10,
            color: t.fg3,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
          }}>
          {everWorn ? 'Worn' : 'Never worn'}
        </Text>
      </View>
    </Pressable>
  );
}

function CardThumb({
  item,
  fallbackHue,
}: {
  item: OutfitItemWithGarment | null;
  fallbackHue: number;
}) {
  const garment = item?.garment ?? null;
  const imagePath = garment?.rendered_image_path ?? garment?.original_image_path ?? null;
  const { uri: imageUri, onError: onImageError } = useGarmentImage(imagePath);
  const showImage = imageUri != null;
  const hue = garment?.id ? outfitGradientHue(garment.id) : fallbackHue;

  return (
    <View style={[s.cardThumbCell, { overflow: 'hidden' }]}>
      <LinearGradient
        colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {showImage ? (
        <Image
          source={{ uri: imageUri }}
          onError={onImageError}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : null}
    </View>
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
