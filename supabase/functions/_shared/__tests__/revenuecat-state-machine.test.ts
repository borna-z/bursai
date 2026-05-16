import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

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
} from "../revenuecat-state-machine.ts";

const userA = "aaaaaaaa-bbbb-cccc-dddd-000000000001";
const userB = "aaaaaaaa-bbbb-cccc-dddd-000000000002";
const userC = "aaaaaaaa-bbbb-cccc-dddd-000000000003";

Deno.test("unwrapEvent — top-level event with type", () => {
  const result = unwrapEvent({ type: "RENEWAL", app_user_id: userA });
  assertEquals(result?.type, "RENEWAL");
});

Deno.test("unwrapEvent — envelope with nested event", () => {
  const result = unwrapEvent({ api_version: "1.0", event: { type: "EXPIRATION", app_user_id: userA } });
  assertEquals(result?.type, "EXPIRATION");
});

Deno.test("unwrapEvent — non-object returns null", () => {
  assertEquals(unwrapEvent("hello"), null);
  assertEquals(unwrapEvent(null), null);
  assertEquals(unwrapEvent(undefined), null);
});

Deno.test("deriveEventId — prefers id, falls back to event_id", () => {
  assertEquals(deriveEventId({ id: "evt_1" }), "evt_1");
  assertEquals(deriveEventId({ event_id: "evt_2" }), "evt_2");
  assertEquals(deriveEventId({ id: "", event_id: "evt_3" }), "evt_3");
  assertEquals(deriveEventId({}), null);
});

Deno.test("deriveEventTimestampMs — numeric ms wins, ISO fallback", () => {
  assertEquals(deriveEventTimestampMs({ event_timestamp_ms: 1700000000000 }), 1700000000000);
  assertEquals(
    deriveEventTimestampMs({ event_timestamp_at: "2024-01-01T00:00:00Z" } as RevenueCatEvent),
    Date.parse("2024-01-01T00:00:00Z"),
  );
  assertEquals(deriveEventTimestampMs({}), null);
  assertEquals(deriveEventTimestampMs({ event_timestamp_ms: Number.NaN }), null);
  assertEquals(deriveEventTimestampMs({ event_timestamp_ms: -5 }), null);
});

Deno.test("parseExpirationMs — valid number to ISO, invalid to null", () => {
  const iso = parseExpirationMs(1700000000000);
  assertEquals(iso, new Date(1700000000000).toISOString());
  assertEquals(parseExpirationMs(0), null);
  assertEquals(parseExpirationMs(-1), null);
  assertEquals(parseExpirationMs("not a number"), null);
  assertEquals(parseExpirationMs(Number.NaN), null);
});

Deno.test("isStripeActivelyPaying — live/test + active/trialing only", () => {
  assertEquals(isStripeActivelyPaying({ stripe_mode: "live", status: "active" }), true);
  assertEquals(isStripeActivelyPaying({ stripe_mode: "test", status: "trialing" }), true);
  assertEquals(isStripeActivelyPaying({ stripe_mode: "live", status: "canceled" }), false);
  assertEquals(isStripeActivelyPaying({ stripe_mode: "revenuecat", status: "active" }), false);
  assertEquals(isStripeActivelyPaying({ stripe_mode: null, status: "active" }), false);
  assertEquals(isStripeActivelyPaying(null), false);
});

Deno.test("extractTransferOriginIds — array + single + dedup, UUIDs only", () => {
  const result = extractTransferOriginIds({
    transferred_from: [userA, userB, "not-a-uuid", userA],
    original_app_user_id: userC,
  });
  assertEquals(result.sort(), [userA, userB, userC].sort());
});

Deno.test("extractTransferOriginIds — rejects non-uuid single", () => {
  const result = extractTransferOriginIds({ original_app_user_id: "$RCAnonymousID:abc" });
  assertEquals(result, []);
});

Deno.test("isMutationEventType — known mutations true, others false", () => {
  for (const t of ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE", "EXPIRATION", "BILLING_ISSUE"]) {
    assertEquals(isMutationEventType(t), true, t);
  }
  for (const t of ["TRANSFER", "CANCELLATION", "TEST", "SUBSCRIBER_ALIAS", ""]) {
    assertEquals(isMutationEventType(t), false, t);
  }
});

Deno.test("classifyRevenueCatEvent — SUBSCRIBER_ALIAS routes to alias_recovery_check", () => {
  const t = classifyRevenueCatEvent({ type: "SUBSCRIBER_ALIAS", app_user_id: userA });
  assertEquals(t.kind, "alias_recovery_check");
});

Deno.test("classifyRevenueCatEvent — missing app_user_id noops", () => {
  const t = classifyRevenueCatEvent({ type: "RENEWAL" });
  assertEquals(t.kind, "noop");
});

Deno.test("classifyRevenueCatEvent — anonymous id noops", () => {
  const t = classifyRevenueCatEvent({ type: "RENEWAL", app_user_id: "$RCAnonymousID:xyz" });
  assertEquals(t.kind, "noop");
});

Deno.test("classifyRevenueCatEvent — non-uuid app_user_id permanent_skip", () => {
  const t = classifyRevenueCatEvent({ type: "RENEWAL", app_user_id: "not-a-uuid" });
  assertEquals(t.kind, "permanent_skip");
  if (t.kind === "permanent_skip") {
    assertEquals(t.code, "22P02");
  }
});

Deno.test("classifyRevenueCatEvent — INITIAL_PURCHASE -> upsert_active", () => {
  const t = classifyRevenueCatEvent({
    type: "INITIAL_PURCHASE",
    app_user_id: userA,
    product_id: "prod_x",
    expiration_at_ms: 1700000000000,
    event_timestamp_ms: 1699999999000,
  });
  assertEquals(t.kind, "upsert_active");
  if (t.kind === "upsert_active") {
    assertEquals(t.userId, userA);
    assertEquals(t.status, "active");
    assertEquals(t.productId, "prod_x");
    assertEquals(t.periodEnd, new Date(1700000000000).toISOString());
    assertEquals(t.eventTimestampMs, 1699999999000);
  }
});

Deno.test("classifyRevenueCatEvent — RENEWAL -> upsert_active", () => {
  const t = classifyRevenueCatEvent({ type: "RENEWAL", app_user_id: userA });
  assertEquals(t.kind, "upsert_active");
});

Deno.test("classifyRevenueCatEvent — NON_RENEWING_PURCHASE without expiration noops", () => {
  const t = classifyRevenueCatEvent({ type: "NON_RENEWING_PURCHASE", app_user_id: userA });
  assertEquals(t.kind, "noop");
  if (t.kind === "noop") {
    assertEquals(t.reason, "non_renewing_missing_expiration");
  }
});

Deno.test("classifyRevenueCatEvent — NON_RENEWING_PURCHASE with expiration -> upsert_active", () => {
  const t = classifyRevenueCatEvent({
    type: "NON_RENEWING_PURCHASE",
    app_user_id: userA,
    expiration_at_ms: 1800000000000,
  });
  assertEquals(t.kind, "upsert_active");
});

Deno.test("classifyRevenueCatEvent — TRANSFER carries origin ids", () => {
  const t = classifyRevenueCatEvent({
    type: "TRANSFER",
    app_user_id: userA,
    transferred_from: [userB, userC],
    expiration_at_ms: 1800000000000,
    event_timestamp_ms: 1700000000000,
  });
  assertEquals(t.kind, "transfer");
  if (t.kind === "transfer") {
    assertEquals(t.userId, userA);
    assertEquals(t.originIds.sort(), [userB, userC].sort());
    assertEquals(t.eventTimestampMs, 1700000000000);
  }
});

Deno.test("classifyRevenueCatEvent — TRANSFER skips origin equal to new user", () => {
  const t = classifyRevenueCatEvent({
    type: "TRANSFER",
    app_user_id: userA,
    transferred_from: [userA, userB],
  });
  assertEquals(t.kind, "transfer");
  if (t.kind === "transfer") {
    assertEquals(t.originIds, [userB]);
  }
});

Deno.test("classifyRevenueCatEvent — CANCELLATION -> cancellation_touch", () => {
  const t = classifyRevenueCatEvent({
    type: "CANCELLATION",
    app_user_id: userA,
    event_timestamp_ms: 1700000000000,
  });
  assertEquals(t.kind, "cancellation_touch");
  if (t.kind === "cancellation_touch") {
    assertEquals(t.eventTimestampMs, 1700000000000);
  }
});

Deno.test("classifyRevenueCatEvent — EXPIRATION -> end_of_life canceled", () => {
  const t = classifyRevenueCatEvent({
    type: "EXPIRATION",
    app_user_id: userA,
    event_timestamp_ms: 1700000000000,
  });
  assertEquals(t.kind, "end_of_life");
  if (t.kind === "end_of_life") {
    assertEquals(t.status, "canceled");
  }
});

Deno.test("classifyRevenueCatEvent — BILLING_ISSUE -> end_of_life past_due", () => {
  const t = classifyRevenueCatEvent({
    type: "BILLING_ISSUE",
    app_user_id: userA,
  });
  assertEquals(t.kind, "end_of_life");
  if (t.kind === "end_of_life") {
    assertEquals(t.status, "past_due");
  }
});

Deno.test("classifyRevenueCatEvent — TEST event is noop", () => {
  const t = classifyRevenueCatEvent({ type: "TEST", app_user_id: userA });
  assertEquals(t.kind, "noop");
});

Deno.test("classifyRevenueCatEvent — unknown type is noop", () => {
  const t = classifyRevenueCatEvent({ type: "WHATEVER", app_user_id: userA });
  assertEquals(t.kind, "noop");
});

Deno.test("out-of-order scenario: classifier emits stable transitions for stale & fresh pair", () => {
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
  assertEquals(stale.kind, "upsert_active");
  assertEquals(fresh.kind, "end_of_life");
  if (stale.kind === "upsert_active" && fresh.kind === "end_of_life") {
    assertEquals(
      typeof stale.eventTimestampMs === "number" &&
        typeof fresh.eventTimestampMs === "number" &&
        stale.eventTimestampMs < fresh.eventTimestampMs,
      true,
    );
  }
});
