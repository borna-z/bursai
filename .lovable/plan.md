

# BURS Roadmap v3 — 25 Steps: Code Refinement, Snappiness & Median.co Readiness

Replaces `.lovable/plan.md` with a fresh 25-step plan focused on making the app production-grade, fast, and fully Median.co native-ready.

---

## Phase 1: Performance & Snappiness (Steps 1-7)

### Step 1: Image Optimization Pipeline
Add WebP/AVIF support to garment image uploads. Compress on upload via canvas resize (max 1200px). Add `loading="lazy"` and `decoding="async"` to all `<img>` tags. Add `srcset` for thumbnail vs full-size in wardrobe grid. Reduces LCP and bandwidth.

### Step 2: Route Prefetching & Preloading
Add `<link rel="prefetch">` for likely next routes (e.g., prefetch `/wardrobe` chunk when on Home). Use React Router `loader` pattern or `import()` on hover/focus of BottomNav tabs. Cuts perceived navigation time.

### Step 3: React Query Optimistic Updates Audit
Audit all mutations (add garment, mark worn, save outfit, toggle laundry) for optimistic updates. Several currently wait for server round-trip. Add `onMutate` rollback patterns for instant feedback.

### Step 4: Animation Frame Budget Audit
Profile framer-motion animations. Cap stagger to 8 items max. Replace `layout` animations on lists with CSS `transform` where possible. Ensure all animated elements use `will-change: transform`. Remove `layoutId="nav-pill"` recalc on every render.

### Step 5: Font Loading Optimization
Currently loading 5 Google Fonts families (DM Sans, Inter, Playfair Display, Sora, Space Grotesk). Audit actual usage — likely only Inter + Sora needed in-app. Remove unused fonts. Switch to `font-display: swap` with `<link rel="preload" as="font">` for critical weights only.

### Step 6: Service Worker & Caching Strategy
Upgrade `sw.js` to cache app shell, fonts, and critical assets with a stale-while-revalidate strategy. Add runtime caching for Supabase signed URLs (garment images). Pre-cache critical routes for instant offline loads.

### Step 7: React.memo & Re-render Optimization
Wrap heavy list-item components (SwipeableGarmentCard, DayCard, OutfitSlotCard) in `React.memo`. Stabilize callback props with `useCallback`. Profile with React DevTools Profiler and fix top re-render culprits.

---

## Phase 2: Median.co Native Bridge (Steps 8-14)

### Step 8: Native Share Sheet Integration
Use `median.share.open()` for sharing outfits/profiles when in Median. Fall back to Web Share API, then clipboard copy. Currently uses `prepareExternalNavigation` which doesn't leverage native share.

### Step 9: Native Status Bar Sync per Route
Extend status bar sync beyond ThemeContext. Dark routes (landing, onboarding) should set `style: 'light'` (white text). In-app routes should match resolved theme. Add a `useMedianStatusBar` hook triggered on route change.

### Step 10: Deep Link Handling
Configure Median universal links for `/u/:username`, `/outfit/:id`, `/auth`. Add a `useDeepLink` hook that parses incoming URLs and navigates via React Router on app launch.

### Step 11: Native Camera Bridge Enhancement
Extend `useMedianCamera` to support `median.camera.takePicture` if/when Median exposes it. Add image quality/size params. Ensure the file input fallback handles `capture="environment"` correctly on both iOS and Android WebViews.

### Step 12: Pull-to-Refresh Native Feel
In Median, disable CSS-based pull-to-refresh and delegate to Median's native `median.webview.pullToRefresh` if available. Prevents double-bounce and gives OS-native feel.

### Step 13: Keyboard & Input Handling
Fix iOS WebView keyboard push-up issues. Add `visualViewport` resize listener to adjust bottom nav and fixed elements when keyboard opens. Prevent input zoom on iOS (already have `font-size: 16px` — verify in Median).

### Step 14: App Launch & Splash Screen Timing
Minimize time-to-interactive. Move auth check to a synchronous token read from localStorage before React mount. Eliminate blank white frame between native splash and first paint. Ensure `body` background matches splash.

---

## Phase 3: Data Integrity & Error Handling (Steps 15-19)

### Step 15: Retry & Error Recovery Patterns
Add exponential backoff retry to all edge function calls. Show inline retry buttons on failed AI generations (outfit, mood, gap analysis). Add toast-based error recovery with "Try again" actions.

### Step 16: Data Validation Layer
Add Zod schemas for all Supabase query responses (garments, outfits, profiles). Validate at the hook level before passing to components. Prevents crashes from unexpected null fields or schema changes.

### Step 17: Stale Data Indicators
Show subtle "last updated X ago" timestamps on AI-generated content (suggestions, insights, gap analysis). Auto-refresh if data older than 24h. Prevents users seeing outdated recommendations.

### Step 18: Edge Function Timeout Handling
Several edge functions (style engine, gap analysis) can take 10-15s. Add client-side timeout handling with user-friendly messages ("Still thinking...") at 5s and abort + retry option at 20s.

### Step 19: Offline Mutation Queue V2
Upgrade offline queue to handle image uploads (store as base64 blob). Show pending uploads count in wardrobe. Auto-resume uploads on reconnect with progress indicator.

---

## Phase 4: Code Quality & Maintainability (Steps 20-23)

### Step 20: Hook Consolidation
Several hooks duplicate Supabase query patterns. Create a `useSupabaseQuery<T>` generic wrapper that handles auth checks, error states, and typing. Reduce boilerplate in `useGarments`, `useOutfits`, `useProfile`, etc.

### Step 21: Translation Key Audit
Audit all `t()` calls for missing keys across EN/SV/ES/DE locales. Add a build-time script or test that flags untranslated keys. Remove dead translation keys.

### Step 22: Component File Size Audit
Split large files (UnusedOutfits, Plan, OutfitDetail, WardrobeGapSection are all 200+ lines). Extract sub-components into `/components` subdirectories. Target max 150 lines per component file.

### Step 23: Type Safety Hardening
Replace `Record<string, any>` casts (used for `preferences`, `style_profile`, etc.) with proper TypeScript interfaces. Add discriminated unions for outfit generation states. Remove `as any` casts.

---

## Phase 5: Production Hardening (Steps 24-25)

### Step 24: Lighthouse & Core Web Vitals Pass
Target: LCP < 2.5s, FID < 100ms, CLS < 0.1. Fix any layout shifts from lazy-loaded images (add explicit `width`/`height`). Defer non-critical CSS. Add `fetchpriority="high"` to hero images.

### Step 25: Median.co QA Checklist & Smoke Tests
Create a manual QA checklist covering: safe area rendering (notch, home indicator), haptic feedback on all interactive elements, status bar color on every route, external link handling, camera/gallery access, push notification flow, back gesture, keyboard behavior, deep links, and offline mode. Add Playwright smoke tests for critical flows (auth, add garment, generate outfit).

