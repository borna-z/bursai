# Smoke Test Fixtures

Recorded external-API responses used by the smoke mock server
(`src/test/smoke/mocks/mock-server.ts`).

## Layout

```
fixtures/
  gemini/
    <flow>.json     — canonical Gemini response for each flow in P0d-iii
  stripe/
    <endpoint>.json — canonical Stripe test-mode responses
```

## How to regenerate

P0d-iii (the prompt that adds the remaining 7 smoke tests) is the first
consumer. Regeneration flow:

1. Set real Gemini / Stripe test-mode keys in your local env.
2. Run the relevant smoke test with `SMOKE_RECORD=1` (wiring TBD in P0d-iii).
3. The mock server proxies to the real API and writes the response body
   under `fixtures/<service>/<flow>.json`.
4. Commit the JSON file. The fixture is now the contract — tests replay it
   deterministically.

Re-record when an edge function changes its Gemini prompt or Stripe request
shape enough that the old fixture no longer matches. Cost per re-record is
small (cents to low dollars per flow); the full one-time seeding cost is
estimated at $5–20 — see the ADR block at the top of P0d-ii in
`LAUNCH_PLAN.md`.

## Why fixtures and not inline literals

Fixtures keep responses diff-able in PRs. If a Gemini API upgrade changes a
field name, the diff shows up as a fixture change rather than buried inside
a test file.
