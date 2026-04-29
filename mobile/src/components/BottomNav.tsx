// Floating dark capsule pill at the bottom of every tab screen.
// 4 tabs (Today · Wardrobe · Plan · Insights) with a centered gold-gradient (+) FAB between Wardrobe and Plan.
// Active tab pill: solid charcoal in light, expanded to show label.
// Inactive: transparent, 0.5 opacity.
// CSS source of truth: design_handoff_burs_rn/source/styles.css `.floating-nav` / `.fnav-*`.

import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { HomeIcon, WardrobeIcon, PlanIcon, InsightsIcon, PlusIcon, type IconProps } from './icons';

export type TabId = 'today' | 'wardrobe' | 'plan' | 'insights';

type TabDef = { id: TabId; label: string; Icon: React.ComponentType<IconProps> };

const TABS_LEFT: TabDef[] = [
  { id: 'today',    label: 'Today',    Icon: HomeIcon },
  { id: 'wardrobe', label: 'Wardrobe', Icon: WardrobeIcon },
];
const TABS_RIGHT: TabDef[] = [
  { id: 'plan',     label: 'Plan',     Icon: PlanIcon },
  { id: 'insights', label: 'Insights', Icon: InsightsIcon },
];

export function BottomNav({
  active,
  onTab,
  onAdd,
}: {
  active: TabId;
  onTab: (id: TabId) => void;
  onAdd: () => void;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();

  // Pill background — translucent over the screen content.
  const pillBg = t.card;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) + 14 }]}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: pillBg,
            borderColor: t.border,
            shadowColor: t.shadow.color,
            shadowOpacity: t.shadow.opacity,
            shadowRadius: t.shadow.radius,
            shadowOffset: t.shadow.offset,
          },
        ]}>
        {TABS_LEFT.map((tab) => (
          <TabBtn key={tab.id} tab={tab} active={active === tab.id} onPress={() => onTab(tab.id)} />
        ))}
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add"
          style={({ pressed }) => [
            styles.fab,
            { transform: pressed ? [{ scale: 0.95 }] : [] },
          ]}>
          <LinearGradient
            colors={[t.accent, t.accentDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <PlusIcon color={t.accentFg} size={18} />
        </Pressable>
        {TABS_RIGHT.map((tab) => (
          <TabBtn key={tab.id} tab={tab} active={active === tab.id} onPress={() => onTab(tab.id)} />
        ))}
      </View>
    </View>
  );
}

function TabBtn({ tab, active, onPress }: { tab: TabDef; active: boolean; onPress: () => void }) {
  const t = useTokens();
  const Icon = tab.Icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      style={({ pressed }) => [
        styles.tab,
        active && { backgroundColor: t.fg, paddingHorizontal: 14 },
        { opacity: pressed ? 0.7 : active ? 1 : 0.5 },
      ]}>
      <Icon active={active} color={active ? t.bg : t.fg} />
      {active && (
        <Text style={[styles.label, { color: t.bg, fontFamily: fonts.uiSemi }]}>{tab.label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    elevation: 12,
  },
  tab: {
    height: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: -0.13,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
});
