// SplashScreen — app entry, custom fade-in BURS wordmark before auth check.
// Distinct from Expo's native splash (which is dismissed in App.tsx once fonts load).
// This is the first React-rendered screen the user sees in production builds.
//
// Auth fork (Wave 1 — feat/mobile-w1-auth):
//   not logged in                    → Auth (replace)
//   logged in + onboarding pending   → Onboarding (replace)
//   logged in + onboarding completed → MainTabs (replace)
//
// We wait for `isLoading=false` from useAuth (session rehydrated from
// AsyncStorage + initial profile fetch settled). A minimum display time
// (FADE_IN_DURATION_MS) prevents the wordmark from flashing through when
// auth resolves in <100ms on a warm cache.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { t as tr } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FADE_IN_DURATION_MS = 600;
// Minimum on-screen time for the wordmark — prevents a sub-100ms auth resolve
// from flashing the splash. Matches the fade duration so the user always sees
// the wordmark at full opacity for a beat before routing.
const MIN_DISPLAY_MS = 600;
// Safety net for a hung auth resolve. supabase.getSession() in flight on a
// flaky network can sit for arbitrarily long; without a fallback the user
// stares at the wordmark indefinitely. After this many ms we assume the worst
// case (no session) and route to Auth — a returning user with valid storage
// will silently re-authenticate in the background and be routed onward by
// AuthScreen's post-sign-in effect once the session lands.
const AUTH_RESOLVE_TIMEOUT_MS = 7000;

export function SplashScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { isLoading, user, isOnboarded } = useAuth();
  const opacity = useRef(new Animated.Value(0)).current;
  const [minElapsed, setMinElapsed] = useState(false);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const navigatedRef = useRef(false);

  // Fade-in on mount + arm the min-display + auth-resolve safety timers. All
  // three fire on the same tick.
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_DURATION_MS,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start();

    const minId = setTimeout(() => setMinElapsed(true), MIN_DISPLAY_MS);
    const authId = setTimeout(() => setAuthTimedOut(true), AUTH_RESOLVE_TIMEOUT_MS);

    return () => {
      clearTimeout(minId);
      clearTimeout(authId);
      opacity.stopAnimation();
    };
  }, [opacity]);

  // Route once auth has resolved (or timed out) AND minimum display time has
  // elapsed. authTimedOut OR-gates with !isLoading so a hung getSession on
  // a flaky network doesn't trap the user on Splash forever.
  useEffect(() => {
    if ((isLoading && !authTimedOut) || !minElapsed || navigatedRef.current) return;

    // Don't clobber a deep-link / push-notification destination that React
    // Navigation may have restored on top of Splash. If the parent state
    // already includes a non-Splash route, leave it alone — that screen is
    // what the user came here to see. (P1-22 from review.)
    const parent = nav.getParent?.() ?? nav;
    const state = parent.getState?.();
    const restoredDeepLink = state?.routes?.some((r) => r.name !== 'Splash') ?? false;
    if (restoredDeepLink) return;

    navigatedRef.current = true;
    try {
      if (!user) {
        // Includes the timeout-fallback branch — if auth never resolved, we
        // assume no session. AuthContext will route onward once the rehydrate
        // eventually lands via AuthScreen's post-sign-in effect.
        nav.reset({ index: 0, routes: [{ name: 'Auth' }] });
      } else if (!isOnboarded) {
        nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
      } else {
        nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }
    } catch (err) {
      // nav.reset is sync but defend anyway — a thrown reset would otherwise
      // leave navigatedRef permanently true with the user still on Splash.
      console.warn('[SplashScreen] nav.reset threw:', err);
      navigatedRef.current = false;
    }
  }, [isLoading, authTimedOut, minElapsed, user, isOnboarded, nav]);

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
