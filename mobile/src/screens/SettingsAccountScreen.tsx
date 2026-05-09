// Settings · Account — profile card + account fields + connected accounts + delete.
// Mirrors design_handoff_burs_rn/source/audit-screens.jsx SettingsAccountScreen.

import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { hapticLight } from '../lib/haptics';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import { BackIcon, MailIcon, KeyIcon, GlobeIcon, FileIcon, TrashIcon, RotateIcon, CalendarIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import { useRestorePurchases } from '../hooks/useRestorePurchases';
import { useCalendarSync } from '../hooks/useCalendarSync';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsAccountScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { user, profile } = useAuth();
  const deleteAccount = useDeleteAccount();
  const restore = useRestorePurchases();
  const calendar = useCalendarSync();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // M36 — Connect / Disconnect Google Calendar. Connect opens the Google
  // consent screen in the system browser; the deep-link callback finishes
  // the exchange in RootNavigator. Disconnect prompts for confirmation
  // because losing the token also wipes synced `calendar_events` server-
  // side, which the user cannot recover without re-authorizing.
  const handleCalendarPress = () => {
    if (calendar.isLoadingConnection || calendar.isDisconnecting) return;
    hapticLight();
    if (calendar.isConnected) {
      Alert.alert(
        tr('settings.calendar.disconnect.title'),
        tr('settings.calendar.disconnect.body'),
        [
          { text: tr('common.cancel'), style: 'cancel' },
          {
            text: tr('settings.calendar.disconnect.confirm'),
            style: 'destructive',
            onPress: () => {
              calendar.disconnectGoogle().catch(() => {
                Alert.alert(
                  tr('settings.calendar.error.title'),
                  tr('settings.calendar.error.body'),
                );
              });
            },
          },
        ],
      );
      return;
    }
    void calendar.connectGoogle();
  };

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? tr('settings.profile.fallbackName');
  const email = user?.email ?? '';
  const initial = (displayName.trim().charAt(0) || 'U').toUpperCase();

  // Real provider list straight from the JWT. `app_metadata.providers` is the
  // canonical Supabase shape (string[]); 'email' shows up alongside any OAuth
  // providers the user has linked. We surface the comma-joined Title-Case
  // names so a user who signed up with email-only no longer sees a hardcoded
  // "Google" label they never connected.
  const connectedProviders = useMemo<string[]>(() => {
    const raw = (user?.app_metadata as { providers?: unknown } | undefined)?.providers;
    if (!Array.isArray(raw)) return [];
    return raw.filter((p): p is string => typeof p === 'string' && p.length > 0);
  }, [user?.app_metadata]);
  const connectedLabel = connectedProviders
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(', ');

  // Support contact lives at support@<project domain>. Compose a mailto so the
  // dead-end "contact support" Alert at least surfaces the address (and opens
  // the user's mail client when possible).
  const SUPPORT_EMAIL = 'support@burs.me';
  const handleEmailRowPress = () => {
    Alert.alert(
      tr('settings.account.email.alert.title'),
      tr('settings.account.email.alert.body', { email: SUPPORT_EMAIL }),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('settings.account.email.alert.action'),
          onPress: () => {
            void Linking.openURL(
              `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(tr('settings.account.email.subject'))}`,
            );
          },
        },
      ],
    );
  };

  const handleRestorePurchases = () => {
    if (restore.isPending) return;
    hapticLight();
    restore.mutate(undefined, {
      onSuccess: (result) => {
        if (result.status === 'restored') {
          // Settings stays mounted — no nav.goBack() (unlike the paywall
          // path) since the user is already on a non-modal account screen
          // and may want to verify the change in-place.
          Alert.alert(
            tr('paywall.restored'),
            tr('paywall.restored.body'),
            [{ text: tr('paywall.restore.alertOk') }],
          );
          return;
        }
        if (result.status === 'restored_pending') {
          // RevenueCat confirmed entitlements but the webhook hasn't
          // mirrored them into the `subscriptions` row within the 10s
          // poll window. Mirror the purchase 'pending' UX so the user
          // sees "activating" rather than a misleading success that
          // leaves them still gated.
          Alert.alert(
            tr('paywall.activating.title'),
            tr('paywall.activating.body'),
            [{ text: tr('paywall.restore.alertOk') }],
          );
          return;
        }
        // 'no_purchases' (legitimate empty state) and 'unsupported'
        // (web / simulator / missing API key, or sign-out-mid-flight
        // short-circuit) collapse to the same alert. Real transport
        // errors land in onError instead.
        Alert.alert(
          tr('paywall.restoreNoPurchases.title'),
          tr('paywall.restoreNoPurchases.body'),
          [{ text: tr('paywall.restore.alertOk') }],
        );
      },
      onError: () => {
        // Real SDK / network failures (revenuecat wrapper re-throws
        // after Sentry-capture). Restore-specific copy avoids the
        // "try again or restore previous purchases" loop that the
        // generic purchase-error key would create here.
        Alert.alert(
          tr('paywall.restoreError.title'),
          tr('paywall.restoreError.body'),
        );
      },
    });
  };

  const handleConfirmDelete = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        setDeleteOpen(false);
        // Codex P1 round 5 on PR #735: AuthContext's SIGNED_OUT handler
        // clears auth + caches but does NOT reset the nav stack — the
        // protected Settings screens stay mounted unless the caller
        // explicitly resets. Drop straight back to the Auth flow so the
        // deleted user can't tap around their own residual UI.
        nav.reset({ index: 0, routes: [{ name: 'Auth' }] });
      },
      onError: (err) => {
        setDeleteOpen(false);
        Alert.alert(
          tr('settings.delete_account.title'),
          err instanceof Error
            ? err.message
            : tr('settings.delete_account.error'),
        );
      },
    });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <IconBtn ariaLabel={tr('common.back')} onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{tr('settings.account.headerEyebrow')}</Eyebrow>
            <PageTitle>{tr('settings.account.headerTitle')}</PageTitle>
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
                {initial}
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
                {displayName}
              </Text>
              <Caption>{email}</Caption>
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  hapticLight();
                  nav.navigate('SettingsProfileEdit');
                }}
                hitSlop={6}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 12,
                    color: t.accent,
                    marginTop: 4,
                    letterSpacing: -0.1,
                  }}>
                  {tr('settings.account.editPhoto')}
                </Text>
              </Pressable>
            </View>
          </View>
        </Card>

        {/* ============ ACCOUNT FIELDS ============ */}
        <View style={{ gap: 8 }}>
          <Eyebrow>{tr('settings.account.section.account')}</Eyebrow>
          <Card padding={4}>
            <SettingsRow
              title={tr('settings.account.row.fullName')}
              value={displayName}
              onPress={() => {
                // N3.9 — was Alert("Coming Soon") which App Review flagged
                // as a launch blocker. Now routes to the real editor.
                hapticLight();
                nav.navigate('SettingsProfileEdit');
              }}
            />
            <SettingsRow
              icon={<MailIcon size={18} color={t.accent} />}
              title={tr('settings.account.row.email')}
              value={email || tr('common.empty')}
              onPress={handleEmailRowPress}
            />
            <SettingsRow
              icon={<KeyIcon size={18} color={t.accent} />}
              title={tr('settings.account.row.changePassword')}
              last={connectedProviders.length === 0}
              onPress={() => nav.navigate('ResetPassword')}
            />
            {connectedProviders.length > 0 ? (
              <SettingsRow
                icon={<GlobeIcon size={18} color={t.accent} />}
                title={tr('settings.account.row.connected')}
                value={connectedLabel}
                last
                hideChevron
              />
            ) : null}
          </Card>
        </View>

        {/* ============ CALENDAR (M36) ============ */}
        {/* Single Connect / Disconnect row that flips its label + caption
            based on the `calendar_connections` row. Connecting opens the
            Google consent screen in the system browser; the deep-link
            callback (`burs://calendar/callback`) hands the auth code back
            to `google_calendar_auth` for the server-side token exchange. */}
        <View style={{ gap: 8 }}>
          <Eyebrow>{tr('settings.calendar.section')}</Eyebrow>
          <Card padding={4}>
            <SettingsRow
              icon={<CalendarIcon size={18} color={t.accent} />}
              title={
                calendar.isConnected
                  ? tr('settings.calendar.row.disconnect')
                  : tr('settings.calendar.row.connect')
              }
              caption={
                calendar.isConnected
                  ? tr('settings.calendar.row.connected.caption')
                  : tr('settings.calendar.row.connect.caption')
              }
              last
              onPress={handleCalendarPress}
            />
          </Card>
        </View>

        {/* SUBSCRIPTION — Apple 3.1.1 mandates a restore affordance
            discoverable outside the paywall (reinstall / device migration
            scenarios). Re-tap during pending is gated by the handler's
            `restore.isPending` early return; the broader subscription
            summary card (status / renewal date / manage link) ships in a
            post-launch hardening pass. */}
        <View style={{ gap: 8 }}>
          <Eyebrow>{tr('settings.account.section.subscription')}</Eyebrow>
          <Card padding={4}>
            <SettingsRow
              icon={<RotateIcon size={18} color={t.accent} />}
              title={tr('settings.account.row.restorePurchases')}
              caption={tr('settings.account.row.restorePurchases.caption')}
              last
              onPress={handleRestorePurchases}
            />
          </Card>
        </View>

        {/* ============ DATA ============ */}
        <View style={{ gap: 8 }}>
          <Eyebrow>{tr('settings.account.section.data')}</Eyebrow>
          <Card padding={4}>
            <SettingsRow
              icon={<FileIcon size={18} color={t.accent} />}
              title={tr('settings.account.row.export')}
              caption={tr('settings.account.row.export.caption')}
              onPress={() =>
                Alert.alert(
                  tr('settings.account.export.alert.title'),
                  tr('settings.account.export.alert.body'),
                )
              }
            />
            <SettingsRow
              icon={<TrashIcon size={18} color={t.destructive} />}
              title={tr('settings.account.row.delete')}
              caption={tr('settings.account.row.delete.caption')}
              destructive
              last
              onPress={() => setDeleteOpen(true)}
            />
          </Card>
        </View>
      </ScrollView>

      <TypedConfirmModal
        open={deleteOpen}
        title={tr('settings.delete_account.title')}
        body={tr('settings.delete_account.body')}
        requiredText={tr('settings.delete_account.required')}
        confirmLabel={tr('settings.delete_account.confirm')}
        destructive
        isPending={deleteAccount.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
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
