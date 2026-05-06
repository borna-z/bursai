// Root entrypoint for the Expo app.
// Order matters:
//   SafeAreaProvider
//   → QueryClientProvider (must wrap AuthProvider — `AuthContext` calls
//     `useQueryClient()` to clear the cache on sign-out)
//   → AuthProvider (consumed by every data hook + `GarmentDetailScreen`)
//   → ThemeProvider
//   → NavigationContainer → RootNavigator
//
// Providers were added in M1 (PR #728) when `GarmentDetailScreen` was
// promoted from `Placeholders.GarmentDetail` to the real screen — its
// `useGarment` / `useSignedUrl` / `useRenderJobStatus` calls require both
// contexts, which the placeholder did not. (Codex P1 round 7.)
// StatusBar is dynamic — driven by the resolved theme.

import React from 'react';
import { Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './src/contexts/AuthContext';
import { queryClient } from './src/lib/queryClient';
import { supabase } from './src/lib/supabase';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { themes } from './src/theme/tokens';
import { RootNavigator, linking } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider initialMode="system">
            <ThemedShell />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

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
