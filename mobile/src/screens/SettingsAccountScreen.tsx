// Settings · Account — profile card + account fields + connected accounts + delete.
// Mirrors design_handoff_burs_rn/source/audit-screens.jsx SettingsAccountScreen.

import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import { BackIcon, MailIcon, KeyIcon, GlobeIcon, FileIcon, TrashIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsAccountScreen() {
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
            <PageTitle>Account</PageTitle>
          </View>
        </View>

        {/* ============ PROFILE CARD ============ */}
        <Card hero padding={18}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={[
                s.avatar,
                { backgroundColor: t.accent },
              ]}>
              <Text style={{ color: t.accentFg, fontFamily: fonts.uiSemi, fontSize: 26, fontWeight: '600' }}>
                B
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 18,
                  fontWeight: '500',
                  color: t.fg,
                  letterSpacing: -0.18,
                }}>
                Borna Krneta
              </Text>
              <Caption>borna@example.com</Caption>
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  Alert.alert('Coming soon', 'Profile photo upload coming soon.')
                }
                hitSlop={6}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 12,
                    color: t.accent,
                    marginTop: 4,
                    letterSpacing: -0.1,
                  }}>
                  Edit photo
                </Text>
              </Pressable>
            </View>
          </View>
        </Card>

        {/* ============ ACCOUNT FIELDS ============ */}
        <View style={{ gap: 8 }}>
          <Eyebrow>Account</Eyebrow>
          <Card padding={4}>
            <SettingsRow
              title="Full name"
              value="Borna Krneta"
              onPress={() =>
                Alert.alert('Full name', 'Edit your name in Profile.')
              }
            />
            <SettingsRow
              icon={<MailIcon size={18} color={t.accent} />}
              title="Email"
              value="borna@example.com"
              onPress={() =>
                Alert.alert('Email', 'Contact support to change your email.')
              }
            />
            <SettingsRow
              icon={<KeyIcon size={18} color={t.accent} />}
              title="Change password"
              onPress={() => nav.navigate('ResetPassword')}
            />
            <SettingsRow
              icon={<GlobeIcon size={18} color={t.accent} />}
              title="Connected accounts"
              value="Google"
              last
              onPress={() =>
                Alert.alert('Coming soon', 'Google sign-in coming soon.')
              }
            />
          </Card>
        </View>

        {/* ============ DATA ============ */}
        <View style={{ gap: 8 }}>
          <Eyebrow>Data</Eyebrow>
          <Card padding={4}>
            <SettingsRow
              icon={<FileIcon size={18} color={t.accent} />}
              title="Export my data"
              caption="Get a copy as a ZIP archive"
              onPress={() =>
                Alert.alert('Export', 'Your data export will be emailed to you.')
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
