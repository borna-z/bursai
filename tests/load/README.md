# Load test — top 5 edge functions

Smoke + load test harness for the five highest-traffic Supabase edge functions:
`analyze_garment`, `enqueue_render_job`, `style_chat`, `generate_outfit`,
`start_trial`.

## Install k6

- Windows: `winget install k6` (or download from https://k6.io/docs/get-started/installation/)
- macOS: `brew install k6`
- Linux: see https://k6.io/docs/get-started/installation/

Verify: `k6 version`

## Run smoke (5 VUs / 1 min)

```bash
export STAGING_URL=https://<preview-branch>.supabase.co
export STAGING_ANON_KEY=<anon-key>
export SERVICE_ROLE_KEY=<service-role-key>
k6 run tests/load/k6-edge-functions.js
```

PowerShell:

```powershell
$env:STAGING_URL = "https://<preview-branch>.supabase.co"
$env:STAGING_ANON_KEY = "<anon-key>"
$env:SERVICE_ROLE_KEY = "<service-role-key>"
k6 run tests/load/k6-edge-functions.js
```

The smoke run is safe against any environment (5 VUs / 60 sec / ~600 total
requests). It provisions a pool of 5 synthetic users (one per VU) so per-user
rate limits don't dominate.

## Run full load scenario

NOT against prod casually — see "Cost estimate" below.

```bash
SCENARIO=load k6 run tests/load/k6-edge-functions.js
```

Stages: ramp 0 → 100 VUs over 2 min, hold 100 VUs for 8 min, spike to 500 VUs
for 5 min. Total run: ~15 min wall time.

Pool size for `load` defaults to 200 synthetic users (~0.5 VU per user at
100 VU hold, ~2.5 VUs per user at 500 VU spike). At that ratio every
endpoint's per-user-per-minute request rate stays under its premium
rate-limit cap (generate_outfit is the tightest at 10/min/user premium).
Override with `POOL_SIZE=<N>` if you want to deliberately stress the
limiter or run on a budget.

## Pass / fail criteria (per sprint brief)

| Condition | Verdict |
|---|---|
| Error rate < 5% at 100 VU | ok — proceed to submission |
| Error rate > 5% at 100 VU | BLOCKS LAUNCH — file finding immediately |
| Error rate > 5% at 500 VU | File finding, not blocking |

The script encodes these as scenario-tagged thresholds so the 100 VU and
500 VU phases are evaluated independently:
- `http_req_failed{scenario:ramp_100}: rate<0.05` (launch-blocking)
- `http_req_failed{scenario:spike_500}: rate<0.15` (non-blocking ceiling;
  total-collapse alarm, not the >5% sprint criterion which is informational
  for the spike phase)

Per-endpoint p95 latency thresholds are encoded in the script:

| Endpoint | p95 ceiling |
|---|---|
| analyze_garment | 8000 ms |
| enqueue_render_job | 2000 ms |
| style_chat | 5000 ms |
| generate_outfit | 6000 ms |
| start_trial | 3000 ms |

## Synthetic user pool

Each pool user is seeded by `setup()` with:

- `subscriptions` row (`plan='premium'`, `status='active'`, fake
  `stripe_subscription_id`) so `enforceSubscription` doesn't 402 every
  AI-gated call.
- `render_credits` row (`monthly_allowance=100`) so `enqueue_render_job`
  doesn't 402 `trial_studio_locked`.
- 4 mixed-slot garments (top / bottom / shoes / outerwear) so
  `generate_outfit`'s engine can compose a real outfit.
- A fake `stripe_subscription_id` triggers `start_trial`'s pre-check
  short-circuit (`already_started:true`, 200) so we never hit live Stripe.

`teardown()` deletes every pool user, which cascades the subscriptions,
render_credits and garments rows via FK.

If a teardown is skipped (e.g. k6 killed mid-run), clean up manually:

```sql
delete from auth.users where email like 'loadtest+%@burs.app';
```

## Why a user pool

Each edge function applies per-user rate limits in
`supabase/functions/_shared/scale-guard.ts`:

- `style_chat` — 15/min
- `enqueue_render_job` — 10/min
- `generate_outfit` — 5/min
- `analyze_garment` — 30/min
- `start_trial` — 2/min

A single shared user would saturate these in seconds and the load run would
mostly measure the rate limiter, not the endpoints. The pool spreads VUs
across users so the per-minute caps stay above the per-user request rate.

## Throughput math

At 500 VUs each iterating with a 0.5s sleep plus the per-call latency
(typically 2-5 s for AI endpoints), the *effective* request rate is roughly
`VUs / (sleep + avg_latency)` ≈ 100-200 RPS aggregate, not the
arithmetically-implied 1000 RPS. Per-user per-minute throughput at 50 users
sits well inside the rate-limit ceilings above.

## Cost estimate (full run, rough)

The earlier "~$30" estimate undercounted. Realistic full-run AI spend
(100 VU × 8 min + 500 VU × 5 min) against a paid Gemini key:

| Bucket | Estimate |
|---|---|
| `analyze_garment` (Gemini vision, fast) | $30–80 |
| `generate_outfit` (Gemini text + engine retries) | $80–150 |
| `style_chat` (Gemini text + wardrobe context) | $40–80 |
| `enqueue_render_job` + `start_trial` | negligible |
| Supabase compute | negligible |
| **Total full run (rough range)** | **$150–300** |

The wide band accounts for: (a) how many AI calls actually succeed past
auth + paywall, (b) prompt caching hit-rate during the run, and (c) whether
the Gemini key is on the free tier (which would shave most of this but
likely 429 long before the load test completes).

Smoke runs cost <$1 — safe to run repeatedly.

## Don't run during launch window

Schedule full runs for off-peak hours (00:00–06:00 CET) and not within 24h of
App Store / Play Store review windows. Smoke is safe anytime.

## Body schemas

Body shapes were verified against the edge function `await req.json()`
destructures on 2026-05-18 (Codex P1 on PR #896 caught earlier drift on
`enqueue_render_job.source` and the missing NOT-NULL columns on the
`garments` seed insert). If a function's request schema drifts in a future
PR, smoke will surface 4xx in the per-endpoint check rate and the bodies
should be refreshed.
