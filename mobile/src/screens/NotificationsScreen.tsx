// Notifications inbox. Backed by the `notifications` table via
// `useNotifications` (M41). Empty / loading / error states all live here so
// the screen behaves correctly regardless of network conditions on first
// open. Mirrors design_handoff_burs_rn/source/extra-screens.jsx
// NotificationsScreen.

import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { IconBtn } from '../components/IconBtn';
import { Button } from '../components/Button';
import {
  BackIcon,
  BellIcon,
  SunIcon,
  SparklesIcon,
  TshirtIcon,
  CalendarIcon,
  OutfitsIcon,
  type IconProps,
} from '../components/icons';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type NotificationKind,
  type NotificationRow,
} from '../hooks/useNotifications';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// React.ReactElement is portable across `jsx: react-native` and `jsx: react-jsx` configs;
// the bare `JSX.Element` global goes away under react-jsx. Codex audit P3.4.
const KIND_ICON: Record<string, (props: IconProps) => React.ReactElement> = {
  weather: (p) => <SunIcon {...p} />,
  outfit: (p) => <SparklesIcon {...p} />,
  wear: (p) => <TshirtIcon {...p} />,
  plan: (p) => <CalendarIcon {...p} />,
  saved: (p) => <OutfitsIcon {...p} />,
};

const FALLBACK_ICON = (p: IconProps) => <BellIcon {...p} />;

function iconForKind(kind: NotificationKind): (props: IconProps) => React.ReactElement {
  return KIND_ICON[kind] ?? FALLBACK_ICON;
}

/**
 * Render a created_at timestamp as "Just now" / "5m ago" / "3h ago" / "2d ago".
 * Beyond seven days we fall back to a localized date string so the row stays
 * scannable without growing more i18n keys.
 */
function formatRelativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diffMs = Math.max(0, now - t);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return tr('notifications.time.justNow');
  if (minutes < 60) return tr('notifications.time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tr('notifications.time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return tr('notifications.time.daysAgo', { count: days });
  // Beyond a week — locale-formatted date.
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}

export function NotificationsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const notificationsQ = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items: NotificationRow[] = notificationsQ.data ?? [];
  const hasUnread = items.some((n) => n.read_at == null);

  // Stable "now" anchor for relative-time labels — recomputed once per
  // render. We deliberately don't tick a timer every minute; the
  // user-visible labels only matter when the screen is focused, and a
  // pull-to-refresh re-renders the list anyway.
  const now = React.useMemo(() => Date.now(), [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = React.useCallback(() => {
    notificationsQ.refetch();
  }, [notificationsQ]);

  const onMarkAll = React.useCallback(() => {
    markAllRead.mutate();
  }, [markAllRead]);

  // Memoised so FlatList's ListHeaderComponent doesn't recompute on every state change.
  // Codex audit P1.5.
  const header = React.useMemo(
    () => (
      <View style={{ paddingHorizontal: 20, paddingBottom: 14, gap: 14 }}>
        <View style={s.headerRow}>
          <IconBtn ariaLabel={tr('common.back')} onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{tr('notifications.eyebrow')}</Eyebrow>
            <PageTitle>{tr('notifications.title')}</PageTitle>
          </View>
          {hasUnread ? (
            <Button
              label={tr('notifications.markAllRead')}
              variant="quiet"
              size="sm"
              onPress={onMarkAll}
              disabled={markAllRead.isPending}
            />
          ) : null}
        </View>
      </View>
    ),
    [hasUnread, markAllRead.isPending, nav, onMarkAll, t.fg],
  );

  // Memoised renderItem — preserves FlatList row memoisation. Codex audit P2.2.
  const renderItem = React.useCallback(
    ({ item }: { item: NotificationRow }) => {
      const Icon = iconForKind(item.type);
      const unread = item.read_at == null;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={() => {
            if (unread) markRead.mutate(item.id);
          }}
          style={({ pressed }) => [
            s.row,
            {
              backgroundColor: unread ? t.card : t.bg2,
              borderColor: t.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <View style={[s.rowIcon, { backgroundColor: t.accentSoft }]}>
            <Icon color={t.accent} size={18} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 13.5,
                color: t.fg,
                fontWeight: '600',
                letterSpacing: -0.13,
              }}
              numberOfLines={1}>
              {item.title}
            </Text>
            {item.body ? (
              <Text
                style={{ fontFamily: fonts.ui, fontSize: 12, color: t.fg2, lineHeight: 16 }}
                numberOfLines={2}>
                {item.body}
              </Text>
            ) : null}
            <Caption style={{ marginTop: 2 }}>{formatRelativeTime(item.created_at, now)}</Caption>
          </View>
          {unread ? <View style={[s.unreadDot, { backgroundColor: t.accent }]} /> : null}
        </Pressable>
      );
    },
    [markRead, now, t.accent, t.accentSoft, t.bg2, t.border, t.card, t.fg, t.fg2],
  );

  // Loading state — first fetch only. Subsequent refetches show the
  // existing data plus a RefreshControl spinner so the inbox doesn't blink.
  if (notificationsQ.isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // Error state — never silently empty. Keeps the header so back-nav still
  // works and surfaces a Caption + retry CTA.
  if (notificationsQ.isError) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={notificationsQ.isFetching}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
            />
          }
          showsVerticalScrollIndicator={false}>
          {header}
          <View style={s.emptyWrap}>
            <View
              style={[s.emptyIcon, { backgroundColor: t.accentSoft }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <BellIcon size={36} color={t.accent} />
            </View>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 26,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.26,
                textAlign: 'center',
                marginTop: 16,
              }}>
              {tr('notifications.error.title')}
            </Text>
            <Caption style={{ textAlign: 'center', marginTop: 6, maxWidth: 240 }}>
              {tr('notifications.error.body')}
            </Caption>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    // Empty state lives inside a ScrollView so Dynamic Type at 200% / small devices can
    // still scroll past the centered illustration. Codex audit P2.4.
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={notificationsQ.isFetching}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
            />
          }
          showsVerticalScrollIndicator={false}>
          {header}
          <View style={s.emptyWrap}>
            <View
              style={[s.emptyIcon, { backgroundColor: t.accentSoft }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <BellIcon size={36} color={t.accent} />
            </View>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 26,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.26,
                textAlign: 'center',
                marginTop: 16,
              }}>
              {tr('notifications.empty.title')}
            </Text>
            <Caption style={{ textAlign: 'center', marginTop: 6, maxWidth: 240 }}>
              {tr('notifications.empty.body')}
            </Caption>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={header}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={notificationsQ.isFetching}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent]}
          />
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
});
