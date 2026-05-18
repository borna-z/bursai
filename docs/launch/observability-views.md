# Observability views — launch-week dashboard

Sprint PR 6 (2026-05-18). Four read-only views feed the founder dashboard via
the `dashboard_metrics` edge function. All views read from existing tables,
filtered to the rolling window appropriate for the panel. Service-role only.

## `view_queue_depth_5min`

Render queue health over the last 24 h, bucketed into 5-minute slots and
grouped by `render_jobs.status` (pending / in_progress / succeeded / failed).
Drives a stacked bar chart on the dashboard; spikes in `pending` or
`in_progress` are the early warning for a stalled worker chain.

## `view_function_health_recent`

Per-function call counts and error rate over the **last 5 minutes**, derived
from `public.request_idempotency`. Idempotency keys are stored as
`${functionName}:${userId}:${rawKey}`, so the function name is extracted
with `split_part(key, ':', 1)`. `status >= 400` counts as an error call;
`error_pct_recent` is `error_calls_recent / total_calls_recent` to 2 decimal
places. Sorted with the worst-performing functions first.

**Window note.** `request_idempotency` is a short-lived dedupe cache —
`_shared/idempotency.ts` stores rows with a 5-minute TTL and the hourly
`request_idempotency_cleanup` cron deletes expired rows. A "24-hour" view
from this source would silently under-report by orders of magnitude on any
deployment older than ~5 min. This view is therefore deliberately scoped to
5 minutes and named accordingly. Use it for real-time spike detection.

For longer-window analysis (24h+), query `edge_function_errors` (sprint PR
#891 / `alert_check`) once it lands — that table stores rows for 7 days
with hourly cleanup.

Pending claims (`status = 0`, in-flight isolates that haven't stored a
response yet) are filtered out so the denominator reflects completed
requests only.

Caveat: only functions that go through `_shared/idempotency.ts` are
represented — non-idempotent functions (most of the AI streaming paths) do
not appear here.

## `view_subscription_distribution`

User counts grouped by `subscriptions.plan` × `subscriptions.status`. The
`public.subscriptions` table is the source of truth for billing state;
`profiles.is_premium` exists but is a denormalized boolean and is not used
here. Plans default to `'free'`, status to `'active'`.

## `view_ai_cost_per_day`

Rolls up the last 30 days by day × function_name × provider, summing
input/output tokens and rounding `estimated_cost_usd` to 4 dp.

Hard dependency on `public.ai_call_log` from sprint PR #893
(`20260518120200_ai_call_log.sql`). Timestamp ordering guarantees that
migration runs first; if PR #893 isn't applied first, this migration fails
loud with "relation ai_call_log does not exist" — that's intentional, an
`IF EXISTS` guard would silently skip the view and leave it permanently
absent once PR #894 was marked applied.

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
  "function_health":  [{ "function_name": "create_checkout_session", "total_calls_recent": 12, "error_calls_recent": 0, "error_pct_recent": 0.00 }, ...],
  "subscriptions":    [{ "plan": "free", "status": "active", "users": 1234 }, ...],
  "ai_cost_per_day":  [{ "day": "2026-05-18", "function_name": "analyze_garment", "provider": "gemini", "calls": 142, "cost_usd": 0.4231 }, ...]
}
```

Cached for 60 s via `Cache-Control: max-age=60`.
