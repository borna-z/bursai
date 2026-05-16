// Loading shell for OutfitGenerateScreen — extracted in Phase 3 modularization.
//
// Owns its own animated state:
//   • `spinAnim` — 1.1s linear loop on a 64×64 spinner ring.
//   • `progressAnim` — climbs to 90% over 2s then holds; the orchestrator
//     can drive it to 100% via the `isLoading` prop (parent flips false
//     when the generate hook resolves).
//   • `messageIdx` — rotates through LOADING_MESSAGES every 600ms while
//     loading is active.
//
// The component is fully self-contained: no Animated.Value crosses the
// boundary (per Phase 3 modularization risk #2). The parent passes
// `isLoading` so the shell can snap progress to 100% on completion and
// stop the rotating ticker.
//
// Parity rules from the spec:
//   • `useTranslation()` stays in the same component that renders the
//     string. We use the `t as tr` helper here so LOADING_MESSAGES'
//     localised values would land here if/when they're localised.
//   • No styling tweaks vs. the inlined version in the orchestrator.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { IconBtn } from '../../components/IconBtn';
import { CloseIcon } from '../../components/icons';
import { hapticLight } from '../../lib/haptics';

const LOADING_MESSAGES = [
  'Reading your wardrobe…',
  'Checking the weather…',
  'Finding the right pieces…',
  'Almost there…',
] as const;

export interface OutfitGenerateLoadingProps {
  // True while the engine call is in flight. Flipping false snaps the
  // progress bar to 100% and stops the message rotator.
  isLoading: boolean;
  onClose: () => void;
}

export function OutfitGenerateLoading({
  isLoading,
  onClose,
}: OutfitGenerateLoadingProps) {
  const t = useTokens();
  const [messageIdx, setMessageIdx] = useState(0);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Spinner rotation — only runs while loading. Without the gate the loop
  // would keep ticking after the orchestrator unmounts the shell (parent
  // flips to the result branch). Codex audit P1-2 (audit 3).
  useEffect(() => {
    if (!isLoading) return;
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
  }, [isLoading, spinAnim]);

  // Drive the progress affordance off the lifecycle: climb to 90% over
  // 2s while loading, snap to 100% on completion. Message rotator runs
  // alongside on a 600ms interval. The result-landing success haptic is
  // owned by the orchestrator (the shell unmounts the same render the
  // parent flips off the loading branch, so emitting it here would never
  // reach the user).
  useEffect(() => {
    if (!isLoading) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
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
  }, [isLoading, progressAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); onClose(); }}>
          <CloseIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>Generating</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>New look</PageTitle>
        </View>
        <View style={{ width: 36 }} />
      </View>
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
});
