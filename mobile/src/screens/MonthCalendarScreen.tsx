// Month-grid calendar with day picker + selected-day panel.
// Source: design_handoff_burs_rn/source/more-screens.jsx PlanMonthScreen (lines 439-519).
//
// Mock-data only: a small set of "planned" outfits scattered around today so the gold-dot
// indicator and selected-day panel both have something to render. Real planned_outfits
// query lands in a future PR.

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, ChevronIcon } from '../components/icons';
import { hapticLight } from '../lib/haptics';
import { usePlannedOutfitsForRange } from '../hooks/usePlannedOutfits';
import { t as tr } from '../lib/i18n';
import { localISODate, outfitDisplayName, outfitGradientHue } from '../lib/outfitDisplay';
import type { PlannedOutfitWithOutfit } from '../types/outfit';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Build the 7 weekday header narrows from the device locale rather than hardcoding English.
// Anchor on a known Monday (2024-01-01 was a Monday) and ask Intl for the short weekday in
// the user's locale, then uppercase to match the eyebrow style.
function buildWeekdayHeaders(): string[] {
  const out: string[] = [];
  // 2024-01-01 = Monday (UTC-anchored to avoid DST drift on the synthetic Date).
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    out.push(
      d
        .toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })
        .slice(0, 3)
        .toUpperCase(),
    );
  }
  return out;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type Cell = {
  date: Date;
  iso: string;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
};

// Build a 6-row × 7-col grid (42 cells), Monday-first, starting on the Monday on or before
// the 1st of the month and continuing through the Sunday on or after the last day.
function buildMonthGrid(year: number, month: number, today: Date): Cell[] {
  const first = new Date(year, month, 1);
  // JS getDay(): Sun=0..Sat=6. We want Monday-first → shift so Mon=0..Sun=6.
  const firstDow = (first.getDay() + 6) % 7;
  // Start = first - firstDow days
  const start = new Date(year, month, 1 - firstDow);
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      iso: localISODate(d),
      dayNum: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: sameDay(d, today),
    });
  }
  return cells;
}

export function MonthCalendarScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const today = useMemo(() => startOfDay(new Date()), []);
  const weekdays = useMemo(() => buildWeekdayHeaders(), []);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const grid = useMemo(() => buildMonthGrid(currentYear, currentMonth, today), [currentYear, currentMonth, today]);

  // Range covers the visible 6×7 grid — first cell to last cell — so dots show on the
  // overflow days (last week of previous month / first week of next month) too.
  const monthStartIso = grid[0]?.iso ?? localISODate(new Date(currentYear, currentMonth, 1));
  const monthEndIso = grid[grid.length - 1]?.iso ?? localISODate(new Date(currentYear, currentMonth + 1, 0));
  const monthPlansQ = usePlannedOutfitsForRange(monthStartIso, monthEndIso);

  const planned = useMemo(() => {
    const map: Record<string, PlannedOutfitWithOutfit> = {};
    for (const p of monthPlansQ.data ?? []) {
      // Last write wins on duplicate dates — sort order is ascending by date so the
      // most-recently-inserted row for a given duplicated date overwrites.
      map[p.date] = p;
    }
    return map;
  }, [monthPlansQ.data]);

  const headerEyebrow = new Date(currentYear, currentMonth, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();
  const monthNavLabel = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const selectedISO = localISODate(selectedDate);
  const selectedPlanned = planned[selectedISO];
  const selectedEyebrow = selectedDate
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();

  const goPrevMonth = () => {
    hapticLight();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    hapticLight();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };
  const resetToToday = () => {
    hapticLight();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(today);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 32,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <IconBtn ariaLabel="Back" onPress={() => { hapticLight(); nav.goBack(); }}>
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>{headerEyebrow}</Eyebrow>
            <PageTitle style={{ marginTop: 4 }}>Calendar</PageTitle>
          </View>
          <Pressable onPress={resetToToday} accessibilityRole="button" accessibilityLabel="Jump to today" hitSlop={8}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 12.5,
                color: t.accent,
                letterSpacing: -0.13,
              }}>
              Today
            </Text>
          </Pressable>
        </View>

        {/* Month navigation */}
        <View style={s.monthNav}>
          <IconBtn ariaLabel="Previous month" onPress={goPrevMonth} size={32}>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <ChevronIcon color={t.fg} size={14} />
            </View>
          </IconBtn>
          <Text
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 18,
              color: t.fg,
              letterSpacing: -0.18,
            }}>
            {monthNavLabel}
          </Text>
          <IconBtn ariaLabel="Next month" onPress={goNextMonth} size={32}>
            <ChevronIcon color={t.fg} size={14} />
          </IconBtn>
        </View>

        {/* Weekday header */}
        <View style={s.weekdayRow}>
          {weekdays.map((wd, i) => (
            <View key={`${wd}-${i}`} style={s.weekdayCell}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: t.fg2,
                  opacity: 0.7,
                }}>
                {wd}
              </Text>
            </View>
          ))}
        </View>

        {/* Day grid */}
        <View style={s.grid}>
          {grid.map((cell) => {
            const isSelected = sameDay(cell.date, selectedDate);
            const has = Boolean(planned[cell.iso]);
            const baseTextColor = !cell.inMonth ? t.fg3 : t.fg;
            return (
              <Pressable
                key={cell.iso}
                onPress={() => {
                  hapticLight();
                  setSelectedDate(cell.date);
                }}
                accessibilityRole="button"
                accessibilityLabel={cell.date.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [s.cell, { opacity: pressed ? 0.7 : 1 }]}>
                <View
                  style={[
                    s.cellPill,
                    isSelected
                      ? { backgroundColor: t.fg }
                      : cell.isToday
                      ? { backgroundColor: t.accent }
                      : null,
                  ]}>
                  <Text
                    style={{
                      fontFamily: isSelected || cell.isToday ? fonts.displayMedium : fonts.uiMed,
                      fontStyle: isSelected || cell.isToday ? 'italic' : 'normal',
                      fontSize: isSelected || cell.isToday ? 14 : 13,
                      color: isSelected ? t.bg : cell.isToday ? t.accentFg : baseTextColor,
                      opacity: !cell.inMonth ? 0.4 : 1,
                    }}>
                    {cell.dayNum}
                  </Text>
                </View>
                {has ? (
                  <View
                    style={[
                      s.dot,
                      { backgroundColor: isSelected ? t.bg : t.accent },
                    ]}
                  />
                ) : (
                  <View style={s.dotPlaceholder} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Selected-day panel */}
        <View style={[s.panel, { backgroundColor: t.card, borderColor: t.border }]}>
          <Eyebrow>{selectedEyebrow}</Eyebrow>
          {selectedPlanned ? (
            <>
              <PlannedThumbRow plan={selectedPlanned} />
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 22,
                  color: t.fg,
                  letterSpacing: -0.22,
                }}>
                {outfitDisplayName(selectedPlanned.outfit, tr('monthCalendar.planned.fallbackName'))}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label={tr('monthCalendar.planned.view')}
                  onPress={() => {
                    hapticLight();
                    if (selectedPlanned.outfit?.id) {
                      nav.navigate('OutfitDetail', { id: selectedPlanned.outfit.id });
                    }
                  }}
                  block
                  style={{ flex: 1 }}
                  disabled={!selectedPlanned.outfit?.id}
                />
                <Button
                  label={tr('monthCalendar.planned.change')}
                  variant="outline"
                  onPress={() => { hapticLight(); nav.navigate('OutfitGenerate'); }}
                  block
                  style={{ flex: 1 }}
                />
              </View>
            </>
          ) : (
            <>
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 22,
                  color: t.fg,
                  letterSpacing: -0.22,
                }}>
                {tr('monthCalendar.empty.title')}
              </Text>
              <Text style={{ fontFamily: fonts.ui, fontSize: 13, lineHeight: 19.5, color: t.fg2 }}>
                {tr('monthCalendar.empty.body')}
              </Text>
              <Button
                label={tr('monthCalendar.empty.cta')}
                variant="accent"
                onPress={() => { hapticLight(); nav.navigate('OutfitGenerate'); }}
                block
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Renders 4 thumb cells from a planned outfit's outfit_items. Each tile gets the
// garment's stable hue (via outfitGradientHue on the garment id) when available so
// the colour family stays consistent with the actual outfit, not a per-row reroll.
function PlannedThumbRow({ plan }: { plan: PlannedOutfitWithOutfit }) {
  const items = (plan.outfit?.outfit_items ?? []).slice(0, 4);
  const fillerCount = Math.max(0, 4 - items.length);
  const baseHue = plan.outfit ? outfitGradientHue(plan.outfit.id) : outfitGradientHue(plan.id);
  const t = useTokens();

  const tileFor = (key: string, garmentId?: string | null) => {
    const hue = garmentId ? outfitGradientHue(garmentId) : baseHue;
    return (
      <View
        key={key}
        style={[
          s.thumb,
          { borderColor: t.border, overflow: 'hidden', backgroundColor: t.bg2 },
        ]}>
        <LinearGradient
          colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>
    );
  };

  return (
    <View style={s.thumbRow}>
      {items.map((item) => tileFor(item.id, item.garment?.id ?? null))}
      {Array.from({ length: fillerCount }).map((_, i) => tileFor(`filler-${i}`))}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
  },
  cellPill: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: radii.pill,
    marginTop: 4,
  },
  dotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 4,
  },
  panel: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 6,
  },
  thumb: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
});
