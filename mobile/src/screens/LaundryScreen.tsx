// Laundry queue — list of garments currently in the wash, swipe-free for v1.
// Source: design_handoff_burs_rn/source/more-screens.jsx LaundryScreen (lines 522-570).
//
// Mock data only. "Mark clean" removes the row locally; "Mark all clean" empties the list.
// Real laundry-status persistence comes with a future schema change.

import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, CheckIcon } from '../components/icons';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import { GarmentListSkeleton } from '../components/skeletons';
import { useMockRefresh } from '../hooks/useMockRefresh';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type LaundryItem = {
  id: string;
  name: string;
  category: string;
  hue: number;
};

const MOCK_LAUNDRY: LaundryItem[] = [
  { id: '1', name: 'Cream linen overshirt', category: 'Outer · linen', hue: 32 },
  { id: '2', name: 'Charcoal merino tee',   category: 'Top · merino', hue: 18 },
  { id: '3', name: 'Indigo workshirt',      category: 'Top · cotton', hue: 200 },
  { id: '4', name: 'Camel chore jacket',    category: 'Outer · canvas', hue: 45 },
  { id: '5', name: 'Cream cotton trouser',  category: 'Bottom · cotton', hue: 32 },
];

export function LaundryScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const [items, setItems] = useState<LaundryItem[]>(MOCK_LAUNDRY);
  const { refreshing, loading, onRefresh } = useMockRefresh(800);

  const markClean = (id: string) => {
    hapticSuccess();
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const markAllClean = () => {
    hapticSuccess();
    setItems([]);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Header */}
      <View style={s.header}>
        <IconBtn ariaLabel="Back" onPress={() => { hapticLight(); nav.goBack(); }}>
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>In the wash</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>Laundry</PageTitle>
        </View>
        <View
          style={[
            s.countBadge,
            { backgroundColor: items.length > 0 ? t.accent : 'transparent', borderColor: t.border },
          ]}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 12,
              color: items.length > 0 ? t.accentFg : t.fg2,
              fontVariant: ['tabular-nums'],
            }}>
            {items.length}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ paddingTop: 8 }}>
          <GarmentListSkeleton rows={5} />
        </View>
      ) : items.length === 0 ? (
        <View style={s.emptyShell}>
          <View style={[s.emptyCircle, { backgroundColor: t.accentSoft, borderColor: t.border }]}>
            <CheckIcon size={40} color={t.accent} />
          </View>
          <PageTitle style={{ marginTop: 24, textAlign: 'center' }}>All clean</PageTitle>
          <Text
            style={{
              marginTop: 8,
              fontFamily: fonts.ui,
              fontSize: 13,
              lineHeight: 19.5,
              color: t.fg2,
              textAlign: 'center',
            }}>
            No garments in laundry.
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: insets.bottom + 96,
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />
            }
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: t.border, opacity: 0.6 }} />
            )}
            renderItem={({ item }) => (
              <View style={s.row}>
                <View
                  style={[
                    s.thumb,
                    {
                      backgroundColor: `hsl(${item.hue}, 22%, 78%)`,
                      borderColor: t.border,
                    },
                  ]}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fonts.uiSemi,
                      fontSize: 13.5,
                      fontWeight: '600',
                      color: t.fg,
                      letterSpacing: -0.13,
                    }}>
                    {item.name}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontFamily: fonts.uiMed,
                      fontSize: 11.5,
                      letterSpacing: 0.4,
                      color: t.fg2,
                    }}>
                    {item.category}
                  </Text>
                </View>
                <Button
                  label="Mark clean"
                  variant="outline"
                  size="sm"
                  onPress={() => markClean(item.id)}
                />
              </View>
            )}
          />
          <View style={[s.actionBar, { paddingBottom: insets.bottom + 16, backgroundColor: t.bg, borderTopColor: t.border }]}>
            <Button label="Mark all clean" onPress={markAllClean} block />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  countBadge: {
    minWidth: 36,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 68,
    borderRadius: radii.md,
    borderWidth: 1,
    flexShrink: 0,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
