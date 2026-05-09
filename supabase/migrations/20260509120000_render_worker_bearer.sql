-- ============================================================================
-- Provision the `render_worker_bearer` vault entry used by the worker chain
-- AND realign the existing process-render-jobs cron command on production
-- to read from it.
--
-- Background: see docs/launch/findings/process-render-jobs-401.md.
--
-- This migration applies on production via `npx supabase db push`. The
-- companion edit to `00000000000000_initial_schema.sql` (this same PR) is
-- only consulted on FRESH environments via `db reset`; it does NOT run
-- against the already-bootstrapped production project, so the
-- cron.alter_job below is what actually flips production over.
--
-- The same bytes must be set as the RENDER_WORKER_BEARER env on every
-- function in the chain (process_render_jobs, render_garment_image,
-- enqueue_render_job, cleanup_ai_cache, daily_reminders, process_job_queue,
-- prefetch_suggestions) so the timingSafeEqual checks succeed.
--
-- IMPORTANT — placeholder bytes only.
-- The user MUST generate the real bearer with `openssl rand -hex 32`,
-- then BEFORE deploy:
--   1. (Optional) Replace the placeholder string below in this migration
--      ONLY if `vault.create_secret` has not yet run on the target project.
--      Otherwise leave the file and rotate via vault.update_secret after
--      `db push`.
--   2. `npx supabase secrets set RENDER_WORKER_BEARER="<bearer>" \
--        --project-ref khvkwojtlkcvxjxztduj`
--   3. After running `db push`, rotate the vault entry to the real value
--      if the placeholder was committed:
--        SELECT vault.update_secret(
--          (SELECT id FROM vault.secrets WHERE name = 'render_worker_bearer'),
--          '<bearer>'
--        );
--   4. Redeploy every function in the worker chain (one at a time, never
--      `--all`).
--
-- Idempotency: vault.create_secret guarded by `WHERE NOT EXISTS`;
-- cron.alter_job is naturally idempotent (it overwrites the named job's
-- command, so re-running this migration on a project that has already
-- been flipped is a no-op).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'render_worker_bearer'
  ) THEN
    PERFORM vault.create_secret(
      -- Placeholder — replace with `openssl rand -hex 32` before deploy.
      -- The bytes are intentionally non-secret and recognisable so a
      -- forgotten placeholder shows up in code review and in the failing
      -- 401 response body of the first cron tick.
      'PLACEHOLDER_REPLACE_BEFORE_DEPLOY_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'render_worker_bearer',
      'Inter-function bearer for the render worker chain. Decoupled from '
        || 'SUPABASE_SERVICE_ROLE_KEY so it can be rotated without depending '
        || 'on the platform-managed service-role env (see '
        || 'docs/launch/findings/process-render-jobs-401.md).'
    );
  END IF;
END $$;

-- Realign the production process-render-jobs cron job. Look the job up by
-- name so the migration is portable across environments where pg_cron may
-- have assigned a different jobid. Same command body as the patched
-- 00000000000000_initial_schema.sql, only the vault key name differs.
DO $$
DECLARE
  target_jobid bigint;
BEGIN
  SELECT jobid INTO target_jobid
  FROM cron.job
  WHERE jobname = 'process-render-jobs'
  LIMIT 1;

  IF target_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id := target_jobid,
      command := $cron$
      SELECT net.http_post(
        url := (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'functions_base_url' LIMIT 1
        ) || '/functions/v1/process_render_jobs',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'render_worker_bearer' LIMIT 1
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 180000
      );
      $cron$
    );
  END IF;
END $$;
