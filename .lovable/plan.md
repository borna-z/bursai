

# Fix: Travel Capsule Loading UX

## Problems identified

1. **Raw translation keys visible**: The phase labels like `capsule.phase_creating` are missing from `translations.ts`. The `t()` function returns the key string literally (dots, underscores), making it look like unfinished code.

2. **Animation too short**: Current phases total ~7 seconds (1500+2000+2000+1500+0ms), then the last phase sits static for the remaining 30-40 seconds of API time. User stares at a frozen screen.

3. **Edge function timeout**: The `travel_capsule` function has a 50s AI timeout with 2 retry attempts. Can be tightened.

## Plan

### 1. Add missing translations (translations.ts)
Add `capsule.phase_weather`, `capsule.phase_wardrobe`, `capsule.phase_planning`, `capsule.phase_packing`, `capsule.phase_creating` to all locale blocks (sv, en, no, da, fi, de, fr, es).

### 2. Extend loading animation to ~60s (TravelCapsule.tsx)
- Increase phase count from 5 to 8-10 with longer durations
- Add phases like "Matching colors...", "Checking weather layers...", "Reviewing combinations..."
- Distribute durations to cover ~60 seconds total
- Keep the last phase at `duration: 0` (infinite hold as safety net)

### 3. Speed up edge function (travel_capsule/index.ts)
- Reduce AI timeout from 50s → 35s
- Reduce cache TTL comment but keep 30min
- On first attempt, use `complexity: "standard"` instead of `"complex"` for trips ≤ 7 days
- Remove the second retry attempt (fallback to deterministic immediately on failure)

### 4. Add progress indicator to loading overlay (TravelCapsule.tsx)
- Pass a simulated `progress` prop to `AILoadingOverlay` that increments smoothly over 60s
- Gives users a sense of forward motion even during long waits

