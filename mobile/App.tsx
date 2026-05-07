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

import React, { useCallback, useEffect, useRef } from 'react';
import { Linking, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
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

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { queryClient } from './src/lib/queryClient';
import { supabase } from './src/lib/supabase';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { themes } from './src/theme/tokens';
import {
  RootNavigator,
  linking,
  type RootStackParamList,
} from './src/navigation/RootNavigator';
import { useRegisterPushToken } from './src/hooks/usePushNotifications';

// Keep the native splash screen visible while we wait for fonts. Calling this
// synchronously at module load — before the first React render — is what the
// expo-splash-screen docs recommend so we don't get a flash of the unloaded
// font.
SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: this can race on hot-reload (already hidden) — safe to swallow.
});

// M30 — global notification handler. Configured at module scope so the OS
// receives the foreground-presentation policy before any notification can
// land. `shouldShowAlert` keeps the banner visible while the app is open;
// badge updates are deferred to a future wave (no inbox count today).
//
// `shouldShowBanner` / `shouldShowList` are the SDK 53+ replacements for the
// deprecated `shouldShowAlert`. We set both for forward + backward compat
// across the SDK 54 typings — expo-notifications still respects the legacy
// field but emits a warning when only the legacy is set.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// M30 — navigation ref so the notification-tap listener can route without
// needing a hook context. createNavigationContainerRef returns a stable ref
// that's safe to wire to NavigationContainer's `ref` prop.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
      // Recovery tokens can land in either the `?` query string or the `#`
      // fragment depending on how the Supabase email template is authored
      // — the `?`-query variant would silently no-op without this handling.
      // Try the URL parser's `searchParams` first (covers `?` and combined
      // `?…#…` URLs), then fall back to manual fragment parsing for the
      // legacy `#`-only format. Codex P2 round on PR #738.
      let access_token: string | null = null;
      let refresh_token: string | null = null;
      let type: string | null = null;
      try {
        const parsed = new URL(url);
        access_token = parsed.searchParams.get('access_token');
        refresh_token = parsed.searchParams.get('refresh_token');
        type = parsed.searchParams.get('type');
      } catch {
        // URL constructor can throw on malformed deep-link inputs — fall
        // through to the hash-fragment path below.
      }
      if (!access_token || !refresh_token || !type) {
        const hashIdx = url.indexOf('#');
        if (hashIdx !== -1) {
          const fragmentParams = new URLSearchParams(url.slice(hashIdx + 1));
          access_token = access_token ?? fragmentParams.get('access_token');
          refresh_token = refresh_token ?? fragmentParams.get('refresh_token');
          type = type ?? fragmentParams.get('type');
        }
      }
      if (type !== 'recovery') return;
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

// M30 — register the device's Expo push token once auth resolves. Mounted
// inside AuthProvider so `useAuth()` is in scope; fires-and-forgets the
// mutation (failures already get captured via captureMutationError).
//
// Why guard on `user.id` rather than just `user`: the dependency array needs
// a primitive so React's stable equality detects a real user-change rather
// than re-firing on every AuthContext re-render. The mutation itself is
// idempotent server-side (upsert on user_id+endpoint) so a duplicate fire
// is a no-op, but we still de-noise to avoid burning permission prompts.
function usePushTokenRegistration(): void {
  const { user, isLoading } = useAuth();
  const register = useRegisterPushToken();
  const triggeredFor = useRef<Set<string>>(new Set());
  // `register` mutate fn comes from useMutation — its identity is not stable
  // across renders. Pin to a ref so the effect dep array stays minimal.
  const mutateRef = useRef(register.mutate);
  useEffect(() => {
    mutateRef.current = register.mutate;
  }, [register.mutate]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (triggeredFor.current.has(user.id)) return;
    triggeredFor.current.add(user.id);
    // Fire-and-forget — captureMutationError handles the failure path.
    mutateRef.current();
  }, [user, isLoading]);
}

// M30 — notification deep-link handler. When the user taps a push, the OS
// resumes the app and fires `addNotificationResponseReceivedListener` with
// the notification payload. We pull a `route` field out of the data blob and
// `navigate()` to it. Routes are passed by name (matching RootStackParamList
// keys); arbitrary deep links coming over the push channel are ignored to
// avoid letting a malformed payload crash the app.
//
// Cold-launch path: `getLastNotificationResponseAsync` returns the response
// that woke the app. Warm-app path: `addNotificationResponseReceivedListener`
// fires for taps received while the app is running.
function useNotificationDeepLink(): void {
  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse | null): void => {
      if (!response) return;
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const route = data?.route;
      if (typeof route !== 'string' || route.length === 0) return;
      // Wait for the navigation container to be ready — on cold launch the
      // listener can fire before NavigationContainer mounts.
      if (!navigationRef.isReady()) {
        // Retry on next tick. `setTimeout` is fine here; the navigation
        // container becomes ready synchronously after the mount completes.
        setTimeout(() => handle(response), 50);
        return;
      }
      // `navigate` is generic over the param list; the runtime check above
      // gates string routes only. We type-assert to the loose shape because
      // notification payloads carry untyped JSON.
      try {
        // @ts-expect-error — route name is dynamic; runtime-validated above.
        navigationRef.navigate(route, data?.params);
      } catch (err) {
        console.warn('[App] notification deep-link nav failed:', err);
      }
    };

    // Cold-launch: read the last response that woke the app, if any.
    void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => {
      sub.remove();
    };
  }, []);
}

function ThemedShell() {
  const { resolved } = useTheme();
  const t = themes[resolved];
  useRecoveryDeepLink();
  usePushTokenRegistration();
  useNotificationDeepLink();
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
      <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}
