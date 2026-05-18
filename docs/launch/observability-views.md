# Observability views — launch-week dashboard

Sprint PR 6 (2026-05-18). Four read-only views feed the founder dashboard via
the `dashboard_metrics` edge function. All views read from existing tables,
filtered to the rolling window appropriate for the panel. Service-role only.

## `view_queue_depth_5min`

Render queue health over the last 24 h, bucketed into 5-minute slots and
grouped by `render_jobs.status` (pending / in_progress / succeeded / failed).
Drives a stacked bar chart on the dashboard; spikes in `pending` or
`in_progress` are the early warning for a stalled worker chain.

## `view_function_health`

Per-function call counts and error rate over the last 24 h, derived from
`public.request_idempotency`. Idempotency keys are stored as
`${functionName}:${userId}:${rawKey}`, so the function name is extracted with
`split_part(key, ':', 1)`. `status >= 400` counts as an error call;
`error_pct` is `error_calls / total_calls` to 2 decimal places. Sorted with
the worst-performing functions first.

Pending claims (`status = 0`, in-flight isolates that haven't stored a
response yet) are filtered out so the denominator reflects completed
requests only.

Caveat: only functions that go through `_shared/idempotency.ts` are
represented — non-idempotent functions (most of the AI streaming paths) do
not appear here. Use the Supabase `analytics_events` table for full
coverage; this view is for the subset that posts state-changing requests.

## `view_subscription_distribution`

User counts grouped by `subscriptions.plan` × `subscriptions.status`. The
`public.subscriptions` table is the source of truth for billing state;
`profiles.is_premium` exists but is a denormalized boolean and is not used
here. Plans default to `'free'`, status to `'active'`.

## `view_ai_cost_per_day`

Conditional. Only created when `public.ai_call_log` is present (added by a
separate AI-logging PR currently in flight). Rolls up the last 30 days by
day × function_name × provider, summing input/output tokens and rounding
`estimated_cost_usd` to 4 dp.

When the underlying table doesn't exist yet, the view is skipped at
migration time and the `dashboard_metrics` endpoint returns
`"ai_cost_per_day": null`. After the AI-logging PR merges, re-running the
`20260518120300_observability_views.sql` migration (or `db push`) will
create the view; the endpoint then returns the rows on the next call.

## Endpoint

```
GET https://khvkwojtlkcvxjxztduj.supabase.co/functions/v1/dashboard_metrics
Authorization: Bearer $RENDER_WORKER_BEARER
```

Example:

```bash
curl -H "Authorization: Bearer $RENDER_WORKER_BEARER" \
  https://khvkwojtlkcvxjxztduj.supabase.co/functions/v1/dashboard_metrics
```

Response:

```json
{
  "queue_depth":      [{ "bucket": "...", "status": "succeeded", "jobs": 42 }, ...],
  "function_health":  [{ "function_name": "create_checkout_session", "total_calls": 12, "error_calls": 0, "error_pct": 0.00 }, ...],
  "subscriptions":    [{ "plan": "free", "status": "active", "users": 1234 }, ...],
  "ai_cost_per_day":  null
}
```

Cached for 60 s via `Cache-Control: max-age=60`.
