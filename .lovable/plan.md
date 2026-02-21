
# DRAPE — Polish, Performance & Missing Features Plan

## ✅ Completed
- Replace emojis with Lucide icons (Home page)
- Onboarding framer-motion entrance animations
- Dark mode contrast refinement
- Standardized whileTap spring feedback
- Shimmer skeleton loading states

---

## 🔥 Phase 1 — Route Transitions & Navigation Polish

### ✅ 1.1 Page-level route transitions
Wrapped `<Routes>` in `AnimatePresence mode="wait"` with a `motion.div` keyed by `location.pathname`. Every route now fades + slides (opacity + translateY 8px → 0 → -6px) over 250ms on enter/exit. Extracted into `AnimatedRoutes.tsx` to keep `App.tsx` clean.

**Files:** `src/App.tsx`, `src/components/layout/AnimatedRoutes.tsx`

### ✅ 1.2 Bottom nav active indicator animation
Added a sliding pill indicator using `motion.div` with `layoutId="nav-pill"` that glides between tabs with spring physics (stiffness: 400, damping: 30). The pill renders behind the active icon with `bg-accent/10 rounded-2xl`.

**Files:** `src/components/layout/BottomNav.tsx`

---

## 🎨 Phase 2 — Landing Page & Marketing Polish

### ✅ 2.1 Lazy-load landing page sections
Split 443-line Landing.tsx into 8 section components. Hero loads eagerly; all below-fold sections (TrialBanner, HowItWorks, Sustainability, Mission, Pricing, CTA, Download, Footer) are `React.lazy` loaded with `Suspense` for faster initial paint. Added a secondary IntersectionObserver to re-observe elements after lazy mount.

**Files:** `src/pages/Landing.tsx`, `src/components/landing/HeroSection.tsx`, `src/components/landing/TrialBanner.tsx`, `src/components/landing/HowItWorks.tsx`, `src/components/landing/SustainabilitySection.tsx`, `src/components/landing/MissionSection.tsx`, `src/components/landing/PricingSection.tsx`, `src/components/landing/CTASection.tsx`, `src/components/landing/DownloadSection.tsx`, `src/components/landing/LandingFooter.tsx`

### ✅ 2.2 Add OG meta tags for social sharing
Added page-specific Open Graph and Twitter Card meta tags via `react-helmet-async` to Landing (brand), Pricing (conversion), and ShareOutfit (dynamic outfit title/explanation).

**Files:** `src/pages/Landing.tsx`, `src/pages/Pricing.tsx`, `src/pages/ShareOutfit.tsx`

---

## ⚡ Phase 3 — Performance Optimizations

### 3.1 Code-split heavy pages with React.lazy
Pages like `AIChat`, `OutfitGenerate`, `LiveScan`, `Plan`, and `Insights` are heavy. Wrap them in `React.lazy` + `Suspense` with a branded loading skeleton.

**Files:** `src/App.tsx`
- Convert direct imports to `const AIChat = lazy(() => import('./pages/AIChat'))`
- Add `<Suspense fallback={<PageSkeleton />}>` wrapper

### ✅ 3.2 Optimize QueryClient defaults
Configured `staleTime: 2min`, `gcTime: 10min`, `refetchOnWindowFocus: false`, `retry: 1` on the global QueryClient to reduce redundant refetches and improve perceived performance.

**Files:** `src/App.tsx`

### ✅ 3.3 Virtualize wardrobe grid for large collections
Added `@tanstack/react-virtual` to virtualize both grid and list views. A `VirtualizedGarmentList` component renders only visible rows + 5 overscan buffer. Automatically triggers `fetchNextPage` when the sentinel row becomes visible. Supports grid (2-col, ~220px rows) and list (~74px rows) modes.

**Files:** `src/pages/Wardrobe.tsx`

---

## 🧩 Phase 4 — Missing Features & UX Gaps

### ✅ 4.1 Pull-to-refresh on mobile
Added reusable `PullToRefresh` component with touch gesture detection, damped pull, framer-motion animated spinner, and threshold-based trigger. Integrated into Home (refreshes weather, insights, garment count) and Wardrobe (refreshes garments list and count).

**Files:** `src/components/layout/PullToRefresh.tsx`, `src/pages/Home.tsx`, `src/pages/Wardrobe.tsx`

### ✅ 4.2 Haptic feedback for key interactions
Created `src/lib/haptics.ts` utility with light/medium/heavy/success patterns using `navigator.vibrate`. Integrated into garment create/update/delete and outfit create/delete/mark-worn hooks.

**Files:** `src/lib/haptics.ts`, `src/hooks/useGarments.ts`, `src/hooks/useOutfits.ts`

### ✅ 4.3 Offline indicator banner
Added `OfflineBanner` component using `navigator.onLine` + window events. Shows a red banner with spring animation when connectivity is lost, auto-hides when back online. Integrated into `AppLayout`.

**Files:** `src/components/layout/OfflineBanner.tsx`, `src/components/layout/AppLayout.tsx`

### ✅ 4.4 Garment quick-actions swipe
Added `SwipeableGarmentCard` component using framer-motion drag gestures. In list view (non-select mode), garment items can be swiped left to reveal three action buttons: Edit (accent), Laundry (warning), and Delete (destructive). Spring-based snap with threshold detection. Integrated into Wardrobe list view.

**Files:** `src/components/wardrobe/SwipeableGarmentCard.tsx`, `src/pages/Wardrobe.tsx`

---

## 🔒 Phase 5 — Reliability & Error Handling

### ✅ 5.1 Global error boundary
Added a styled `ErrorBoundary` class component wrapping the entire app. Catches React crashes and shows a branded error screen with "Try again" and "Reload" buttons. Shows error details in development mode.

**Files:** `src/components/layout/ErrorBoundary.tsx`, `src/App.tsx`

### ✅ 5.2 Retry logic on failed mutations
Added `retry: 2` with exponential backoff (`retryDelay: 2^attempt * 1000`, max 8s) to all write mutations (create, update, delete) in garment and outfit hooks.

**Files:** `src/hooks/useGarments.ts`, `src/hooks/useOutfits.ts`

---

## Priority Order
1. **3.1** Code-split heavy pages (biggest perf win, low effort)
2. **3.2** QueryClient optimization (quick win)
3. **1.1** Route transitions (high-impact polish)
4. **1.2** Bottom nav pill animation (delightful detail)
5. **5.1** Global error boundary (reliability)
6. **2.2** OG meta tags (SEO)
7. **4.3** Offline indicator (UX)
8. **2.1** Landing page lazy sections
9. **3.3** Virtual scroll wardrobe
10. **4.1** Pull-to-refresh
11. **4.2** Haptic feedback
12. **4.4** Swipe actions
13. **5.2** Retry logic
