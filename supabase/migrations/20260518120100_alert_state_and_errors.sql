-- ============================================================================
-- alert_check infrastructure: edge_function_errors + alert_state + pg_cron
--
-- Pre-launch sprint PR 2. Adds the schema needed for the alert_check edge
-- function to evaluate 6 business-critical rules every 5 min and fire to
-- Discord. See supabase/functions/alert_check/index.ts for the rule bodies.
--
-- New tables:
--   * public.edge_function_errors — append-only error event stream populated
--     by `captureError` in _shared/observability.ts. Queryable for rate-based
--     alerts (rules 4 + 5). 7-day retention via hourly cron.
--   * public.alert_state — single-row-per-rule dedupe map. Stores
--     last_fired_at so a single breach can't spam Discord every cron tick;
--     alert_check skips any rule whose last_fired_at is within the last 30 min.
--
-- New cron jobs:
--   * alert_check_every_5min — invokes alert_check via net.http_post with the
--     shared render_worker_bearer (same auth as process_render_jobs cron).
--   * cleanup_edge_function_errors — hourly retention sweep.
--
-- Webhook URL: alert_check reads `alert_webhook_url` from vault.decrypted_secrets
-- at runtime; this migration does NOT create that secret (user provisions it
-- before merge — function tolerates absence and no-ops).
-- ============================================================================

-- ─── edge_function_errors ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.edge_function_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  error_class text,
  error_message text,
  user_id uuid,
  request_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_efe_fn_created
  ON public.edge_function_errors (function_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_efe_created
  ON public.edge_function_errors (created_at DESC);

ALTER TABLE public.edge_function_errors ENABLE ROW LEVEL SECURITY;

-- service_role only — no end-user policies. Errors are an operational
-- telemetry stream; anon/authenticated callers must never read or write.
-- (Absence of any FOR ALL / FOR SELECT policy on an RLS-enabled table means
-- non-service-role queries are rejected by default.)

-- ─── alert_state ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alert_state (
  rule_name text PRIMARY KEY,
  last_fired_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_state ENABLE ROW LEVEL SECURITY;

-- service_role only.

-- ─── cron: alert_check every 5 min ──────────────────────────────────────────
-- Same auth+URL pattern as process-render-jobs (see initial_schema.sql line
-- ~2724). render_worker_bearer is reused for all internal-cron worker auth so
-- bearer rotation stays a single-secret operation.
SELECT cron.schedule(
  'alert_check_every_5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'functions_base_url' LIMIT 1
    ) || '/functions/v1/alert_check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'render_worker_bearer' LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);

-- ─── cron: edge_function_errors retention (7 days, hourly sweep) ────────────
SELECT cron.schedule(
  'cleanup_edge_function_errors',
  '0 * * * *',
  $cron$
  DELETE FROM public.edge_function_errors
  WHERE created_at < NOW() - INTERVAL '7 days';
  $cron$
);
