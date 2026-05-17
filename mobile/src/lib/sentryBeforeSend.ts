// Sentry `beforeSend` hook for the RN app. Strips Authorization / Cookie
// headers, redacts keys matching the PII regex anywhere in `extra` / `contexts`,
// and trims `event.user` to a minimal { id, ip_address } shape so we never
// ship email / name / IP combos that the auth SDK might attach.
//
// Audit issue #5 — pre-launch hardening before App Store + Play Store
// submission.

import type { ErrorEvent } from '@sentry/react-native';

const SENSITIVE_KEY_RE = /email|token|key|secret|password|stripe|payment/i;
const REDACTED = '[REDACTED]';

function redactObject<T>(value: T, depth = 0): T {
  // Bound depth to avoid pathological cycles. Sentry events are shallow in
  // practice; 8 levels covers anything realistic and stops if a caller
  // accidentally attached a self-referential graph.
  if (depth > 8) return value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactObject(v, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = REDACTED;
    } else if (v && typeof v === 'object') {
      out[k] = redactObject(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out as unknown as T;
}

export function beforeSend(event: ErrorEvent): ErrorEvent | null {
  if (event.request?.headers) {
    const headers = event.request.headers as Record<string, string>;
    delete headers.Authorization;
    delete headers.authorization;
    delete headers.Cookie;
    delete headers.cookie;
    delete headers['X-API-Key'];
    delete headers['x-api-key'];
  }
  if (event.extra) {
    event.extra = redactObject(event.extra);
  }
  if (event.contexts) {
    event.contexts = redactObject(event.contexts);
  }
  if (event.user) {
    // Whitelist: keep only id + ip_address. Drop email/username/anything else
    // the Sentry SDK or app code may have attached.
    const { id, ip_address } = event.user;
    event.user = { id, ip_address };
  }
  return event;
}
