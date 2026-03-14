
# BURS Roadmap v3 — 25 Steps: Code Refinement, Snappiness & Median.co Readiness

## Phase 1: Performance & Snappiness (Steps 1-7)

### Step 1: Image Optimization Pipeline ✅
Created `src/lib/imageCompression.ts` — canvas-based resize (max 1200px) + WebP conversion (0.82 quality) before upload. Integrated into AddGarment flow. Added `loading="lazy"` and `decoding="async"` to all `<img>` tags in LazyImage/LazyImageSimple.

### Step 2: Route Prefetching & Preloading ✅
Created `src/lib/routePrefetch.ts` — prefetches route chunks on hover/focus via `requestIdleCallback`. Integrated into BottomNav with `onPointerEnter` and `onFocus` handlers on all 5 tabs.

### Step 3: React Query Optimistic Updates Audit ✅
Added `onMutate` optimistic updates with rollback to `useUpdateGarment` and `useUpdateOutfit`. Cache is updated instantly and reverted on error.

### Step 4: Animation Frame Budget Audit ✅
Removed `layoutId="nav-pill"` from BottomNav — replaced framer-motion layout animation with pure CSS transitions (no per-frame layout recalc). Replaced `motion.div` icon scale with CSS `transition-transform`. Removed `motion` import from BottomNav entirely.

### Step 5: Font Loading Optimization ✅
Removed DM Sans and Playfair Display from Google Fonts (unused in app). Trimmed Space Grotesk weights. Now loading only Inter (400-700), Sora (500-700), and Space Grotesk (400, 700).

### Step 6: Service Worker & Caching Strategy ✅
Upgraded `public/sw.js` with install/activate lifecycle, app shell pre-caching, stale-while-revalidate for static assets, cache-first for Google Fonts, and network-first skip for Supabase API calls.

### Step 7: React.memo & Re-render Optimization ✅
Wrapped `SwipeableGarmentCard` and `OutfitSlotCard` in `React.memo`.

---

## Phase 2: Median.co Native Bridge (Steps 8-14)

### Step 8: Native Share Sheet Integration ✅
Created `src/lib/nativeShare.ts` — cascading share: Median bridge → Web Share API → clipboard fallback. Integrated into OutfitDetail share flow.

### Step 9: Native Status Bar Sync per Route ✅
Created `src/hooks/useMedianStatusBar.ts` — syncs Median status bar style based on route (dark routes get light text) and resolved theme. Integrated into AppLayout.

### Step 10: Deep Link Handling
Configure Median universal links for `/u/:username`, `/outfit/:id`, `/auth`.

### Step 11: Native Camera Bridge Enhancement
Extend `useMedianCamera` to support additional native APIs.

### Step 12: Pull-to-Refresh Native Feel
Delegate to Median native pull-to-refresh when available.

### Step 13: Keyboard & Input Handling ✅
Created `src/hooks/useKeyboardAdjust.ts` — uses `visualViewport` API to detect keyboard height and sets `--keyboard-offset` CSS variable. Updated `.safe-bottom` to include keyboard offset. Integrated into AppLayout.

### Step 14: App Launch & Splash Screen Timing ✅
Auth token read is already synchronous from localStorage before React mount (Index.tsx). Body background matches splash via inline script in index.html.

---

## Phase 3: Data Integrity & Error Handling (Steps 15-19)

### Step 15: Retry & Error Recovery Patterns ✅
Created `src/lib/edgeFunctionClient.ts` — resilient edge function invocation with configurable timeout (25s default), exponential backoff retry (up to 3 attempts), and `EdgeFunctionTimeoutError` class.

### Step 16: Data Validation Layer
Add Zod schemas for Supabase query responses.

### Step 17: Stale Data Indicators
Show subtle "last updated X ago" timestamps on AI-generated content.

### Step 18: Edge Function Timeout Handling ✅
Handled in Step 15 — `invokeEdgeFunction` includes AbortController-based timeout and dedicated error class.

### Step 19: Offline Mutation Queue V2
Upgrade offline queue to handle image uploads.

---

## Phase 4: Code Quality & Maintainability (Steps 20-23)

### Step 20: Hook Consolidation
Create a `useSupabaseQuery<T>` generic wrapper.

### Step 21: Translation Key Audit
Audit all `t()` calls for missing keys.

### Step 22: Component File Size Audit
Split large files. Target max 150 lines per component.

### Step 23: Type Safety Hardening
Replace `Record<string, any>` casts with proper TypeScript interfaces.

---

## Phase 5: Production Hardening (Steps 24-25)

### Step 24: Lighthouse & Core Web Vitals Pass
Target: LCP < 2.5s, FID < 100ms, CLS < 0.1.

### Step 25: Median.co QA Checklist & Smoke Tests
Create manual QA checklist + Playwright smoke tests.
