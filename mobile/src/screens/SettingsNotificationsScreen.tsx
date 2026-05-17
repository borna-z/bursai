// Settings · Notifications — toggle which notifications BURS sends.
// M30: bound to real `profiles.notification_prefs` via useNotificationPrefs +
// useUpdateNotificationPrefs. Permission state surfaced as a banner that
// links into iOS Settings when the OS has denied access.

import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';

import { log } from '../lib/log';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import { BackIcon } from '../components/icons';
import { t as translate } from '../lib/i18n';
import {
  DEFAULT_NOTIFICATION_PREFS,
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  type NotificationPrefKey,
} from '../hooks/usePushNotifications';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Static row configuration — title / caption come from i18n at render time so
// language changes pick up without a remount.
type RowConfig = {
  key: NotificationPrefKey;
  titleKey: string;
  captionKey: string;
};

const ROWS: RowConfig[] = [
  {
    key: 'daily',
    titleKey: 'settingsNotifications.daily.label',
    captionKey: 'settingsNotifications.daily.body',
  },
  {
    key: 'new_outfit',
    titleKey: 'settingsNotifications.newOutfit.label',
    captionKey: 'settingsNotifications.newOutfit.body',
  },
  {
    key: 'reminders',
    titleKey: 'settingsNotifications.reminders.label',
    captionKey: 'settingsNotifications.reminders.body',
  },
];

export function SettingsNotificationsScreen() {
  const tokens = useTokens();
  const nav = useNavigation<Nav>();

  const { data: prefs } = useNotificationPrefs();
  const updatePref = useUpdateNotificationPrefs();

  // Permission state — read once on mount, then again on any OS resume so a
  // user who flipped the toggle in iOS Settings sees the banner update.
  // expo-notifications doesn't expose a permission-change subscription, so
  // we re-poll on focus via a navigation listener.
  const [permission, setPermission] =
    React.useState<Notifications.PermissionStatus>(
      Notifications.PermissionStatus.UNDETERMINED,
    );
  React.useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await Notifications.getPermissionsAsync();
        if (!cancelled) setPermission(result.status);
      } catch (err) {
        log.error(err, { context: 'SettingsNotificationsScreen.get_permissions_failed' });
        // Ignore — surface as undetermined.
      }
    };
    void refresh();
    const unsub = nav.addListener('focus', () => {
      void refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [nav]);

  const effective = prefs ?? DEFAULT_NOTIFICATION_PREFS;
  const permissionDenied = permission === Notifications.PermissionStatus.DENIED;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <IconBtn ariaLabel={translate('common.back')} onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={tokens.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{translate('settings.notifications.headerEyebrow')}</Eyebrow>
            <PageTitle>{translate('settings.notifications.headerTitle')}</PageTitle>
          </View>
        </View>

        <Caption>{translate('settingsNotifications.permissionsRequest')}</Caption>

        {permissionDenied ? (
          <View
            style={[
              s.banner,
              { backgroundColor: tokens.accentSoft, borderColor: tokens.border },
            ]}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 13,
                color: tokens.fg,
                marginBottom: 4,
              }}>
              {translate('settingsNotifications.permissionsDenied.title')}
            </Text>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: 12,
                color: tokens.fg2,
                lineHeight: 16,
                marginBottom: 10,
              }}>
              {translate('settingsNotifications.permissionsDenied.body')}
            </Text>
            <Pressable
              onPress={() => {
                void Linking.openSettings();
              }}
              style={({ pressed }) => [
                s.bannerCta,
                { borderColor: tokens.border, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 12.5,
                  color: tokens.fg,
                }}>
                {translate('settingsNotifications.permissionsDenied.openSettings')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ============ TOGGLES ============ */}
        <Card padding={4}>
          {ROWS.map((row, i) => (
            <SettingsRow
              key={row.key}
              title={translate(row.titleKey)}
              caption={translate(row.captionKey)}
              toggle={{
                value: effective[row.key],
                onValueChange: (value) => {
                  updatePref.mutate({ key: row.key, value });
                },
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
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  bannerCta: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
