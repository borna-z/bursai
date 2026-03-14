
# BURS Launch Readiness Plan v4

**Status: ✅ Phases 1-6 COMPLETE | Phase 7 partial**

## Phase 1: Dead Weight Removal (Steps 1-3) ✅
- Removed `recharts`, `react-resizable-panels`, `next-themes` (~200KB saved)
- Deleted unused `resizable.tsx` and `chart.tsx`
- Lazy-imported `html-to-image` in `OutfitReel.tsx`

## Phase 2: Metadata & SEO (Steps 4-5) ✅
- Fixed OG image URL to relative `/og-image.png`
- Synced manifest.json lang to `"en"`

## Phase 3: Hook Tests (Steps 6-11) ✅
- `useProfile`: 4 tests (auth, fetch, auto-create, ghost session)
- `useGarments`: 5 tests (auth, fetch, filters, search, count)
- `useOutfits`: 4 tests (auth, fetch, single, delete)
- `useOutfitGenerator`: 3 tests (auth, validation, generation)
- `useOfflineQueue`: 4 tests (online/offline, replay, events)
- `useSupabaseQuery`: 4 tests (auth skip, fetch, single, schema)

## Phase 4: Component Tests (Steps 12-18) ✅
- `Onboarding`: 1 smoke test
- `Settings`: 1 smoke test
- `Landing`: 1 smoke test
- Existing: Auth, Home, Wardrobe, PaywallModal, BottomNav, ProtectedRoute

## Phase 5: Utility Tests (Steps 19-21) ✅
- `edgeFunctionClient`: 5 tests (success, retry, exhausted, exceptions, timeout error)
- `offlineQueue`: 6 tests (enqueue, upload, clear, replay, progress)
- `schemas`: 11 tests (profile, garment, style score, weather, safeParse, preferences)
- `nativeShare`: 4 tests (Median, Web Share, clipboard, cancel)
- Existing: compressFrame, backgroundGarmentSave

## Phase 6: Infrastructure (Steps 22-24) ✅
- Added `test:coverage` script with v8 provider + 30% line threshold
- Added CSP meta tag to `index.html`
- Added Sentry `release` tag using `__APP_VERSION__`

## Phase 7: Final Polish (Step 25) 🔄
- All new tests passing individually
- CI pipeline configured

**Total tests: ~100+ (48 existing + 52 new across 13 new test files)**
