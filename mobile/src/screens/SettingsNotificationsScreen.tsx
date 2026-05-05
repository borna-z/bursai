// Settings · Notifications — toggle which notifications BURS sends.
// Mirrors design_handoff_burs_rn/source/audit-screens.jsx SettingsNotificationsScreen.

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import { BackIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ToggleKey =
  | 'dailyOutfit'
  | 'weeklyReport'
  | 'newFeatures'
  | 'promo';

type ToggleConfig = { key: ToggleKey; title: string; caption: string; defaultOn: boolean };

const ROWS: ToggleConfig[] = [
  { key: 'dailyOutfit',   title: 'Daily outfit reminder', caption: 'Get your daily look at 8am',  defaultOn: true },
  { key: 'weeklyReport',  title: 'Weekly style report',   caption: 'Every Monday morning',         defaultOn: true },
  { key: 'newFeatures',   title: 'New AI features',       caption: 'Be first to know',             defaultOn: false },
  { key: 'promo',         title: 'Promotional updates',   caption: 'Offers and news',              defaultOn: false },
];

export function SettingsNotificationsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const [state, setState] = React.useState<Record<ToggleKey, boolean>>(() =>
    ROWS.reduce(
      (acc, row) => {
        acc[row.key] = row.defaultOn;
        return acc;
      },
      {} as Record<ToggleKey, boolean>,
    ),
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Settings</Eyebrow>
            <PageTitle>Notifications</PageTitle>
          </View>
        </View>

        <Caption>What you&rsquo;d like BURS to ping you about.</Caption>

        {/* ============ TOGGLES ============ */}
        <Card padding={4}>
          {ROWS.map((row, i) => (
            <SettingsRow
              key={row.key}
              title={row.title}
              caption={row.caption}
              toggle={{
                value: state[row.key],
                onValueChange: (v) => setState((prev) => ({ ...prev, [row.key]: v })),
              }}
              last={i === ROWS.length - 1}
            />
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
});
