import { describe, expect, it } from 'vitest';

import {
  classifyRevenueCatEvent,
  deriveEventId,
  deriveEventTimestampMs,
  extractTransferOriginIds,
  isMutationEventType,
  isStripeActivelyPaying,
  parseExpirationMs,
  RevenueCatEvent,
  unwrapEvent,
} from '../revenuecat-state-machine';

const userA = "aaaaaaaa-bbbb-cccc-dddd-000000000001";
const userB = "aaaaaaaa-bbbb-cccc-dddd-000000000002";
const userC = "aaaaaaaa-bbbb-cccc-dddd-000000000003";

describe('revenuecat-state-machine', () => {
  it('unwrapEvent — top-level event with type', () => {
    const result = unwrapEvent({ type: "RENEWAL", app_user_id: userA });
    expect(result?.type).toEqual("RENEWAL");
  });

  it('unwrapEvent — envelope with nested event', () => {
    const result = unwrapEvent({ api_version: "1.0", event: { type: "EXPIRATION", app_user_id: userA } });
    expect(result?.type).toEqual("EXPIRATION");
  });

  it('unwrapEvent — non-object returns null', () => {
    expect(unwrapEvent("hello")).toEqual(null);
    expect(unwrapEvent(null)).toEqual(null);
    expect(unwrapEvent(undefined)).toEqual(null);
  });

  it('deriveEventId — prefers id, falls back to event_id', () => {
    expect(deriveEventId({ id: "evt_1" })).toEqual("evt_1");
    expect(deriveEventId({ event_id: "evt_2" })).toEqual("evt_2");
    expect(deriveEventId({ id: "", event_id: "evt_3" })).toEqual("evt_3");
    expect(deriveEventId({})).toEqual(null);
  });

  it('deriveEventTimestampMs — numeric ms wins, ISO fallback', () => {
    expect(deriveEventTimestampMs({ event_timestamp_ms: 1700000000000 })).toEqual(1700000000000);
    expect(
      deriveEventTimestampMs({ event_timestamp_at: "2024-01-01T00:00:00Z" } as RevenueCatEvent),
    ).toEqual(Date.parse("2024-01-01T00:00:00Z"));
    expect(deriveEventTimestampMs({})).toEqual(null);
    expect(deriveEventTimestampMs({ event_timestamp_ms: Number.NaN })).toEqual(null);
    expect(deriveEventTimestampMs({ event_timestamp_ms: -5 })).toEqual(null);
  });

  it('parseExpirationMs — valid number to ISO, invalid to null', () => {
    const iso = parseExpirationMs(1700000000000);
    expect(iso).toEqual(new Date(1700000000000).toISOString());
    expect(parseExpirationMs(0)).toEqual(null);
    expect(parseExpirationMs(-1)).toEqual(null);
    expect(parseExpirationMs("not a number")).toEqual(null);
    expect(parseExpirationMs(Number.NaN)).toEqual(null);
  });

  it('isStripeActivelyPaying — live/test + active/trialing only', () => {
    expect(isStripeActivelyPaying({ stripe_mode: "live", status: "active" })).toEqual(true);
    expect(isStripeActivelyPaying({ stripe_mode: "test", status: "trialing" })).toEqual(true);
    expect(isStripeActivelyPaying({ stripe_mode: "live", status: "canceled" })).toEqual(false);
    expect(isStripeActivelyPaying({ stripe_mode: "revenuecat", status: "active" })).toEqual(false);
    expect(isStripeActivelyPaying({ stripe_mode: null, status: "active" })).toEqual(false);
    expect(isStripeActivelyPaying(null)).toEqual(false);
  });

  it('extractTransferOriginIds — array + single + dedup, UUIDs only', () => {
    const result = extractTransferOriginIds({
      transferred_from: [userA, userB, "not-a-uuid", userA],
      original_app_user_id: userC,
    });
    expect(result.sort()).toEqual([userA, userB, userC].sort());
  });

  it('extractTransferOriginIds — rejects non-uuid single', () => {
    const result = extractTransferOriginIds({ original_app_user_id: "$RCAnonymousID:abc" });
    expect(result).toEqual([]);
  });

  it('isMutationEventType — known mutations true, others false', () => {
    for (const t of ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE", "EXPIRATION", "BILLING_ISSUE"]) {
      expect(isMutationEventType(t), t).toEqual(true);
    }
    for (const t of ["TRANSFER", "CANCELLATION", "TEST", "SUBSCRIBER_ALIAS", ""]) {
      expect(isMutationEventType(t), t).toEqual(false);
    }
  });

  it('classifyRevenueCatEvent — SUBSCRIBER_ALIAS routes to alias_recovery_check', () => {
    const t = classifyRevenueCatEvent({ type: "SUBSCRIBER_ALIAS", app_user_id: userA });
    expect(t.kind).toEqual("alias_recovery_check");
  });

  it('classifyRevenueCatEvent — missing app_user_id noops', () => {
    const t = classifyRevenueCatEvent({ type: "RENEWAL" });
    expect(t.kind).toEqual("noop");
  });

  it('classifyRevenueCatEvent — anonymous id noops', () => {
    const t = classifyRevenueCatEvent({ type: "RENEWAL", app_user_id: "$RCAnonymousID:xyz" });
    expect(t.kind).toEqual("noop");
  });

  it('classifyRevenueCatEvent — non-uuid app_user_id permanent_skip', () => {
    const t = classifyRevenueCatEvent({ type: "RENEWAL", app_user_id: "not-a-uuid" });
    expect(t.kind).toEqual("permanent_skip");
    if (t.kind === "permanent_skip") {
      expect(t.code).toEqual("22P02");
    }
  });

  it('classifyRevenueCatEvent — INITIAL_PURCHASE -> upsert_active', () => {
    const t = classifyRevenueCatEvent({
      type: "INITIAL_PURCHASE",
      app_user_id: userA,
      product_id: "prod_x",
      expiration_at_ms: 1700000000000,
      event_timestamp_ms: 1699999999000,
    });
    expect(t.kind).toEqual("upsert_active");
    if (t.kind === "upsert_active") {
      expect(t.userId).toEqual(userA);
      expect(t.status).toEqual("active");
      expect(t.productId).toEqual("prod_x");
      expect(t.periodEnd).toEqual(new Date(1700000000000).toISOString());
      expect(t.eventTimestampMs).toEqual(1699999999000);
    }
  });

  it('classifyRevenueCatEvent — RENEWAL -> upsert_active', () => {
    const t = classifyRevenueCatEvent({ type: "RENEWAL", app_user_id: userA });
    expect(t.kind).toEqual("upsert_active");
  });

  it('classifyRevenueCatEvent — NON_RENEWING_PURCHASE without expiration noops', () => {
    const t = classifyRevenueCatEvent({ type: "NON_RENEWING_PURCHASE", app_user_id: userA });
    expect(t.kind).toEqual("noop");
    if (t.kind === "noop") {
      expect(t.reason).toEqual("non_renewing_missing_expiration");
    }
  });

  it('classifyRevenueCatEvent — NON_RENEWING_PURCHASE with expiration -> upsert_active', () => {
    const t = classifyRevenueCatEvent({
      type: "NON_RENEWING_PURCHASE",
      app_user_id: userA,
      expiration_at_ms: 1800000000000,
    });
    expect(t.kind).toEqual("upsert_active");
  });

  it('classifyRevenueCatEvent — TRANSFER carries origin ids', () => {
    const t = classifyRevenueCatEvent({
      type: "TRANSFER",
      app_user_id: userA,
      transferred_from: [userB, userC],
      expiration_at_ms: 1800000000000,
      event_timestamp_ms: 1700000000000,
    });
    expect(t.kind).toEqual("transfer");
    if (t.kind === "transfer") {
      expect(t.userId).toEqual(userA);
      expect(t.originIds.sort()).toEqual([userB, userC].sort());
      expect(t.eventTimestampMs).toEqual(1700000000000);
    }
  });

  it('classifyRevenueCatEvent — TRANSFER skips origin equal to new user', () => {
    const t = classifyRevenueCatEvent({
      type: "TRANSFER",
      app_user_id: userA,
      transferred_from: [userA, userB],
    });
    expect(t.kind).toEqual("transfer");
    if (t.kind === "transfer") {
      expect(t.originIds).toEqual([userB]);
    }
  });

  it('classifyRevenueCatEvent — CANCELLATION -> cancellation_touch', () => {
    const t = classifyRevenueCatEvent({
      type: "CANCELLATION",
      app_user_id: userA,
      event_timestamp_ms: 1700000000000,
    });
    expect(t.kind).toEqual("cancellation_touch");
    if (t.kind === "cancellation_touch") {
      expect(t.eventTimestampMs).toEqual(1700000000000);
    }
  });

  it('classifyRevenueCatEvent — EXPIRATION -> end_of_life canceled', () => {
    const t = classifyRevenueCatEvent({
      type: "EXPIRATION",
      app_user_id: userA,
      event_timestamp_ms: 1700000000000,
    });
    expect(t.kind).toEqual("end_of_life");
    if (t.kind === "end_of_life") {
      expect(t.status).toEqual("canceled");
    }
  });

  it('classifyRevenueCatEvent — BILLING_ISSUE -> end_of_life past_due', () => {
    const t = classifyRevenueCatEvent({
      type: "BILLING_ISSUE",
      app_user_id: userA,
    });
    expect(t.kind).toEqual("end_of_life");
    if (t.kind === "end_of_life") {
      expect(t.status).toEqual("past_due");
    }
  });

  it('classifyRevenueCatEvent — TEST event is noop', () => {
    const t = classifyRevenueCatEvent({ type: "TEST", app_user_id: userA });
    expect(t.kind).toEqual("noop");
  });

  it('classifyRevenueCatEvent — unknown type is noop', () => {
    const t = classifyRevenueCatEvent({ type: "WHATEVER", app_user_id: userA });
    expect(t.kind).toEqual("noop");
  });

  it('out-of-order scenario: classifier emits stable transitions for stale & fresh pair', () => {
    const stale = classifyRevenueCatEvent({
      type: "RENEWAL",
      app_user_id: userA,
      event_timestamp_ms: 1700000900000,
    });
    const fresh = classifyRevenueCatEvent({
      type: "EXPIRATION",
      app_user_id: userA,
      event_timestamp_ms: 1700001000000,
    });
    expect(stale.kind).toEqual("upsert_active");
    expect(fresh.kind).toEqual("end_of_life");
    if (stale.kind === "upsert_active" && fresh.kind === "end_of_life") {
      expect(
        typeof stale.eventTimestampMs === "number" &&
          typeof fresh.eventTimestampMs === "number" &&
          stale.eventTimestampMs < fresh.eventTimestampMs,
      ).toEqual(true);
    }
  });
});
