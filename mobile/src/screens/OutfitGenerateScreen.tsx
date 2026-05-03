// Outfit-generation flow — 2 phases (loading → result).
// Source: design_handoff_burs_rn/source/extra-screens.jsx StyleMeScreen results phase
// (lines 186-398) + more-screens.jsx generating pattern (lines 1021-1041).
//
// Loading is simulated (2s setTimeout). On "Try again" we cycle through 3 mock outfits.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { CloseIcon } from '../components/icons';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const LOADING_MESSAGES = [
  'Reading your wardrobe…',
  'Checking the weather…',
  'Finding the right pieces…',
  'Almost there…',
] as const;

type MockOutfit = {
  name: string;
  hues: [number, number, number, number];
  categories: [string, string, string, string];
  occasion: string;
  formality: string;
  weather: string;
  description: string;
};

const MOCK_OUTFITS: MockOutfit[] = [
  {
    name: 'Cream and shadow',
    hues: [32, 18, 200, 45],
    categories: ['OUTER', 'TOP', 'BOTTOM', 'SHOES'],
    occasion: 'Office',
    formality: 'Smart casual',
    weather: '14°  ·  Cloudy',
    description:
      'Cream linen overshirt over a charcoal tee, soft trouser, suede loafers — calibrated for cool air and a long lunch.',
  },
  {
    name: 'Late afternoon',
    hues: [220, 32, 18, 45],
    categories: ['OUTER', 'TOP', 'BOTTOM', 'SHOES'],
    occasion: 'Dinner',
    formality: 'Soft tailored',
    weather: '12°  ·  Clear',
    description:
      'Wool blazer the colour of cold tea, ecru roll-neck, dark denim, and a low boot — easy hand, sharp line.',
  },
  {
    name: 'Studio Tuesday',
    hues: [45, 200, 0, 32],
    categories: ['OUTER', 'TOP', 'BOTTOM', 'SHOES'],
    occasion: 'Creative',
    formality: 'Relaxed',
    weather: '17°  ·  Sun',
    description:
      'Camel chore jacket, faded indigo workshirt, wide cream trouser, beat-up runners — the easiest version of yourself.',
  },
];

export function OutfitGenerateScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const [phase, setPhase] = useState<'loading' | 'result'>('loading');
  const [resultIdx, setResultIdx] = useState(0);
  const [messageIdx, setMessageIdx] = useState(0);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Spinner rotation — runs continuously.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);

  // Phase loading lifecycle: kick progress 0→1 over 2000ms; cycle messages every 800ms;
  // flip to 'result' after 2000ms.
  useEffect(() => {
    if (phase !== 'loading') return;
    progressAnim.setValue(0);
    setMessageIdx(0);
    const progress = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    progress.start();
    // 4 messages over a 2000ms phase → cycle every 500ms so the user sees all four before
    // the result lands. (Code-reviewer P2 — original 800ms cadence stopped at message[2].)
    const interval = setInterval(() => {
      setMessageIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 500);
    const timeout = setTimeout(() => {
      hapticSuccess();
      setPhase('result');
    }, 2000);
    return () => {
      progress.stop();
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [phase, progressAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const outfit = useMemo(() => MOCK_OUTFITS[resultIdx % MOCK_OUTFITS.length], [resultIdx]);

  const tryAgain = () => {
    hapticLight();
    setResultIdx((i) => (i + 1) % MOCK_OUTFITS.length);
    setPhase('loading');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); nav.goBack(); }}>
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>{phase === 'loading' ? 'Generating' : 'Your new look'}</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>New look</PageTitle>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {phase === 'loading' ? (
        <View style={s.loadingShell}>
          {/* Spinner */}
          <Animated.View
            style={[
              s.spinner,
              {
                borderColor: t.border,
                borderTopColor: t.accent,
                transform: [{ rotate: spin }],
              },
            ]}
          />
          {/* Cycling message */}
          <Text
            style={{
              marginTop: 28,
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 18,
              color: t.fg,
              textAlign: 'center',
              letterSpacing: -0.18,
            }}>
            {LOADING_MESSAGES[messageIdx]}
          </Text>
          {/* Progress bar */}
          <View style={[s.progressTrack, { backgroundColor: t.border, marginTop: 24 }]}>
            <Animated.View
              style={[s.progressFill, { backgroundColor: t.accent, width: progressWidth }]}
            />
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 32,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}>
          <PageTitle style={{ textAlign: 'center', fontSize: 24 }}>{outfit.name}</PageTitle>

          {/* 2x2 grid */}
          <View style={s.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  s.gridCell,
                  {
                    backgroundColor: `hsl(${outfit.hues[i]}, 22%, 78%)`,
                    borderColor: t.border,
                  },
                ]}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 9,
                    letterSpacing: 1.2,
                    color: t.fg,
                    opacity: 0.55,
                    position: 'absolute',
                    bottom: 10,
                    left: 10,
                  }}>
                  {outfit.categories[i]}
                </Text>
              </View>
            ))}
          </View>

          {/* Chip row */}
          <View style={s.chipRow}>
            <ChipPill label={outfit.occasion} />
            <ChipPill label={outfit.formality} />
            <ChipPill label={outfit.weather} />
          </View>

          {/* Description */}
          <Text
            style={{
              fontFamily: fonts.display,
              fontStyle: 'italic',
              fontSize: 14.5,
              lineHeight: 22,
              color: t.fg2,
              marginTop: 4,
            }}>
            {outfit.description}
          </Text>

          {/* Actions */}
          <Button
            label="Wear today"
            onPress={() => {
              hapticLight();
              // The generated outfit isn't yet persisted to Supabase — that requires
              // burs_style_engine wiring (Wave 4 scope). Until then, we surface a
              // user-facing notice so "Wear today" doesn't dead-end on the
              // OutfitDetail "Outfit not found" empty state.
              Alert.alert(
                'Generating your look',
                'Real outfit generation lands in a future update — for now this is a preview.',
              );
            }}
            block
            style={{ marginTop: 8 }}
          />
          <Button
            label="Save outfit"
            variant="outline"
            onPress={() => Alert.alert('Saved', 'Outfit saved to your collection.')}
            block
          />
          <Button label="Try again" variant="quiet" onPress={tryAgain} block />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ChipPill({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        height: 26,
        paddingHorizontal: 12,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 10.5,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: t.fg,
        }}>
        {label}
      </Text>
    </View>
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
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  spinner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
  },
  progressTrack: {
    width: '70%',
    height: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridCell: {
    width: '48.5%',
    aspectRatio: 0.85,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
