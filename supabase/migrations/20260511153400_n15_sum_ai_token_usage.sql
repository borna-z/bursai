-- N15/BE-P0-B2 — Server-side SUM for AI token usage.
--
-- `supabase/functions/_shared/burs-ai.ts` `readUsageBudget` currently does:
--   SELECT cost_micros FROM ai_token_usage
--    WHERE user_id = $1 AND occurred_at >= $monthStart
-- and then iterates client-side to sum. With the
-- `idx_ai_token_usage_user_occurred (user_id, occurred_at DESC)` index, this
-- is a range scan returning every row of the user's monthly history on EVERY
-- AI call. For a power user firing 2k AI calls/month that is 2k rows over
-- the wire on call N+1 — quasi-O(N²) on the hot path.
--
-- Move the SUM into Postgres. Same range scan cost server-side, but
--   * one number over the wire instead of N rows,
--   * no JS-side iteration,
--   * SECURITY DEFINER + service-role-only EXECUTE means the function only
--     ever runs in the trusted edge-function context.
--
-- STABLE: same `(user_id, month_start)` inputs yield the same result within
-- a single statement, which lets the planner short-circuit repeated calls
-- in a hypothetical future batched read.

CREATE OR REPLACE FUNCTION public.sum_ai_token_usage_for_month(
  p_user_id uuid,
  p_month_start timestamptz
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_micros), 0)::bigint
    FROM public.ai_token_usage
   WHERE user_id = p_user_id
     AND occurred_at >= p_month_start;
$$;

REVOKE EXECUTE ON FUNCTION public.sum_ai_token_usage_for_month(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sum_ai_token_usage_for_month(uuid, timestamptz) TO service_role;
