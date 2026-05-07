-- M31 PR B — RevenueCat webhook idempotency log.
--
-- Mirrors the `stripe_events` pattern: every incoming RevenueCat webhook
-- payload is inserted by event_id (PRIMARY KEY) so duplicate deliveries
-- collapse to a single processing pass. The PRIMARY KEY constraint also
-- serializes parallel deliveries of the same event_id — exactly one
-- caller will succeed at the INSERT, the rest will see a unique-violation
-- and short-circuit.
--
-- RLS is enabled with NO public policy: only the service_role (edge
-- function) writes here. End users have no need to read the event log.
--
-- Idempotent across re-runs (CREATE TABLE IF NOT EXISTS / CREATE INDEX
-- IF NOT EXISTS) so reapplying this migration on environments that
-- already have it is a no-op.
--
-- Retry semantics (Codex P0 on PR #759):
--   `processed_at` is NULLABLE so the webhook can claim the row before
--   handleEvent() runs and only stamp the processed timestamp on success.
--   If handleEvent() fails transiently (DB blip, network) the row stays
--   `processed_at IS NULL`. RevenueCat's next retry sees the pending row
--   on the idempotency check, increments `attempts`, and reprocesses.
--   Without this, a transient failure on the FIRST attempt would set
--   processed_at=now() via the default and silently swallow every retry
--   as `already_processed` — losing the subscription state mutation.

CREATE TABLE IF NOT EXISTS public.revenuecat_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  app_user_id text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  error text
);

CREATE INDEX IF NOT EXISTS idx_revenuecat_events_user
  ON public.revenuecat_events (app_user_id, processed_at DESC);

-- Partial index over rows that haven't completed processing yet — used by
-- ops dashboards to surface stuck events that need manual replay, and by
-- future cleanup crons that want to reap old pending claims.
CREATE INDEX IF NOT EXISTS idx_revenuecat_events_pending
  ON public.revenuecat_events (app_user_id)
  WHERE processed_at IS NULL;

ALTER TABLE public.revenuecat_events ENABLE ROW LEVEL SECURITY;

-- No public policy: service-role only writes here.
