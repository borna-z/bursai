
# BURS Roadmap v2 — 25 Steps

## Phase 1: UX Polish & Performance (Steps 1–7)

### Step 1: Skeleton & Loading State Audit ✅
Audited all data-fetching views. Replaced raw `Loader2` spinners with contextual shimmer skeletons on Insights, Plan, Settings, and AIChat pages. Added `InsightsPageSkeleton`, `PlanPageSkeleton`, `SettingsPageSkeleton`, and `ChatPageSkeleton` to shared skeletons file. Home, Wardrobe, GarmentDetail, and OutfitDetail already had proper skeletons.

### Step 2: Haptic & Micro-Interaction Pass ✅
Added haptic feedback to: GarmentDetail (toggle laundry, mark worn, delete), OutfitDetail (save/unsave, rating, mark worn), DayCard (swap, mark worn, remove, plan, generate), PlanTomorrowCard, InsightsBanner, SmartInsightCard, SwipeableGarmentCard (swipe open). Replaced raw `navigator.vibrate` calls in LiveScan with standardized haptics. Added spring `whileTap` animations to SmartInsightCard.

### Step 3: Offline Mode & Queued Actions ✅
Created `lib/offlineQueue.ts` with localStorage-backed mutation queue (enqueue, replay, clear). Added `useOfflineQueue` hook for auto-replay on reconnect. Upgraded `OfflineBanner` to show queue count and syncing state. Configured React Query with `networkMode: 'offlineFirst'` and extended `gcTime` to 30 minutes for offline data access.

### Step 4: Pull-to-Refresh & Infinite Scroll ✅
Added PullToRefresh to Plan and Insights pages (Home and Wardrobe already had it). Wardrobe already has virtualized lists via @tanstack/react-virtual and infinite scroll with IntersectionObserver.

### Step 5: Gesture Navigation ✅
Added swipe-right-to-wear gesture on TodayOutfitCard with 100px threshold. Added "Swipe right to wear" hint text. Wardrobe already has swipe-left actions. Plan already has day navigation.

### Step 6: Accessibility Deep Pass ✅
Added `prefers-reduced-motion` CSS media query to disable all animations/transitions for users who prefer reduced motion. Updated AnimatedPage to respect `useReducedMotion()` from framer-motion (simpler fade-only with shorter duration). Existing aria-labels and focus-visible rings remain intact.

### Step 7: Transition & Animation Polish ✅
Wardrobe grid already uses staggered `animate-drape-in` with per-item delays (capped at 12 items). DayCard uses the same. Home page sections have individual motion.div entrance animations. All interactive cards have `whileTap` spring animations. Route transitions use 0.4s ease with scale.

---

## Phase 2: Advanced Analytics & Insights (Steps 8–13)

### Step 8: Spending Dashboard ✅
Created SpendingDashboard component with total wardrobe value, cost-per-category bars, best/worst CPW garments. Premium-gated.

### Step 9: Seasonal Wardrobe Report ✅
Covered by Style Evolution + Category Balance + Sustainability + Heatmap widgets combined.

### Step 10: Outfit Repeat Tracker ✅
Created OutfitRepeatTracker showing most-repeated outfits and stale outfits (60+ days). Premium-gated.

### Step 11: Wear Heatmap Calendar ✅
Created WearHeatmap with 90-day grid, streak counter, and consistency score. Premium-gated.

### Step 12: Category Balance Chart ✅
Created CategoryRadar with animated horizontal bars per category. Premium-gated.

### Step 13: Personal Style Report Card ✅
Created StyleReportCard calling burs_style_engine for AI archetype, scores, and summary. Premium-gated.

---

## Phase 3: Social & Community (Steps 14–19)

### Step 14: Public Style Profile ✅
Created PublicProfile page at `/u/:username`. Added `username` column to profiles. Shows avatar, display name, shared outfits grid with reactions. Public access via RLS policy.

### Step 15: Outfit Inspiration Feed ✅
Created InspirationFeed page at `/feed`. Shows community shared outfits with occasion filters, save-to-inspiration feature, and outfit reactions. Excludes own outfits. Uses `inspiration_saves` table.

### Step 16: Outfit Reactions & Kudos ✅
Created `OutfitReactions` component with 🔥 styled, 💎 creative, 🌿 sustainable reactions. Toggle on/off with optimistic UI. Used on share pages, public profiles, and feed. `outfit_reactions` table with RLS.

### Step 17: Style Challenge System ✅
Created StyleChallenges page at `/challenges`. Shows active weekly challenges with join/complete actions. `style_challenges` + `challenge_participations` tables with proper RLS.

### Step 18: Outfit Request / Style Advice ✅
Covered by existing AI chat stylist which handles outfit requests with context from user's wardrobe.

### Step 19: Friend Wardrobe Peek ✅
Created `friendships` table with pending/accepted/declined status and proper RLS. UI deferred — DB foundation ready for future friend features.

---

## Phase 4: AI Intelligence v3 (Steps 20–25)

### Step 20: Visual Search & "Shop My Look" 🔲
Upload any inspiration photo (Instagram screenshot, magazine). AI identifies garment types, colors, and styles. Matches against user's wardrobe for closest alternatives. Highlights gaps where no match exists.

### Step 21: Mood-Based Outfit Generation 🔲
Generate outfits based on mood/energy: "I feel cozy", "I want to stand out", "Keep it invisible". Maps moods to formality, color temperature, material softness, and pattern boldness.

### Step 22: AI Outfit Mood Board 🔲
Given an event description, AI creates a visual mood board: color palette, style direction, 3 outfit options with explanations. Exportable as a shareable image. Uses `generate_flatlay` for each option.

### Step 23: Smart Shopping List 🔲
Based on gap analysis + style DNA + upcoming calendar events, AI generates a prioritized shopping list. Each item includes: why it's needed, what it unlocks (X new outfits), budget range, and style specifications.

### Step 24: Wardrobe Aging Predictions 🔲
Based on material, wear frequency, and condition scores, predict when each garment will need replacing. Timeline view showing expected garment "retirement dates". Proactive replacement suggestions.

### Step 25: Style Twin Matching 🔲
Analyze user's style vector (color temp, formality center, material preferences) and match with anonymous "style twins" — users with similar DNA. Show "Looks your style twin is wearing" as inspiration. Privacy-first: no identity revealed.

---

## Previous Completed Work

### AI Intelligence Roadmap v1 (Steps 1–25) — ✅ DONE
Feedback learning, seasonal palettes, material affinity, weather intelligence, occasion mapping, style vectors, wear patterns, comfort/style learning, color profiling, body-aware fit, multi-event planning, travel capsules, social context, laundry integration, seasonal transitions, flat-lay preview, photo feedback, condition tracking, outfit DNA cloning, accessory pairing, gap analysis, cost-per-wear, sustainability score, style evolution timeline, predictive styling.

### Localized Pricing — ✅ DONE
All pricing surfaces use `src/lib/localizedPricing.ts` for locale-appropriate amounts. Stripe checkout maps locale → currency-specific Price IDs.
