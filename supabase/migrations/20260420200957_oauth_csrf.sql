-- Migration: oauth_csrf — CSRF token storage for Google Calendar OAuth flow
--
-- Context: Prompt 3 / Wave 1 (Security). The `google_calendar_auth` edge
-- function previously used `state: user.id` in the OAuth request — `user.id`
-- is an enumerable UUID, so it gives zero CSRF protection. An attacker could
-- craft a consent URL with a victim's UUID and trick them into linking an
-- attacker-controlled Google Calendar to the victim's BURS account (or vice
-- versa, depending on how the callback is triggered).
--
-- Replacement: a random single-use CSRF token stored in this table, bound to
-- the user that initiated the flow, with a 10-minute TTL. The `state` param
-- becomes `<user_id>.<csrf_token>`. On callback the function re-authenticates
-- the caller via JWT, splits the state, verifies the token exists, is not
-- expired, matches the caller's user_id, and then DELETEs the row to enforce
-- one-time use.
--
-- Table shape:
--   * token        UUID primary key — the CSRF nonce (crypto.randomUUID on
--                  the edge function side).
--   * user_id      UUID FK to auth.users with ON DELETE CASCADE — account
--                  deletion should not leave orphan CSRF rows.
--   * expires_at   TIMESTAMPTZ — enforced on read, 10 minutes from insert.
--                  Indexed because the hourly cleanup cron scans by this.
--   * created_at   TIMESTAMPTZ DEFAULT NOW() — operational observability only.
--
-- RLS: the table is written/read exclusively by the service role in the edge
-- function. RLS is enabled with NO policies so `anon` / `authenticated`
-- clients cannot touch it directly. Service role bypasses RLS.
--
-- Cleanup: pg_cron job `oauth_csrf_cleanup` runs hourly, deleting expired
-- rows. pg_cron is already enabled by the initial schema migration.

CREATE TABLE IF NOT EXISTS public.oauth_csrf (
  token      UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_csrf_expires_at_idx
  ON public.oauth_csrf (expires_at);

ALTER TABLE public.oauth_csrf ENABLE ROW LEVEL SECURITY;

-- No policies: only the service role (which bypasses RLS) touches this table.
-- Authenticated and anon roles get zero access.

-- Hourly cleanup of expired tokens.
-- Idempotent: unschedule first to avoid "job already exists" errors when
-- re-applying the migration on a clean DB that happens to already have the job.
DO $$
BEGIN
  PERFORM cron.unschedule('oauth_csrf_cleanup');
EXCEPTION WHEN OTHERS THEN
  -- Job did not exist — fine.
  NULL;
END $$;

SELECT cron.schedule(
  'oauth_csrf_cleanup',
  '0 * * * *',
  $cron$DELETE FROM public.oauth_csrf WHERE expires_at < NOW()$cron$
);
