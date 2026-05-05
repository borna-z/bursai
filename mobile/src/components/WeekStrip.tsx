// 7-day horizontal week grid — used by PlanScreen.
// Active day inverts fg/bg (charcoal cell, cream text). Gold dot marks days with a planned
// outfit; muted neutral dot otherwise. Mirrors design_handoff_burs_rn/source/styles.css
// `.week-strip` / `.week-day{,.active,.gold}` exactly.

import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

export type WeekDay = {
  /** Three-letter weekday — "MON". Caller is responsible for capitalisation. */
  dow: string;
  /** Day-of-month number. */
  n: number;
  /** Highlights this cell as today/active. */
  active?: boolean;
  /** True → gold dot (planned). False/missing → muted dot. */
  planned?: boolean;
  /** Optional ISO date the cell represents — passed to onPress for hydration. */
  iso?: string;
};

export function WeekStrip({
  days,
  onDayPress,
  style,
}: {
  days: WeekDay[];
  onDayPress?: (day: WeekDay) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  return (
    <View style={[{ flexDirection: 'row', gap: 6 }, style]}>
      {days.map((day, i) => {
        const isActive = !!day.active;
        const cellBg = isActive ? t.fg : t.card;
        const cellBorder = isActive ? t.fg : t.border;
        const dowColor = isActive ? t.bg : t.fg2;
        const dowOpacity = isActive ? 0.75 : 1;
        const numColor = isActive ? t.bg : t.fg;

        const dotBg = day.planned
          ? isActive ? t.bg : t.accent
          : isActive ? t.bg : t.fg3;
        const dotOpacity = day.planned ? 1 : 0.25;

        const Cell = (
          <View
            style={{
              flex: 1,
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              paddingTop: 8,
              paddingBottom: 10,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: cellBorder,
              backgroundColor: cellBg,
            }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 9.5,
                letterSpacing: 1.33,
                textTransform: 'uppercase',
                color: dowColor,
                opacity: dowOpacity,
              }}>
              {day.dow}
            </Text>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 16,
                fontWeight: '600',
                color: numColor,
                fontVariant: ['tabular-nums'],
              }}>
              {day.n}
            </Text>
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 4,
                backgroundColor: dotBg,
                opacity: dotOpacity,
              }}
            />
          </View>
        );

        if (!onDayPress) {
          return (
            <View key={day.iso ?? `${day.dow}-${i}`} style={{ flex: 1 }}>
              {Cell}
            </View>
          );
        }

        return (
          <Pressable
            key={day.iso ?? `${day.dow}-${i}`}
            accessibilityRole="button"
            accessibilityLabel={`${day.dow} ${day.n}${day.planned ? ', planned' : ''}`}
            onPress={() => onDayPress(day)}
            style={({ pressed }) => [
              { flex: 1, opacity: pressed ? 0.85 : 1 },
            ]}>
            {Cell}
          </Pressable>
        );
      })}
    </View>
  );
}
