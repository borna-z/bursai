

# 10-Step Quality Improvement Plan

## Data Fixes (Quick Wins)

### Step 1 — Fix `ai_provider` fallback in `backgroundGarmentSave.ts`
Change the fallback on line 53 from `'lovable_ai'` to `'unknown'`. This prevents misleading analytics data when the actual provider field is missing from the AI response.

### Step 2 — Rename package in `package.json`
Change `"name"` from `"vite_react_shadcn_ts"` to `"burs-ai"` and set `"version"` to `"1.0.0"`. This fixes Sentry breadcrumbs, error reports, and any App Store metadata that reads from this field.

---

## Component Smoke Tests (Steps 3-8)

Each test renders the component in isolation with mocked providers (AuthContext, QueryClient, Router) and asserts it mounts without crashing plus key elements are visible.

### Step 3 — Smoke test `ProtectedRoute` redirects
Already partially covered. Add a test confirming the loading spinner renders with the correct accessibility role.

### Step 4 — Smoke test `Auth` page
- Renders login/signup tabs
- Email and password inputs are present
- Submit button is visible
- Mock `useAuth` to prevent real Supabase calls

### Step 5 — Smoke test `Home` page
- Renders greeting text
- Quick actions row is present
- Wrap in `AuthProvider` mock + `QueryClientProvider` + `MemoryRouter`

### Step 6 — Smoke test `Wardrobe` page
- Renders the Garments/Outfits tabs
- FAB (add button) is visible
- Empty state shows when no garments returned

### Step 7 — Smoke test `PaywallModal`
- Renders with `isOpen={true}` and `reason="garments"`
- Crown icon, upgrade buttons, and "Not now" button are present
- Calls `onClose` when dismissed

### Step 8 — Smoke test `BottomNav`
- All 5 tab icons render
- Active tab gets correct styling
- Clicking a tab triggers navigation

---

## Structural Improvements (Steps 9-10)

### Step 9 — Update existing `backgroundGarmentSave.test.ts`
Update the test assertion to expect `'unknown'` instead of `'lovable_ai'` for the `ai_provider` field, matching the fix from Step 1.

### Step 10 — Run full suite and verify CI
Run all tests to confirm 0 regressions. Verify the CI workflow (`ci.yml`) picks up the new test files automatically (it already globs `src/**/*.test.*`).

---

## Summary

| Step | File(s) | Type |
|------|---------|------|
| 1 | `src/lib/backgroundGarmentSave.ts` | Bug fix |
| 2 | `package.json` | Metadata fix |
| 3 | `src/components/auth/__tests__/ProtectedRoute.test.tsx` | Test addition |
| 4 | `src/pages/__tests__/Auth.test.tsx` | New test file |
| 5 | `src/pages/__tests__/Home.test.tsx` | New test file |
| 6 | `src/pages/__tests__/Wardrobe.test.tsx` | New test file |
| 7 | `src/components/__tests__/PaywallModal.test.tsx` | New test file |
| 8 | `src/components/layout/__tests__/BottomNav.test.tsx` | New test file |
| 9 | `src/lib/__tests__/backgroundGarmentSave.test.ts` | Test update |
| 10 | Full suite run | Verification |

Estimated impact: test count goes from ~29 to ~45+, covering the highest-risk UI surfaces. The two data fixes are one-line changes with immediate production benefit.

