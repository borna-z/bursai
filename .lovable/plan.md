
# BURS Launch Readiness Plan v4

**Status: ✅ Phases 1-7 COMPLETE | AI Loading Animations COMPLETE**

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

## Phase 7: Final Polish (Step 25) ✅
- All new tests passing individually
- CI pipeline configured

## AI Loading Animations (35-Step Sprint) ✅

### Foundation
- Created `AILoadingOverlay` — reusable multi-phase loading with radar pulse rings, bouncing dots, phase cycling
- Created `AILoadingCard` — compact inline variant for cards/sections
- Added `shimmer-sweep` CSS keyframe for scanner beam effect

### Integrated Surfaces (20+ touchpoints)
- **OutfitGenerate** — 5-phase fullscreen animation
- **TodayOutfitCard** — AILoadingCard for initial load, AILoadingOverlay for regeneration
- **StylePicker** — AILoadingCard embedded in active style card
- **MoodOutfit** — AILoadingCard in selected mood card
- **QuickGenerateSheet** — AILoadingCard replaces spinner button
- **QuickPlanSheet** — AILoadingOverlay with day-name subtitle + progress bar
- **UnusedOutfits** — AILoadingOverlay with skeleton cards
- **AddGarment** — shimmer-sweep on image + AILoadingOverlay for phases
- **BatchUploadProgress** — per-item pulse ring animations
- **LiveScan** — multi-phase ScanOverlay with concentric rings + bouncing dots
- **AIChat** — bouncing dots + phase text for streaming indicator
- **AISuggestions** — AILoadingOverlay variant="card" with progress
- **StyleReportCard** — AILoadingCard with 3 phases
- **WardrobeGapSection** — refactored to use shared AILoadingOverlay
- **TravelCapsule** — AILoadingOverlay for generation, AILoadingCard for weather lookup + calendar sync
- **QuickGenerateSheet** — AILoadingCard for travel weather lookup

**Total tests: ~100+ (48 existing + 52 new across 13 new test files)**
