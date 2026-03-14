

# Plan: .env gitignore fix + targeted test suite

## 1. Add `.env` to `.gitignore`

Add `.env` and `.env*` patterns to `.gitignore` (line 13, after `*.local`). The anon key is public-facing so no rotation needed, but this prevents future secret leaks.

## 2. Fix and expand test suite

### Bug: `waitFor` not awaited in existing tests

The current `useSubscription.test.tsx` has **3 tests where `waitFor()` is called without `await`**. This means the assertions inside never actually run — the tests pass vacuously. Fix: add `await` and make the test functions `async`.

### New/fixed tests to write:

**File: `src/hooks/__tests__/useSubscription.test.tsx`** (rewrite)
1. **Fix `waitFor` bug** — add `await` to all 3 `waitFor` calls (lines 89, 140, 183)
2. **Free plan garment limit enforcement** — verify `canAddGarment()` returns `false` at exactly 10 garments (already exists but wasn't running due to bug)
3. **Free plan outfit limit enforcement** — verify `canCreateOutfit()` returns `false` at exactly 10 outfits (already exists but wasn't running)
4. **Premium unlimited access** — verify premium users get `Infinity` remainders (already exists but wasn't running)

**File: `src/hooks/__tests__/useLiveScan.test.tsx`** (new)
5. **Accept flow** — verify `accept()` clears `lastResult`, increments `scanCount`, and triggers storage upload + DB insert
6. **Accept with no result** — verify `accept()` is a no-op when `lastResult` is null

**Total: 6 meaningful test cases across 2 files**, covering subscription limit enforcement and the live scan accept flow.

### Files changed:
- `.gitignore` — add `.env` pattern
- `src/hooks/__tests__/useSubscription.test.tsx` — fix `await waitFor` bug in 3 tests
- `src/hooks/__tests__/useLiveScan.test.tsx` — new file with 2 tests for accept flow

