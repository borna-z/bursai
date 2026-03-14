
# BURS Roadmap v3 — 25 Steps: Code Refinement, Snappiness & Median.co Readiness

## Phase 1: Performance & Snappiness (Steps 1-7)

### Step 1: Image Optimization Pipeline ✅
Created `src/lib/imageCompression.ts` — canvas-based resize (max 1200px) + WebP conversion (0.82 quality) before upload. Integrated into AddGarment flow. Added `loading="lazy"` and `decoding="async"` to all `<img>` tags in LazyImage/LazyImageSimple.

### Step 2: Route Prefetching & Preloading ✅
Created `src/lib/routePrefetch.ts` — prefetches route chunks on hover/focus via `requestIdleCallback`. Integrated into BottomNav with `onPointerEnter` and `onFocus` handlers on all 5 tabs.

### Step 3: React Query Optimistic Updates Audit ✅
Added `onMutate` optimistic updates with rollback to `useUpdateGarment` and `useUpdateOutfit`. Cache is updated instantly and reverted on error.

### Step 4: Animation Frame Budget Audit
Profile framer-motion animations. Cap stagger to 8 items max. Replace `layout` animations on lists with CSS `transform` where possible. Ensure all animated elements use `will-change: transform`. Remove `layoutId="nav-pill"` recalc on every render.

### Step 5: Font Loading Optimization ✅
Removed DM Sans and Playfair Display from Google Fonts (unused in app). Trimmed Space Grotesk weights. Now loading only Inter (400-700), Sora (500-700), and Space Grotesk (400, 700). Reduced font payload significantly.

### Step 6: Service Worker & Caching Strategy ✅
Upgraded `public/sw.js` with install/activate lifecycle, app shell pre-caching, stale-while-revalidate for static assets, cache-first for Google Fonts, and network-first skip for Supabase API calls.

### Step 7: React.memo & Re-render Optimization ✅
Wrapped `SwipeableGarmentCard` and `OutfitSlotCard` in `React.memo` to prevent unnecessary re-renders in list contexts.

---

## Phase 2: Median.co Native Bridge (Steps 8-14)

### Step 8: Native Share Sheet Integration
Use `median.share.open()` for sharing outfits/profiles when in Median. Fall back to Web Share API, then clipboard copy.

### Step 9: Native Status Bar Sync per Route
Extend status bar sync beyond ThemeContext. Dark routes should set `style: 'light'`. Add a `useMedianStatusBar` hook triggered on route change.

### Step 10: Deep Link Handling
Configure Median universal links for `/u/:username`, `/outfit/:id`, `/auth`. Add a `useDeepLink` hook.

### Step 11: Native Camera Bridge Enhancement
Extend `useMedianCamera` to support `median.camera.takePicture` if/when Median exposes it.

### Step 12: Pull-to-Refresh Native Feel
In Median, disable CSS-based pull-to-refresh and delegate to Median's native `median.webview.pullToRefresh` if available.

### Step 13: Keyboard & Input Handling
Fix iOS WebView keyboard push-up issues. Add `visualViewport` resize listener to adjust bottom nav.

### Step 14: App Launch & Splash Screen Timing
Minimize time-to-interactive. Move auth check to synchronous token read.

---

## Phase 3: Data Integrity & Error Handling (Steps 15-19)

### Step 15: Retry & Error Recovery Patterns
Add exponential backoff retry to all edge function calls. Show inline retry buttons.

### Step 16: Data Validation Layer
Add Zod schemas for Supabase query responses.

### Step 17: Stale Data Indicators
Show subtle "last updated X ago" timestamps on AI-generated content.

### Step 18: Edge Function Timeout Handling
Add client-side timeout handling with "Still thinking..." messages.

### Step 19: Offline Mutation Queue V2
Upgrade offline queue to handle image uploads (store as base64 blob).

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
