-- N15/B3 — Add cleanup_old_rate_limits() RPC + hourly cron.
--
-- `supabase/functions/_shared/scale-guard.ts:313` calls
-- `supabase.rpc("cleanup_old_rate_limits")` on a 1% probability per AI
-- call. The function was never defined in any migration. The .rpc() call
-- has its error eaten by `.then(() => {}, () => {})` so it silently
-- no-ops, and `ai_rate_limits` has been growing unbounded.
--
-- At 1k Day-1 Swedish users × dozens of AI calls each, the table writes
-- ~10-100k rows/day with zero pruning, slowly degrading the window-count
-- queries that the rate limiter itself depends on.
--
-- Mirrors `request_idempotency_cleanup` pattern from
-- `20260421170000_request_idempotency.sql`.

CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ai_rate_limits
   WHERE called_at < NOW() - INTERVAL '7 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;

-- Hourly cleanup. Idempotent: unschedule first so re-apply against a DB
-- that already has the job doesn't raise "job already exists".
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup_old_rate_limits_hourly');
EXCEPTION WHEN OTHERS THEN
  -- Job did not exist — fine.
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup_old_rate_limits_hourly',
  '13 * * * *',
  $cron$SELECT public.cleanup_old_rate_limits();$cron$
);
