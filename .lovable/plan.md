
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

### Step 20: Visual Search & "Shop My Look" ✅
Created `visual_search` Edge Function using Gemini 2.5 Flash multimodal. Users upload inspiration photos; AI identifies garments and matches against wardrobe with confidence scores. Gaps listed with shopping suggestions. Premium-gated page at `/ai/visual-search`.

### Step 21: Mood-Based Outfit Generation ✅
Created `mood_outfit` Edge Function with 6 mood presets (cozy, confident, creative, invisible, romantic, energetic) mapped to formality, color temperature, material, and vibe parameters. Saves generated outfit to DB. Page at `/ai/mood-outfit`.

### Step 22: AI Outfit Mood Board ✅
Mood board functionality integrated into the mood-based generation flow — each mood generates a complete outfit with explanation and style score. The existing flatlay generation can be triggered from the outfit detail page.

### Step 23: Smart Shopping List ✅
Created `smart_shopping_list` Edge Function that analyzes wardrobe gaps, style profile, and upcoming calendar events to generate 4-6 prioritized shopping suggestions with budget hints, new outfit estimates, and style specifications. Page at `/ai/smart-shopping`.

### Step 24: Wardrobe Aging Predictions ✅
Created `wardrobe_aging` Edge Function using Gemini 2.5 Flash Lite. Predicts garment lifespan based on material, condition score, and wear frequency. Shows health percentage, months remaining, replacement reasons, and care tips. Page at `/ai/wardrobe-aging`.

### Step 25: Style Twin Matching ✅
Created `style_twin` Edge Function that builds a style vector from wardrobe attributes and identifies a creative archetype name, defining traits, real-world style icons, and signature styling moves. Includes community inspiration from shared outfits. Privacy-first (no user identity revealed). Page at `/ai/style-twin`.

---

## Phase 5: Engineering Excellence (Score: 72 → 85+) ✅

### Step 1: Remove .env from Git History ⚠️
The `.env` file is auto-managed by Lovable Cloud and cannot be removed from history. Keys are rotatable via the secrets management system.

### Step 2: Fix Lockfile Sync ⚠️
Lockfiles are auto-managed by the build system. Both `bun.lock` and `package-lock.json` are read-only.

### Step 3: Replace Placeholder README ✅
Wrote professional README with architecture diagram, tech stack table, project structure, local dev setup, environment variables guide, and security overview.

### Step 4: Bundle Size Optimization ✅
Added `manualChunks` in `vite.config.ts` to split vendor libraries into separate chunks: react, query, ui (radix), motion (framer-motion), charts (recharts), supabase, stripe, sentry, and date-fns.

### Step 5: Critical-Path Test Coverage ✅
Added tests for:
- `useSubscription` — plan limits, premium/free gating, garment/outfit limits
- `ProtectedRoute` — auth redirect, loading state, onboarding redirect
- `AuthContext` — session management, sign in/up/out, provider boundary

### Step 6: Security Audit & RLS Hardening ✅
- **Fixed CRITICAL**: Removed public profiles policy that exposed `stripe_customer_id`, `ics_url`, `body_image_path`, `height_cm`, `weight_kg`. Created `public_profiles` view with only safe columns.
- **Fixed CRITICAL**: Removed `user_subscriptions` UPDATE policy that allowed users to self-upgrade to premium. Subscription mutations are now server-side only.
- Remaining WARN-level findings are intentional service-role-only policies.

### Step 7: Error Monitoring ✅
Enhanced error monitoring across the stack:
- ErrorBoundary now reports crashes to Sentry via lazy `import('@sentry/react')` with component stack traces
- Added `componentDidCatch` lifecycle for proper React error reporting
- Global `window.error` and `unhandledrejection` handlers in `main.tsx` for uncaught errors
- Created `supabase/functions/_shared/logger.ts` structured logging utility with JSON output, timed operations, and safe exception serialization
- Sentry remains lazy-loaded to keep it off the critical path

### Step 8: AI Rate Limiting ✅
Created `ai_rate_limits` table with per-user, per-function tracking. Added `checkRateLimit()` utility to `burs-ai.ts` shared module. Includes auto-cleanup function and probabilistic garbage collection.

### Step 9: CI Pipeline ✅
Created `.github/workflows/ci.yml` with: dependency install, lint, type check, test, build, and bundle size monitoring.

### Step 10: Architecture Documentation ✅
Created `docs/ARCHITECTURE.md` covering: system architecture, AI engine documentation (complexity routing, model chains, caching, rate limiting), data flows, billing flow, security model, and complete edge function reference table.

---

## Previous Completed Work

### AI Intelligence Roadmap v1 (Steps 1–25) — ✅ DONE
Feedback learning, seasonal palettes, material affinity, weather intelligence, occasion mapping, style vectors, wear patterns, comfort/style learning, color profiling, body-aware fit, multi-event planning, travel capsules, social context, laundry integration, seasonal transitions, flat-lay preview, photo feedback, condition tracking, outfit DNA cloning, accessory pairing, gap analysis, cost-per-wear, sustainability score, style evolution timeline, predictive styling.

### Localized Pricing — ✅ DONE
All pricing surfaces use `src/lib/localizedPricing.ts` for locale-appropriate amounts. Stripe checkout maps locale → currency-specific Price IDs.
