-- N2 — AI token cost ceiling: per-user usage ledger + monthly quota column.
--
-- Problem: `_shared/burs-ai.ts` enforces a per-user-per-function-per-hour
-- call-count rate limit (good) but has no notion of the cumulative
-- AI token cost a user incurs in a billing window. A premium subscriber
-- (or, worse, a free-tier user via the more permissive functions like
-- `summarize_day` / `style_chat`) hammering the AI endpoints can rack up
-- arbitrarily large Gemini bills well above the subscription price.
--
-- Fix:
--   * `ai_token_usage` — append-only ledger row per AI call, carrying
--     input/output tokens and `cost_micros` (USD * 1_000_000, integer to
--     avoid floating-point accumulation drift). RLS lets the owning user
--     SELECT only their own rows; writes are service-role only (matches
--     the N1 ai_rate_limits / subscriptions / user_subscriptions pattern).
--   * `subscriptions.monthly_token_quota_micros` — per-user monthly cap
--     in micros. Defaults: free=$2.00 (2_000_000 micros), premium=$200.00
--     (200_000_000 micros). The seed UPDATE only writes rows missing the
--     quota — re-runs are idempotent.
--   * Index on `(user_id, date_trunc('month', occurred_at))` supports
--     the hot-path "current month sum" read in `callBursAI()`.
--
-- Idempotent across re-runs (CREATE TABLE IF NOT EXISTS / CREATE INDEX
-- IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / WHERE IS NULL on the seed).

BEGIN;

-- ---------------------------------------------------------------------------
-- ai_token_usage: append-only per-call usage ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_micros bigint NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Hot path: SUM(cost_micros) WHERE user_id = $1 AND occurred_at >= start_of_month.
-- Plain b-tree on (user_id, occurred_at) suffices — date_trunc is computed at
-- read time. A functional index on date_trunc('month', occurred_at) would not
-- be IMMUTABLE without an explicit timezone arg, so we keep the index simple
-- and let the planner range-scan.
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_occurred
  ON public.ai_token_usage (user_id, occurred_at DESC);

ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;

-- Service-role inserts only; the owning user can read their own rows
-- (e.g. for an "AI usage this month" UI). Mirrors the N1 lockdown pattern.
DROP POLICY IF EXISTS "ai_token_usage_select_own" ON public.ai_token_usage;
CREATE POLICY "ai_token_usage_select_own"
  ON public.ai_token_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- subscriptions.monthly_token_quota_micros
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS monthly_token_quota_micros bigint;

COMMENT ON COLUMN public.subscriptions.monthly_token_quota_micros IS
  'Per-user monthly AI token cost ceiling, in USD micros (1 micro = $0.000001). Enforced in supabase/functions/_shared/burs-ai.ts callBursAI() before each AI call. Defaults: free=2_000_000 ($2.00), premium=200_000_000 ($200.00). NULL = no enforcement (legacy rows).';

-- Per-plan defaults. Only writes rows where the column is NULL so re-runs
-- are idempotent and operator overrides survive.
UPDATE public.subscriptions
   SET monthly_token_quota_micros = 200000000
 WHERE monthly_token_quota_micros IS NULL
   AND plan = 'premium';

UPDATE public.subscriptions
   SET monthly_token_quota_micros = 2000000
 WHERE monthly_token_quota_micros IS NULL
   AND (plan = 'free' OR plan IS NULL);

COMMIT;
