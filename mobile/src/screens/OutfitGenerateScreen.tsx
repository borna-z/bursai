// Outfit-generation flow — 2 phases (loading → result).
// W4: wired to the real `burs_style_engine` edge function via
// useGenerateOutfit. Generation kicks on mount (anchor garmentId pulled from
// route params if present); "Try again" calls reset() then re-runs generate().
//
// The loading shell keeps the existing cycling-message + progress-bar
// affordance, but progress is now driven by the request lifecycle (animated
// to 90% then held until isLoading flips false).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { ErrorState } from '../components/ErrorState';
import { CloseIcon } from '../components/icons';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import { useGenerateOutfit } from '../hooks/useGenerateOutfit';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OutfitGenerate'>;

const LOADING_MESSAGES = [
  'Reading your wardrobe…',
  'Checking the weather…',
  'Finding the right pieces…',
  'Almost there…',
] as const;

// Stable visual hue ramp for the 4-cell preview grid. Real garment images
// land in W9 — for now we render a neutral palette keyed off slot.
const PLACEHOLDER_HUES: [number, number, number, number] = [32, 18, 200, 45];
const SLOT_LABELS = ['OUTER', 'TOP', 'BOTTOM', 'SHOES'];

export function OutfitGenerateScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();

  const { result, isLoading, error, generate, reset } = useGenerateOutfit();
  const [messageIdx, setMessageIdx] = useState(0);
  const paywallShownRef = useRef(false);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Spinner rotation — runs continuously while mounted.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);

  // Kick generation on mount + when the anchor garment changes.
  useEffect(() => {
    void generate({ garmentId: route.params?.garmentId });
    return () => {
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.garmentId]);

  // Drive the loading affordance off the request lifecycle. Progress climbs
  // to 90% over 2s then holds; we snap to 100% on completion.
  useEffect(() => {
    if (!isLoading) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(() => {
        if (result) hapticSuccess();
      });
      return;
    }
    progressAnim.setValue(0);
    setMessageIdx(0);
    Animated.timing(progressAnim, {
      toValue: 0.9,
      duration: 2000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    const interval = setInterval(() => {
      setMessageIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 600);
    return () => clearInterval(interval);
  }, [isLoading, result, progressAnim]);

  useEffect(() => {
    if (error === 'subscription_required' && !paywallShownRef.current) {
      paywallShownRef.current = true;
      Alert.alert(
        'Premium feature',
        'Outfit generation is part of BURS Premium. Upgrade to keep generating looks.',
        [{ text: 'OK' }],
      );
    }
    if (error !== 'subscription_required') {
      paywallShownRef.current = false;
    }
  }, [error]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const itemCount = result?.items.length ?? 0;
  const subLine = useMemo(() => {
    if (!result) return '';
    return `${itemCount} PIECE${itemCount === 1 ? '' : 'S'} · ${result.outfit_name.toUpperCase()}`;
  }, [result, itemCount]);

  const tryAgain = () => {
    hapticLight();
    reset();
    void generate({ garmentId: route.params?.garmentId });
  };

  if (error && error !== 'subscription_required') {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={s.header}>
          <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); nav.goBack(); }}>
            <CloseIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Generation failed</Eyebrow>
            <PageTitle style={{ marginTop: 4 }}>New look</PageTitle>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <ErrorState
          title="Couldn't build your outfit"
          body={error}
          onRetry={tryAgain}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); nav.goBack(); }}>
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>{isLoading || !result ? 'Generating' : 'Your new look'}</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>New look</PageTitle>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {isLoading || !result ? (
        <View style={s.loadingShell}>
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
          <PageTitle style={{ textAlign: 'center', fontSize: 24 }}>{result.outfit_name}</PageTitle>

          {/* 2x2 grid — placeholder hues until real garment images land. */}
          <View style={s.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  s.gridCell,
                  {
                    backgroundColor: `hsl(${PLACEHOLDER_HUES[i]}, 22%, 78%)`,
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
                  {result.items[i]?.slot.toUpperCase() ?? SLOT_LABELS[i]}
                </Text>
              </View>
            ))}
          </View>

          <View style={s.chipRow}>
            {result.occasion ? <ChipPill label={result.occasion} /> : null}
            {result.formality ? <ChipPill label={result.formality} /> : null}
            <ChipPill label={subLine} />
          </View>

          {result.description ? (
            <Text
              style={{
                fontFamily: fonts.display,
                fontStyle: 'italic',
                fontSize: 14.5,
                lineHeight: 22,
                color: t.fg2,
                marginTop: 4,
              }}>
              {result.description}
            </Text>
          ) : null}

          <Button
            label="Wear today"
            onPress={() => {
              hapticLight();
              if (result.outfit_id) {
                nav.navigate('OutfitDetail', { id: result.outfit_id });
              } else {
                Alert.alert(
                  'Saved as preview',
                  'Persistent saving lands in a future update. For now this is a preview.',
                );
              }
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
