/**
 * Thin logging wrapper that suppresses debug output in production.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.warn('something happened', detail);
 *   logger.error('critical failure', err);   // always shown
 *   logger.debug('verbose trace', data);     // dev-only
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /** Always logged — use for genuine errors that affect the user. */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },

  /** Logged in dev and production — use for recoverable non-fatal issues. */
  warn: (...args: unknown[]): void => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /** Dev-only verbose tracing. Stripped in production builds. */
  debug: (...args: unknown[]): void => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  },

  /** Informational messages — dev only. */
  info: (...args: unknown[]): void => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(...args);
    }
  },
};
