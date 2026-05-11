// HomeScreen — "This week" mini-strip + action buttons (N13 split).
//
// Renders the 7-day MiniWeek pills plus the wear-today / restyle / add CTA
// row. The 7-day window data comes from the parent via the `days` prop;
// this file is presentational.

import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Button } from '../components/Button';
import { t as tr } from '../lib/i18n';
import type { WeekDay } from './HomeScreen.helpers';

export type ThisWeekSectionProps = {
  days: WeekDay[];
  canWearToday: boolean;
  wearTodayPending: boolean;
  onPlanTap: () => void;
  onWearToday: () => void;
  onRestyle: () => void;
  onAdd: () => void;
};

export function ThisWeekSection({
  days,
  canWearToday,
  wearTodayPending,
  onPlanTap,
  onWearToday,
  onRestyle,
  onAdd,
}: ThisWeekSectionProps) {
  const t = useTokens();
  return (
    <View>
      <View style={s.sectionHead}>
        <Text style={[s.sectionTitle, { color: t.fg, fontFamily: fonts.displayMedium }]}>{tr('home.section.thisWeek')}</Text>
        <Pressable onPress={onPlanTap} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ color: t.accent, fontSize: 12, fontWeight: '500', fontFamily: fonts.uiMed }}>{tr('home.thisWeek.calendarLink')}</Text>
        </Pressable>
      </View>
      <MiniWeek days={days} onPress={onPlanTap} />
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
        <Button
          label={tr('home.thisWeek.wearToday')}
          size="sm"
          onPress={onWearToday}
          block
          style={{ flex: 1 }}
          disabled={!canWearToday || wearTodayPending}
        />
        <Button label={tr('home.thisWeek.restyle')} variant="outline" size="sm" onPress={onRestyle} />
        <Button label={tr('home.thisWeek.add')} variant="outline" size="sm" onPress={onAdd} />
      </View>
    </View>
  );
}

function MiniWeek({ days, onPress }: { days: WeekDay[]; onPress: () => void }) {
  const t = useTokens();
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {days.map((day) => {
        const dotColor = day.dot ? t.accent : day.active ? t.bg : t.fg3;
        return (
          <Pressable
            key={day.iso}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${day.dow} ${day.n}${day.dot ? ', planned' : ''}`}
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

const s = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 19, fontStyle: 'italic', fontWeight: '500', letterSpacing: -0.19 },
  miniDay: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
});
