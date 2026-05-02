// Settings hub. Mirrors design_handoff_burs_rn/source/extra-screens.jsx SettingsScreen
// — subscription card up top, then grouped sections rendered as Card-wrapped SettingsRow
// stacks. Sign out button at the bottom.

import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { radii } from '../theme/tokens';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import {
  GlobeIcon,
  PaletteIcon,
  BellIcon,
  ShieldIcon,
  FileIcon,
  TshirtIcon,
  TrashIcon,
  MailIcon,
  GearIcon,
  LockIcon,
} from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const APP_VERSION = '2.0.4';

export function SettingsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const handleSignOut = () => {
    // CRITICAL: never tell the user "signed out" until the supabase-auth bridge actually
    // signs them out. A false success message is worse than the no-op it replaces — a user
    // on a shared device might walk away believing the session was cleared. Surface the
    // pending status instead so the action is honest.
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      // TODO: wire supabase.auth.signOut() once mobile auth bridge lands. Codex audit P3.8.
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Sign-out coming soon',
            'Mobile sign-out is not yet wired to your account. Use the web app to sign out for now.',
          ),
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Account</Eyebrow>
            <PageTitle>Settings</PageTitle>
          </View>
          <IconBtn
            ariaLabel="Profile"
            onPress={() => nav.navigate('Profile')}
            style={{ backgroundColor: t.accent, borderColor: 'transparent' }}>
            <Text style={{ color: t.accentFg, fontFamily: fonts.uiSemi, fontSize: 14, fontWeight: '600' }}>
              B
            </Text>
          </IconBtn>
        </View>

        {/* ============ SUBSCRIPTION CARD ============ */}
        <Card hero padding={18}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Eyebrow>Premium · 3-day trial</Eyebrow>
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 22,
                  fontWeight: '500',
                  color: t.fg,
                  letterSpacing: -0.22,
                }}>
                Free trial
              </Text>
              <Caption>2 days remaining · renews automatically</Caption>
            </View>
            <Button label="Manage" variant="outline" size="sm" onPress={() => nav.navigate('Paywall')} />
          </View>
        </Card>

        {/* ============ PROFILE SECTION ============ */}
        <Section title="Profile">
          <SettingsRow
            icon={
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: t.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ color: t.accentFg, fontFamily: fonts.uiSemi, fontSize: 12, fontWeight: '600' }}>
                  B
                </Text>
              </View>
            }
            title="Borna Krneta"
            caption="borna@example.com"
            onPress={() => nav.navigate('Profile')}
          />
          <SettingsRow
            icon={<GlobeIcon size={18} color={t.accent} />}
            title="Language"
            value="English"
            last
            onPress={() =>
              Alert.alert('Language', 'Change language in your style profile.')
            }
          />
        </Section>

        {/* ============ STYLE SECTION ============ */}
        <Section title="Style">
          <SettingsRow
            icon={<TshirtIcon size={18} color={t.accent} />}
            title="Style profile"
            caption="Quiet luxe · Earth tones"
            onPress={() => nav.navigate('SettingsStyle')}
          />
          <SettingsRow
            icon={<TrashIcon size={18} color={t.destructive} />}
            title="Reset style memory"
            caption="Clears learned preferences only"
            destructive
            last
            onPress={() =>
              Alert.alert(
                'Reset style memory',
                'This clears what BURS has learned about you. Your wardrobe and outfits are kept.',
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
        </Section>

        {/* ============ APP SECTION ============ */}
        <Section title="App">
          <SettingsRow
            icon={<PaletteIcon size={18} color={t.accent} />}
            title="Appearance"
            value="System"
            onPress={() => nav.navigate('SettingsAppearance')}
          />
          <SettingsRow
            icon={<BellIcon size={18} color={t.accent} />}
            title="Notifications"
            caption="Daily looks · weather · stylist"
            last
            onPress={() => nav.navigate('SettingsNotifications')}
          />
        </Section>

        {/* ============ ACCOUNT & DATA ============ */}
        <Section title="Account & data">
          <SettingsRow
            icon={<GearIcon size={18} color={t.accent} />}
            title="Account"
            caption="Email, password, connected accounts"
            onPress={() => nav.navigate('SettingsAccount')}
          />
          <SettingsRow
            icon={<LockIcon size={18} color={t.accent} />}
            title="Privacy & data"
            caption="Export, reset memory, delete account"
            last
            onPress={() => nav.navigate('SettingsPrivacy')}
          />
        </Section>

        {/* ============ LEGAL SECTION ============ */}
        <Section title="Legal">
          <SettingsRow
            icon={<ShieldIcon size={18} color={t.accent} />}
            title="Privacy policy"
            onPress={() => Linking.openURL('https://burs.me/privacy')}
          />
          <SettingsRow
            icon={<FileIcon size={18} color={t.accent} />}
            title="Terms of service"
            onPress={() => Linking.openURL('https://burs.me/terms')}
          />
          <SettingsRow
            icon={<MailIcon size={18} color={t.accent} />}
            title="App version"
            value={APP_VERSION}
            hideChevron
            last
          />
        </Section>

        {/* ============ SIGN OUT ============ */}
        <View style={{ marginTop: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={handleSignOut}
            style={({ pressed }) => [
              {
                height: 44,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: t.destructive,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 13, color: t.destructive, fontWeight: '600', letterSpacing: -0.13 }}>
              Sign out
            </Text>
          </Pressable>
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 11.5,
              color: t.fg3,
              textAlign: 'center',
              marginTop: 12,
              letterSpacing: 0.4,
            }}>
            BURS · {APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Eyebrow>{title}</Eyebrow>
      <Card padding={4}>{children}</Card>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
});
