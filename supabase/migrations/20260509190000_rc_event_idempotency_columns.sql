-- N2 — RevenueCat webhook ordering hardening: per-row event idempotency markers.
--
-- Problem: today the RC webhook's out-of-order guard (`isStaleEvent` in
-- supabase/functions/revenuecat_webhook/index.ts) compares the inbound
-- `event_timestamp_ms` against the row's `subscriptions.updated_at`. That
-- column is rewritten by EVERY mutation that touches the row — including
-- the SELECT-before-write Stripe-protection branch's CANCELLATION touch
-- and the manual sync path — so two RC events arriving out-of-order from
-- different state-transition kinds (e.g. RENEWAL after EXPIRATION) can
-- silently lose the older one OR re-apply a stale one because
-- `updated_at` doesn't carry the originating event identity.
--
-- Fix: stamp the originating event's id + timestamp on every successful
-- subscriptions write from `revenuecat_webhook`, and have the staleness
-- guard read THIS column instead of `updated_at`. The column is
-- nullable so existing rows (Stripe subscribers, pre-RC users) don't
-- block the migration; the webhook treats null as "no prior RC event"
-- and accepts the inbound write.
--
-- The matching index `(user_id, latest_revenuecat_event_timestamp_ms DESC)`
-- supports the hot-path read inside `isStaleEvent` (single row by user_id;
-- the trailing column lets future analytics queries scan recent RC
-- mutations without a sort).
--
-- Idempotent across re-runs (ADD COLUMN IF NOT EXISTS / CREATE INDEX
-- IF NOT EXISTS) so reapplying this migration is a no-op.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS latest_revenuecat_event_id text,
  ADD COLUMN IF NOT EXISTS latest_revenuecat_event_timestamp_ms bigint;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_rc_event_ts
  ON public.subscriptions (user_id, latest_revenuecat_event_timestamp_ms DESC);

COMMENT ON COLUMN public.subscriptions.latest_revenuecat_event_id IS
  'RevenueCat event id that produced the most recent successful write to this row. Set by revenuecat_webhook only. Used together with latest_revenuecat_event_timestamp_ms for out-of-order detection (N2).';

COMMENT ON COLUMN public.subscriptions.latest_revenuecat_event_timestamp_ms IS
  'event_timestamp_ms of the RevenueCat event that produced the most recent successful write to this row. Authoritative ordering signal; replaces the `updated_at`-based staleness check (N2).';
