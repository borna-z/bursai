// Sentry init for React Native via Expo. Called once from App.tsx, before any
// React tree mounts. DSN comes from EXPO_PUBLIC_SENTRY_DSN; absent in dev,
// present in EAS production builds via eas.json secrets. Sample rate 0.2
// matches web (src/main.tsx).

import * as Sentry from '@sentry/react-native';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) console.log('[sentry] no DSN — skipping init');
    return;
  }
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
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
