// Travel Capsule — Step 1 of 3. Destination + dates + trip type.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx TravelCapsuleScreen step 0.
//
// Builds the trip brief that's threaded through Steps 2 (TravelMustHaves) and 3
// (TravelPackingList) via route params.

import React from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, CalendarIcon, ChevronIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Curated suggestions for the destination chip strip. Labelled "Popular" rather
// than "Recent" so a first-time user doesn't see cities they've never visited
// being framed as their own travel history. When real per-user trip history
// ships we can rename the section back and source from the user's prior trips.
const POPULAR_DESTINATIONS = ['Lisbon', 'Tokyo', 'New York', 'Copenhagen', 'Marrakesh'];
const TRIP_TYPES = ['Business', 'Leisure', 'Beach', 'City', 'Outdoor', 'Winter'] as const;

type TripType = (typeof TRIP_TYPES)[number];

// Strict YYYY-MM-DD parser. `Date.parse` interprets ISO date strings as UTC, but the user
// types local-calendar dates — and Hermes returns NaN inconsistently for non-ISO forms
// (e.g. "5/12/2026"). Parse via explicit components and treat both endpoints as the same
// timezone, returning the night-count.
//
// Returns null on missing or malformed input; returns 0 for same-day (day trip).
// Codex audit P1.1 + P1.2.
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseISODate(value: string): Date | null {
  const match = ISO_DATE_RE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

function nightsBetween(from: string, to: string): number | null {
  if (!from || !to) return null;
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (!a || !b || b.getTime() < a.getTime()) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function offsetISO(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return localISO(d);
}

const DATE_PRESETS: readonly { label: string; daysFromToday: number }[] = [
  { label: 'Today',     daysFromToday: 0 },
  { label: 'Tomorrow',  daysFromToday: 1 },
  { label: '+3 days',   daysFromToday: 3 },
  { label: '+1 week',   daysFromToday: 7 },
  { label: '+2 weeks',  daysFromToday: 14 },
];

function shortDateLabel(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------- Mini calendar (used by the "Custom" preset) ----------

type DayCell = {
  date: Date;
  iso: string;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
};

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 6×7 Monday-first grid (42 cells), starting on the Monday on/before the 1st of the month.
// Mirrors MonthCalendarScreen's buildMonthGrid so the visual rhythm matches.
function buildMonthGrid(year: number, month: number, today: Date): DayCell[] {
  const first = new Date(year, month, 1);
  const firstDow = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstDow);
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      iso: localISO(d),
      dayNum: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: sameDay(d, today),
    });
  }
  return cells;
}

function buildWeekdayHeaders(): string[] {
  const out: string[] = [];
  // 2024-01-01 was a Monday — anchor in UTC to dodge DST drift on the synthetic Date.
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    out.push(
      d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }).slice(0, 3).toUpperCase(),
    );
  }
  return out;
}

export function TravelCapsuleScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const [destination, setDestination] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [tripTypes, setTripTypes] = React.useState<TripType[]>(['City']);
  // Which date pill, if any, is showing the custom-date sheet. `null` = sheet closed.
  const [customPickerFor, setCustomPickerFor] = React.useState<'from' | 'to' | null>(null);

  const nights = nightsBetween(fromDate, toDate);
  const canContinue = destination.trim().length > 0 && tripTypes.length > 0;

  const toggleTripType = (type: TripType) =>
    setTripTypes((prev) => (prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]));

  // Preset-pill date chooser. The first 5 buttons are quick offsets; the 6th ("Custom")
  // opens an inline mini-calendar sheet so the user can pick any specific date directly.
  // Avoids dragging in @react-native-community/datetimepicker.
  const openDatePicker = React.useCallback((which: 'from' | 'to') => {
    const buttons: { text: string; onPress?: () => void; style?: 'cancel' }[] = DATE_PRESETS.map(
      ({ label, daysFromToday }) => ({
        text: label,
        onPress: () => {
          const iso = offsetISO(daysFromToday);
          if (which === 'from') setFromDate(iso);
          else setToDate(iso);
        },
      }),
    );
    buttons.push({
      text: 'Custom…',
      onPress: () => setCustomPickerFor(which),
    });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(which === 'from' ? 'Start date' : 'End date', undefined, buttons);
  }, []);

  const onCustomConfirm = React.useCallback(
    (iso: string) => {
      if (customPickerFor === 'from') setFromDate(iso);
      else if (customPickerFor === 'to') setToDate(iso);
      setCustomPickerFor(null);
    },
    [customPickerFor],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 18 }}
          keyboardShouldPersistTaps="handled">
          {/* ============ HEADER ============ */}
          <View style={s.headerRow}>
            <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
              <BackIcon color={t.fg} />
            </IconBtn>
            <View style={{ flex: 1 }}>
              <Eyebrow style={{ marginBottom: 4 }}>Pack smart</Eyebrow>
              <PageTitle>Travel Capsule</PageTitle>
            </View>
          </View>

          {/* ============ STEP INDICATOR ============ */}
          {/* Wizard has 3 stops (this + must-haves + packing list). Codex audit P2.7. */}
          <View style={[s.stepChip, { backgroundColor: t.accentSoft }]}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: t.accent }}>
              Step 1 of 3
            </Text>
          </View>

          {/* ============ DESTINATION ============ */}
          <View style={{ gap: 10 }}>
            <Eyebrow>Destination</Eyebrow>
            <View style={[s.input, { backgroundColor: t.bg2, borderColor: t.border }]}>
              <TextInput
                value={destination}
                onChangeText={setDestination}
                placeholder="Where are you going?"
                placeholderTextColor={t.fg3}
                style={{ flex: 1, color: t.fg, fontFamily: fonts.uiMed, fontSize: 14, padding: 0 }}
                returnKeyType="next"
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {POPULAR_DESTINATIONS.map((city) => (
                <Chip
                  key={city}
                  label={city}
                  active={destination === city}
                  onPress={() => setDestination(city)}
                />
              ))}
            </ScrollView>
          </View>

          {/* ============ DATE RANGE ============ */}
          <View style={{ gap: 10 }}>
            <Eyebrow>Dates</Eyebrow>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => openDatePicker('from')}
                accessibilityRole="button"
                accessibilityLabel="Pick start date"
                style={[s.dateInput, { backgroundColor: t.bg2, borderColor: t.border }]}>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: fromDate ? t.fg : t.fg3,
                    fontFamily: fonts.uiMed,
                    fontSize: 13,
                  }}>
                  {fromDate ? shortDateLabel(fromDate) : 'From'}
                </Text>
                <CalendarIcon color={t.fg2} />
              </Pressable>
              <Pressable
                onPress={() => openDatePicker('to')}
                accessibilityRole="button"
                accessibilityLabel="Pick end date"
                style={[s.dateInput, { backgroundColor: t.bg2, borderColor: t.border }]}>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: toDate ? t.fg : t.fg3,
                    fontFamily: fonts.uiMed,
                    fontSize: 13,
                  }}>
                  {toDate ? shortDateLabel(toDate) : 'To'}
                </Text>
                <CalendarIcon color={t.fg2} />
              </Pressable>
            </View>
            {/* Day-trip (0 nights) gets distinct copy; otherwise show pluralised night count.
                Codex audit P1.2. */}
            {nights != null ? (
              <Eyebrow style={{ color: t.accent, opacity: 1 }}>
                {nights === 0 ? 'Day trip' : nights === 1 ? '1 night' : `${nights} nights`}
              </Eyebrow>
            ) : null}
          </View>

          {/* ============ TRIP TYPE ============ */}
          <View style={{ gap: 10 }}>
            <Eyebrow>Trip type</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TRIP_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={type}
                  active={tripTypes.includes(type)}
                  onPress={() => toggleTripType(type)}
                />
              ))}
            </View>
            <Caption>Multi-select. Shapes what we recommend packing.</Caption>
          </View>

          {/* ============ WEATHER CONTEXT ============ */}
          {/* Weather card intentionally not rendered. The previous version
              hardcoded "18–24° · Mostly sunny · 1 day rain" for every
              destination, which is worse than no forecast at all — a user
              packing for Reykjavik in January would be misled into leaving
              their coat at home. The card returns once a real weather
              provider is wired (TODO: M-weather wave). */}

          {/* ============ CTA ============ */}
          <Button
            label="Build my capsule"
            variant="accent"
            block
            disabled={!canContinue}
            onPress={() => nav.navigate('TravelMustHaves')}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ============ CUSTOM DATE SHEET ============ */}
      <DatePickerSheet
        visible={customPickerFor !== null}
        title={customPickerFor === 'from' ? 'Start date' : 'End date'}
        // For the end-date picker, prevent picking before the start date so the user can't
        // build an inverted range. From-date has no minimum.
        minISO={customPickerFor === 'to' ? fromDate || undefined : undefined}
        initialISO={customPickerFor === 'from' ? fromDate || undefined : toDate || undefined}
        onClose={() => setCustomPickerFor(null)}
        onConfirm={onCustomConfirm}
      />
    </SafeAreaView>
  );
}

// ---------- DatePickerSheet — inline mini-calendar modal ----------
//
// Bottom-sheet style modal: scrim backdrop closes on tap, inner sheet captures taps via
// `onStartShouldSetResponder` (no empty `onPress` handler). Month nav arrows + day grid match
// the MonthCalendarScreen vocabulary so the visual rhythm is consistent.
//
// `minISO` (optional) — dates strictly before this are non-pickable. Used by the "To" picker to
// prevent end < start. `initialISO` (optional) — opens at that month, with that date staged.

function DatePickerSheet({
  visible,
  title,
  initialISO,
  minISO,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  initialISO?: string;
  minISO?: string;
  onClose: () => void;
  onConfirm: (iso: string) => void;
}) {
  const t = useTokens();
  const today = React.useMemo(() => startOfDay(new Date()), []);

  const initialDate = React.useMemo(() => {
    const parsed = initialISO ? parseISODate(initialISO) : null;
    return parsed ?? today;
  }, [initialISO, today]);

  const [year, setYear] = React.useState(initialDate.getFullYear());
  const [month, setMonth] = React.useState(initialDate.getMonth());
  const [staged, setStaged] = React.useState<Date>(initialDate);

  // Re-anchor on each open so re-opening with a different `initialISO` doesn't show a stale month.
  React.useEffect(() => {
    if (!visible) return;
    setYear(initialDate.getFullYear());
    setMonth(initialDate.getMonth());
    setStaged(initialDate);
  }, [visible, initialDate]);

  const minDate = React.useMemo(() => (minISO ? parseISODate(minISO) ?? null : null), [minISO]);

  const grid = React.useMemo(() => buildMonthGrid(year, month, today), [year, month, today]);
  const weekdays = React.useMemo(() => buildWeekdayHeaders(), []);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isDisabled = (cell: DayCell): boolean =>
    minDate ? cell.date.getTime() < minDate.getTime() : false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close date picker"
        onPress={onClose}
        style={[ds.backdrop, { backgroundColor: t.scrimBg }]}>
        {/* Inner sheet — claims the responder so taps inside it don't propagate to the backdrop. */}
        <View
          onStartShouldSetResponder={() => true}
          style={[ds.sheet, { backgroundColor: t.bg, borderColor: t.border }]}>
          {/* Header */}
          <View style={ds.header}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Pick a date</Eyebrow>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 20,
                  color: t.fg,
                  letterSpacing: -0.2,
                }}>
                {title}
              </Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Cancel" hitSlop={8}>
              <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2 }}>Cancel</Text>
            </Pressable>
          </View>

          {/* Month nav */}
          <View style={ds.monthNav}>
            <Pressable
              onPress={goPrev}
              accessibilityLabel="Previous month"
              hitSlop={8}
              style={({ pressed }) => [ds.navBtn, { borderColor: t.border, opacity: pressed ? 0.7 : 1 }]}>
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <ChevronIcon color={t.fg} size={14} />
              </View>
            </Pressable>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 16,
                color: t.fg,
                letterSpacing: -0.16,
              }}>
              {monthLabel}
            </Text>
            <Pressable
              onPress={goNext}
              accessibilityLabel="Next month"
              hitSlop={8}
              style={({ pressed }) => [ds.navBtn, { borderColor: t.border, opacity: pressed ? 0.7 : 1 }]}>
              <ChevronIcon color={t.fg} size={14} />
            </Pressable>
          </View>

          {/* Weekday header */}
          <View style={ds.weekRow}>
            {weekdays.map((wd, i) => (
              <View key={`${wd}-${i}`} style={ds.weekCell}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 9.5,
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
          <View style={ds.grid}>
            {grid.map((cell) => {
              const selected = sameDay(cell.date, staged);
              const disabled = isDisabled(cell);
              const baseColor = !cell.inMonth ? t.fg3 : t.fg;
              return (
                <Pressable
                  key={cell.iso}
                  onPress={() => {
                    if (disabled) return;
                    setStaged(cell.date);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={cell.date.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                  disabled={disabled}
                  style={({ pressed }) => [
                    ds.cell,
                    { opacity: disabled ? 0.3 : pressed ? 0.7 : 1 },
                  ]}>
                  <View
                    style={[
                      ds.cellPill,
                      selected
                        ? { backgroundColor: t.fg }
                        : cell.isToday
                        ? { backgroundColor: t.accentSoft, borderWidth: 1, borderColor: t.accent }
                        : null,
                    ]}>
                    <Text
                      style={{
                        fontFamily: selected || cell.isToday ? fonts.displayMedium : fonts.uiMed,
                        fontStyle: selected || cell.isToday ? 'italic' : 'normal',
                        fontSize: selected || cell.isToday ? 14 : 13,
                        color: selected ? t.bg : cell.isToday ? t.accent : baseColor,
                        opacity: !cell.inMonth ? 0.45 : 1,
                      }}>
                      {cell.dayNum}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Confirm */}
          <View style={{ marginTop: 14 }}>
            <Button label="Done" block onPress={() => onConfirm(localISO(staged))} />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  stepChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  input: {
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

const ds = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
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
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPill: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
