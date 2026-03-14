

# Fix: `occasionCount is not defined` in travel_capsule edge function

## Root Cause

In `supabase/functions/travel_capsule/index.ts`, the `buildDeterministicFallback` function references `occasionCount` on line 228, but that variable is never declared. It's used in calculating `daysToGenerate`:

```ts
const daysToGenerate = Math.min(duration_days, Math.max(3, Math.min(targetOutfits, duration_days * Math.max(1, occasionCount))));
```

This crashes the deterministic fallback, which then crashes the entire function via `bursAIErrorResponse`.

## Fix

One line: define `occasionCount` from the `occasions` array before its use inside `buildDeterministicFallback`. Since `occasions` is captured from the request body in the outer scope and is accessible inside the closure:

```ts
const occasionCount = occasions?.length || 1;
```

Add this as the first line inside `buildDeterministicFallback`.

**1 file, 1 line added.** No other changes.

