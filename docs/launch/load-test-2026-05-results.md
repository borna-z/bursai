# Load test results — 2026-05

Status: **awaiting run** (script merged; full run to be triggered against a
Supabase preview branch post-merge).

## Smoke run (5 VUs / 1 min)

| Endpoint | p50 | p95 | p99 | err_rate |
|---|---|---|---|---|
| analyze_garment | TBD | TBD | TBD | TBD |
| enqueue_render_job | TBD | TBD | TBD | TBD |
| style_chat | TBD | TBD | TBD | TBD |
| generate_outfit | TBD | TBD | TBD | TBD |
| start_trial | TBD | TBD | TBD | TBD |

## Full load (100 VU / 10 min hold + 500 VU / 5 min spike)

To be filled post-merge — Borna triggers from a Supabase preview branch URL
per `tests/load/README.md`.

| Endpoint | p50 | p95 | p99 | err_rate (100 VU) | err_rate (500 VU) |
|---|---|---|---|---|---|
| analyze_garment | TBD | TBD | TBD | TBD | TBD |
| enqueue_render_job | TBD | TBD | TBD | TBD | TBD |
| style_chat | TBD | TBD | TBD | TBD | TBD |
| generate_outfit | TBD | TBD | TBD | TBD | TBD |
| start_trial | TBD | TBD | TBD | TBD | TBD |

## Findings

(none until run)

## Pass / fail decision

Per `tests/load/README.md`:

- Error rate < 5% at 100 VU → ok, proceed to submission
- Error rate > 5% at 100 VU → BLOCKS LAUNCH, file finding in
  `docs/launch/findings-log.md`
- Error rate > 5% at 500 VU → file finding, not blocking
