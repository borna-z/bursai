/**
 * N2 — RevenueCat webhook event-ordering helpers (extracted from
 * `supabase/functions/revenuecat_webhook/index.ts` so the comparator
 * is unit-testable without importing the index.ts entrypoint, which
 * calls `serve()` at module load and references Deno globals.
 *
 * The webhook compares the inbound `event_timestamp_ms` against the
 * authoritative `subscriptions.latest_revenuecat_event_timestamp_ms`
 * stamped on the row by the most recent RC-origin write. This replaces
 * the pre-N2 `updated_at`-based comparison (`updated_at` is rewritten
 * by the CANCELLATION touch and the manual sync path, so it doesn't
 * carry event identity).
 */

/** Minimal supabase-js shape — anything that supports `.from(...)` chains. */
// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

/**
 * Out-of-order guard.
 *
 *   - `eventTimestampMs === null` → false (no comparator; accept).
 *   - row missing → false (first event for user; accept).
 *   - stored timestamp null/undefined/non-finite → false (Stripe-origin
 *     row, or pre-N2 row that never had the column written; accept).
 *   - `eventTimestampMs < storedMs` → true (stale; caller skips).
 *
 * Exported separately from the webhook entrypoint so unit tests don't
 * pull in `serve()` / Deno-global side-effects at module load.
 */
export async function isRevenueCatEventStale(
  client: SupabaseLike,
  userId: string,
  eventTimestampMs: number | null,
): Promise<boolean> {
  if (eventTimestampMs === null) return false;
  const { data } = await client
    .from("subscriptions")
    .select("latest_revenuecat_event_timestamp_ms")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;
  const currentMs = (data as { latest_revenuecat_event_timestamp_ms?: number | null })
    .latest_revenuecat_event_timestamp_ms;
  if (currentMs === null || currentMs === undefined) return false;
  if (typeof currentMs !== "number" || !Number.isFinite(currentMs)) return false;
  return eventTimestampMs < currentMs;
}
