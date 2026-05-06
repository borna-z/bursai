// Plan — pixel-faithful port of design_handoff_burs_rn/source/screens.jsx PlanScreen.
// Sections (top→bottom): page header (month + Playfair "Your Week" + calendar btn) ·
// WeekStrip · planned-outfit panel (chips → italic title → body → 4-thumb outfit row →
// Wear today / Restyle / Clear / + Add) · HR · "Coming up" list.
// BottomNav lives in MainTabsScreen; not rendered here.
//
// All time-dependent values (header eyebrow month, week-strip 7-day window) derive from
// `new Date()` at render so the screen stays accurate as days roll forward.

import React from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { WeekStrip, type WeekDay } from '../components/WeekStrip';
import { PlanCardSkeleton } from '../components/skeletons';
import { ErrorState } from '../components/ErrorState';
import { CalendarIcon, ChevronIcon } from '../components/icons';
import { usePlannedOutfitsForRange, useDeletePlannedOutfit } from '../hooks/usePlannedOutfits';
import { useMarkOutfitWorn } from '../hooks/useOutfits';
import { useNow } from '../hooks/useNow';
import { useSignedUrl } from '../hooks/useSignedUrl';
import { localISODate, outfitDisplayName, outfitGradientHue } from '../lib/outfitDisplay';
import type { OutfitItemWithGarment, OutfitWithItems, PlannedOutfitWithOutfit } from '../types/outfit';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Build the rolling 7-day window (today first), pulling the gold-dot flag from the live
// `planned_outfits` set. `setDate(getDate() + i)` not ms-arithmetic so DST transitions
// don't skip a calendar day.
//
// `selectedIndex` drives the `active` flag — when the user taps a different day in the
// strip, the visual highlight + the panel's planned-outfit copy below follow that selection.
function buildPlanWeek(today: Date, selectedIndex: number, plannedDates: Set<string>): WeekDay[] {
  const out: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = localISODate(d);
    out.push({
      dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      n: d.getDate(),
      active: i === selectedIndex,
      planned: plannedDates.has(iso),
      iso,
    });
  }
  return out;
}

// Two upcoming planned days excluding the active selection. Pulls real outfit names so
// the row never goes stale.
function buildComingUp(
  week: WeekDay[],
  byDate: Map<string, PlannedOutfitWithOutfit>,
): readonly { when: string; label: string; iso: string; outfitId?: string }[] {
  return week
    .filter((d) => !d.active && d.planned)
    .slice(0, 2)
    .map((d) => {
      const plan = d.iso ? byDate.get(d.iso) : undefined;
      return {
        when: `${d.dow} ${d.n}`,
        label: outfitDisplayName(plan?.outfit, 'Planned outfit'),
        iso: d.iso ?? '',
        outfitId: plan?.outfit?.id,
      };
    });
}

export function PlanScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  // Reactive `now` — RN tabs stay mounted across day boundaries so a static
  // memo would freeze the week strip on yesterday's date and the eyebrow's
  // month label could lag too. useNow ticks on AppState 'active' and at the
  // next midnight. Codex P2 on PR #738.
  const now = useNow();
  const headerEyebrow = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const weekStart = React.useMemo(() => localISODate(now), [now]);
  // Calendar-day arithmetic — `now.getTime() + 6 * 24h` would land 6 hours
  // off in DST-observing time zones during the fall-back transition (e.g.
  // America/New_York Nov 1 00:30 → Nov 6 23:30 instead of Nov 7), so the
  // 7th displayed day in the strip would be queried out of range and its
  // planned dot / Coming up entry / selected-day panel would silently drop.
  // Use the same `setDate(getDate() + 6)` shape `buildPlanWeek` uses.
  // Codex P2 round 7 on PR #738.
  const weekEnd = React.useMemo(() => {
    const d = new Date(now);
    d.setDate(now.getDate() + 6);
    return localISODate(d);
  }, [now]);
  const weekPlansQ = usePlannedOutfitsForRange(weekStart, weekEnd);

  const byDate = React.useMemo(() => {
    const m = new Map<string, PlannedOutfitWithOutfit>();
    for (const p of weekPlansQ.data ?? []) {
      // Last write wins — usePlannedOutfitsForRange sorts ascending so the
      // most recently created plan for a duplicated date overwrites.
      m.set(p.date, p);
    }
    return m;
  }, [weekPlansQ.data]);

  const plannedDates = React.useMemo(() => new Set(byDate.keys()), [byDate]);
  const week = React.useMemo(
    () => buildPlanWeek(now, selectedIndex, plannedDates),
    [now, selectedIndex, plannedDates],
  );
  const comingUp = React.useMemo(() => buildComingUp(week, byDate), [week, byDate]);
  const selectedDay = week[selectedIndex];
  const selectedPlan = selectedDay?.iso ? byDate.get(selectedDay.iso) ?? null : null;
  const selectedOutfit = selectedPlan?.outfit ?? null;

  const markWorn = useMarkOutfitWorn();
  const deletePlanned = useDeletePlannedOutfit();

  // "Worn today" gate for the today-only Wear button. Mirrors OutfitDetail.
  // Without this the button stays primary-coloured + enabled even after a
  // successful mark-worn, inviting an extra mutation chain on re-tap. Audit J.
  const wornToday = React.useMemo(() => {
    if (selectedIndex !== 0 || !selectedOutfit?.worn_at) return false;
    const wornDate = new Date(selectedOutfit.worn_at);
    if (Number.isNaN(wornDate.getTime())) return false;
    return localISODate(wornDate) === localISODate(now);
  }, [selectedIndex, selectedOutfit?.worn_at, now]);

  const loading = weekPlansQ.isLoading;
  const refreshing = weekPlansQ.isRefetching;
  const error = weekPlansQ.isError;
  const onRefresh = React.useCallback(() => {
    void weekPlansQ.refetch();
  }, [weekPlansQ]);
  const retry = onRefresh;

  const goOutfit = React.useCallback(() => {
    if (selectedOutfit) nav.navigate('OutfitDetail', { id: selectedOutfit.id });
  }, [nav, selectedOutfit]);

  const handleWearToday = React.useCallback(() => {
    if (!selectedOutfit) return;
    const garmentIds = (selectedOutfit.outfit_items ?? [])
      .map((item) => item.garment?.id)
      .filter((id): id is string => Boolean(id));
    markWorn.mutate(
      { outfitId: selectedOutfit.id, garmentIds },
      {
        // Skip the toast when the mutation deduped — see useMarkOutfitWorn's
        // day-level idempotency check (Codex P2 round 10 on PR #738).
        onSuccess: (data) => {
          if (data?.deduped) return;
          Alert.alert('Marked worn', 'Saved to your wear log.');
        },
        onError: (err: unknown) =>
          Alert.alert(
            'Could not mark worn',
            err instanceof Error ? err.message : 'Please try again.',
          ),
      },
    );
  }, [markWorn, selectedOutfit]);

  const handleClear = React.useCallback(() => {
    const iso = selectedDay?.iso;
    if (!iso) return;
    Alert.alert(
      'Clear plans',
      'This will remove the planned outfit for this day.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            deletePlanned.mutate(iso, {
              onSuccess: () => Alert.alert('Cleared', 'Planned outfit cleared.'),
              onError: (err: unknown) =>
                Alert.alert(
                  'Could not clear',
                  err instanceof Error ? err.message : 'Please try again.',
                ),
            });
          },
        },
      ],
    );
  }, [deletePlanned, selectedDay?.iso]);

  if (error) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingHorizontal: 20, paddingBottom: 130 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
          }>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Eyebrow style={{ marginBottom: 4 }}>{headerEyebrow}</Eyebrow>
              <PageTitle>Your Week</PageTitle>
            </View>
          </View>
          <ErrorState onRetry={retry} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingHorizontal: 20,
          paddingBottom: 130,
          gap: 18,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
        }
        showsVerticalScrollIndicator={false}>

        {/* ============ HEADER ============ */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{headerEyebrow}</Eyebrow>
            <PageTitle>Your Week</PageTitle>
          </View>
          {/* Calendar btn → month view (MonthCalendarScreen). */}
          <IconBtn ariaLabel="Open calendar" onPress={() => nav.navigate('MonthCalendar')}>
            <CalendarIcon color={t.fg} />
          </IconBtn>
        </View>

        {/* ============ WEEK STRIP ============ */}
        <WeekStrip
          days={week}
          onDayPress={(_day) => {
            const idx = week.findIndex((d) => d.iso === _day.iso);
            if (idx >= 0) setSelectedIndex(idx);
          }}
        />

        {/* ============ PLANNED PANEL ============ */}
        {loading ? (
          <PlanCardSkeleton />
        ) : selectedOutfit ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <EyebrowChip
                label={
                  selectedIndex === 0
                    ? 'Planned · Today'
                    : `Planned · ${selectedDay?.dow ?? ''} ${selectedDay?.n ?? ''}`
                }
              />
              {selectedOutfit.occasion ? (
                <EyebrowChip label={selectedOutfit.occasion} />
              ) : null}
            </View>

            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 22,
                lineHeight: 26,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.22,
              }}>
              {outfitDisplayName(selectedOutfit)}
            </Text>

            {selectedOutfit.explanation ? (
              <Text
                style={{ fontFamily: fonts.ui, fontSize: 13, lineHeight: 19.5, color: t.fg2 }}
                numberOfLines={3}>
                {selectedOutfit.explanation}
              </Text>
            ) : null}

            <PlanThumbRow outfit={selectedOutfit} />

            <Button
              label={
                selectedIndex === 0
                  ? wornToday
                    ? 'Worn today'
                    : 'Wear today'
                  : 'View outfit'
              }
              variant={selectedIndex === 0 && wornToday ? 'accent' : 'primary'}
              onPress={selectedIndex === 0 ? handleWearToday : goOutfit}
              block
              disabled={selectedIndex === 0 && (wornToday || markWorn.isPending)}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Restyle" variant="outline" size="sm" block style={{ flex: 1 }} onPress={() => nav.navigate('OutfitGenerate')} />
              <Button
                label="Clear"
                variant="outline"
                size="sm"
                block
                style={{ flex: 1 }}
                onPress={handleClear}
                disabled={deletePlanned.isPending}
              />
              <Button label="+ Add" variant="outline" size="sm" block style={{ flex: 1 }} onPress={() => nav.navigate('AddPieceStep1')} />
            </View>
          </View>
        ) : (
          // Empty state — selected day has no planned outfit. Same vocabulary as MonthCalendar.
          <View style={{ gap: 10 }}>
            <EyebrowChip label={`${selectedDay?.dow ?? ''} ${selectedDay?.n ?? ''}`} />
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 22,
                lineHeight: 26,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.22,
              }}>
              Nothing planned
            </Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, lineHeight: 19.5, color: t.fg2 }}>
              Generate an outfit or pick from your saved looks.
            </Text>
            <Button label="Generate outfit" onPress={() => nav.navigate('OutfitGenerate')} block />
          </View>
        )}

        {/* ============ HR ============ */}
        <View style={{ height: 1, backgroundColor: t.border, opacity: 0.7 }} />

        {/* ============ COMING UP ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 10 }}>Coming up</Eyebrow>
          <View>
            {comingUp.map((item, i) => (
              <Pressable
                key={item.iso || `${item.when}-${i}`}
                onPress={() => {
                  if (item.outfitId) nav.navigate('OutfitDetail', { id: item.outfitId });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.when} ${item.label}`}
                style={({ pressed }) => [
                  s.upcomingRow,
                  {
                    borderBottomColor: t.border,
                    borderBottomWidth: i === comingUp.length - 1 ? 0 : 1,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <View style={[s.upcomingThumb, { backgroundColor: t.bg2, borderColor: t.border }]}>
                  <View style={[s.upcomingThumbStripe, { backgroundColor: t.card }]} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontFamily: fonts.uiSemi,
                      fontSize: 10,
                      letterSpacing: 1.4,
                      textTransform: 'uppercase',
                      color: t.fg2,
                      opacity: 0.7,
                    }}>
                    {item.when}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.uiSemi,
                      fontSize: 13.5,
                      fontWeight: '600',
                      color: t.fg,
                      letterSpacing: -0.13,
                      marginTop: 2,
                    }}>
                    {item.label}
                  </Text>
                </View>
                <ChevronIcon color={t.fg3} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ====== Sub-components (private to PlanScreen) ======

function EyebrowChip({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        height: 24,
        paddingHorizontal: 10,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 10,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: t.fg2,
        }}>
        {label}
      </Text>
    </View>
  );
}

function PlanThumbRow({ outfit }: { outfit: OutfitWithItems }) {
  const items = (outfit.outfit_items ?? []).slice(0, 4);
  const fillerCount = Math.max(0, 4 - items.length);
  const fallbackHue = outfitGradientHue(outfit.id);
  return (
    <View style={s.outfitRow}>
      {items.map((item) => (
        <PlanOutfitThumb key={item.id} item={item} fallbackHue={fallbackHue} />
      ))}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <PlanOutfitThumb key={`filler-${i}`} item={null} fallbackHue={fallbackHue} />
      ))}
    </View>
  );
}

function PlanOutfitThumb({
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
  const label = (item?.slot ?? garment?.category ?? '').toString().toUpperCase();
  const hue = garment?.id ? outfitGradientHue(garment.id) : fallbackHue;

  return (
    <View
      style={{
        flex: 1,
        aspectRatio: 1,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.bg2,
        overflow: 'hidden',
      }}>
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
        <Text
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            fontFamily: fonts.uiSemi,
            fontSize: 9,
            letterSpacing: 1.1,
            color: '#fff',
            opacity: 0.85,
            textTransform: 'uppercase',
          }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  outfitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  upcomingThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    flexShrink: 0,
  },
  upcomingThumbStripe: {
    position: 'absolute',
    top: '50%',
    left: -10,
    right: -10,
    height: 8,
    transform: [{ rotate: '135deg' }],
    opacity: 0.5,
  },
});
