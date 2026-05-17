// Lightweight logger wrapper used in place of bare `console.*` across the app.
//
// Why: every `console.log`/`console.warn` in the JS bundle still serialises its
// args at runtime even though Hermes drops the output in production builds —
// so a chatty hot-path logs hundreds of bytes per call. Wrapping in a
// `__DEV__`-guarded helper makes the call a no-op in production while keeping
// dev DX. `log.error` always reports to Sentry so we don't lose silently-
// caught failures (the audit flagged 9 `.catch(() => {})` sites in mobile/).
//
// Usage:
//   import { log } from '../lib/log';
//   log.debug('snap stylist response', { mode, latency });
//   log.warn('signed url expired, refetching', path);
//   log.error(err, { area: 'offline_queue', op: 'replay' });
//
// `error()` accepts `unknown` so it composes cleanly with `catch (e)` blocks
// where TypeScript types `e` as `unknown`.

import { Sentry } from './sentry';

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  try {
    return new Error(JSON.stringify(err));
  } catch (_serErr) {
    return new Error(String(err));
  }
}

// N3b — this file is the canonical wrapper for `console.*`; the no-console
// ESLint rule is intentionally bypassed here so that everywhere ELSE has to
// route through these helpers.
/* eslint-disable no-console */
export const log = {
  debug: (...args: unknown[]): void => {
    if (__DEV__) console.log(...args);
  },
  warn: (...args: unknown[]): void => {
    if (__DEV__) console.warn(...args);
  },
  /**
   * Always-capture error logger. Reports to Sentry with optional `extra`
   * context. In dev, also writes to console.error so the issue surfaces in
   * the Metro logs.
   */
  error: (err: unknown, extra?: Record<string, unknown>): void => {
    if (__DEV__) console.error(err, extra);
    const wrapped = toError(err);
    Sentry.withScope((scope) => {
      if (extra) scope.setContext('error_context', extra);
      Sentry.captureException(wrapped);
    });
  },
};
