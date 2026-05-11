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
import { AppState, Linking, View } from 'react-native';
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
import { configureRevenueCat, resetRevenueCat } from './src/lib/revenuecat';
import { ErrorBoundary } from './src/components/ErrorBoundary';
// N3b — Toast host. Mounted at the bottom of the tree (after
// NavigationContainer) so toast-message paints above every screen including
// modal/native-stack headers. Calls funnel through `src/lib/toast.ts`.
import Toast from 'react-native-toast-message';

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

// M31 — configure the RevenueCat SDK once auth resolves. Mounted ahead of
// push-token registration so the IAP surface is ready before the paywall
// can be presented (deep link / push-driven entry to Paywall would
// otherwise race the configure call).
//
// Three transitions to handle:
//   * sign-in (null → user)         → configureRevenueCat(user.id)
//   * sign-out (user → null)        → resetRevenueCat()
//   * user-swap (userA → userB)     → resetRevenueCat() then configure(B)
//
// The configure/reset helpers are idempotent (de-duped on the cached
// `configuredFor`) so a re-fire from a TOKEN_REFRESHED event is a no-op.
// Errors are swallowed inside the SDK wrapper (Sentry breadcrumbs only)
// — RevenueCat misconfiguration must never block app boot.
function useRevenueCatLifecycle(): void {
  const { user, isLoading } = useAuth();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const nextId = user?.id ?? null;
    const prevId = lastUserId.current;
    if (nextId === prevId) return;

    let cancelled = false;
    void (async () => {
      if (!nextId) {
        // sign-out — await so a fast re-sign-in into the same effect
        // dependency-update chain serialises behind it. The wrapper's
        // module-level inFlight queue serialises ALL callers, but
        // capturing the await here also prevents `lastUserId.current`
        // from leading the actual SDK state.
        await resetRevenueCat();
        if (cancelled) return;
        lastUserId.current = null;
        return;
      }

      // sign-in or user-swap. The wrapper's queue handles the implicit
      // logOut + reconfigure when `configuredFor !== nextId`. Capture
      // `lastUserId.current` only AFTER the configure resolves so a
      // mid-flight unmount or another auth event doesn't end up with a
      // ref pointing at a user the SDK isn't actually serving yet.
      await configureRevenueCat(nextId);
      if (cancelled) return;
      lastUserId.current = nextId;
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isLoading]);
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

  // M30 review fix — re-fire registration when the user flips the OS
  // notification permission from "denied" to "granted" while the app is
  // backgrounded (Settings → Notifications → BURS → Allow). Without this
  // listener the user would have to fully relaunch before we'd attempt the
  // token fetch again. Guarded on `triggeredFor` so we only run once we've
  // already captured the initial denied state for this user.
  useEffect(() => {
    if (!user) return;
    let lastState = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackgrounded = lastState === 'background' || lastState === 'inactive';
      lastState = next;
      if (next !== 'active' || !wasBackgrounded) return;
      if (!triggeredFor.current.has(user.id)) return;
      void (async () => {
        try {
          const current = await Notifications.getPermissionsAsync();
          if (current.status !== Notifications.PermissionStatus.GRANTED) return;
          // Permission flipped on while we were backgrounded — clear the
          // dedupe and re-fire registration so the Expo token gets stored.
          triggeredFor.current.delete(user.id);
          triggeredFor.current.add(user.id);
          mutateRef.current();
        } catch {
          // getPermissionsAsync should never throw on a real device; swallow
          // so we don't crash the AppState listener.
        }
      })();
    });
    return () => {
      sub.remove();
    };
  }, [user]);

  // N14/F5 — Expo push tokens are long-lived in practice but can rotate
  // server-side (rarer on APNs, more common on FCM). Without a listener the
  // app would only catch a rotation on next launch, leaving the row in
  // `push_subscriptions` stale until then. `addPushTokenListener` fires for
  // every rotation; we re-call the registration mutation so the new token is
  // upserted via the same path as the initial registration.
  useEffect(() => {
    if (!user) return;
    const sub = Notifications.addPushTokenListener(() => {
      // Re-run the full registration flow so the upsert lands with the
      // fresh token. The mutation is keyed on (user_id, endpoint) — a
      // rotation produces a new row; the previous one stays until the
      // server-side stale-token cleanup catches it.
      mutateRef.current();
    });
    return () => {
      sub.remove();
    };
  }, [user]);
}

// M30 — notification deep-link handler. When the user taps a push, the OS
// resumes the app and fires `addNotificationResponseReceivedListener` with
// the notification payload. We pull a `route` field out of the data blob and
// `navigate()` to it. Routes are passed by name (matching RootStackParamList
// keys); arbitrary deep links coming over the push channel are ignored to
// avoid letting a malformed payload crash the app.
//
// Allowlist (M30 review fix): even though the runtime `navigate` will throw
// on an unknown route name, accepting any string from a push payload widens
// our attack surface — a misconfigured server send could route the user
// past Onboarding or Auth into the app. Restrict to a curated set of safe
// destinations (tabs, detail screens, standalone tools, settings) and drop
// anything outside that set. Excludes Splash / Auth / Onboarding / Paywall /
// ResetPassword — those are part of the acquisition / recovery funnel and
// should never be reachable from a push tap.
//
// Cold-launch path: `getLastNotificationResponseAsync` returns the response
// that woke the app. Warm-app path: `addNotificationResponseReceivedListener`
// fires for taps received while the app is running.
const ALLOWED_DEEP_LINK_ROUTES: ReadonlySet<string> = new Set<string>([
  // Tabs shell — `MainTabs` accepts an optional initialTab in params.
  'MainTabs',
  // Outfit / garment / sharing
  'Outfits',
  'OutfitDetail',
  'OutfitGenerate',
  'OutfitPool',
  'PhotoFeedback',
  'GarmentDetail',
  'EditGarment',
  // Calendar + laundry
  'MonthCalendar',
  'Laundry',
  // Stylist / mood / occasion
  'StyleChat',
  'StyleMe',
  'MoodOutfit',
  'MoodFlow',
  // Travel capsule
  'TravelCapsule',
  'TravelMustHaves',
  'TravelPackingList',
  // Discover / lists
  'WardrobeGaps',
  'PickMustHaves',
  'UsedGarments',
  'UnusedOutfits',
  'UnusedGarments',
  // Settings
  'Settings',
  'SettingsAppearance',
  'SettingsStyle',
  'SettingsNotifications',
  'SettingsAccount',
  'SettingsPrivacy',
  // Profile / extras
  'Profile',
  // 'Notifications' — M41: route hidden until inbox stream lands
  // Search
  'Search',
]);

// M30 review fix (2026-05-07) — bound the cold-launch retry loop. The
// navigation container becomes ready a handful of ticks after mount; if a
// pathological mount delay or an unmounted container kept us looping, the
// previous unbounded recursion would burn CPU forever on a corner-case
// payload. 20 attempts × 50 ms = ~1s upper bound — generous for any real
// mount, decisive on a stuck one.
const DEEP_LINK_MAX_RETRIES = 20;
const DEEP_LINK_RETRY_DELAY_MS = 50;

// Cap the JSON-serialized size of params before passing them to
// `navigate`. React Navigation serializes params into route state; a
// pathological push payload (`params: { x: <huge array> }`) could pin the
// JS thread or OOM the state cache. 4 KB matches Expo's own push payload
// ceiling, so any params surviving the wire are already inside this
// bound — but a misconfigured server send shouldn't be load-bearing.
const DEEP_LINK_PARAMS_MAX_BYTES = 4096;

function useNotificationDeepLink(): void {
  useEffect(() => {
    // Concurrent-tap race (Reviewer D 2nd-pass on PR #763): if the user
    // taps push A, navigationRef isn't ready, retry loop fires, then
    // they tap push B mid-loop, both `handle` invocations recurse
    // independently with their own `attempt` counters. Both eventually
    // call `navigate` and last-write-wins for the visible route.
    // Acceptable — no CPU / memory hazard (each capped at
    // DEEP_LINK_MAX_RETRIES) and the user-visible outcome is "the push
    // you tapped most recently is where you land" almost always.
    const handle = (
      response: Notifications.NotificationResponse | null,
      attempt = 0,
    ): void => {
      if (!response) return;
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const route = data?.route;
      if (typeof route !== 'string' || route.length === 0) return;
      if (!ALLOWED_DEEP_LINK_ROUTES.has(route)) {
        Sentry.addBreadcrumb({
          category: 'push',
          message: 'unknown_route',
          data: { route },
        });
        return;
      }
      // Wait for the navigation container to be ready — on cold launch the
      // listener can fire before NavigationContainer mounts. Capped retry
      // (DEEP_LINK_MAX_RETRIES × DEEP_LINK_RETRY_DELAY_MS) so a stuck
      // navigator can't loop indefinitely.
      if (!navigationRef.isReady()) {
        if (attempt >= DEEP_LINK_MAX_RETRIES) {
          Sentry.withScope((scope) => {
            scope.setTag('source', 'push_deep_link');
            scope.setContext('deep_link', { route, attempts: attempt });
            Sentry.captureMessage(
              'navigationRef never became ready for push deep link',
              'warning',
            );
          });
          return;
        }
        setTimeout(() => handle(response, attempt + 1), DEEP_LINK_RETRY_DELAY_MS);
        return;
      }
      // Validate params size before navigating — a misconfigured server
      // push that ships an oversized blob would otherwise pin the JS
      // thread serializing it into route state. Drops the params (still
      // navigates) when over budget so the user lands on the route
      // without the payload.
      let paramsForNav: unknown = data?.params ?? undefined;
      if (paramsForNav !== undefined) {
        try {
          const serializedSize = JSON.stringify(paramsForNav).length;
          if (serializedSize > DEEP_LINK_PARAMS_MAX_BYTES) {
            Sentry.addBreadcrumb({
              category: 'push',
              message: 'oversized_params_dropped',
              data: { route, size: serializedSize },
            });
            paramsForNav = undefined;
          }
        } catch {
          // JSON.stringify can throw on circular refs — drop the
          // params and continue rather than block navigation.
          paramsForNav = undefined;
        }
      }
      // `navigate` is generic over the param list; the runtime check above
      // gates string routes only. We type-assert to the loose shape because
      // notification payloads carry untyped JSON.
      try {
        // @ts-expect-error — route name is dynamic; runtime-validated above.
        navigationRef.navigate(route, paramsForNav);
      } catch (err) {
        // Silent catches in production = invisible failures. Surface to
        // Sentry with the route/params context so a regression in the
        // deep-link route table or NavigationContainer state doesn't
        // disappear into stdout.
        Sentry.withScope((scope) => {
          scope.setTag('source', 'push_deep_link');
          scope.setContext('deep_link', { route, params: paramsForNav ?? null });
          // Wrap non-Error throws so Sentry still gets a usable stack
          // trace. navigationRef.navigate normally throws Error, but the
          // ts-expect-error annotation above means the type system isn't
          // enforcing the throw shape — guard at runtime.
          Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
        });
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
  // RevenueCat must be configured before push so the paywall is ready
  // even if the user opens it immediately after auth resolves.
  useRevenueCatLifecycle();
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
        {/* ErrorBoundary mounted INSIDE NavigationContainer so the fallback
            still has navigation context if it ever needs it (and so a
            broken screen tree doesn't take down the navigator itself). */}
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
      </NavigationContainer>
      {/* N3b — Toast host sits OUTSIDE NavigationContainer so a broken
          navigator state can't hide the toast layer; see
          `src/lib/toast.ts` for the call-site wrapper. */}
      <Toast />
    </>
  );
}
