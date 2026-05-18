-- Sprint PR 10 — per-call AI cost logging.
--
-- Every `_shared/ai-provider.ts` `callAI()` invocation fire-and-forget inserts
-- one row recording the provider used, token counts, estimated USD cost, and
-- latency. Mirrors `ai_token_usage` (which is user-quota-scoped) but adds a
-- `provider` dimension so Gemini→Anthropic fallback economics are queryable.
--
-- The post-merge alert_check (PR 2 in this sprint) wires rule 7:
--   * daily total > $200 / 24h
--   * hourly total > $30 / 1h
-- using SUM(estimated_cost_usd) windows on this table.
--
-- RLS: service-role only (no anon/authenticated policies). The edge function
-- writers always run with the service role; the operations dashboard reads
-- via SQL-editor / direct queries, also service-role.
--
-- TTL: 90 days. Daily cleanup at 03:30 UTC.

CREATE TABLE IF NOT EXISTS public.ai_call_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name       text NOT NULL,
  provider            text NOT NULL CHECK (provider IN ('gemini','anthropic')),
  user_id             uuid,
  input_tokens        integer NOT NULL DEFAULT 0,
  output_tokens       integer NOT NULL DEFAULT 0,
  estimated_cost_usd  numeric(10, 6) NOT NULL DEFAULT 0,
  latency_ms          integer,
  request_id          uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_call_log_created_at
  ON public.ai_call_log (created_at);

CREATE INDEX IF NOT EXISTS idx_ai_call_log_fn_created
  ON public.ai_call_log (function_name, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_call_log_provider_created
  ON public.ai_call_log (provider, created_at);

ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only.

-- Daily TTL cleanup at 03:30 UTC. Idempotent unschedule-then-reschedule so
-- re-applying the migration (db push --include-all) is a no-op.
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup_ai_call_log');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup_ai_call_log',
  '30 3 * * *',
  $cron$DELETE FROM public.ai_call_log WHERE created_at < NOW() - INTERVAL '90 days'$cron$
);

-- POST-MERGE TODO for sprint PR 2 (alert_check):
--   Rule 7 — AI cost runaway:
--     daily : SUM(estimated_cost_usd) WHERE created_at > NOW() - INTERVAL '24h' > 200
--     hourly: SUM(estimated_cost_usd) WHERE created_at > NOW() - INTERVAL '1h'  > 30
