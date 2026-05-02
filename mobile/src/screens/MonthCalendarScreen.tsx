// Month-grid calendar with day picker + selected-day panel.
// Source: design_handoff_burs_rn/source/more-screens.jsx PlanMonthScreen (lines 439-519).
//
// Mock-data only: a small set of "planned" outfits scattered around today so the gold-dot
// indicator and selected-day panel both have something to render. Real planned_outfits
// query lands in a future PR.

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

// Mock planned outfits — keyed by ISO date. Generated relative to today so the dots aren't
// stuck in the past.
function buildMockPlanned(today: Date): Record<string, { hue: number; name: string }> {
  const out: Record<string, { hue: number; name: string }> = {};
  const offsets: Array<{ delta: number; hue: number; name: string }> = [
    { delta: 0,  hue: 32,  name: 'Today is styled' },
    { delta: 1,  hue: 200, name: 'Morning coffee' },
    { delta: 2,  hue: 18,  name: 'Office tailored' },
    { delta: 5,  hue: 45,  name: 'Friday softness' },
    { delta: 8,  hue: 220, name: 'Brunch · soft' },
    { delta: -3, hue: 0,   name: 'Studio · creative' },
  ];
  for (const o of offsets) {
    const d = new Date(today);
    d.setDate(today.getDate() + o.delta);
    out[localISODate(d)] = { hue: o.hue, name: o.name };
  }
  return out;
}

export function MonthCalendarScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const today = useMemo(() => startOfDay(new Date()), []);
  const planned = useMemo(() => buildMockPlanned(today), [today]);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const grid = useMemo(() => buildMonthGrid(currentYear, currentMonth, today), [currentYear, currentMonth, today]);

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
          {WEEKDAYS.map((wd) => (
            <View key={wd} style={s.weekdayCell}>
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
                accessibilityLabel={cell.iso}
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
              <View style={s.thumbRow}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      s.thumb,
                      {
                        backgroundColor: `hsl(${(selectedPlanned.hue + i * 15) % 360}, 22%, 78%)`,
                        borderColor: t.border,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 22,
                  color: t.fg,
                  letterSpacing: -0.22,
                }}>
                {selectedPlanned.name}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label="View outfit"
                  onPress={() => { hapticLight(); nav.navigate('OutfitDetail'); }}
                  block
                  style={{ flex: 1 }}
                />
                <Button
                  label="Change"
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
                Nothing planned
              </Text>
              <Text style={{ fontFamily: fonts.ui, fontSize: 13, lineHeight: 19.5, color: t.fg2 }}>
                Generate an outfit or plan one manually.
              </Text>
              <Button
                label="Generate outfit"
                variant="accent"
                onPress={() => { hapticLight(); nav.navigate('OutfitGenerate'); }}
                block
              />
              <Button
                label="Plan manually"
                variant="outline"
                onPress={() =>
                  Alert.alert('Coming soon', 'Manual outfit planning coming soon.')
                }
                block
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
