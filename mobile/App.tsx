// Root entrypoint for the Expo app.
//
// Order matters:
//   SafeAreaProvider
//   → QueryClientProvider (must wrap AuthProvider — `AuthContext` calls
//     `useQueryClient()` to clear the cache on sign-out)
//   → AuthProvider (consumed by every data hook + `GarmentDetailScreen`)
//   → ThemeProvider
//   → NavigationContainer linking={linking} → RootNavigator
//
// Providers were added in M1 (PR #728) when `GarmentDetailScreen` was
// promoted from `Placeholders.GarmentDetail` to the real screen — its
// `useGarment` / `useSignedUrl` / `useRenderJobStatus` calls require both
// contexts, which the placeholder did not. (Codex P1 round 7.)
//
// Fonts: Playfair Display (italic + medium-italic) + DM Sans
// (regular/medium/semibold/bold) load via @expo-google-fonts. Until they're
// ready, SplashScreen.preventAutoHideAsync() keeps the launch screen visible
// — once loaded, we hide it. RN falls back to system serif/sans on font
// names it doesn't recognize, so blocking until load is what makes the
// design's italic Playfair actually render.
//
// StatusBar is dynamic — driven by the resolved theme.

// Sentry must initialize before any other module that might throw — so it
// captures import-time errors and any early useEffect failures. Calling
// initSentry() at the top of the file (rather than inside App()) gives us
// coverage from module load.
import { initSentry, Sentry } from './src/lib/sentry';
initSentry();

import React, { useCallback, useEffect } from 'react';
import { Linking, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

import { AuthProvider } from './src/contexts/AuthContext';
import { queryClient } from './src/lib/queryClient';
import { supabase } from './src/lib/supabase';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { themes } from './src/theme/tokens';
import { RootNavigator, linking } from './src/navigation/RootNavigator';

// Keep the native splash screen visible while we wait for fonts. Calling this
// synchronously at module load — before the first React render — is what the
// expo-splash-screen docs recommend so we don't get a flash of the unloaded
// font.
SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: this can race on hot-reload (already hidden) — safe to swallow.
});

function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_500Medium_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  // Hide the splash once fonts are ready (or definitively errored — we still
  // let the app boot with system fallbacks rather than blocking forever).
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    // Splash screen is still up via preventAutoHideAsync — render nothing
    // under it.
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider initialMode="system">
              <ThemedShell />
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </View>
  );
}

// Wrap App so Sentry's ErrorBoundary catches uncaught render errors and
// captures crash-reporting context. No-op when Sentry is uninitialized.
export default Sentry.wrap(App);

// M12 — Recovery deep-link handler. The Supabase password-reset email link
// resolves to `burs://reset-password#access_token=...&refresh_token=...&type=recovery`.
// supabase.ts has `detectSessionInUrl: false` (RN doesn't have a `window.location`),
// so we hydrate the session ourselves before React Navigation routes to
// ResetPasswordScreen. Set both initial-URL (cold launch via the link) and the
// addEventListener path (warm launch while the app is already in the
// background).
function useRecoveryDeepLink(): void {
  React.useEffect(() => {
    const hydrate = (url: string | null): void => {
      if (!url) return;
      const hashIdx = url.indexOf('#');
      if (hashIdx === -1) return;
      const params = new URLSearchParams(url.slice(hashIdx + 1));
      if (params.get('type') !== 'recovery') return;
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) return;
      void supabase.auth.setSession({ access_token, refresh_token });
    };
    void Linking.getInitialURL().then(hydrate).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => hydrate(url));
    return () => {
      sub.remove();
    };
  }, []);
}

function ThemedShell() {
  const { resolved } = useTheme();
  const t = themes[resolved];
  useRecoveryDeepLink();
  // Map BURS tokens onto React Navigation's theme contract — the only thing it cares about
  // is background colour + text + primary, so the platform back gestures look right.
  const navTheme = {
    ...(resolved === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(resolved === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: t.bg,
      card: t.card,
      text: t.fg,
      primary: t.accent,
      border: t.border,
      notification: t.accent,
    },
  };
  return (
    <>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme} linking={linking}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}
