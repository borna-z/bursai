-- Migration: observability views for the launch-week dashboard
--
-- Sprint PR 6 (2026-05-18). Adds four read-only views that the
-- `dashboard_metrics` edge function reads to expose operational health to the
-- founder dashboard. Views, not materialized views: dataset sizes are small
-- (last 24 h / 30 d) and we want fresh numbers on every dashboard refresh.
--
-- Grants:
--   * service_role only. The dashboard_metrics edge function uses the
--     service-role client. RLS on underlying tables stays intact for direct
--     anon/authenticated access; views inherit table RLS, but service_role
--     bypasses it anyway, so the GRANT is what actually gates reads.
--
-- Conditional view: view_ai_cost_per_day is only created if the
-- `ai_call_log` table exists (added by a separate in-flight PR). When that
-- table is not present, the view is skipped and dashboard_metrics returns
-- null for that field.

-- 1. Render queue depth in 5-min buckets, last 24 h.
--    Joined on (bucket, status) so the dashboard can render a stacked bar
--    chart of pending / in_progress / succeeded / failed over time.
CREATE OR REPLACE VIEW public.view_queue_depth_5min AS
SELECT
  date_trunc('hour', created_at)
    + (floor(extract(minute from created_at) / 5) * INTERVAL '5 minutes') AS bucket,
  status,
  COUNT(*) AS jobs
FROM public.render_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY bucket, status
ORDER BY bucket DESC, status;

-- 2. Function health from request_idempotency, last 24 h.
--    request_idempotency keys are `${functionName}:${userId}:${rawKey}` so
--    split_part on ':' yields the function name. status is the cached HTTP
--    response status; >=400 counts as an error call.
--
--    Pending claims have status = 0 (see _shared/idempotency.ts CLAIM_TTL_MS):
--    in-flight isolates that haven't written a response yet. Excluding status
--    = 0 keeps the denominator honest — `total_calls` reflects completed
--    requests, not in-flight ones. Only functions that go through
--    _shared/idempotency.ts are represented; non-idempotent endpoints
--    (streaming AI paths, etc.) don't appear here.
CREATE OR REPLACE VIEW public.view_function_health AS
SELECT
  split_part(key, ':', 1) AS function_name,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE status >= 400) AS error_calls,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status >= 400) / NULLIF(COUNT(*), 0),
    2
  ) AS error_pct
FROM public.request_idempotency
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND status > 0
GROUP BY function_name
ORDER BY error_pct DESC NULLS LAST;

-- 3. Subscription distribution.
--    Discovery showed subscription state lives in `public.subscriptions`
--    (columns: plan TEXT default 'free', status TEXT default 'active').
--    profiles.is_premium exists too but is a denormalized boolean — the
--    subscriptions table is the source of truth.
CREATE OR REPLACE VIEW public.view_subscription_distribution AS
SELECT
  COALESCE(plan, 'free') AS plan,
  COALESCE(status, 'unknown') AS status,
  COUNT(*) AS users
FROM public.subscriptions
GROUP BY plan, status
ORDER BY users DESC;

-- 4. AI cost per day — conditional on the `ai_call_log` table from the
--    in-flight AI logging PR. When the table doesn't exist, the view is
--    skipped and the dashboard endpoint returns null for ai_cost_per_day.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_call_log'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.view_ai_cost_per_day AS
      SELECT
        date_trunc('day', created_at)::date AS day,
        function_name,
        provider,
        COUNT(*) AS calls,
        SUM(input_tokens) AS input_tokens,
        SUM(output_tokens) AS output_tokens,
        ROUND(SUM(estimated_cost_usd)::numeric, 4) AS cost_usd
      FROM public.ai_call_log
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY day, function_name, provider
      ORDER BY day DESC, cost_usd DESC;
    $sql$;
  END IF;
END $$;

-- Grants. The three unconditional views are always granted. The conditional
-- view's grant lives inside the same existence guard so re-runs are safe.
GRANT SELECT ON public.view_queue_depth_5min TO service_role;
GRANT SELECT ON public.view_function_health TO service_role;
GRANT SELECT ON public.view_subscription_distribution TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_call_log'
  ) THEN
    EXECUTE 'GRANT SELECT ON public.view_ai_cost_per_day TO service_role';
  END IF;
END $$;
