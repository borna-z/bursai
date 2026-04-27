-- Wave 7 audit P0 #1: bound the onboarding garment counter.
--
-- Context: 20260426120000_onboarding_state.sql shipped
-- `increment_onboarding_garment_count(p_user_id)` with an unconditional UPDATE
-- that adds 1 to `onboarding_garment_count` regardless of step or current value.
-- Combined with the Wave 7 P43 scale-guard 3x boost (active while
-- `onboarding_step <> 'completed'` AND `onboarding_started_at` is within 24h),
-- a malicious caller can hammer the RPC tens of thousands of times while
-- stalling mid-onboarding to indefinitely abuse the boost. The 24h window
-- caps the boost duration but the counter itself is unbounded.
--
-- Fix: replace the function body with a guarded UPDATE that refuses to
-- increment past 200 OR once `onboarding_step = 'completed'`. 200 is a generous
-- ceiling — the BatchCapture screen (P47) caps at 50 garments per session, so
-- 200 leaves 4x headroom for retries / soft re-entries / future expansion.
--
-- Failure mode: when the guard rejects the UPDATE, the function returns the
-- CURRENT count instead of erroring. Callers (the BatchCapture client) treat
-- the response as "this is your count now" — silently capping is the correct
-- UX. Erroring would force the client to handle a new error code without
-- adding value: the next valid increment simply won't happen.
--
-- This migration is purely a function rewrite — no schema changes, no data
-- migration, idempotent on re-apply. Existing column-level UPDATE GRANTs from
-- 20260426120000 still apply: only the SECURITY DEFINER RPC and service_role
-- can mutate `onboarding_garment_count`.

BEGIN;

CREATE OR REPLACE FUNCTION public.increment_onboarding_garment_count(
  p_user_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count integer;
  v_current_count integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'caller does not own this profile'
      USING ERRCODE = '42501';
  END IF;

  -- Guarded UPDATE: only increment when (a) onboarding is still active and
  -- (b) we're under the 200-garment ceiling. RETURNING gives the post-update
  -- value; v_new_count stays NULL if zero rows matched.
  UPDATE public.profiles
  SET onboarding_garment_count = onboarding_garment_count + 1,
      updated_at = NOW()
  WHERE id = p_user_id
    AND onboarding_step <> 'completed'
    AND onboarding_garment_count < 200
  RETURNING onboarding_garment_count INTO v_new_count;

  -- Guard rejected the increment. Distinguish "profile missing" (real error)
  -- from "guard fired" (silent cap) by reading the current state.
  IF v_new_count IS NULL THEN
    SELECT onboarding_garment_count INTO v_current_count
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_current_count IS NULL THEN
      RAISE EXCEPTION 'profile not found for user %', p_user_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Cap reached or onboarding already completed — return current count
    -- without erroring. Caller observes the count didn't move and stops
    -- retrying.
    RETURN v_current_count;
  END IF;

  RETURN v_new_count;
END;
$$;

ALTER FUNCTION public.increment_onboarding_garment_count(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.increment_onboarding_garment_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_onboarding_garment_count(uuid)
  TO authenticated, service_role;

COMMIT;
