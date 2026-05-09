// @sentry/react-native mock — N4.
//
// All telemetry calls no-op. Hooks log breadcrumbs on degraded paths;
// tests assert behaviour, not breadcrumb side-effects, so silent stubs
// are sufficient. If a future test needs to assert Sentry integration,
// this mock can grow per-call jest.fn() spies without changing callers.

const Sentry = {
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((fn: (scope: { setTag: jest.Mock }) => void) => {
    fn({ setTag: jest.fn() });
  }),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
};

module.exports = Sentry;
module.exports.default = Sentry;
module.exports.Sentry = Sentry;
