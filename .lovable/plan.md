
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

### 2.1 Lazy-load landing page sections
The Landing page is 434 lines with scroll observers. Split into lazy-loaded section components with `React.lazy` + `Suspense` for faster initial paint.

**Files:** `src/pages/Landing.tsx` → extract `HeroSection`, `FeaturesSection`, `TestimonialsSection`, `CTASection`

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

### 3.3 Virtualize wardrobe grid for large collections
Users with 50+ garments experience scroll jank. Add virtual scrolling to the wardrobe grid using a lightweight virtualizer.

**Files:** `src/pages/Wardrobe.tsx`
- Consider `@tanstack/react-virtual` for the garment grid
- Only render visible items + buffer

---

## 🧩 Phase 4 — Missing Features & UX Gaps

### 4.1 Pull-to-refresh on mobile
Add a pull-to-refresh gesture on the Home and Wardrobe pages to re-fetch data, matching native app behavior.

**Files:** `src/pages/Home.tsx`, `src/pages/Wardrobe.tsx`

### 4.2 Haptic feedback for key interactions
Use the `navigator.vibrate` API (where supported) for save confirmations, outfit generation completion, and delete actions.

**Files:** Create `src/lib/haptics.ts` utility, integrate into key flows

### 4.3 Offline indicator banner
Show a subtle banner when the user loses connectivity, since the app depends on cloud data.

**Files:** Create `src/components/layout/OfflineBanner.tsx`, add to `AppLayout`

### 4.4 Garment quick-actions swipe
Add swipe-to-reveal actions (edit, delete, toggle laundry) on garment list items for faster wardrobe management.

**Files:** `src/pages/Wardrobe.tsx` (list view mode)

---

## 🔒 Phase 5 — Reliability & Error Handling

### ✅ 5.1 Global error boundary
Added a styled `ErrorBoundary` class component wrapping the entire app. Catches React crashes and shows a branded error screen with "Try again" and "Reload" buttons. Shows error details in development mode.

**Files:** `src/components/layout/ErrorBoundary.tsx`, `src/App.tsx`

### 5.2 Retry logic on failed mutations
Add automatic retry with exponential backoff for failed saves (garment create/update, outfit save) using react-query mutation options.

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
