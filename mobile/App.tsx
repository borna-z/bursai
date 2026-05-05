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
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './src/contexts/AuthContext';
import { queryClient } from './src/lib/queryClient';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { themes } from './src/theme/tokens';
import { RootNavigator } from './src/navigation/RootNavigator';

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

function ThemedShell() {
  const { resolved } = useTheme();
  const t = themes[resolved];
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
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}
