// SplashScreen — app entry, custom fade-in BURS wordmark before auth check.
// Distinct from Expo's native splash (which is dismissed in App.tsx once fonts load).
// This is the first React-rendered screen the user sees.
//
// Auth state is not yet wired into mobile — once `useAuth()` lands, replace the
// hardcoded reset-to-Auth with the three-way fork in the spec:
//   logged in + has profile         → MainTabs
//   logged in + onboarding pending  → Onboarding
//   not logged in                   → Auth

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SPLASH_DURATION_MS = 1500;
const FADE_IN_DURATION_MS = 600;

export function SplashScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_DURATION_MS,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start();

    const id = setTimeout(() => {
      // Don't clobber a deep-link / push-notification destination that React
      // Navigation may have restored on top of Splash. If the parent state
      // already includes a non-Splash route, leave it alone — that screen is
      // what the user came here to see. (P1-22 from review.)
      const parent = nav.getParent?.() ?? nav;
      const state = parent.getState?.();
      const restoredDeepLink = state?.routes?.some((r) => r.name !== 'Splash') ?? false;
      if (restoredDeepLink) return;
      // TODO(auth): once useAuth() exists, fork on session + profile.onboarding_step.
      nav.reset({ index: 0, routes: [{ name: 'Auth' }] });
    }, SPLASH_DURATION_MS);

    return () => {
      clearTimeout(id);
      opacity.stopAnimation();
    };
  }, [nav, opacity]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          paddingHorizontal: 20,
        }}>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 48,
            color: t.fg,
            letterSpacing: -0.6,
          }}
          accessibilityRole="header">
          {tr('splash.wordmark')}
        </Text>
        <Text
          style={{
            marginTop: 12,
            fontFamily: fonts.uiMed,
            fontSize: 13,
            color: t.fg2,
            letterSpacing: 0.1,
          }}>
          {tr('splash.tagline')}
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}
