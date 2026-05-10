// Sentry init for React Native via Expo. Called once from App.tsx, before any
// React tree mounts. DSN comes from EXPO_PUBLIC_SENTRY_DSN; absent in dev,
// present in EAS production builds via eas.json secrets.
//
// tracesSampleRate is set to 1.0 for the launch window — we want every error
// captured during the first month of TestFlight + initial App Store rollout
// so a low-volume crash doesn't slip past the dashboards. Revisit after the
// first month of stable production traffic and bring this back down to 0.2
// (matching web `src/main.tsx`) once volume warrants the cost.

import * as Sentry from '@sentry/react-native';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    // N3b — `no-console` allows `warn`. `log.debug` from `lib/log.ts` would
    // be circular here: log.ts imports Sentry from this module to forward
    // errors. Plain console.warn keeps init order simple.
    if (__DEV__) console.warn('[sentry] no DSN — skipping init');
    return;
  }
  Sentry.init({
    dsn,
    // 1.0 for the launch window. TODO: bring back to 0.2 after the first
    // month of stable production traffic.
    tracesSampleRate: 1.0,
    enableAutoSessionTracking: true,
    debug: __DEV__,
    // The native Sentry SDK only ships in EAS dev/prod builds. Inside Expo Go
    // it's not available, so we keep the JS bridge active and skip native init.
    enableNative: !__DEV__,
  });
  initialized = true;
}

/**
 * onError handler for every useMutation in mobile/. Tags the captured error
 * with the mutation scope so dashboards can filter by `mutation:<name>`.
 *
 * Pattern in a hook:
 *   onError: captureMutationError('useAddGarment'),
 *
 * If a hook already has an inline onError that does UI side-effects, compose:
 *   const reportError = captureMutationError('useFoo');
 *   onError: (err, vars, ctx) => { reportError(err); existingHandler(err, vars, ctx); }
 *
 * Safe to call before init — short-circuits when uninitialized.
 */
export function captureMutationError(scope: string) {
  return (error: unknown): void => {
    if (!initialized) return;
    Sentry.withScope((s) => {
      s.setTag('mutation', scope);
      Sentry.captureException(error);
    });
  };
}

export { Sentry };
