// Plan — pixel-faithful port of design_handoff_burs_rn/source/screens.jsx PlanScreen.
// Sections (top→bottom): page header (month + Playfair "Your Week" + calendar btn) ·
// WeekStrip · planned-outfit panel (chips → italic title → body → 4-thumb outfit row →
// Wear today / Restyle / Clear / + Add) · HR · "Coming up" list.
// BottomNav lives in MainTabsScreen; not rendered here.
//
// All time-dependent values (header eyebrow month, week-strip 7-day window) derive from
// `new Date()` at render so the screen stays accurate as days roll forward.

import React from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { t as tr } from '../lib/i18n';
import { showToast } from '../lib/toast';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { WeekStrip, type WeekDay } from '../components/WeekStrip';
import { WeekPlanPreview } from '../components/WeekPlanPreview';
import { PlanCardSkeleton } from '../components/skeletons';
import { ErrorState } from '../components/ErrorState';
import { GarmentImageTile } from '../components/GarmentImageTile';
import { CalendarIcon, ChevronIcon } from '../components/icons';
import { usePlannedOutfitsForRange, useDeletePlannedOutfit } from '../hooks/usePlannedOutfits';
import { useWeekGenerator } from '../hooks/useWeekGenerator';
import { useMarkOutfitWorn } from '../hooks/useOutfits';
import { useNow } from '../hooks/useNow';
import { localISODate, outfitDisplayName } from '../lib/outfitDisplay';
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

  // Track the selected day by ISO string, not by index. Across midnight
  // the week strip rebuilds with today shifted to index 0, so a
  // stored-index would silently point at yesterday's plan while the strip
  // highlights today's slot. Storing the iso lets the rendering code
  // re-derive the index after the rebuild and fall back to today when
  // the previously-selected day has scrolled out of the 7-day window.
  // Codex P2 on PR #738.
  const todayIso = React.useMemo(() => localISODate(now), [now]);
  const [selectedIso, setSelectedIso] = React.useState<string>(todayIso);

  const weekStart = todayIso;
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
  // Derive the index from the iso. If the previously-selected day has fallen
  // out of the rolling window (e.g. user kept the app on the prior day's
  // selection across midnight + several day rolls), reset back to today.
  // We compute index against the iso list independently of `buildPlanWeek`
  // so the `active` flag and the `selectedDay` lookup agree even when the
  // strip rebuilds.
  const weekIsos = React.useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      out.push(localISODate(d));
    }
    return out;
  }, [now]);
  const isoInWindow = weekIsos.includes(selectedIso);
  // Reconcile state with the rolling window once it shifts out of range —
  // can't write state during render, so a layout effect sets it on the
  // next tick. Reads use a memoised effective iso to avoid a one-frame
  // visual mismatch in the meantime.
  React.useEffect(() => {
    if (!isoInWindow) setSelectedIso(weekIsos[0]);
  }, [isoInWindow, weekIsos]);
  const effectiveSelectedIso = isoInWindow ? selectedIso : weekIsos[0];
  const selectedIndex = weekIsos.indexOf(effectiveSelectedIso);
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

  // M16 — week generator surface. Lazy-mounted: the preview shows a single
  // "Generate week" CTA until the user opts in, at which point it expands
  // into 7 rows. Once entries land, the section default-collapses behind a
  // "View N planned days" toggle so the PlanScreen surface stays compact;
  // the user can re-expand to swap individual days.
  const weekGen = useWeekGenerator();
  // Destructure the methods so the dep arrays below depend on stable
  // function refs (the hook returns new objects every render). Without
  // this `weekGen` itself ticks the dep set every render and the
  // memoised callbacks rebuild needlessly.
  const { generateWeek, regenerateDay } = weekGen;
  const handleGenerateWeek = React.useCallback(() => {
    void generateWeek({ startDate: now });
  }, [generateWeek, now]);
  const handleSwapDay = React.useCallback(
    (date: string) => {
      void regenerateDay(date);
    },
    [regenerateDay],
  );
  const [weekPreviewExpanded, setWeekPreviewExpanded] = React.useState(false);

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
          // N3b — non-blocking confirmation.
          showToast(
            'success',
            tr('outfit.actions.markedWorn.title'),
            tr('outfit.actions.markedWorn.body'),
          );
        },
        onError: (err: unknown) =>
          showToast(
            'error',
            tr('outfit.actions.couldNotMarkWorn.title'),
            err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
          ),
      },
    );
  }, [markWorn, selectedOutfit]);

  const handleClear = React.useCallback(() => {
    const iso = selectedDay?.iso;
    if (!iso) return;
    Alert.alert(
      tr('plan.clearPlan.confirm.title'),
      tr('plan.clearPlan.confirm.body'),
      [
        { text: tr('plan.clearPlan.confirm.cancel'), style: 'cancel' },
        {
          text: tr('plan.clearPlan.confirm.confirm'),
          style: 'destructive',
          onPress: () => {
            deletePlanned.mutate(iso, {
              // Defer the success alert until the week-plan refetch lands so
              // the underlying panel reflects the cleared state by the time
              // the user dismisses the toast. Without this, the alert pops
              // while the old planned outfit is still visible behind it —
              // misleading "confirmation" UX. Codex P2 on PR #738.
              onSuccess: async () => {
                try {
                  await weekPlansQ.refetch();
                } finally {
                  // N3b — confirm dialog above is the action gate;
                  // success here is non-blocking confirmation.
                  showToast(
                    'success',
                    tr('plan.clearPlan.success.title'),
                    tr('plan.clearPlan.success.body'),
                  );
                }
              },
              onError: (err: unknown) =>
                showToast(
                  'error',
                  tr('plan.clearPlan.error.title'),
                  err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
                ),
            });
          },
        },
      ],
    );
  }, [deletePlanned, selectedDay?.iso, weekPlansQ]);

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
            if (_day.iso) setSelectedIso(_day.iso);
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
              <Button
                label="Restyle"
                variant="outline"
                size="sm"
                block
                style={{ flex: 1 }}
                // N3.10 F-012 — thread the planned outfit's garments through
                // to the regen route as `seedGarmentIds` so the engine builds
                // an outfit that honours those pieces. Mirrors OutfitDetail's
                // Variation/Clone CTAs (~lines 952, 1000) which pass
                // `seedGarmentIds`. Previously this button navigated with no
                // params, so Restyle from Plan generated an unrelated outfit
                // — inconsistent with how the same affordance behaves on
                // OutfitDetail and silently broke the user's mental model.
                onPress={() => {
                  const seedIds = (selectedOutfit.outfit_items ?? [])
                    .map((item) => item.garment?.id)
                    .filter((id): id is string => Boolean(id));
                  nav.navigate(
                    'OutfitGenerate',
                    seedIds.length > 0 ? { seedGarmentIds: seedIds } : undefined,
                  );
                }}
              />
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
            {/* M18 — "Try it on" CTA on the planned-outfit row. Same
                destination as OutfitDetail's CTA — captures a selfie and
                compares against the planned outfit's garments. */}
            <Button
              label={tr('photoFeedback.tryOnAction')}
              variant="quiet"
              size="sm"
              onPress={() => nav.navigate('PhotoFeedback', { outfitId: selectedOutfit.id })}
              accessibilityHint="Take a mirror selfie and compare to this outfit"
            />
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
              {tr('plan.empty.title')}
            </Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, lineHeight: 19.5, color: t.fg2 }}>
              {tr('plan.empty.body')}
            </Text>
            {/* Q-B — thread the Plan-tab-selected date forward as
                `initialDate` so the generated outfit's "Plan for a date"
                action lands the planner sheet pre-selected on the right
                day. Falls back to today when no day is selected (defensive
                — `selectedDay` is derived from `effectiveSelectedIso`
                which is always present). */}
            <Button
              label={tr('plan.empty.cta')}
              onPress={() =>
                nav.navigate('OutfitGenerate', {
                  initialDate: selectedDay?.iso ?? effectiveSelectedIso,
                })
              }
              block
            />
          </View>
        )}

        {/* ============ HR ============ */}
        <View style={{ height: 1, backgroundColor: t.border, opacity: 0.7 }} />

        {/* ============ WEEK GENERATOR (M16) ============
            Empty (no entries, not generating): single "Generate week" CTA.
            Populated: collapsed by default behind a "View N planned days"
            toggle so the PlanScreen stays compact; expanding reveals the
            7-row preview with per-day swap. */}
        {weekGen.entries.length === 0 && !weekGen.isGenerating ? (
          <WeekPlanPreview
            entries={weekGen.entries}
            isGenerating={weekGen.isGenerating}
            completed={weekGen.completed}
            regeneratingDates={weekGen.regeneratingDates}
            onGenerateWeek={handleGenerateWeek}
            onRegenerateDay={handleSwapDay}
          />
        ) : (
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => setWeekPreviewExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded: weekPreviewExpanded }}
              accessibilityLabel={
                weekPreviewExpanded
                  ? 'Hide planned week'
                  : `View ${weekGen.entries.length} planned days`
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}>
              <Eyebrow>
                {weekPreviewExpanded
                  ? 'Hide planned week'
                  : `View ${weekGen.entries.length} planned days`}
              </Eyebrow>
              <ChevronIcon color={t.fg3} />
            </Pressable>
            {weekPreviewExpanded ? (
              <WeekPlanPreview
                entries={weekGen.entries}
                isGenerating={weekGen.isGenerating}
                completed={weekGen.completed}
                regeneratingDates={weekGen.regeneratingDates}
                onGenerateWeek={handleGenerateWeek}
                onRegenerateDay={handleSwapDay}
              />
            ) : null}
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
  return (
    <View style={s.outfitRow}>
      {items.map((item) => (
        <PlanOutfitThumb key={item.id} item={item} />
      ))}
      {Array.from({ length: fillerCount }).map((_, i) => (
        <PlanOutfitThumb key={`filler-${i}`} item={null} />
      ))}
    </View>
  );
}

function PlanOutfitThumb({ item }: { item: OutfitItemWithGarment | null }) {
  const t = useTokens();
  const garment = item?.garment ?? null;

  return (
    <View
      style={{
        flex: 1,
        aspectRatio: 1,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: t.border,
        overflow: 'hidden',
      }}>
      <GarmentImageTile garment={garment} iconSize={22} />
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
