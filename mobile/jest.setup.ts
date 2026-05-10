// Jest setup — runs after the test framework is installed in each worker.
//
// Wires up @testing-library/jest-native matchers and registers the four
// boundary mocks used by every smoke test. Mocking at the boundary
// (Supabase / RevenueCat / AsyncStorage / Sentry) keeps tests honest:
// they exercise the real React Query + hook code paths and only stub
// what genuinely can't run in jsdom.

import '@testing-library/jest-native/extend-expect';

// Provide the EXPO_PUBLIC_* env vars the supabase + revenuecat modules
// validate at import time. Setting them here (before any module is
// imported by a test) means `mobile/src/lib/supabase.ts`'s requireEnv()
// guard doesn't throw inside the test process.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

// Silence the module-level Sentry breadcrumbs / console.warn noise the
// hooks emit on degraded paths — tests assert behaviour, not log output.
// Tests can spy on these globally if a specific assertion needs it.
jest.mock('@supabase/supabase-js', () => require('./src/__mocks__/supabase'));
jest.mock('react-native-purchases', () =>
  require('./src/__mocks__/react-native-purchases'),
);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('./src/__mocks__/async-storage'),
);
jest.mock('@sentry/react-native', () =>
  require('./src/__mocks__/sentry-react-native'),
);

// N3b — Toast lib pulls native-only animation code on import. Mocked at
// the boundary so toast call sites are exercised but the RN bridge isn't.
// Inline factory rather than `require('./src/__mocks__/...')` because the
// mock factory must be self-contained — pulling a sibling module here ran
// into a recursive resolve loop when the test file itself imported the
// real module path.
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
    hide: jest.fn(),
  },
}));

// NetInfo is rare in the spec-listed hooks but `offlineQueue.ts` reads it
// during deferred replay scheduling. A minimal in-memory mock keeps the
// queue tests deterministic without pulling the native bridge.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    }),
    addEventListener: jest.fn().mockReturnValue(() => {}),
  },
}));
