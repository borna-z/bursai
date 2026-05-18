-- =============================================================================
-- Synthetic monitor: happy-path observability for the memory-ingest pipeline
-- =============================================================================
--
-- Wave 8.5 PR B exposed a 4-day undetected breakage where the memory-ingest
-- pipeline silently no-op'd in production. This migration installs a 15-minute
-- synthetic that exercises the full path end-to-end:
--
--   1. Create a throwaway auth user (synthetic+<uuid>@burs.app)
--   2. Insert one garment for that user (service_role)
--   3. Call ingest_memory_event with a wear_outfit signal
--   4. Wait 30s, then assert user_style_summaries has a row (or dirty_at set)
--   5. Delete the user via auth.admin.deleteUser
--
-- Any step failure inserts a row into `synthetic_failures` and the function
-- returns 200 — cron stays green and the alert table tells the story (mirrors
-- the pattern used by process_render_jobs telemetry).
--
-- The cron body reads bearer + base URL from vault.secrets (preview branches
-- get their own values; production secrets never leak). See
-- docs/launch/findings/process-render-jobs-401.md for the rotation pattern.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. synthetic_failures table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.synthetic_failures (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  step        text NOT NULL,
  error_message text NOT NULL,
  error_class text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_synthetic_failures_created_at
  ON public.synthetic_failures (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_synthetic_failures_step
  ON public.synthetic_failures (step);

ALTER TABLE public.synthetic_failures ENABLE ROW LEVEL SECURITY;

-- Service-role only. No `authenticated` policy — synthetic failures are
-- operator-facing telemetry, not user data.
DROP POLICY IF EXISTS "service_role_all_synthetic_failures" ON public.synthetic_failures;
CREATE POLICY "service_role_all_synthetic_failures"
  ON public.synthetic_failures FOR ALL
  TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.synthetic_failures TO service_role;

-- ----------------------------------------------------------------------------
-- 2. pg_cron schedule (every 15 minutes)
-- ----------------------------------------------------------------------------
--
-- Bearer + base URL come from vault.secrets (NOT custom GUCs — per
-- CLAUDE.md, any authenticated user can read GUCs). Both secrets already
-- exist on the project (render_worker_bearer, functions_base_url).
SELECT cron.schedule(
  'synthetic_happy_path',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'functions_base_url' LIMIT 1
    ) || '/functions/v1/synthetic_monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'render_worker_bearer' LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    -- Synthetic run worst-case: create user + insert garment + RPC + 30s wait
    -- + select + delete user ≈ 35s under normal load. 90s leaves headroom for
    -- auth-admin latency spikes without overlapping the next 15-min tick.
    timeout_milliseconds := 90000
  );
  $cron$
);
