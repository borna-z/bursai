-- N1 — Subscription + role write lockdown (CRITICAL paywall bypass).
--
-- Today the four tables below carry a single `FOR ALL USING (auth.uid() = user_id)`
-- policy from the initial schema baseline. Postgres treats `FOR ALL` with no
-- `WITH CHECK` as `WITH CHECK = USING`, so any authenticated user can run, against
-- the public Supabase REST API with their own anon JWT:
--
--   UPDATE public.subscriptions
--      SET plan = 'premium',
--          status = 'active',
--          current_period_end = '2099-01-01'
--    WHERE user_id = auth.uid();
--
-- The mobile entitlement check (`mobile/src/hooks/useSubscription.ts`) reads
-- exactly these columns and trusts them, so this is a complete paywall bypass.
-- The same hole exists on `user_subscriptions` (legacy mirror), `ai_rate_limits`
-- (lets a user reset their own rate-limit window), and `user_roles` (privilege
-- escalation surface — anyone could insert `role='admin'` for themselves).
--
-- Fix: drop the `FOR ALL` policies and recreate them as `FOR SELECT` only for
-- `authenticated`. Writes happen exclusively from edge functions running with
-- the service-role key (`SUPABASE_SERVICE_ROLE_KEY`) which bypasses RLS:
--
--   * `subscriptions` / `user_subscriptions` writes:
--       - `revenuecat_webhook` (iOS / Android purchase events)
--       - `stripe_webhook` (web purchase events; deprecated post-launch)
--       - `start_trial` (3-day Stripe trial mint on signup)
--       - `restore_subscription`, `create_checkout_session`,
--         `delete_user_account` (admin client paths)
--   * `ai_rate_limits` writes: `_shared/scale-guard.ts` enforceRateLimit() runs
--     with a service-role client throughout the AI edge functions.
--   * `user_roles` writes: only via admin RPCs / direct DB ops (no edge function
--     currently writes; the row exists for `is_admin()` lookups).
--
-- Mobile + web read paths are unaffected: SELECT remains permitted for the
-- owning user. Verified call sites:
--   - mobile/src/hooks/useSubscription.ts (SELECT only)
--   - mobile/src/hooks/usePurchaseSubscription.ts (SELECT only — post-purchase poll)
--   - mobile/src/hooks/useRestorePurchases.ts (SELECT only — restore poll)
--
-- Idempotency: every block uses DROP POLICY IF EXISTS + CREATE POLICY. The
-- CREATE will fail loudly if a same-named policy exists from a prior run, but
-- the DROP above guarantees that won't happen — and the policy names are new
-- (the old names were `Users can manage own *`).

BEGIN;

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
-- Writes only via service_role (revenuecat_webhook / stripe_webhook /
-- start_trial / restore_subscription / delete_user_account / admin RPCs).
DROP POLICY IF EXISTS "Users can manage own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;

CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_subscriptions
-- ---------------------------------------------------------------------------
-- Legacy mirror table; same write origins as `subscriptions`. Service_role only.
DROP POLICY IF EXISTS "Users can manage own user subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "user_subscriptions_select_own" ON public.user_subscriptions;

CREATE POLICY "user_subscriptions_select_own"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ai_rate_limits
-- ---------------------------------------------------------------------------
-- Writes only via service_role inside `_shared/scale-guard.ts` enforceRateLimit().
-- A user-side write would let any authenticated client wipe their rate-limit
-- counter and bypass the per-function quota.
DROP POLICY IF EXISTS "Users can manage own rate limits" ON public.ai_rate_limits;
DROP POLICY IF EXISTS "ai_rate_limits_select_own" ON public.ai_rate_limits;

CREATE POLICY "ai_rate_limits_select_own"
  ON public.ai_rate_limits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
-- Privilege-escalation surface: `is_admin(uuid)` reads this table, and the
-- `FOR ALL USING (auth.uid() = user_id)` policy let any authenticated user
-- INSERT `role='admin'` for themselves and pass `is_admin()` checks in
-- SECURITY DEFINER functions. Writes only via direct DB / admin RPCs.
DROP POLICY IF EXISTS "Users can manage own roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;

CREATE POLICY "user_roles_select_own"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMIT;

-- ---------------------------------------------------------------------------
-- Smoke test (run from psql / Supabase Studio as a regular signed-in user, NOT
-- service_role) AFTER `supabase db push --linked --yes` lands this migration:
-- ---------------------------------------------------------------------------
--
--   -- Should return 0 rows updated (RLS denies write).
--   UPDATE public.subscriptions
--      SET plan = 'premium', status = 'active'
--    WHERE user_id = auth.uid();
--
--   -- Should return 0 rows updated.
--   UPDATE public.user_subscriptions SET plan = 'premium' WHERE user_id = auth.uid();
--
--   -- Should return 0 rows updated.
--   UPDATE public.ai_rate_limits SET called_at = '1970-01-01' WHERE user_id = auth.uid();
--
--   -- Should fail / return 0 rows (no INSERT policy).
--   INSERT INTO public.user_roles (user_id, role)
--   VALUES (auth.uid(), 'admin');
--
--   -- Read paths still work for the owning user:
--   SELECT plan, status, current_period_end FROM public.subscriptions
--    WHERE user_id = auth.uid();  -- returns the row.
--
-- Service-role smoke test (webhook simulation): run the same UPDATE with the
-- `SUPABASE_SERVICE_ROLE_KEY` — should succeed (service_role bypasses RLS).
