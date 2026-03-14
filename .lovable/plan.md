

# 25-Step Launch Readiness Plan

Current state: 48 tests, ~72/100 readiness score. Target: 150+ tests, 100/100 score.

---

## Phase 1: Dead Weight Removal (Steps 1-3)

### Step 1 — Remove unused dependencies
Remove `recharts`, `react-resizable-panels`, `next-themes` from `package.json`. None are imported in app code (only in unused generated UI stubs). Saves ~200KB from bundle.

### Step 2 — Delete unused UI component files
Remove `src/components/ui/resizable.tsx` (only consumer of `react-resizable-panels`). Audit `src/components/ui/chart.tsx` — likely the sole recharts consumer; delete if unused.

### Step 3 — Lazy-import `html-to-image`
`OutfitReel.tsx` eagerly imports `toPng` — change to dynamic `import()` like `ShareOutfit.tsx` and `OutfitDetail.tsx` already do. Removes it from main bundle.

---

## Phase 2: Metadata & SEO Hardening (Steps 4-5)

### Step 4 — Fix OG image URL
`index.html` references `https://burs.me/og-image.png` but the app is deployed at `bursai.lovable.app`. Update to use the correct domain or a relative path that works with both.

### Step 5 — Sync HTML lang attribute
`index.html` has `lang="en"` but `manifest.json` has `lang: "sv-SE"`. Align both to `"en"` (primary audience) or add a runtime script that reads the stored locale preference.

---

## Phase 3: Test Coverage Sprint — Hooks (Steps 6-11)

Each test file mocks `AuthContext`, `supabase`, and `QueryClient`. Target: ~6 tests per file.

### Step 6 — Test `useProfile`
- Returns null when unauthenticated
- Fetches and validates profile via schema
- Auto-creates profile when missing
- Ghost session detection (FK error → sign out)

### Step 7 — Test `useGarments` (core CRUD)
- Returns empty array when unauthenticated
- Applies category/color filters
- `useCreateGarment` inserts and invalidates cache
- `useDeleteGarment` invalidates cache
- `useMarkGarmentWorn` increments wear_count

### Step 8 — Test `useOutfits`
- Fetches outfits with items
- `useCreateOutfit` inserts outfit + items
- `useMarkOutfitWorn` updates garment wear counts
- `useDeleteOutfit` invalidates cache

### Step 9 — Test `useOutfitGenerator`
- Validates wardrobe has minimum garments
- Calls edge function with correct params
- Handles insufficient garments error
- Returns generated outfit on success

### Step 10 — Test `useOfflineQueue`
- Tracks online/offline transitions
- Auto-replays queue on reconnect
- Shows toast with sync count

### Step 11 — Test `useSupabaseQuery`
- Skips query when no user and `requireAuth: true`
- Applies custom filters
- Validates with Zod schema when provided
- Returns single row when `single: true`

---

## Phase 4: Test Coverage Sprint — Components (Steps 12-18)

### Step 12 — Test `ProtectedRoute`
- Shows spinner during auth loading
- Redirects to `/auth` when unauthenticated
- Redirects to `/onboarding` when onboarding incomplete
- Renders children when authenticated + onboarded

### Step 13 — Test `Onboarding` page
- Renders first step
- Progresses through quiz steps
- Completes and redirects to home

### Step 14 — Test `Settings` page
- Renders all settings groups
- Links navigate to sub-pages

### Step 15 — Test `OutfitGenerate` page
- Renders occasion selector
- Shows error state when wardrobe too small

### Step 16 — Test `AddGarment` page
- Renders upload step initially
- Shows camera/gallery buttons
- Transitions to form step after analysis

### Step 17 — Test `Discover` page
- Renders hero section
- Shows style tools and challenges

### Step 18 — Test `Landing` page
- Renders hero, CTA buttons, pricing section
- "Get Started" navigates to auth

---

## Phase 5: Test Coverage Sprint — Utilities (Steps 19-21)

### Step 19 — Test `edgeFunctionClient`
- Retries on failure with exponential backoff
- Throws `EdgeFunctionTimeoutError` on timeout
- Returns data on success

### Step 20 — Test `offlineQueue`
- Enqueues mutations to localStorage
- Replays mutations in order
- Handles upload queue with base64

### Step 21 — Test `imageCompression`, `nativeShare`, `schemas`
- Image compression respects maxDim
- Share cascades: Median → Web Share → clipboard
- Zod schemas validate and reject bad data

---

## Phase 6: Infrastructure & Security (Steps 22-24)

### Step 22 — Add test coverage reporting
Add `"test:coverage": "vitest run --coverage"` script. Install `@vitest/coverage-v8`. Add coverage thresholds to `vitest.config.ts` (target: 40% lines as floor).

### Step 23 — Security audit pass
- Verify all edge functions check JWT auth (not just CORS)
- Confirm `user_subscriptions` INSERT policy blocks client writes (it does: `WITH CHECK (false)`)
- Verify `subscriptions` table is fully locked from client mutations (it is)
- Add CSP meta tag to `index.html`

### Step 24 — Error monitoring readiness
- Ensure `ErrorBoundary` catches all routes
- Verify Sentry lazy-load fallback works (it does)
- Add `release` tag using `__APP_VERSION__` for Sentry source maps

---

## Phase 7: Final Polish (Step 25)

### Step 25 — Full suite run + CI verification
- Run all ~150 tests, confirm 0 failures
- Verify CI pipeline catches new test files
- Build and check no chunk exceeds 500KB
- Update `README.md` test count and architecture section

---

## Summary

| Phase | Steps | Tests Added | Focus |
|-------|-------|------------|-------|
| Dead Weight | 1-3 | 0 | Bundle size |
| Metadata | 4-5 | 0 | SEO/correctness |
| Hook Tests | 6-11 | ~36 | Data layer coverage |
| Component Tests | 12-18 | ~42 | UI surface coverage |
| Utility Tests | 19-21 | ~24 | Lib coverage |
| Infrastructure | 22-24 | 0 | Security/monitoring |
| Final | 25 | 0 | Verification |

**Total estimated tests: ~150** (48 existing + ~102 new)

