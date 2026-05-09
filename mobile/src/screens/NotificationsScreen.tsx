// Notifications inbox. Empty state by default; switching to populated mock data is one
// line. Mirrors design_handoff_burs_rn/source/extra-screens.jsx NotificationsScreen.

import React from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useMockRefresh } from '../hooks/useMockRefresh';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type NotificationKind = 'weather' | 'outfit' | 'wear' | 'plan' | 'saved';

type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

// FIXTURES_TODO: replace with useNotifications() hook once the inbox stream lands.
// Toggle to a non-empty array to preview the populated path during dev. Codex audit P3.5.
const FIXTURES: Notification[] = [];

// React.ReactElement is portable across `jsx: react-native` and `jsx: react-jsx` configs;
// the bare `JSX.Element` global goes away under react-jsx. Codex audit P3.4.
const KIND_ICON: Record<NotificationKind, (props: IconProps) => React.ReactElement> = {
  weather: (p) => <SunIcon {...p} />,
  outfit: (p) => <SparklesIcon {...p} />,
  wear: (p) => <TshirtIcon {...p} />,
  plan: (p) => <CalendarIcon {...p} />,
  saved: (p) => <OutfitsIcon {...p} />,
};

export function NotificationsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [items, setItems] = React.useState<Notification[]>(FIXTURES);
  const { refreshing, onRefresh } = useMockRefresh();

  const hasUnread = items.some((n) => n.unread);

  const markAllRead = React.useCallback(
    () => setItems((prev) => prev.map((n) => ({ ...n, unread: false }))),
    [],
  );

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
            <Button label={tr('notifications.markAllRead')} variant="quiet" size="sm" onPress={markAllRead} />
          ) : null}
        </View>
      </View>
    ),
    [hasUnread, markAllRead, nav, t.fg],
  );

  // Memoised renderItem — preserves FlatList row memoisation. Codex audit P2.2.
  const renderItem = React.useCallback(
    ({ item }: { item: Notification }) => {
      const Icon = KIND_ICON[item.kind];
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={() => {
            setItems((prev) =>
              prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n)),
            );
          }}
          style={({ pressed }) => [
            s.row,
            {
              backgroundColor: item.unread ? t.card : t.bg2,
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
            <Text
              style={{ fontFamily: fonts.ui, fontSize: 12, color: t.fg2, lineHeight: 16 }}
              numberOfLines={2}>
              {item.body}
            </Text>
            <Caption style={{ marginTop: 2 }}>{item.time}</Caption>
          </View>
          {item.unread ? (
            <View style={[s.unreadDot, { backgroundColor: t.accent }]} />
          ) : null}
        </Pressable>
      );
    },
    [t.accent, t.accentSoft, t.bg2, t.border, t.card, t.fg, t.fg2],
  );

  if (items.length === 0) {
    // Empty state lives inside a ScrollView so Dynamic Type at 200% / small devices can
    // still scroll past the centered illustration. Codex audit P2.4.
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
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
