-- N15 Codex round 1 — atomic rate-limit count + insert.
--
-- The previous `enforceRateLimit` did two SELECT count queries then a
-- separate INSERT. Even after the BE-P0-B5 fix that awaited the insert,
-- concurrent isolates serving the same (user, function) could all
-- complete the two count queries before any of them committed an
-- insert — so they all observed the same below-limit count and each
-- only awaited its own insert. Under a parallel burst the configured
-- minute/hour cap could still be exceeded, leaving the N15 bill-
-- shielding gate ineffective for the scenario it targets.
--
-- Fix: a SECURITY DEFINER function that runs the count + check + insert
-- inside one transaction, serialized per (user, function) via a
-- session-scoped advisory lock. Concurrent isolates queue on the lock;
-- by the time the second isolate runs its count, the first isolate's
-- insert is already committed. Denied calls do NOT insert (clean
-- accounting), which also stops a 429-stormed user from polluting their
-- own rate-limit window.
--
-- Return shape:
--   allowed       boolean      — true when both gates pass
--   minute_count  integer      — count IN the last 60s BEFORE insert
--   hour_count    integer      — count IN the last 3600s BEFORE insert
--   reason        text | null  — 'minute' or 'hour' on denial, null on allow

CREATE OR REPLACE FUNCTION public.record_and_check_rate_limit(
  p_user_id uuid,
  p_function_name text,
  p_max_per_minute integer,
  p_max_per_hour integer
)
RETURNS TABLE(
  allowed boolean,
  minute_count integer,
  hour_count integer,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minute integer;
  v_hour integer;
BEGIN
  -- Serialize concurrent isolates for the same (user, function). The
  -- advisory lock is transaction-scoped so it auto-releases at COMMIT
  -- and never leaks across statements. `hashtextextended` provides a
  -- 64-bit hash; `hashtext` is 32-bit and risks collisions when two
  -- different (user, function) pairs hash to the same key — we'd see
  -- false serialization across unrelated users, harming throughput
  -- without harming correctness.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || '|' || p_function_name, 0)
  );

  SELECT count(*)::integer
    INTO v_minute
    FROM public.ai_rate_limits
   WHERE user_id = p_user_id
     AND function_name = p_function_name
     AND called_at >= NOW() - INTERVAL '1 minute';

  SELECT count(*)::integer
    INTO v_hour
    FROM public.ai_rate_limits
   WHERE user_id = p_user_id
     AND function_name = p_function_name
     AND called_at >= NOW() - INTERVAL '1 hour';

  IF v_minute >= p_max_per_minute THEN
    RETURN QUERY SELECT false, v_minute, v_hour, 'minute'::text;
    RETURN;
  END IF;

  IF v_hour >= p_max_per_hour THEN
    RETURN QUERY SELECT false, v_minute, v_hour, 'hour'::text;
    RETURN;
  END IF;

  INSERT INTO public.ai_rate_limits (user_id, function_name)
  VALUES (p_user_id, p_function_name);

  RETURN QUERY SELECT true, v_minute, v_hour, NULL::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_and_check_rate_limit(uuid, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_and_check_rate_limit(uuid, text, integer, integer)
  TO service_role;
