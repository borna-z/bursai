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

CREATE TABLE IF NOT EXISTS public.revenuecat_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  app_user_id text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  error text
);

CREATE INDEX IF NOT EXISTS idx_revenuecat_events_user
  ON public.revenuecat_events (app_user_id, processed_at DESC);

ALTER TABLE public.revenuecat_events ENABLE ROW LEVEL SECURITY;

-- No public policy: service-role only writes here.
