-- Migration: observability views for the launch-week dashboard
--
-- Sprint PR 6 (2026-05-18). Adds four read-only views that the
-- `dashboard_metrics` edge function reads to expose operational health to the
-- founder dashboard. Views, not materialized views: dataset sizes are small
-- and we want fresh numbers on every dashboard refresh.
--
-- Grants:
--   * service_role only. The dashboard_metrics edge function uses the
--     service-role client. RLS on underlying tables stays intact for direct
--     anon/authenticated access; views inherit table RLS, but service_role
--     bypasses it anyway, so the GRANT is what actually gates reads.
--
-- Self-contained: this migration creates only views that depend on tables
-- already on `main`. The `view_ai_cost_per_day` view depends on
-- `public.ai_call_log` which lands in sprint PR #893 — that view is created
-- inside PR #893's migration (alongside the table) so the two land
-- atomically. dashboard_metrics gracefully handles the view not existing
-- until PR #893 is merged.

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

-- 2. Function health (recent) from request_idempotency.
--    request_idempotency keys are `${functionName}:${userId}:${rawKey}` so
--    split_part on ':' yields the function name. status is the cached HTTP
--    response status; >=400 counts as an error call.
--
--    *** Window: 5 minutes, NOT 24h. *** _shared/idempotency.ts stores rows
--    with a 5-minute TTL (see CLAIM_TTL_MS / DEFAULT_TTL_MS) and the hourly
--    `request_idempotency_cleanup` cron deletes expired rows. So the longest
--    durable window for any deployment older than 5 min is bounded to the
--    last few minutes of completed requests. Use this view for real-time
--    spike detection; longer-window analysis (24h+) requires the
--    edge_function_errors table from sprint PR #891 (alert_check) once that
--    lands.
--
--    Pending claims have status = 0 — in-flight isolates that haven't
--    written a response yet. Excluding status = 0 keeps the denominator
--    honest. Only functions that go through _shared/idempotency.ts appear
--    here; non-idempotent endpoints (streaming AI paths, etc.) don't.
CREATE OR REPLACE VIEW public.view_function_health_recent AS
SELECT
  split_part(key, ':', 1) AS function_name,
  COUNT(*) AS total_calls_recent,
  COUNT(*) FILTER (WHERE status >= 400) AS error_calls_recent,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status >= 400) / NULLIF(COUNT(*), 0),
    2
  ) AS error_pct_recent
FROM public.request_idempotency
WHERE created_at > NOW() - INTERVAL '5 minutes'
  AND status > 0
GROUP BY function_name
ORDER BY error_pct_recent DESC NULLS LAST;

-- 3. Subscription distribution.
--    Discovery showed subscription state lives in `public.subscriptions`
--    (columns: plan TEXT default 'free', status TEXT default 'active').
--    profiles.is_premium exists too but is a denormalized boolean — the
--    subscriptions table is the source of truth.
--
--    Both columns are nullable in the existing schema (defaults exist but
--    historical rows may have NULL). Group by the COALESCEd values via a CTE
--    so e.g. (plan NULL, status 'active') and (plan 'free', status 'active')
--    collapse into a single 'free'/'active' row in the dashboard — otherwise
--    the dashboard shows two visually-identical rows.
CREATE OR REPLACE VIEW public.view_subscription_distribution AS
WITH normalized AS (
  SELECT
    COALESCE(plan, 'free') AS plan,
    COALESCE(status, 'unknown') AS status
  FROM public.subscriptions
)
SELECT plan, status, COUNT(*) AS users
FROM normalized
GROUP BY plan, status
ORDER BY users DESC;

-- (view_ai_cost_per_day lives in 20260518120200_ai_call_log.sql alongside
-- the table it reads — see sprint PR #893. Splitting it across migrations
-- would mean a clean-env apply of PR #894 fails until PR #893 lands,
-- breaking CI's migration-smoke job and forcing serialized merges.)

-- Grants. service_role only — RLS on underlying tables stays in place.
GRANT SELECT ON public.view_queue_depth_5min TO service_role;
GRANT SELECT ON public.view_function_health_recent TO service_role;
GRANT SELECT ON public.view_subscription_distribution TO service_role;
