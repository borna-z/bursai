// Home (Today) — hub screen, mirrors design_handoff_burs_rn/source/screens.jsx HomeScreen exactly.
// Sections: greeting header · Today's look hero card · Your Stylist hub grid · Discover hub grid ·
// This week mini-strip · Ask the stylist row · Your rhythm stat blocks · BottomNav.
// Source of truth for visual values: styles.css (`.card-hero`, `.hub-tile`, `.mini-day`, `.stat-block`).
//
// All time-dependent values (header eyebrow date, time-of-day greeting, MiniWeek 7-day window)
// derive from `new Date()` at render time so the UI stays accurate as days roll forward.
// Codex P2 #4 on PR #699 — the original prototype hardcoded "Sat · Apr 26 / SAT 26 → FRI 2".

import React from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { SmartDayBanner } from '../components/SmartDayBanner';
import { PlanCardSkeleton, StatRowSkeleton } from '../components/skeletons';
import {
  ChatIcon, OutfitsIcon, TshirtIcon, SmileIcon, SuitcaseIcon, GapsIcon, GearIcon,
  SunIcon, ChevronIcon, SparklesIcon,
} from '../components/icons';
import { useAuth } from '../contexts/AuthContext';
import { useFlatGarments } from '../hooks/useGarments';
import { useGarmentCount } from '../hooks/useGarmentCount';
import { useNow } from '../hooks/useNow';
import { useTodayPlannedOutfit, usePlannedOutfitsForWeek } from '../hooks/usePlannedOutfits';
import { useMarkOutfitWorn } from '../hooks/useOutfits';
import { useSignedUrl } from '../hooks/useSignedUrl';
import { localISODate, outfitDisplayName, outfitGradientHue } from '../lib/outfitDisplay';
import type { OutfitItemWithGarment, OutfitWithItems } from '../types/outfit';
import type { RootStackParamList, TabName } from '../navigation/RootNavigator';

type HomeNav = NativeStackNavigationProp<RootStackParamList>;

// "Sat · Apr 26" — short weekday + dot separator + short month + day-of-month.
function formatHeaderDate(d: Date): string {
  const dow = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  return `${dow} · ${mon} ${d.getDate()}`;
}

// Time-of-day greeting buckets: night (22:00–04:59) · morning (05:00–11:59) ·
// afternoon (12:00–16:59) · evening (17:00–21:59).
function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 5)  return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

type WeekDay = { dow: string; n: number; active: boolean; dot: boolean };

// 7-day rolling window starting from today. `plannedDates` is a Set of ISO yyyy-mm-dd strings
// pulled from the live `planned_outfits` query — empty set falls through to "no dot anywhere".
//
// Iteration uses `setDate(getDate() + i)` rather than fixed-ms arithmetic so a DST transition
// inside the window doesn't skip or duplicate a local calendar day. Codex P2 #5 on PR #699.
function buildMiniWeek(today: Date, plannedDates: Set<string>): WeekDay[] {
  const out: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      n: d.getDate(),
      active: i === 0,
      dot: plannedDates.has(localISODate(d)),
    });
  }
  return out;
}

export function HomeScreen({ goTab }: { goTab: (id: TabName) => void }) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<HomeNav>();
  const push = (route: keyof RootStackParamList) => () => nav.navigate(route as never);

  const { profile } = useAuth();
  const firstName = (profile?.display_name ?? '').trim().split(/\s+/)[0] ?? '';

  // Reactive `now` — RN tabs stay mounted across day boundaries so a static
  // `useMemo([])` would freeze the date and `wornToday` would compare today's
  // outfit against yesterday. useNow ticks on AppState 'active' and at the
  // next midnight. Codex P2 on PR #738.
  const now = useNow();
  const headerDate = formatHeaderDate(now);
  const greeting = greetingFor(now);

  // Real today's plan + 7-day window for the MiniWeek dots. Loading is true until the
  // plan query settles so the user sees a skeleton hero card instead of an empty state
  // flashing into a populated state. Codex re-runs of HomeScreen rely on this transition
  // staying smooth.
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
  // hasn't settled yet, render `'—'` instead of a wrong number — same gate
  // shape as `wardrobeStatsAuthoritative` below. Codex P2 on PR #738.
  const garmentCountReady = garmentCountQ.isSuccess;
  const garmentTotal = garmentCountReady
    ? String(garmentCountQ.data ?? 0)
    : '—';

  // Wardrobe-used % derives from the *full* garment set (the 30-day cutoff
  // rides on `last_worn_at`). useFlatGarments paginates at PAGE_SIZE=30 so a
  // wardrobe of 200 garments on a partial-load would compute against just the
  // first page — the % would silently undercount. We auto-paginate when the
  // user lands on Home so the stat is correct, AND only render the % once all
  // pages are in. Otherwise we render `—` (matches WardrobeScreen's
  // `countsAuthoritative` pattern). Codex P2 on PR #738.
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
        // Skip the success alert when the mutation deduped (already worn
        // today / synchronous in-flight). The first real write's alert
        // already covered the user; a second toast for a no-op write is
        // confusing. Codex P2 round 10 on PR #738.
        onSuccess: (data) => {
          if (data?.deduped) return;
          Alert.alert('Marked worn', "Today's look saved to your wear log.");
        },
        onError: (err: unknown) =>
          Alert.alert(
            'Could not mark worn',
            err instanceof Error ? err.message : 'Please try again.',
          ),
      },
    );
  }, [todayOutfit, markWorn]);

  const goOutfitDetail = React.useCallback(() => {
    if (todayOutfit) nav.navigate('OutfitDetail', { id: todayOutfit.id });
    else nav.navigate('OutfitGenerate');
  }, [nav, todayOutfit]);

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
            <Pressable
              onPress={push('Notifications')}
              style={[s.weatherPill, { borderColor: t.border, backgroundColor: t.card }]}>
              <SunIcon color={t.fg} />
              <Text style={[s.weatherText, { color: t.fg, fontFamily: fonts.uiMed }]}>14°</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Profile"
              onPress={push('Profile')}
              style={s.avatarWrap}>
              <View style={[s.avatar, { backgroundColor: t.accent }]}>
                <Text style={{ color: t.accentFg, fontWeight: '600', fontSize: 13 }}>B</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ============ SMART DAY BANNER (M15) ============ */}
        {/* Day-intelligence engine: ranks today's outfit against weather +
            calendar context. Renders above the existing today's-look hero
            card; hides itself on engine error / empty wardrobe so the hero
            below always remains the primary surface. */}
        <SmartDayBanner />

        {/* ============ TODAY'S LOOK HERO ============ */}
        <Card hero padding={18}>
          {heroLoading ? (
            <PlanCardSkeleton />
          ) : todayOutfit ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Eyebrow style={{ marginBottom: 3 }}>Today's Look</Eyebrow>
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontSize: 22, lineHeight: 24, fontWeight: '500', color: t.fg, letterSpacing: -0.22 }}>
                    {outfitDisplayName(todayOutfit)}
                  </Text>
                </View>
                <Pressable onPress={goOutfitDetail} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: t.accent, fontSize: 12, fontWeight: '500', fontFamily: fonts.uiMed }}>View</Text>
                  <ChevronIcon color={t.accent} />
                </Pressable>
              </View>
              <OutfitThumbRow outfit={todayOutfit} />
              {todayOutfit.explanation ? (
                <Text style={{ fontSize: 12.5, color: t.fg2, marginVertical: 14, lineHeight: 18, fontFamily: fonts.ui }} numberOfLines={3}>
                  {todayOutfit.explanation}
                </Text>
              ) : (
                <View style={{ height: 14 }} />
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label={wornToday ? 'Worn today' : 'Wear this'}
                  onPress={handleWearToday}
                  block
                  style={{ flex: 1 }}
                  disabled={wornToday || markWorn.isPending}
                />
                <Button label="Restyle" variant="outline" onPress={push('OutfitGenerate')} />
                <Button label="View" variant="quiet" onPress={goOutfitDetail} />
              </View>
            </>
          ) : (
            <>
              <Eyebrow style={{ marginBottom: 6 }}>Today's Look</Eyebrow>
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 22,
                  lineHeight: 26,
                  fontWeight: '500',
                  color: t.fg,
                  letterSpacing: -0.22,
                  marginBottom: 6,
                }}>
                Nothing planned yet
              </Text>
              <Text
                style={{
                  fontSize: 12.5,
                  color: t.fg2,
                  marginBottom: 14,
                  lineHeight: 18,
                  fontFamily: fonts.ui,
                }}>
                Generate an outfit from your wardrobe or pick from your saved looks.
              </Text>
              <Button label="Generate outfit" onPress={push('OutfitGenerate')} block />
            </>
          )}
        </Card>

        {/* ============ YOUR STYLIST GRID ============ */}
        <Section title="Your Stylist">
          <HubGrid>
            <HubTile icon={<ChatIcon color={t.accent} />}     label="Style Chat"   sub="Ask your AI stylist anything"  onPress={push('StyleChat')} />
            <HubTile icon={<OutfitsIcon color={t.accent} />}  label="Outfits"      sub="Your saved looks & combos"     onPress={push('Outfits')} />
            <HubTile icon={<TshirtIcon color={t.accent} />}   label="Style Me"     sub="Get styled for any occasion"   onPress={push('StyleMe')} />
            <HubTile icon={<SmileIcon color={t.accent} />}    label="Mood Outfit"  sub="Dress how you feel"            onPress={push('MoodOutfit')} />
          </HubGrid>
        </Section>

        {/* ============ DISCOVER GRID ============ */}
        <Section title="Discover">
          <HubGrid>
            <HubTile icon={<SuitcaseIcon color={t.accent} />} label="Travel Capsule" sub="Pack smart for any trip"              onPress={push('TravelCapsule')} />
            <HubTile icon={<GapsIcon color={t.accent} />}     label="Wardrobe Gaps"  sub="What's missing from your closet"      onPress={push('WardrobeGaps')} />
            <HubTile icon={<GearIcon color={t.accent} />}     label="Settings"       sub="Preferences & account"                onPress={push('Settings')} />
          </HubGrid>
        </Section>

        {/* ============ THIS WEEK MINI-STRIP ============ */}
        <View>
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: t.fg, fontFamily: fonts.displayMedium }]}>This week</Text>
            <Pressable onPress={() => goTab('plan')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ color: t.accent, fontSize: 12, fontWeight: '500', fontFamily: fonts.uiMed }}>Calendar →</Text>
            </Pressable>
          </View>
          <MiniWeek days={week} onPress={() => goTab('plan')} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            <Button
              label="Wear today"
              size="sm"
              onPress={handleWearToday}
              block
              style={{ flex: 1 }}
              disabled={!todayOutfit || wornToday || markWorn.isPending}
            />
            <Button label="Restyle" variant="outline" size="sm" onPress={push('StyleMe')} />
            <Button label="+ Add" variant="outline" size="sm" onPress={push('AddPieceStep1')} />
          </View>
        </View>

        {/* ============ ASK THE STYLIST ROW ============ */}
        <View>
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: t.fg, fontFamily: fonts.displayMedium }]}>Ask the stylist</Text>
            <Caption>AI</Caption>
          </View>
          <Pressable
            onPress={push('StyleChat')}
            style={[s.stylistRow, { borderColor: t.border, backgroundColor: t.card }]}>
            <View style={[s.stylistIcon, { backgroundColor: t.accentSoft }]}>
              <SparklesIcon color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: t.fg, fontFamily: fonts.uiSemi, letterSpacing: -0.13 }}>
                What goes with my linen trousers?
              </Text>
              <Text style={{ fontSize: 11.5, color: t.fg2, marginTop: 1, fontFamily: fonts.ui }}>
                Tap to chat — context-aware
              </Text>
            </View>
            <ChevronIcon color={t.fg3} />
          </Pressable>
        </View>

        {/* ============ YOUR RHYTHM ============ */}
        <View>
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: t.fg, fontFamily: fonts.displayMedium }]}>Your rhythm</Text>
            <Pressable onPress={() => goTab('insights')}>
              <Text style={{ color: t.accent, fontSize: 12, fontWeight: '500', fontFamily: fonts.uiMed }}>Insights →</Text>
            </Pressable>
          </View>
          {statsLoading ? (
            <StatRowSkeleton count={2} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <RhythmStat
                num={garmentTotal}
                label="Pieces in wardrobe"
                onPress={() => goTab('insights')}
              />
              <RhythmStat
                num={wardrobeStatsAuthoritative ? `${wardrobeUsedPct}%` : '—'}
                label="Wardrobe used"
                onPress={() => goTab('insights')}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ====== Sub-components (private to HomeScreen — promote to /components/ if reused) ======

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <View style={{ marginBottom: 10 }}>
        <Eyebrow>{title}</Eyebrow>
      </View>
      {children}
    </View>
  );
}

function HubGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

function HubTile({
  icon, label, sub, onPress,
}: { icon: React.ReactNode; label: string; sub: string; onPress?: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.hubTile,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          transform: pressed ? [{ scale: 0.98 }] : [],
        },
      ]}>
      <View style={[s.hubTileIcon, { backgroundColor: t.accentSoft }]}>{icon}</View>
      <View style={{ gap: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: t.fg, fontFamily: fonts.uiSemi, letterSpacing: -0.15 }}>
          {label}
        </Text>
        <Text numberOfLines={2} style={{ fontSize: 11.5, color: t.fg2, lineHeight: 16, fontFamily: fonts.ui }}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

// Builds the 4-tile garment row inside Today's Look. Up to 4 of the outfit_items
// render as signed-URL <Image>s; remaining slots fall through to gradient
// placeholders so the row's visual rhythm holds even on a 2-piece outfit.
function OutfitThumbRow({ outfit }: { outfit: OutfitWithItems }) {
  const items = (outfit.outfit_items ?? []).slice(0, 4);
  const fillerCount = Math.max(0, 4 - items.length);
  const fallbackHue = outfitGradientHue(outfit.id);
  return (
    <View style={s.outfitRow}>
      {items.map((item) => (
        <OutfitThumb key={item.id} item={item} fallbackHue={fallbackHue} />
      ))}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <OutfitThumb key={`filler-${i}`} item={null} fallbackHue={fallbackHue} />
      ))}
    </View>
  );
}

function OutfitThumb({
  item,
  fallbackHue,
}: {
  item: OutfitItemWithGarment | null;
  fallbackHue: number;
}) {
  const t = useTokens();
  const garment = item?.garment ?? null;
  const imagePath = garment?.rendered_image_path ?? garment?.original_image_path ?? null;
  const { data: signedUrl } = useSignedUrl(imagePath);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [imagePath, signedUrl]);
  const showImage = signedUrl && !broken;
  // Truthy fallback (`||` not `??`) — legacy outfit_items rows have `slot`
  // as the empty string `''` rather than null, and `??` would still pick
  // that empty value over the garment's category. Codex P2 on PR #738.
  const label = (item?.slot || garment?.category || '').toString().toUpperCase();
  const hue = garment?.id ? outfitGradientHue(garment.id) : fallbackHue;

  return (
    <View style={[s.thumb, { borderColor: t.border, backgroundColor: t.bg2 }]}>
      <LinearGradient
        colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {showImage ? (
        <Image
          source={{ uri: signedUrl }}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : null}
      {label && !showImage ? (
        <Text style={s.thumbLabel}>{label}</Text>
      ) : null}
    </View>
  );
}

function MiniWeek({ days, onPress }: { days: WeekDay[]; onPress: () => void }) {
  const t = useTokens();
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {days.map((day, i) => {
        const dotColor = day.dot ? t.accent : day.active ? t.bg : t.fg3;
        return (
          <Pressable
            key={i}
            onPress={onPress}
            style={[
              s.miniDay,
              {
                backgroundColor: day.active ? t.fg : t.card,
                borderColor: day.active ? t.fg : t.border,
                flex: 1,
              },
            ]}>
            <Text style={{ fontSize: 9, letterSpacing: 1.3, color: day.active ? t.bg : t.fg2, fontFamily: fonts.uiSemi, opacity: day.active ? 0.75 : 1 }}>
              {day.dow}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: fonts.uiSemi, color: day.active ? t.bg : t.fg }}>
              {day.n}
            </Text>
            <View style={{ width: 4, height: 4, borderRadius: 4, backgroundColor: dotColor, opacity: day.dot ? 1 : 0.25 }} />
          </Pressable>
        );
      })}
    </View>
  );
}

function RhythmStat({ num, label, onPress }: { num: string; label: string; onPress: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      style={[s.rhythmStat, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontSize: 28, lineHeight: 28, fontWeight: '500', color: t.fg }}>
        {num}
      </Text>
      <Text style={{ fontSize: 10.5, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1.7, color: t.fg2, fontFamily: fonts.uiSemi }}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  weatherPill: {
    height: 32,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  weatherText: { fontSize: 12, fontWeight: '500' },
  avatarWrap: { /* hit area */ },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  thumb: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    fontSize: 9,
    fontFamily: fonts.uiSemi,
    letterSpacing: 1.1,
    color: '#fff',
    opacity: 0.85,
    textTransform: 'uppercase',
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 19, fontStyle: 'italic', fontWeight: '500', letterSpacing: -0.19 },
  hubTile: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  hubTileIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDay: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  stylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  stylistIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rhythmStat: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
});
