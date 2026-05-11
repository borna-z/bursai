// TravelCapsuleScreen — custom date picker sheet (N13 split).
//
// Bottom-sheet style modal: scrim backdrop closes on tap, inner sheet
// captures taps via `onStartShouldSetResponder`. Month nav arrows + day
// grid match MonthCalendarScreen's vocabulary so the visual rhythm is
// consistent.
//
// `minISO` (optional) — dates strictly before this are non-pickable. Used
// by the "To" picker to prevent end < start.
// `initialISO` (optional) — opens at that month, with that date staged.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Button } from '../components/Button';
import { ChevronIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import {
  buildMonthGrid,
  buildWeekdayHeaders,
  localISO,
  parseISODate,
  sameDay,
  startOfDay,
  type DayCell,
} from './TravelCapsuleScreen.helpers';

export function DatePickerSheet({
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

  // Re-anchor on each open so re-opening with a different `initialISO`
  // doesn't show a stale month.
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
            <Pressable onPress={onClose} accessibilityLabel={tr('common.cancel')} hitSlop={8}>
              <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2 }}>{tr('common.cancel')}</Text>
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
