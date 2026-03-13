

# Fix: Travel Capsule "modelChain is not iterable" — Redeploy Edge Functions

## Problem
The error `modelChain is not iterable` is still occurring because the edge functions haven't been redeployed after the recent code fixes. The deployed version still contains the old code with invalid complexity values (like `"fast"`) that don't exist in `COMPLEXITY_CHAINS`.

The error log references an `executeCall` function at line 359, which doesn't exist in the current repo code — confirming the deployed version is stale.

## Fix
Redeploy both the shared dependency and the travel_capsule function. No code changes needed — the repo already has the correct fixes:
- `travel_capsule/index.ts`: Uses `"standard"` / `"complex"` / `"trivial"` (all valid)
- `_shared/burs-ai.ts`: Has `estimateMaxTokens` and correct `COMPLEXITY_CHAINS`

### Action
Force redeploy of `travel_capsule` edge function to push the already-corrected code to production.

