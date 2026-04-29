// Add piece — Step 2 of 3 (analyzing batch).
// Pixel-faithful port of design_handoff_burs_rn/source/screens.jsx AddGarmentStep2.
//
// Layout: top header (close · "Step 2 of 3" + "Analyzing" · Skip) → big italic counter
// (3 / 5 with gold/fg3 split) → progress bar → per-item list with status indicator →
// sticky CTA "Review & confirm".
//
// Mock progression: items array carries hue + state ('done' | 'now' | 'wait'). In a future
// PR this hooks into the real analyzer pipeline; for now it's a static snapshot showing
// what the screen looks like mid-batch.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { CloseIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ItemState = 'done' | 'now' | 'wait';
type Item = { n: number; label: string; state: ItemState; hue: number };

const ITEMS: Item[] = [
  { n: 1, label: 'Cream wool overshirt', state: 'done', hue: 32 },
  { n: 2, label: 'Charcoal trouser',    state: 'done', hue: 28 },
  { n: 3, label: 'White oxford',        state: 'done', hue: 200 },
  { n: 4, label: 'Reading colors…',     state: 'now',  hue: 18 },
  { n: 5, label: 'Queued',              state: 'wait', hue: 45 },
];

const TOTAL = ITEMS.length;
const DONE = ITEMS.filter((i) => i.state === 'done').length;

function hueGrad(h: number): [string, string] {
  return [`hsl(${h}, 38%, 78%)`, `hsl(${(h + 30) % 360}, 30%, 62%)`];
}

export function AddPieceStep2() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const pct = (DONE / TOTAL) * 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      {/* ============ HEADER ============ */}
      <View style={[s.header, { borderBottomColor: t.border }]}>
        <IconBtn variant="ghost" onPress={() => nav.navigate('MainTabs')} ariaLabel="Close">
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>Step 2 of 3</Eyebrow>
          <PageTitle size={26}>Analyzing</PageTitle>
        </View>
        <Pressable
          onPress={() => nav.navigate('AddPieceStep3')}
          style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2, fontWeight: '500' }}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }}
        showsVerticalScrollIndicator={false}>

        {/* ============ BIG ITALIC COUNTER ============ */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Eyebrow>Reading the batch</Eyebrow>
          <Text style={{ fontFamily: fonts.displayMedium, fontStyle: 'italic', fontWeight: '500', fontSize: 32, lineHeight: 34, letterSpacing: -0.32 }}>
            <Text style={{ color: t.accent }}>{DONE}</Text>
            <Text style={{ color: t.fg3 }}> / {TOTAL}</Text>
          </Text>
          <Caption>pieces tagged</Caption>
        </View>

        {/* ============ PROGRESS BAR ============ */}
        <View style={{ height: 4, borderRadius: 2, backgroundColor: t.bg2, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.accent }} />
        </View>

        {/* ============ PER-ITEM LIST ============ */}
        <View style={{ gap: 8 }}>
          {ITEMS.map((it) => {
            const isWait = it.state === 'wait';
            const isNow  = it.state === 'now';
            const isDone = it.state === 'done';
            return (
              <View
                key={it.n}
                style={[
                  s.row,
                  {
                    borderColor: t.border,
                    // The prototype distinguishes "now" (active card surface) from "wait/done"
                    // (subtler bg-2). Done rows fade to bg2 because the work is settled.
                    backgroundColor: isNow ? t.card : t.bg2,
                    opacity: isWait ? 0.55 : 1,
                  },
                ]}>
                <LinearGradient
                  colors={hueGrad(it.hue)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.rowThumb}
                />
                <View style={{ flex: 1 }}>
                  <Eyebrow style={{ marginBottom: 2 }}>Piece {String(it.n).padStart(2, '0')}</Eyebrow>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fonts.uiSemi,
                      fontSize: 13,
                      fontWeight: '600',
                      color: t.fg,
                      letterSpacing: -0.13,
                    }}>
                    {it.label}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: fonts.uiBold,
                    fontSize: 14,
                    color: isDone ? t.accent : t.fg3,
                    minWidth: 16,
                    textAlign: 'center',
                  }}>
                  {isDone ? '✓' : isNow ? '···' : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ============ STICKY CTA ============ */}
      <View style={[s.stickyBar, { borderTopColor: t.border, backgroundColor: t.bg }]}>
        <Button label="Review & confirm" onPress={() => nav.navigate('AddPieceStep3')} block />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  rowThumb: {
    width: 40,
    height: 52,
    borderRadius: radii.sm,
    flexShrink: 0,
  },
  stickyBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
});
