-- ============================================================================
-- Provision the `render_worker_bearer` vault entry used by the worker chain.
--
-- Background: see docs/launch/findings/process-render-jobs-401.md.
--
-- The cron command in 00000000000000_initial_schema.sql now reads
-- `vault.decrypted_secrets WHERE name = 'render_worker_bearer'` and POSTs
-- the value as the Authorization Bearer to /functions/v1/process_render_jobs.
-- The same bytes must be set as the RENDER_WORKER_BEARER env on every
-- function in the chain (process_render_jobs, render_garment_image,
-- cleanup_ai_cache, daily_reminders, process_job_queue, prefetch_suggestions)
-- so the timingSafeEqual checks succeed.
--
-- IMPORTANT — placeholder bytes only.
-- The user MUST generate the real bearer with `openssl rand -hex 32`,
-- then BEFORE deploy:
--   1. Replace the placeholder string below in this migration (commit only
--      if `vault.create_secret` has not yet run; otherwise leave the file
--      and rotate via vault.update_secret + Supabase secrets set).
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
-- Idempotency: guarded by `WHERE NOT EXISTS`, so re-running this migration
-- against a project that already has the secret is a no-op.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'render_worker_bearer'
  ) THEN
    PERFORM vault.create_secret(
      -- Placeholder — replace with `openssl rand -hex 32` before deploy.
      -- This 64-char hex is intentionally non-secret and recognisable so a
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
