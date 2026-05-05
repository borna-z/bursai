// Settings · Privacy & data — info card + actions for export, reset memory, delete.
// Mirrors design_handoff_burs_rn/source/audit-screens.jsx SettingsPrivacyScreen.

import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import { BackIcon, FileIcon, RotateIcon, TrashIcon, ShieldIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsPrivacyScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

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
            <PageTitle>Privacy & data</PageTitle>
          </View>
        </View>

        {/* ============ INFO CARD ============ */}
        <Card hero padding={18}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: t.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <ShieldIcon size={22} color={t.accent} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Eyebrow>Your data</Eyebrow>
              <Caption>
                BURS keeps your wardrobe and style data private. You can export, reset, or delete it
                at any time.
              </Caption>
              <Button
                label="Read privacy policy"
                variant="quiet"
                size="sm"
                onPress={() =>
                  Alert.alert('Privacy policy', 'Visit burs.me/privacy to read the full policy.')
                }
                style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
              />
            </View>
          </View>
        </Card>

        {/* ============ ACTIONS ============ */}
        <Card padding={4}>
          <SettingsRow
            icon={<FileIcon size={18} color={t.accent} />}
            title="Export all my data"
            caption="Get a ZIP archive of everything"
            onPress={() =>
              Alert.alert('Export', 'Your data export will be emailed to you.')
            }
          />
          <SettingsRow
            icon={<RotateIcon size={18} color={t.accent} />}
            title="Reset style memory"
            caption="Clears learned preferences only"
            onPress={() =>
              Alert.alert(
                'Reset style memory',
                'BURS will forget what it has learned about you. Your wardrobe and outfits stay.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: () => Alert.alert('Reset', 'Style memory cleared.'),
                  },
                ],
              )
            }
          />
          <SettingsRow
            icon={<TrashIcon size={18} color={t.destructive} />}
            title="Delete account"
            caption="Permanently removes all data"
            destructive
            last
            onPress={() =>
              Alert.alert(
                'Delete account',
                'This permanently removes your wardrobe, outfits, and learned style. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () =>
                      Alert.alert(
                        'Account deletion requested',
                        'Your account will be removed within 30 days.',
                      ),
                  },
                ],
              )
            }
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
});
