/**
 * RevenueCat webhook state machine — pure event-to-transition mapping.
 *
 * Extracted from `supabase/functions/revenuecat_webhook/index.ts`. Given a
 * parsed RevenueCat event, `classifyRevenueCatEvent` returns a typed
 * transition descriptor that the webhook entrypoint executes against the
 * `subscriptions` table. All branching that does NOT require a database
 * round-trip lives here; the impure `isStaleEvent` out-of-order check and
 * the actual upsert/update writes stay in the handler so this module can
 * be unit-tested without supabase-js.
 *
 * Out-of-order protection: the inbound timestamp comparator
 * (`isRevenueCatEventStale` from `./rc-event-ordering.ts`) is invoked by
 * the handler against a DB read; the per-row staleness branching for
 * TRANSFER (new-user vs origin rows) is encoded in the transition shape
 * so the handler can apply staleness to each side independently.
 */

import {
  PREMIUM_MONTHLY_ALLOWANCE,
  RC_STRIPE_MODE_MARKER,
  UUID_REGEX,
} from "./revenuecat-constants.ts";

export type RevenueCatEvent = {
  type?: string;
  id?: string;
  event_id?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
  event_timestamp_ms?: number;
  store?: string;
  environment?: string;
  aliases?: unknown;
  transferred_from?: unknown;
  [key: string]: unknown;
};

export type RevenueCatEnvelope = {
  api_version?: string;
  event?: RevenueCatEvent;
};

export type SubscriptionsRowSnapshot = {
  stripe_mode?: string | null;
  status?: string | null;
};

export type RevenueCatTransition =
  | { kind: "noop"; reason: string }
  | { kind: "alias_recovery_check" }
  | { kind: "permanent_skip"; code: string; reason: string }
  | {
      kind: "upsert_active";
      userId: string;
      status: "active" | "trialing";
      productId: string | null;
      periodEnd: string | null;
      eventTimestampMs: number | null;
    }
  | {
      kind: "transfer";
      userId: string;
      productId: string | null;
      periodEnd: string | null;
      eventTimestampMs: number | null;
      originIds: string[];
    }
  | {
      kind: "cancellation_touch";
      userId: string;
      eventTimestampMs: number | null;
    }
  | {
      kind: "end_of_life";
      userId: string;
      status: "canceled" | "past_due";
      eventTimestampMs: number | null;
    };

export function unwrapEvent(parsed: unknown): RevenueCatEvent | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as RevenueCatEnvelope & RevenueCatEvent;
  if (obj.event && typeof obj.event === "object") {
    return obj.event;
  }
  if (typeof obj.type === "string") {
    return obj as RevenueCatEvent;
  }
  return null;
}

export function deriveEventId(event: RevenueCatEvent): string | null {
  if (typeof event.id === "string" && event.id.length > 0) return event.id;
  if (typeof event.event_id === "string" && event.event_id.length > 0) return event.event_id;
  return null;
}

export function deriveEventTimestampMs(event: RevenueCatEvent): number | null {
  const ms = event.event_timestamp_ms;
  if (typeof ms === "number" && Number.isFinite(ms) && ms > 0) return ms;
  const iso = (event as { event_timestamp_at?: unknown }).event_timestamp_at;
  if (typeof iso === "string") {
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

export function parseExpirationMs(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function isStripeActivelyPaying(row: SubscriptionsRowSnapshot | null): boolean {
  if (!row) return false;
  const mode = typeof row.stripe_mode === "string" ? row.stripe_mode : null;
  if (mode !== "live" && mode !== "test") return false;
  const status = typeof row.status === "string" ? row.status : null;
  return status === "active" || status === "trialing";
}

export function extractTransferOriginIds(event: RevenueCatEvent): string[] {
  const out = new Set<string>();
  const arr = event.transferred_from;
  if (Array.isArray(arr)) {
    for (const v of arr) {
      if (typeof v === "string" && UUID_REGEX.test(v)) out.add(v);
    }
  }
  const single = event.original_app_user_id;
  if (typeof single === "string" && UUID_REGEX.test(single)) out.add(single);
  return Array.from(out);
}

export function isMutationEventType(type: string): boolean {
  return [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "NON_RENEWING_PURCHASE",
    "EXPIRATION",
    "BILLING_ISSUE",
  ].includes(type);
}

export function classifyRevenueCatEvent(event: RevenueCatEvent): RevenueCatTransition {
  const type = (event.type ?? "").toUpperCase();
  const userId = typeof event.app_user_id === "string" ? event.app_user_id : null;

  if (type === "SUBSCRIBER_ALIAS") {
    return { kind: "alias_recovery_check" };
  }

  if (!userId) {
    return { kind: "noop", reason: "missing_app_user_id" };
  }
  if (userId.startsWith("$RCAnonymousID")) {
    return { kind: "noop", reason: "anonymous_app_user_id" };
  }
  if (!UUID_REGEX.test(userId)) {
    return { kind: "permanent_skip", code: "22P02", reason: "non_uuid_app_user_id" };
  }

  const eventTimestampMs = deriveEventTimestampMs(event);
  const productId = typeof event.product_id === "string" ? event.product_id : null;
  const periodEnd = parseExpirationMs(event.expiration_at_ms);

  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE": {
      if (type === "NON_RENEWING_PURCHASE" && periodEnd === null) {
        return { kind: "noop", reason: "non_renewing_missing_expiration" };
      }
      return {
        kind: "upsert_active",
        userId,
        status: "active",
        productId,
        periodEnd,
        eventTimestampMs,
      };
    }
    case "TRANSFER": {
      const originIds = extractTransferOriginIds(event).filter((id) => id !== userId);
      return {
        kind: "transfer",
        userId,
        productId,
        periodEnd,
        eventTimestampMs,
        originIds,
      };
    }
    case "CANCELLATION": {
      return { kind: "cancellation_touch", userId, eventTimestampMs };
    }
    case "EXPIRATION": {
      return {
        kind: "end_of_life",
        userId,
        status: "canceled",
        eventTimestampMs,
      };
    }
    case "BILLING_ISSUE": {
      return {
        kind: "end_of_life",
        userId,
        status: "past_due",
        eventTimestampMs,
      };
    }
    case "TEST":
    case "":
    default:
      return { kind: "noop", reason: `logged_only:${type || "EMPTY"}` };
  }
}

export type RcEntitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  purchase_date?: string | null;
  product_identifier?: string | null;
};

export type RcSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, RcEntitlement>;
  };
};

export type ActiveEntitlement = {
  expiresAt: string | null;
  expiresMs: number;
  productId: string | null;
};

export function pickLatestActiveEntitlement(
  entitlements: Record<string, RcEntitlement> | undefined,
  nowMs: number = Date.now(),
): ActiveEntitlement | null {
  if (!entitlements) return null;
  let best: ActiveEntitlement | null = null;
  for (const ent of Object.values(entitlements)) {
    const expiresIso = typeof ent.expires_date === "string" ? ent.expires_date : null;
    const graceIso =
      typeof ent.grace_period_expires_date === "string"
        ? ent.grace_period_expires_date
        : null;
    let expiresMs: number;
    let effectiveIso: string | null = expiresIso;
    if (expiresIso === null) {
      expiresMs = Number.POSITIVE_INFINITY;
    } else {
      const parsed = Date.parse(expiresIso);
      if (Number.isNaN(parsed)) continue;
      if (parsed > nowMs) {
        expiresMs = parsed;
      } else {
        const graceParsed = graceIso !== null ? Date.parse(graceIso) : NaN;
        if (Number.isNaN(graceParsed) || graceParsed <= nowMs) {
          continue;
        }
        expiresMs = graceParsed;
        effectiveIso = graceIso;
      }
    }
    const candidate: ActiveEntitlement = {
      expiresAt: effectiveIso,
      expiresMs,
      productId: typeof ent.product_identifier === "string" ? ent.product_identifier : null,
    };
    if (!best || candidate.expiresMs > best.expiresMs) {
      best = candidate;
    }
  }
  return best;
}

export { PREMIUM_MONTHLY_ALLOWANCE, RC_STRIPE_MODE_MARKER, UUID_REGEX };
