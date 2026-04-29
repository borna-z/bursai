// Plan — pixel-faithful port of design_handoff_burs_rn/source/screens.jsx PlanScreen.
// Sections (top→bottom): page header (month + Playfair "Your Week" + calendar btn) ·
// WeekStrip · planned-outfit panel (chips → italic title → body → 4-thumb outfit row →
// Wear today / Restyle / Clear / + Add) · HR · "Coming up" list.
// BottomNav lives in MainTabsScreen; not rendered here.
//
// All time-dependent values (header eyebrow month, week-strip 7-day window) derive from
// `new Date()` at render so the screen stays accurate as days roll forward.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { CalendarIcon, ChevronIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Local-date YYYY-MM-DD. `Date.prototype.toISOString()` converts to UTC first, so a local
// midnight in e.g. CET (UTC+1) returns yesterday's date — wrong for hydrating queries against
// the day the user actually sees. Codex P2 on PR #701.
function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Build the rolling 7-day window (today first). Dot pattern matches HomeScreen's MiniWeek
// so the two views agree on which days are "planned" until the planned_outfits query lands.
// `setDate(getDate() + i)` not ms-arithmetic so DST transitions don't skip a calendar day.
function buildPlanWeek(today: Date): WeekDay[] {
  const dotPattern = [true, true, true, false, true, false, false];
  const out: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      n: d.getDate(),
      active: i === 0,
      planned: dotPattern[i],
      iso: localISODate(d),
    });
  }
  return out;
}

const SLOTS: ReadonlyArray<string> = ['OUTER', 'TOP', 'BOTTOM', 'SHOES'];

// Placeholder labels paired by index with future planned days. Real labels come from
// `planned_outfits` once the query is wired; until then we cycle through these so the UI
// has copy without inventing a calendar.
const UPCOMING_LABELS: ReadonlyArray<string> = [
  'Office · tailored',
  'Dinner · evening',
  'Studio · creative',
  'Brunch · soft',
];

// Derive "Coming up" rows from the same week we just rendered — keeps the gold dots in
// the WeekStrip and the upcoming list strictly in lockstep, and the labels can never go
// stale (e.g. "MON 28" on April 29 would already be in the past). Codex P2 on PR #701.
function buildComingUp(week: WeekDay[]): ReadonlyArray<{ when: string; label: string; iso?: string }> {
  return week
    .filter((d) => !d.active && d.planned)
    .slice(0, 2)
    .map((d, i) => ({
      when: `${d.dow} ${d.n}`,
      label: UPCOMING_LABELS[i % UPCOMING_LABELS.length],
      iso: d.iso,
    }));
}

export function PlanScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const now = new Date();
  const headerEyebrow = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const week = buildPlanWeek(now);
  const comingUp = buildComingUp(week);

  const goOutfit = () => nav.navigate('OutfitDetail');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingHorizontal: 20,
          paddingBottom: 130,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}>

        {/* ============ HEADER ============ */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{headerEyebrow}</Eyebrow>
            <PageTitle>Your Week</PageTitle>
          </View>
          {/* Calendar btn → month view; route ships with the Plan-month screen later. */}
          <IconBtn ariaLabel="Open calendar">
            <CalendarIcon color={t.fg} />
          </IconBtn>
        </View>

        {/* ============ WEEK STRIP ============ */}
        <WeekStrip days={week} />

        {/* ============ PLANNED PANEL ============ */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <EyebrowChip label="Planned · Today" />
            <EyebrowChip label="Brunch · Soft" />
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
            Today is styled
          </Text>

          <Text style={{ fontFamily: fonts.ui, fontSize: 13, lineHeight: 19.5, color: t.fg2 }}>
            Cream linen trouser, wool overshirt, and the suede loafers — calibrated for 14° and a long lunch.
          </Text>

          <View style={s.outfitRow}>
            {SLOTS.map((slot) => (
              <OutfitThumb key={slot} label={slot} />
            ))}
          </View>

          <Button label="Wear today" onPress={goOutfit} block />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Restyle" variant="outline" size="sm" block style={{ flex: 1 }} onPress={() => nav.navigate('StyleMe')} />
            <Button label="Clear" variant="outline" size="sm" block style={{ flex: 1 }} />
            <Button label="+ Add" variant="outline" size="sm" block style={{ flex: 1 }} onPress={() => nav.navigate('AddPieceStep1')} />
          </View>
        </View>

        {/* ============ HR ============ */}
        <View style={{ height: 1, backgroundColor: t.border, opacity: 0.7 }} />

        {/* ============ COMING UP ============ */}
        <View>
          <Eyebrow style={{ marginBottom: 10 }}>Coming up</Eyebrow>
          <View>
            {comingUp.map((item, i) => (
              <Pressable
                key={item.iso ?? `${item.when}-${i}`}
                onPress={goOutfit}
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

function OutfitThumb({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        flex: 1,
        aspectRatio: 1,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.bg2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 9,
          letterSpacing: 1.1,
          color: t.fg2,
          opacity: 0.55,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
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
