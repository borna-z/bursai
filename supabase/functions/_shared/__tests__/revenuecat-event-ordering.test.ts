import { describe, expect, it } from "vitest";

import { isRevenueCatEventStale } from "../rc-event-ordering.ts";

/**
 * N2 — RevenueCat webhook out-of-order guard unit tests.
 *
 * Replaces the pre-N2 `updated_at`-based staleness check (which was
 * unreliable because `updated_at` is rewritten by CANCELLATION's touch
 * path AND by the manual sync handler — neither of which carry RC event
 * identity). The new comparator reads
 * `subscriptions.latest_revenuecat_event_timestamp_ms`, set by the
 * webhook on every successful RC-origin write.
 *
 * Test surface — covers the four corner cases:
 *   - inbound timestamp newer than stored → NOT stale (proceed).
 *   - inbound timestamp older than stored → stale (skip).
 *   - row has no stored RC timestamp (Stripe-origin row, or pre-N2 row
 *     before the webhook stamped one) → NOT stale (RC takes over).
 *   - inbound timestamp null (event lacks `event_timestamp_ms`) → NOT
 *     stale (no comparator; accept).
 */

function makeClient(row: { latest_revenuecat_event_timestamp_ms?: number | null } | null) {
  return {
    from(table: string) {
      if (table !== "subscriptions") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve({ data: row, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("isRevenueCatEventStale (N2)", () => {
  const userId = "aaaaaaaa-bbbb-cccc-dddd-000000000001";

  it("returns true when inbound event is older than the stored RC event timestamp", async () => {
    const stored = 1_700_000_500_000;
    const inbound = 1_700_000_400_000; // 100s older
    const client = makeClient({ latest_revenuecat_event_timestamp_ms: stored });

    expect(await isRevenueCatEventStale(client, userId, inbound)).toBe(true);
  });

  it("returns false when inbound event is newer than the stored timestamp", async () => {
    const stored = 1_700_000_400_000;
    const inbound = 1_700_000_500_000; // 100s newer
    const client = makeClient({ latest_revenuecat_event_timestamp_ms: stored });

    expect(await isRevenueCatEventStale(client, userId, inbound)).toBe(false);
  });

  it("returns false on equal timestamps (idempotent re-delivery; let dedup handle)", async () => {
    const ts = 1_700_000_400_000;
    const client = makeClient({ latest_revenuecat_event_timestamp_ms: ts });
    // The PK on revenuecat_events.event_id catches duplicates earlier;
    // the staleness gate is for OUT-OF-ORDER deliveries with different
    // event ids. Equal timestamps don't trigger stale (strict <).
    expect(await isRevenueCatEventStale(client, userId, ts)).toBe(false);
  });

  it("returns false when no subscriptions row exists for the user (first event wins)", async () => {
    const client = makeClient(null);
    expect(await isRevenueCatEventStale(client, userId, 1_700_000_500_000)).toBe(false);
  });

  it("returns false when the row has NULL latest_revenuecat_event_timestamp_ms (Stripe row / pre-N2)", async () => {
    const client = makeClient({ latest_revenuecat_event_timestamp_ms: null });
    // Stripe-origin rows never get this column written. Allow the inbound
    // RC event to take over so a Stripe→RC platform migration works.
    expect(await isRevenueCatEventStale(client, userId, 1_700_000_500_000)).toBe(false);
  });

  it("returns false when the row is missing the column entirely (defensive)", async () => {
    const client = makeClient({});
    expect(await isRevenueCatEventStale(client, userId, 1_700_000_500_000)).toBe(false);
  });

  it("returns false when the inbound event lacks event_timestamp_ms (null comparator)", async () => {
    const client = makeClient({ latest_revenuecat_event_timestamp_ms: 1_700_000_400_000 });
    expect(await isRevenueCatEventStale(client, userId, null)).toBe(false);
  });

  it("rejects non-finite stored timestamps as 'no comparator' (defensive)", async () => {
    const client = makeClient({ latest_revenuecat_event_timestamp_ms: Number.NaN });
    expect(await isRevenueCatEventStale(client, userId, 1_700_000_500_000)).toBe(false);
  });

  it("scenario: stale RENEWAL after newer EXPIRATION is correctly skipped", async () => {
    // The pre-N2 bug: an EXPIRATION lands at t=1000, later a RENEWAL with
    // event_timestamp_ms=900 (delivered out of order) reuses the same
    // user_id. Pre-N2 the comparator read `updated_at` which the
    // EXPIRATION had set to ~now() — wall-clock — not 1000. The
    // N2 comparator reads the stored RC event timestamp instead.
    const expirationTs = 1_700_001_000_000;
    const staleRenewalTs = 1_700_000_900_000;
    const client = makeClient({ latest_revenuecat_event_timestamp_ms: expirationTs });

    expect(await isRevenueCatEventStale(client, userId, staleRenewalTs)).toBe(true);
  });

  it("scenario: in-order EXPIRATION after RENEWAL is NOT skipped", async () => {
    const renewalTs = 1_700_000_900_000;
    const expirationTs = 1_700_001_000_000;
    const client = makeClient({ latest_revenuecat_event_timestamp_ms: renewalTs });

    expect(await isRevenueCatEventStale(client, userId, expirationTs)).toBe(false);
  });
});
