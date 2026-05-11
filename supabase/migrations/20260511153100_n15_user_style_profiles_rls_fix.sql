-- N15/B1 — Close cross-user data-leak on user_style_profiles.
--
-- The initial schema (00000000000000_initial_schema.sql:1990) created:
--   CREATE POLICY "Service role full access to style profiles"
--     ON public.user_style_profiles USING (true) WITH CHECK (true);
--
-- The missing `TO service_role` clause means the policy applies to PUBLIC.
-- Under Postgres permissive RLS, policies layer additively — so this
-- wide-open `USING (true)` overrode the sibling owner-scoped policies and
-- gave every authenticated user SELECT/INSERT/UPDATE access to every other
-- user's style profile via PostgREST.
--
-- Fix: drop and recreate the policy with `TO service_role`. The
-- owner-scoped INSERT/SELECT/UPDATE policies (initial schema lines
-- 1994 / 2076 / 2084) remain and continue to protect authenticated-role
-- access. service_role bypasses RLS regardless, so the new policy is
-- technically redundant — kept for documentation continuity.

BEGIN;

DROP POLICY IF EXISTS "Service role full access to style profiles"
  ON public.user_style_profiles;

CREATE POLICY "Service role full access to style profiles"
  ON public.user_style_profiles
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
