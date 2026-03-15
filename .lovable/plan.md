

## Plan: Replace `fallbackFetchCandidates()` in `useSwapGarment.ts`

**File**: `src/hooks/useSwapGarment.ts`

### Change

Replace lines 65–162 (the entire `fallbackFetchCandidates` function including the closing `return top;` on line 161 and the `};` on ~162) with the user's provided version.

Key differences from current:
1. **Laundry filter moved to query** — `.eq('in_laundry', false)` in the Supabase query instead of post-fetch `.filter()`
2. **Simpler scoring model** — three focused scorers (`scoreFreshness`, `scoreColorFit`, `scoreFit`) with weighted combination (0.45/0.35/0.20) instead of additive adjustments
3. **No top-10 slice** — returns all scored candidates instead of capping at 10
4. **Breakdown included** — returns `{ freshness, color_fit, fit }` breakdown per candidate
5. **No `colorFamily` helper** — uses direct string matching for neutrals and exact color matches

No other files need changes. The return type `SwapCandidate[]` is preserved. The existing `fallbackSwapScoring.test.ts` mirrors the old logic and will need updating separately if desired, but the user didn't ask for that.

