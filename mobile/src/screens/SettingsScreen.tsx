// Settings hub. Mirrors design_handoff_burs_rn/source/extra-screens.jsx SettingsScreen
// — subscription card up top, then grouped sections rendered as Card-wrapped SettingsRow
// stacks. Sign out button at the bottom.

import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import { useAuth } from '../hooks/useAuth';
import { useResetStyleMemory } from '../hooks/useResetStyleMemory';
import { useStyleDNA } from '../hooks/useStyleDNA';
import { useWardrobeStats } from '../hooks/useWardrobeStats';
import { t as tr, getLocale, type Locale } from '../lib/i18n';
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

// Source of truth is app.json → expo.version. Reading via expo-constants keeps
// the displayed version in lock-step with the binary that ships, so we don't
// drift back into hardcoded mismatches when the version bumps.
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// Endonyms for the language row's value column. Showing each language in its
// own script + capitalisation matches platform conventions (iOS Settings ▸
// Language uses the same convention) and avoids the "Swedish" label appearing
// for a user who has the device set to Swedish.
const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  sv: 'Svenska',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  ar: 'العربية',
  fa: 'فارسی',
  pl: 'Polski',
  pt: 'Português',
};

export function SettingsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { user, profile, signOut } = useAuth();
  const resetMemory = useResetStyleMemory();
  const [resetOpen, setResetOpen] = useState(false);
  // M29 — wardrobe-count badge below the header. Reads from the same
  // bundled HEAD-count hook used by ProfileScreen so cache hits across
  // the two screens (1-min staleTime) — opening Settings right after
  // Profile shouldn't refetch.
  const { data: wardrobeStats } = useWardrobeStats();
  // Style profile row caption — show real archetype + first vibe so the
  // row reflects the user's actual DNA instead of the previously
  // hardcoded "Quiet luxe · Earth tones" placeholder. Hides the caption
  // when the DNA hasn't resolved or has no archetype yet.
  const { data: styleDNA } = useStyleDNA();
  const styleProfileCaption = (() => {
    if (!styleDNA) return undefined;
    const parts = [styleDNA.archetype];
    if (styleDNA.vibes.length > 0) parts.push(styleDNA.vibes[0]);
    const joined = parts.filter(Boolean).join(' · ').trim();
    return joined.length > 0 ? joined : undefined;
  })();

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? tr('settings.profile.fallbackName');
  const accountEmail = user?.email ?? '';
  const initial = (displayName.trim().charAt(0) || 'U').toUpperCase();

  const handleConfirmReset = () => {
    resetMemory.mutate(undefined, {
      onSuccess: () => {
        setResetOpen(false);
        Alert.alert(
          tr('settings.reset_memory.success.title'),
          tr('settings.reset_memory.success.body'),
        );
      },
      onError: (err) => {
        setResetOpen(false);
        Alert.alert(
          tr('settings.reset_memory.title'),
          err instanceof Error ? err.message : tr('settings.reset_memory.error'),
        );
      },
    });
  };

  const handleSignOut = () => {
    Alert.alert(tr('settings.signOut.confirm.title'), tr('settings.signOut.confirm.body'), [
      { text: tr('common.cancel'), style: 'cancel' },
      {
        text: tr('settings.signOut.label'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          // Local state cleared in signOut(); reset the stack so the user can't
          // back-button their way into a still-mounted authenticated screen.
          nav.reset({ index: 0, routes: [{ name: 'Auth' }] });
        },
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
            <Eyebrow style={{ marginBottom: 4 }}>{tr('settings.header.eyebrow')}</Eyebrow>
            <PageTitle>{tr('settings.header.title')}</PageTitle>
            {/* M29 — wardrobe-count badge. Quiet caption below the title;
                hidden until the count resolves (no skeleton in this slot
                because the page itself doesn't block on the query). */}
            {wardrobeStats && wardrobeStats.garmentCount > 0 ? (
              <Caption style={{ marginTop: 4 }}>
                {tr('settings.wardrobeBadgeTemplate', { count: wardrobeStats.garmentCount })}
              </Caption>
            ) : null}
          </View>
          <IconBtn
            ariaLabel={tr('settings.profile.aria')}
            onPress={() => nav.navigate('Profile')}
            style={{ backgroundColor: t.accent, borderColor: 'transparent' }}>
            <Text style={{ color: t.accentFg, fontFamily: fonts.uiSemi, fontSize: 14, fontWeight: '600' }}>
              {initial}
            </Text>
          </IconBtn>
        </View>

        {/* ============ SUBSCRIPTION CARD ============ */}
        {/* Intentionally not rendered. The mock card hardcoded a "Premium · 3-day
            trial · 2 days remaining · renews automatically" state regardless of
            the actual user — actively misleading. The profiles table has no
            subscription columns yet, so we have nothing honest to show.
            M31 (RevenueCat) wires real billing; the card returns then with
            real entitlement state from the RC customer info. */}

        {/* ============ PROFILE SECTION ============ */}
        <Section title={tr('settings.section.profile')}>
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
                  {initial}
                </Text>
              </View>
            }
            title={displayName}
            caption={accountEmail || undefined}
            onPress={() => nav.navigate('Profile')}
          />
          <SettingsRow
            icon={<GlobeIcon size={18} color={t.accent} />}
            title={tr('settings.row.language')}
            value={LOCALE_LABELS[getLocale()] ?? LOCALE_LABELS.en}
            last
            onPress={() =>
              Alert.alert(tr('settings.languageAlert.title'), tr('settings.languageAlert.body'))
            }
          />
        </Section>

        {/* ============ STYLE SECTION ============ */}
        <Section title={tr('settings.section.style')}>
          <SettingsRow
            icon={<TshirtIcon size={18} color={t.accent} />}
            title={tr('settings.row.styleProfile')}
            caption={styleProfileCaption}
            onPress={() => nav.navigate('SettingsStyle')}
          />
          <SettingsRow
            icon={<TrashIcon size={18} color={t.destructive} />}
            title={tr('settings.row.resetMemory')}
            caption={tr('settings.row.resetMemory.caption')}
            destructive
            last
            onPress={() => setResetOpen(true)}
          />
        </Section>

        {/* ============ APP SECTION ============ */}
        <Section title={tr('settings.section.app')}>
          <SettingsRow
            icon={<PaletteIcon size={18} color={t.accent} />}
            title={tr('settings.row.appearance')}
            value={tr('settings.row.appearance.value')}
            onPress={() => nav.navigate('SettingsAppearance')}
          />
          <SettingsRow
            icon={<BellIcon size={18} color={t.accent} />}
            title={tr('settings.row.notifications')}
            caption={tr('settings.row.notifications.caption')}
            last
            onPress={() => nav.navigate('SettingsNotifications')}
          />
        </Section>

        {/* ============ ACCOUNT & DATA ============ */}
        <Section title={tr('settings.section.accountData')}>
          <SettingsRow
            icon={<GearIcon size={18} color={t.accent} />}
            title={tr('settings.row.account')}
            caption={tr('settings.row.account.caption')}
            onPress={() => nav.navigate('SettingsAccount')}
          />
          <SettingsRow
            icon={<LockIcon size={18} color={t.accent} />}
            title={tr('settings.row.privacy')}
            caption={tr('settings.row.privacy.caption')}
            last
            onPress={() => nav.navigate('SettingsPrivacy')}
          />
        </Section>

        {/* ============ LEGAL SECTION ============ */}
        <Section title={tr('settings.section.legal')}>
          <SettingsRow
            icon={<ShieldIcon size={18} color={t.accent} />}
            title={tr('settings.row.privacyPolicy')}
            onPress={() => Linking.openURL('https://burs.me/privacy')}
          />
          <SettingsRow
            icon={<FileIcon size={18} color={t.accent} />}
            title={tr('settings.row.terms')}
            onPress={() => Linking.openURL('https://burs.me/terms')}
          />
          <SettingsRow
            icon={<MailIcon size={18} color={t.accent} />}
            title={tr('settings.row.appVersion')}
            value={APP_VERSION}
            hideChevron
            last
          />
        </Section>

        {/* ============ SIGN OUT ============ */}
        <View style={{ marginTop: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('settings.signOut.label')}
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
              {tr('settings.signOut.label')}
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
            {tr('settings.footer', { version: APP_VERSION })}
          </Text>
        </View>
      </ScrollView>

      <TypedConfirmModal
        open={resetOpen}
        title={tr('settings.reset_memory.title')}
        body={tr('settings.reset_memory.body')}
        requiredText={tr('settings.reset_memory.required')}
        confirmLabel={tr('settings.reset_memory.confirm')}
        destructive
        isPending={resetMemory.isPending}
        onConfirm={handleConfirmReset}
        onCancel={() => setResetOpen(false)}
      />
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
