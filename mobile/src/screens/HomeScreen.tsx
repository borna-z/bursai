// Home (Today) — hub screen, mirrors design_handoff_burs_rn/source/screens.jsx HomeScreen exactly.
// Sections: greeting header · Today's look hero card · Your Stylist hub grid · Discover hub grid ·
// This week mini-strip · Ask the stylist row · Your rhythm stat blocks · BottomNav.
// Source of truth for visual values: styles.css (`.card-hero`, `.hub-tile`, `.mini-day`, `.stat-block`).
//
// N13 split — sub-components live in sibling files (HomeScreen.hero.tsx,
// HomeScreen.recent.tsx, HomeScreen.hubs.tsx, HomeScreen.miniWeek.tsx,
// HomeScreen.rhythm.tsx) and pure helpers in HomeScreen.helpers.ts. This
// file is the orchestrator: query/state derivation + layout.

import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { IconBtn } from '../components/IconBtn';
import { SmartDayBanner } from '../components/SmartDayBanner';
import { WeatherStrip } from '../components/WeatherStrip';
import { OccasionPicker, eventsForOccasion, type OccasionId } from '../components/OccasionPicker';
import { BellIcon } from '../components/icons';
import { useAuth } from '../contexts/AuthContext';
import { useFlatGarments } from '../hooks/useGarments';
import { useGarmentCount } from '../hooks/useGarmentCount';
import { useNow } from '../hooks/useNow';
import { useTodayPlannedOutfit, usePlannedOutfitsForWeek } from '../hooks/usePlannedOutfits';
import { useMarkOutfitWorn, useOutfits } from '../hooks/useOutfits';
import { usePrefetchSuggestions } from '../hooks/usePrefetchSuggestions';
import { useWeather } from '../hooks/useWeather';
import { useCalendarEvents } from '../hooks/useCalendarSync';
import type { DayEventInput } from '../lib/dayIntelligence';
import { useFirstRunCoach, COACH_TOUR_TOTAL } from '../hooks/useFirstRunCoach';
import { CoachOverlay } from '../components/CoachOverlay';
import { t as tr } from '../lib/i18n';
import { useStylistPromptKey } from '../lib/stylistPrompts';
import { showToast } from '../lib/toast';
import { localISODate } from '../lib/outfitDisplay';
import type { RootStackParamList, TabName } from '../navigation/RootNavigator';

import { buildMiniWeek, formatHeaderDate, greetingFor } from './HomeScreen.helpers';
import { TodaysLookHero } from './HomeScreen.hero';
import { RecentOutfitsRow } from './HomeScreen.recent';
import { StylistHubsSection, DiscoverHubsSection, AskStylistRow } from './HomeScreen.hubs';
import { ThisWeekSection } from './HomeScreen.miniWeek';
import { RhythmSection } from './HomeScreen.rhythm';

type HomeNav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen({
  goTab,
  isActive = true,
}: {
  goTab: (id: TabName) => void;
  /** True when this screen is the active MainTabs tab. M27 R1 gate — the
   * coach overlay only renders when the tab is visible so a hidden
   * (display:'none') sibling can't measure 0×0 and surface the cutout
   * over the wrong screen. Defaults to true so callers that aren't aware
   * of the tab system (tests, future direct-route mounts) keep the prior
   * always-on behavior. */
  isActive?: boolean;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<HomeNav>();
  const push = (route: keyof RootStackParamList) => () => nav.navigate(route as never);

  // Home → "Ask the stylist" rotation. Picks a fresh prompt key per
  // HomeScreen mount; the chosen text is what users see on the card AND
  // what the chat composer is seeded with when they tap. Keeping the
  // pick stable per mount (useMemo inside the hook) prevents the chip
  // copy from shuffling while the user is looking at it.
  const askStylistPromptKey = useStylistPromptKey();
  const askStylistPromptText = tr(askStylistPromptKey);
  const handleAskStylistPress = useCallback(
    () => nav.navigate('StyleChat', { initialDraft: askStylistPromptText }),
    [nav, askStylistPromptText],
  );

  const { profile } = useAuth();
  const firstName = (profile?.display_name ?? '').trim().split(/\s+/)[0] ?? '';

  // T-A — fire-and-forget prefetch of the daily outfit suggestion cache on
  // Home mount so the Generate path returns a warm result instead of
  // blocking on a cold Gemini call. The hook swallows every error and
  // never updates UI state, so the React tree is unaffected by a failed
  // prefetch. AppState foreground-resume wiring is deferred.
  const { prefetch: prefetchSuggestions } = usePrefetchSuggestions();
  React.useEffect(() => {
    void prefetchSuggestions();
    // Run once on mount — the hook is idempotent server-side (cache key
    // dedupes) and adding `prefetchSuggestions` to deps would re-fire
    // every time auth state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive `now` — RN tabs stay mounted across day boundaries so a static
  // `useMemo([])` would freeze the date and `wornToday` would compare today's
  // outfit against yesterday. useNow ticks on AppState 'active' and at the
  // next midnight. Codex P2 on PR #738.
  const now = useNow();
  const headerDate = formatHeaderDate(now);
  const greeting = greetingFor(now);

  // Real today's plan + 7-day window for the MiniWeek dots. Loading is true until the
  // plan query settles so the user sees a skeleton hero card instead of an empty state
  // flashing into a populated state.
  const todayPlanQ = useTodayPlannedOutfit();
  const weekPlansQ = usePlannedOutfitsForWeek();
  const garmentsQ = useFlatGarments();
  // Server-side count — authoritative regardless of pagination state, so
  // "Pieces in wardrobe" doesn't undercount once a user crosses the 30-row
  // PAGE_SIZE. Codex P2 on PR #738.
  const garmentCountQ = useGarmentCount();
  const todayPlan = todayPlanQ.data ?? null;
  const todayOutfit = todayPlan?.outfit ?? null;

  const plannedDatesSet = React.useMemo(
    () => new Set((weekPlansQ.data ?? []).map((p) => p.date)),
    [weekPlansQ.data],
  );
  const week = React.useMemo(() => buildMiniWeek(now, plannedDatesSet), [now, plannedDatesSet]);

  const markWorn = useMarkOutfitWorn();

  // M35 — weather + occasion state. Both feed `SmartDayBanner` via its M35
  // `overrides` prop so the day-intelligence engine sees real data instead
  // of the FALLBACK_WEATHER placeholder.
  const { weather } = useWeather();
  const smartDayWeather = React.useMemo(
    () =>
      weather
        ? {
            temperature: weather.temperature,
            precipitation: weather.precipitation,
            wind: weather.wind,
          }
        : null,
    [weather],
  );
  const [occasion, setOccasion] = React.useState<OccasionId>('casual');
  const occasionEvents = React.useMemo(() => eventsForOccasion(occasion), [occasion]);

  // M36 — pull today's calendar events directly so we can merge them with
  // the manual occasion pick before forwarding to the day-intelligence
  // engine + Gemini summary. Both `useSmartDayRecommendation` AND
  // `useDaySummary` (called inside SmartDayBanner) read `overrides.events`,
  // so merging here guarantees the AI summary sees the user's actual day
  // (calendar) PLUS their stated intent (occasion picker), not one or the
  // other.
  const todayDateISO = React.useMemo(() => localISODate(now), [now]);
  const calendarEventsQ = useCalendarEvents(todayDateISO);
  const smartDayEvents = React.useMemo<DayEventInput[]>(() => {
    const calendar = (calendarEventsQ.data ?? []).map((e) => ({
      title: e.title,
      location: e.location,
      start_time: e.start_time,
      end_time: e.end_time,
    }));
    return occasionEvents.length > 0
      ? [...calendar, ...occasionEvents]
      : calendar;
  }, [calendarEventsQ.data, occasionEvents]);

  // M35 — Recent outfits row. Pulls saved outfits ordered by `created_at`
  // desc and renders the most recent 8 in a horizontal scroll. Distinct
  // surface from the today's-look hero (which is a *planned* outfit for
  // today).
  const recentOutfitsQ = useOutfits(true);
  const recentOutfits = React.useMemo(
    () => (recentOutfitsQ.data ?? []).slice(0, 8),
    [recentOutfitsQ.data],
  );

  // Mirror OutfitDetail's logic: "worn today" is true iff outfit.worn_at is a
  // valid timestamp that falls on today (local date). The previous proxy of
  // `todayPlan.status === 'worn'` never flipped because the mark-worn mutation
  // doesn't touch planned_outfits.status. Audit J on PR #718.
  const wornToday = React.useMemo(() => {
    if (!todayOutfit?.worn_at) return false;
    const wornDate = new Date(todayOutfit.worn_at);
    if (Number.isNaN(wornDate.getTime())) return false;
    return localISODate(wornDate) === localISODate(now);
  }, [todayOutfit?.worn_at, now]);

  // Total pieces — server-side count is the only authoritative source
  // (paginated `garmentsQ.data?.length` would silently undercount once the
  // user crosses the 30-row PAGE_SIZE). When the count query errors or
  // hasn't settled yet, render `'—'` instead of a wrong number.
  const garmentCountReady = garmentCountQ.isSuccess;
  const garmentTotal = garmentCountReady
    ? String(garmentCountQ.data ?? 0)
    : '—';

  // Wardrobe-used % derives from the *full* garment set (the 30-day cutoff
  // rides on `last_worn_at`). useFlatGarments paginates at PAGE_SIZE=30 so a
  // wardrobe of 200 garments on a partial-load would compute against just the
  // first page — the % would silently undercount. We auto-paginate when the
  // user lands on Home so the stat is correct, AND only render the % once all
  // pages are in.
  const {
    hasNextPage: garmentsHasNextPage,
    isFetchingNextPage: garmentsFetchingNext,
    isLoading: garmentsLoading,
    fetchNextPage: garmentsFetchNextPage,
  } = garmentsQ;
  React.useEffect(() => {
    if (garmentsHasNextPage && !garmentsFetchingNext && !garmentsLoading) {
      void garmentsFetchNextPage();
    }
  }, [garmentsHasNextPage, garmentsFetchingNext, garmentsLoading, garmentsFetchNextPage]);
  const wardrobeStatsAuthoritative = !garmentsHasNextPage;
  const wardrobeUsedPct = React.useMemo(() => {
    if (!garmentsQ.data || garmentsQ.data.length === 0) return 0;
    const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let worn = 0;
    for (const g of garmentsQ.data) {
      const ts = g.last_worn_at ? new Date(g.last_worn_at).getTime() : NaN;
      if (Number.isFinite(ts) && ts >= cutoffMs) worn += 1;
    }
    return Math.round((worn / garmentsQ.data.length) * 100);
  }, [garmentsQ.data]);

  // Per-section loading flags so a fast hero can populate while the slowest
  // query finishes — the previous OR-of-three made the screen wait for the
  // slowest of {today plan, week plans, garments} before anything appeared.
  // Audit H on PR #718.
  const heroLoading = todayPlanQ.isLoading;
  const statsLoading = garmentsQ.isLoading;

  // Pull-to-refresh uses a single state flag driven by Promise.all so the
  // spinner stays up until ALL refetches settle. The previous OR-of-three
  // refetching flags would clear the spinner the moment the first query
  // resolved, even with two more in flight. Audit I on PR #718.
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    void Promise.all([
      todayPlanQ.refetch(),
      weekPlansQ.refetch(),
      garmentsQ.refetch(),
    ]).finally(() => setRefreshing(false));
  }, [todayPlanQ, weekPlansQ, garmentsQ]);

  const handleWearToday = React.useCallback(() => {
    if (!todayOutfit) return;
    const garmentIds = (todayOutfit.outfit_items ?? [])
      .map((item) => item.garment?.id)
      .filter((id): id is string => Boolean(id));
    markWorn.mutate(
      { outfitId: todayOutfit.id, garmentIds },
      {
        // Skip the success toast when the mutation deduped (already worn
        // today / synchronous in-flight). The first real write's alert
        // already covered the user; a second toast for a no-op write is
        // confusing. Codex P2 round 10 on PR #738.
        onSuccess: (data) => {
          if (data?.deduped) return;
          showToast(
            'success',
            tr('home.alert.markedWorn.title'),
            tr('home.alert.markedWorn.body'),
          );
        },
        onError: (err: unknown) =>
          showToast(
            'error',
            tr('home.alert.markWornError.title'),
            err instanceof Error ? err.message : tr('home.alert.markWornError.fallback'),
          ),
      },
    );
  }, [todayOutfit, markWorn]);

  const goOutfitDetail = React.useCallback(() => {
    if (todayOutfit) nav.navigate('OutfitDetail', { id: todayOutfit.id });
    else nav.navigate('OutfitGenerate');
  }, [nav, todayOutfit]);

  // M27 — first-run coach overlay step 1 (Today's Look hero). The ref
  // wraps the hero Card so CoachOverlay can `measureInWindow` to draw
  // the cutout. The overlay only renders when the hook reports
  // `shouldShow && currentStep === 0` so re-mounts of this tab don't
  // re-fire the coachmark on a user who's already past Home.
  const coach = useFirstRunCoach();
  const heroRef = React.useRef<View | null>(null);
  // M27 R1 — also gate on `isActive` so a hidden (display:'none') Home
  // tab sibling can't surface a stale cutout while the user is on
  // another tab.
  const showHeroCoach = isActive && coach.shouldShow && coach.currentStep === 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 130,
          gap: 18,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent]}
          />
        }
        showsVerticalScrollIndicator={false}>

        {/* ============ HEADER ============ */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{headerDate}</Eyebrow>
            <PageTitle>{greeting}{firstName ? `, ${firstName}` : ''}</PageTitle>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 2 }}>
            <IconBtn
              ariaLabel={tr('home.notifications.aria')}
              onPress={push('Notifications')}>
              <BellIcon size={18} color={t.fg} />
            </IconBtn>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr('home.profile.aria')}
              onPress={push('Profile')}
              style={s.avatarWrap}>
              <View style={[s.avatar, { backgroundColor: t.accent }]}>
                <Text style={{ color: t.accentFg, fontWeight: '600', fontSize: 13 }}>
                  {(profile?.display_name?.trim().charAt(0) || 'B').toUpperCase()}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ============ WEATHER STRIP (M35) ============ */}
        <WeatherStrip />

        {/* ============ SMART DAY BANNER (M15 + M35) ============ */}
        <SmartDayBanner
          overrides={{
            weather: smartDayWeather,
            events: smartDayEvents,
          }}
        />

        {/* ============ OCCASION PICKER (M35) ============ */}
        {!todayOutfit ? (
          <View>
            <View style={{ marginBottom: 10 }}>
              <Eyebrow>{tr('home.occasion.eyebrow')}</Eyebrow>
            </View>
            <OccasionPicker selected={occasion} onSelect={setOccasion} />
          </View>
        ) : null}

        {/* ============ TODAY'S LOOK HERO ============ */}
        <TodaysLookHero
          heroRef={heroRef}
          heroLoading={heroLoading}
          todayOutfit={todayOutfit}
          wornToday={wornToday}
          markWornPending={markWorn.isPending}
          onWearToday={handleWearToday}
          onRestyle={push('OutfitGenerate')}
          onView={goOutfitDetail}
          onEmptyCta={push('OutfitGenerate')}
        />

        {/* ============ RECENT OUTFITS ROW (M35) ============ */}
        <RecentOutfitsRow
          outfits={recentOutfits}
          onSeeAll={push('Outfits')}
          onPressOutfit={(id) => nav.navigate('OutfitDetail', { id })}
        />

        {/* ============ YOUR STYLIST GRID ============ */}
        <StylistHubsSection goRoute={push} />

        {/* ============ DISCOVER GRID ============ */}
        <DiscoverHubsSection goRoute={push} />

        {/* ============ THIS WEEK MINI-STRIP ============ */}
        <ThisWeekSection
          days={week}
          canWearToday={!!todayOutfit && !wornToday}
          wearTodayPending={markWorn.isPending}
          onPlanTap={() => goTab('plan')}
          onWearToday={handleWearToday}
          onRestyle={push('StyleMe')}
          onAdd={push('AddPieceStep1')}
        />

        {/* ============ ASK THE STYLIST ROW ============ */}
        <AskStylistRow
          promptKey={askStylistPromptKey}
          onPress={handleAskStylistPress}
        />

        {/* ============ YOUR RHYTHM ============ */}
        <RhythmSection
          loading={statsLoading}
          garmentTotal={garmentTotal}
          wardrobeStatsAuthoritative={wardrobeStatsAuthoritative}
          wardrobeUsedPct={wardrobeUsedPct}
          onSeeInsights={() => goTab('insights')}
        />
      </ScrollView>

      {/* M27 — first-run coach overlay step 1. Lives at the screen root
          (sibling to ScrollView) so the modal scrim covers the whole
          viewport, not just the scrollable area. */}
      <CoachOverlay
        visible={showHeroCoach}
        targetRef={heroRef}
        caption={tr('coachTour.step.home')}
        ctaLabel={tr('coachTour.next')}
        onNext={coach.advance}
        onSkip={coach.skip}
        step={1}
        total={COACH_TOUR_TOTAL}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  avatarWrap: { /* hit area */ },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
