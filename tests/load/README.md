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
requests). It exercises every endpoint at least 10× per VU.

## Run full load scenario

NOT against prod casually — burns ~30 USD in AI tokens per full run.

```bash
SCENARIO=load k6 run tests/load/k6-edge-functions.js
```

Stages: ramp 0 → 100 VUs over 2 min, hold 100 VUs for 8 min, spike to 500 VUs
for 5 min. Total run: ~15 min wall time.

## Pass / fail criteria (per sprint brief)

| Condition | Verdict |
|---|---|
| Error rate < 5% at 100 VU | ok — proceed to submission |
| Error rate > 5% at 100 VU | BLOCKS LAUNCH — file finding immediately |
| Error rate > 5% at 500 VU | File finding, not blocking |

Per-endpoint p95 latency thresholds are encoded in the script:

| Endpoint | p95 ceiling |
|---|---|
| analyze_garment | 8000 ms |
| enqueue_render_job | 2000 ms |
| style_chat | 5000 ms |
| generate_outfit | 6000 ms |
| start_trial | 3000 ms |

## Synthetic user lifecycle

- `setup()` creates one `loadtest+<uuid>@burs.app` user + 1 garment row.
- `teardown()` deletes the user (cascades to garments).

If a teardown is skipped (e.g. k6 killed mid-run), clean up manually:

```sql
delete from auth.users where email like 'loadtest+%@burs.app';
```

## Costs to expect (full run, rough)

| Bucket | Estimate |
|---|---|
| `analyze_garment` (Gemini vision) | ~$5 |
| `generate_outfit` (Gemini text) | ~$8 |
| `style_chat` (Gemini text) | ~$10 |
| `enqueue_render_job` + `start_trial` | negligible |
| Supabase compute | negligible |
| **Total full run** | **~$30** |

## Don't run during launch window

Schedule full runs for off-peak hours (00:00–06:00 CET) and not within 24h of
App Store / Play Store review windows. Smoke is safe anytime.

## Body schemas

The body shapes in the script are best-effort, derived from a brief read of
each edge function's `await req.json()` destructure as of 2026-05-18. If a
function's request schema drifts, the load test will return 400s — that is
fine for smoke (we'll see it in the summary) and the bodies should be
refreshed in a follow-up PR.
