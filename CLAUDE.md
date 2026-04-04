# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Follow everything here without being asked. These are standing orders, not suggestions.

## Hard Rules — Never Break These

- Never push directly to main — all changes via PR or explicit instruction
- `src/pages/Insights.tsx` — freeze lifted for V4 redesign. Was previously frozen, now editable.
- Never use localStorage or sessionStorage in artifacts — use React state
- Never use form HTML elements in React — use onClick/onChange handlers
- TypeScript must pass after every task — run `npx tsc --noEmit --skipLibCheck` and fix all errors before finishing
- Edge function deploy command (exact, always):
  ```
  npx supabase functions deploy [function-name] --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
  ```
- Never deploy all functions at once — always name the specific function
- Never use `getClaims()` in edge functions — deprecated, broken. Use `getUser()` pattern instead
- All AI edge functions must use `enforceRateLimit()` + `checkOverload()` + pass `functionName` to `callBursAI()`. Caching params (`cacheTtlSeconds`/`cacheNamespace`) required for cacheable functions but not for image generation or streaming

## Project Identity

| Field | Value |
|-------|-------|
| App | BURS — AI-powered wardrobe management and personal stylist |
| Founder | Solo, non-technical background, AI-assisted development throughout |
| Repo | borna-z/bursai on GitHub |
| Distribution | React/Vite web app on Vercel, wrapped for iOS/Android via Median.co |
| Backend | Supabase (PostgreSQL + 39 edge functions) |
| AI | Gemini API via OpenAI-compatible endpoint (chosen over Claude API for cost — 3-6x cheaper). Model routing: trivial/standard → Flash Lite primary (Flash fallback), complex → Flash primary (Flash Lite fallback) |
| Target market | Sweden first, then Nordics/UK/Netherlands, US year two |
| Pricing | $7.99/month, $69.99/year. Binary free/premium model |
| Domain | burs.me via IONOS DNS to Vercel nameservers |

## Build & Dev Commands

```bash
npm run dev            # local dev server on port 8080
npm run build          # production build (Vite)
npm run build:dev      # development build
npm run lint           # ESLint (ignores supabase/**)
npm run typecheck      # tsc --noEmit
npm test               # Vitest + jsdom
npm run test:watch     # watch mode
npx vitest run src/path/to/File.test.tsx  # single test file
npm run test:coverage  # 30% line threshold
```

## Design System — Source of Truth

### Brand Palette
| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| Editorial Cream | hsl(34 32% 95%) | #F5F0E8 | Background |
| Deep Charcoal | hsl(24 13% 10%) | #1C1917 | Foreground |
| Warm Gold | hsl(37 47% 46%) | #B07D3A | Accent (CORRECT) |
| Card surface | hsl(30 32% 98%) | near-white warm | Cards |
| Border | hsl(31 29% 84%) | — | Borders |

The accent is warm gold — NOT indigo. If you see `--accent: 229` anywhere, that's wrong. Fix it to `37 47% 46%`.

### Typography
- Display/emotional headlines: `font-['Playfair_Display'] italic`
- Body/UI copy: `font-['DM_Sans']`
- Never use: Inter, Roboto, Arial, Space Grotesk (legacy, replaced)
- CSS comment in index.css says "Inter + Sora" — stale/wrong

### Surface Classes
`.surface-hero` `.surface-secondary` `.surface-inset` `.surface-interactive` `.surface-editorial` `.surface-utility` `.topbar-frost` `.app-dock` `.eyebrow-chip` `.label-editorial`

**Post-flattening (branch `cleanup/flat-premium-pass`):** Most pages no longer use surface classes. Surfaces were removed from 33 pages and 13 components. The classes still exist in CSS for Home, Plan, Insights, and any future use — but the default pattern is now flat with `border border-border/40` for visual separation.

### Design Principles
- Light mode: flat surfaces, no shadows, editorial feel — Scandinavian magazine aesthetic
- Dark mode: rich, warm charcoal with subtle shadows — not cold/blue
- Borders: use `border-border/40` (not /30 — too faint in dark mode)
- Radius: `--radius: 1.125rem` — rounded but not bubbly
- Motion: Framer Motion throughout. Use `EASE_CURVE` from `src/lib/motion.ts`
- Micro-interactions: `hapticLight()` on every tap (`src/lib/haptics.ts`)

## Architecture

**Stack**: React 18 + TypeScript 5.8 + Vite, Supabase, TanStack React Query v5, Radix UI + shadcn/ui + Tailwind CSS, Framer Motion

**Path alias**: `@/` maps to `src/`

### Data Flow
- **5 contexts**: AuthContext, ThemeContext (5 accent colors via CSS vars), LanguageContext (14 locales, RTL for ar/fa), LocationContext, SeedContext
- **React Query**: offline-first, staleTime 2min, gcTime 30min, retry 1, no refetch on window focus
- **Pages**: lazy-loaded via React Router v6 in `AnimatedRoutes.tsx`, wrapped in `ProtectedRoute`
- **Error handling**: ErrorBoundary + Sentry (20% trace sample rate, `VITE_SENTRY_DSN`)

### Supabase Client
- **Client singleton**: `src/integrations/supabase/client.ts`
- **Types**: `src/integrations/supabase/types.ts` — use `Tables<'table_name'>`, `TablesInsert<>`, `TablesUpdate<>`
- **Edge invocation**: `src/lib/edgeFunctionClient.ts` — `invokeEdgeFunction<T>(name, opts)` with:
  - 25s timeout + exponential backoff with jitter
  - Client-side circuit breaker (5 consecutive failures = 30s cooldown)
  - Non-retryable error classification (429, 401, 402, 403, 400 — never retry)
  - `EdgeFunctionRateLimitError` with `retryAfter` for 429 responses
- **Garment images**: private `garments` bucket scoped to `<user-id>/*`

### Edge Functions (supabase/functions/)
- 39 functions, snake_case dirs, each with `index.ts` (Deno runtime, ESM URL imports)
- Shared utilities in `_shared/`: see `supabase/functions/CLAUDE.md` for full reference
- **AI engine** (`_shared/burs-ai.ts`): complexity-based model routing, Gemini fallback chains, DB response caching, per-user rate limiting, token/cost tracking. `parseBursAIProviderResponse` has `hadTools` param — JSON content fallback only fires for tool-based responses (Session 0 fix)
- **Scale guard** (`_shared/scale-guard.ts`): subscription-tier-aware rate limiting (free=0.5x, premium=2x), overload detection, job queue primitives, bounded concurrency, AI cost estimation, enhanced telemetry
- **Outfit scoring** (`_shared/outfit-scoring.ts`): extracted from burs_style_engine — all scoring functions (color harmony, material compat, weather, formality, rotation, feedback, pair memory, style alignment, intent, comfort, body, social, uniform, `scoreGarment`)
- **Outfit combination** (`_shared/outfit-combination.ts`): extracted from burs_style_engine — combo building (family signatures, `buildCombos`, `buildFallbackCombos`, `scoreCombo`, `qualityGate`, confidence, wardrobe gaps, limitation notes)
- **Outfit rules** (`_shared/outfit-rules.ts`): canonical slot mapping, layering rules, outfit validation (331 lines)
- **Outfit validation** (`_shared/outfit-validation.ts`): outfit validation logic with slot inference
- **Complete outfit IDs** (`_shared/complete-outfit-ids.ts`): outfit ID completion/resolution
- **Style chat normalizer** (`_shared/style-chat-normalizer.ts`): normalizes style_chat AI output into structured outfit format
- All functions: `verify_jwt = false` in config.toml, validate JWT manually with `getUser()`

### i18n
- 14 locales lazy-loaded from `src/i18n/locales/`
- `t(key)` from LanguageContext, dot-notation keys
- Missing keys humanized as fallback
- Persist to localStorage (`burs-locale`) + profile

## Database Schema (28 tables)

### Core
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (display_name, preferences, home_city, height/weight, stripe_customer_id, is_premium, mannequin_presentation) |
| `garments` | Wardrobe items (title, category, subcategory, colors, material, pattern, fit, formality, season_tags, wear_count, condition_score, image_path, enrichment_status, render_status) |
| `outfits` | Outfit definitions (title, occasion, garment_ids via outfit_items, saved flag, flatlay image) |
| `outfit_items` | Junction: garment + outfit + slot (top, bottom, shoes, outerwear, etc.) |
| `wear_logs` | Wear history (garment_id, user_id, worn_at, occasion) |
| `planned_outfits` | Calendar planner entries (date, outfit_id, worn flag) |
| `user_roles` | RBAC (user_id, role) |

### AI & Analytics
| Table | Purpose |
|-------|---------|
| `ai_response_cache` | DB-backed AI cache (cache_key, response, model_used, expires_at, hit_count). Indexed on (cache_key, expires_at) |
| `ai_rate_limits` | Per-user per-function call tracking. Indexed on (user_id, function_name, called_at DESC) |
| `analytics_events` | Observability (event_type, metadata: fn, model, latency_ms, cached, status, cost_usd, input_tokens, output_tokens) |
| `chat_messages` | Conversation history for style_chat and shopping_chat |
| `feedback_signals` | Implicit learning from user actions (saves, ignores, swaps, ratings) |
| `garment_pair_memory` | Positive/negative garment pairings learned over time |
| `job_queue` | Async job processing (job_type, payload, status, priority, attempts, locked_until). Worker: process_job_queue |

### Billing
| Table | Purpose |
|-------|---------|
| `subscriptions` | Stripe subscription state (user_id, plan: free/premium, status: active/trialing/past_due/canceled, stripe_subscription_id, current_period_end) |
| `user_subscriptions` | Legacy plan tracking (plan, garments_count, outfits_used_month) |
| `stripe_events` | Webhook idempotency log (event_id, event_type, processed_ok). Atomic upsert prevents race conditions |
| `checkout_attempts` | Payment attempt rate limiting |

### Social
| Table | Purpose |
|-------|---------|
| `friendships` | Social connections (requester, addressee, status: pending/accepted/declined) |
| `outfit_feedback` | Photo feedback scores (fit, color_match, overall) + AI commentary |
| `outfit_reactions` | Community reactions on shared outfits |
| `inspiration_saves` | Bookmarked shared outfits |
| `style_challenges` | Weekly challenge definitions |
| `challenge_participations` | User challenge entries |

### System
| Table | Purpose |
|-------|---------|
| `calendar_events` | Synced calendar events for occasion-based suggestions |
| `calendar_connections` | OAuth tokens for calendar providers |
| `push_subscriptions` | Web push notification endpoints |
| `marketing_leads` | Email capture for unauthenticated users |
| `marketing_events` | Growth analytics (UTM tracking) |

## Edge Functions (39 total)

Full function reference (rate limits, overload guards, caching, rate limit tiers) in `supabase/functions/CLAUDE.md`.

**Key functions:** `burs_style_engine` (unified outfit generation), `style_chat` (~2300 LOC AI stylist), `shopping_chat` (streaming), `analyze_garment` (image→metadata, 13 languages), `generate_flatlay`/`generate_garment_images` (AI image gen), `stripe_webhook` (atomic idempotency), `process_job_queue` (async worker).

**Rate limit tiers** defined in `_shared/scale-guard.ts`. Base limits scale by subscription: free=0.5x, premium=2.0x.

## Scale Infrastructure

### Client-Side (edgeFunctionClient.ts)
- **Circuit breaker**: 5 consecutive failures → 30s cooldown (per function name)
- **Exponential backoff with jitter**: +-25% jitter prevents thundering herd
- **Non-retryable errors**: 429, 401, 402, 403, 400 never retried
- **Idempotency**: optional UUID key shared across retries via `X-Idempotency-Key` header

### Server-Side (scale-guard.ts)
- **Subscription-tier rate limiting**: queries `subscriptions` table, caches plan per-isolate for 5min. Free=0.5x limits, premium=2.0x limits
- **Overload detection**: per-isolate error counter, auto-503 when 10+ errors/minute
- **Job queue**: PostgreSQL-backed with pessimistic locking (5min lock window). Stuck jobs auto-recovered on each worker invocation. Job types: image_processing, garment_enrichment, batch_analysis
- **Bounded concurrency**: `withConcurrencyLimit(items, N, fn)` for batch operations
- **AI cost tracking**: per-request token counts + estimated USD cost logged to analytics_events
- **Response caching**: DB-backed via ai_response_cache with TTL, hit counting, automatic cleanup

### Performance Indexes
- `idx_ai_rate_limits_user_fn_time` — (user_id, function_name, called_at DESC)
- `idx_ai_response_cache_key_expires` — (cache_key, expires_at)
- `idx_garments_user_available` — (user_id) WHERE in_laundry=false
- `idx_subscriptions_user_id` — (user_id)
- Plus 15+ indexes on garments, outfits, outfit_items, wear_logs from earlier migrations

## Key Component Inventory

### God Components (large, handle carefully — surgical changes only)
| File | Lines | Notes |
|------|-------|-------|
| `src/pages/AddGarment.tsx` | ~960 | Split in progress |
| `src/pages/Wardrobe.tsx` | ~905 | Split in progress |
| `src/pages/OutfitDetail.tsx` | ~833 | Split planned (Session B) |
| `src/pages/OutfitGenerate.tsx` | ~846 | Split planned (Session B) |

### Critical UI Components
- `src/components/wardrobe/GarmentCardSystem.tsx` — garment card layouts (grid + list)
- `src/components/ui/card-language.tsx` — CardEyebrow, CardPill, CardMetaRail, ColorSwatch
- `src/components/layout/BottomNav.tsx` — main nav with spring animation active pill
- `src/components/layout/AppLayout.tsx` — root layout, safe areas, overscroll-none
- `src/components/layout/BursLoadingScreen.tsx` — app launch screen
- `src/components/layout/EmptyState.tsx` — empty state with concentric ring motif
- `src/pages/Auth.tsx` — editorial private-atelier auth screen

### Hook Patterns
`useGarmentCount()` `useFlatGarments()` `useGarments()` `useProfile()` `useOutfits()` `usePlannedOutfitsForDate(dateStr)` `useStyleDNA()` `useFirstRunCoach()` `useWardrobeUnlocks()` `useUnlockCelebration()` `useWeather({ city })` `hapticLight()`

## Current Code Quality State

**Audit score**: 94/100 (upgraded from 93 after completing all V4 pages). Target: 95+

### What Was Fixed (do not redo)
- Accent color migration: indigo → warm gold (index.css + all components)
- Full V4 editorial redesign: 37/44 pages (Scandinavian magazine aesthetic, Playfair Display headlines, editorial surfaces)
- Flat premium pass: surface wrappers removed from 33 pages + 13 components, light/dark contrast audit (WCAG AA)
- Scale hardening: rate limiting on 15 functions, circuit breaker, retry backoff, job queue, AI cost telemetry, overload detection, subscription-tier limits, N+1 fixes, performance indexes, stripe webhook idempotency
- UI polish: auth screen redesign, cinematic loading screen, garment cards (edge-to-edge image, colour swatches), empty states (concentric ring motif), style quiz (10→6 questions), overscroll-behavior: none, blue gradient removed, home shortcuts (5 quick-access cards)

### V4 Redesign — Current State (branch: `v4/editorial-redesign`)

**Status:** 37/44 pages redesigned. 0 TODO, 1 SKIP (SeedWardrobe — not in repo), 3 N/A (redirects).

The V4 redesign applies Scandinavian editorial magazine aesthetic (Kinfolk/Cereal feel): serif italic headlines (Playfair Display), clean hierarchy, hero cards, minimal shadows, warm gold accent, editorial surfaces.

**Stitch project ID:** `8117716384164426188` | **Design system asset ID:** `14594054922406120457`
Fetch designs with `mcp__stitch__get_screen` using `name: "projects/8117716384164426188/screens/{screenId}"`.

**V4 Screen ID Map:** All 44 pages mapped. 40 DONE, 1 SKIP (SeedWardrobe — not in repo), 3 N/A (redirects). Full map in `docs/V4_SCREEN_IDS.md`. To fetch a design: `mcp__stitch__get_screen` with `name: "projects/8117716384164426188/screens/{screenId}"`.

**V4 design principles:**
- Headlines: `font-display italic text-[1.3rem+]` (Playfair Display)
- Eyebrow labels: `label-editorial text-muted-foreground/75` uppercase tracking
- Cards: flat with `border border-border/40 rounded-[1.25rem]` (surfaces removed in flat-premium-pass). Only Home/Plan/Insights retain `surface-hero`/`surface-secondary`.
- Buttons: `rounded-full` with hapticLight() on tap
- Motion: Framer Motion with staggered entrances, `EASE_CURVE` from motion.ts, gated by `useReducedMotion()`
- Spacing: generous padding (`p-4` to `p-6`), `gap-3` to `gap-4` between sections
- No visual clutter: remove redundant labels, badge spam, dense grids
- Each page uses `AppLayout > PageHeader > PullToRefresh > AnimatedPage` pattern
- Text contrast: minimum `text-muted-foreground/60` for readable text (WCAG AA). Icons/placeholders can be lower.

### What Still Needs Doing
- Keyboard accessibility on SwipeableGarmentCard (swipe has no keyboard alternative)
- Virtual scrolling on GarmentGrid (no react-window, renders entire list at 100+ items)
- AI stylist truncation — `style_chat/index.ts` ~line 1572 hard-caps at 6 sentences/900 chars (should be 9/1400)
- Milestone celebrations — first outfit, 10 garments, first wear (hook + overlay component)
- Reduced motion guards on AnimatedPage and BursLoadingScreen (most V4 pages now have `useReducedMotion`, but these two core components still lack it)
- ~~Contrast ratios — CardEyebrow fixed to text-foreground/70 (was /35, now WCAG AA compliant)~~ DONE (Session G)

## Known Bugs (confirmed, fix when touching related code)

**Bug 1: AI Stylist Truncation** (partially fixed)
- File: `supabase/functions/style_chat/index.ts` ~lines 1587-1631
- Status: Limits already raised to 9 sentences / 1400 chars. Two-stage truncation: (1) cleans partial sentence on `finish_reason === "length"`, (2) caps non-outfit replies at 9 sentences with ` …` indicator
- Remaining: Verify limits are adequate for production responses — may still cut complex styling advice short

**Bug 2: Outfit Without Shoes** (partially fixed)
- File: `src/pages/OutfitGenerate.tsx`
- Status: Placeholder now navigates to `wardrobe?category=shoes`. Warning banner shows when outfit incomplete.

**Bug 3: Auth JWT Pattern**
- Issue: Some edge functions may still use deprecated `getClaims()` — silently fails
- Fix: Replace with `const { data: { user } } = await supabase.auth.getUser(token)`

## Infrastructure Facts

| System | Details |
|--------|---------|
| SMTP | Resend (migrated from IONOS — do NOT use IONOS SMTP) |
| iOS Payments | StoreKit in-app purchases (Stripe CANNOT be used for digital goods on iOS) |
| Web Payments | Stripe checkout + webhook. Atomic upsert idempotency on stripe_events |
| Frontend hosting | Vercel |
| Backend hosting | Supabase (PostgreSQL + Edge Functions + Auth + Storage) |
| Camera | Median.co native camera bridge (useMedianCamera hook) — do not use browser fetch(dataUrl) |
| Subscriptions | Binary free/premium. `subscriptions` table is source of truth. Rate limits scale by tier automatically |
| Job queue | `job_queue` table with pessimistic locking. Worker: `process_job_queue` (cron every 1 min). Stuck jobs auto-recovered |
| AI caching | `ai_response_cache` table. Cleanup: `cleanup_ai_cache` function (cron). TTLs per function (5min to 12hr) |

## Testing Conventions

- Tests co-located in `__tests__/` subdirectories
- Test setup: `src/test/setup.ts` (localStorage/sessionStorage mocked)
- 30% line coverage threshold — do not drop below this
- When adding a new hook: add a `__tests__/useMyHook.test.tsx` alongside it
- Edge function client tests: `src/lib/__tests__/edgeFunctionClient.test.ts` (10 tests covering retry, circuit breaker, rate limit detection)

## Subagent Instructions

When given a multi-task prompt, spawn subagents in parallel:
```
Task 1 [Agent A]: [specific files] -> [specific outcome]
Task 2 [Agent B]: [specific files] -> [specific outcome]
```
After all agents: run `npx tsc --noEmit --skipLibCheck` -> must return 0 errors.
Deploy only changed edge functions (never deploy all).
Prefer parallelism. Sequential only when Task B depends on Task A's output.

## Environment Variables

### Frontend (required)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Frontend (optional)
- `VITE_SENTRY_DSN`

### Edge Functions (required)
- `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Edge Functions (feature-specific)
- Stripe: `STRIPE_MODE`, `STRIPE_SECRET_KEY_TEST`/`_LIVE`, `STRIPE_WEBHOOK_SECRET_TEST`/`_LIVE`, `STRIPE_PRICE_ID_*`
- Image processing: `PHOTOROOM_API_KEY`, `PHOTOROOM_API_BASE_URL`
- Push: VAPID keys
- OAuth: Google OAuth keys

## Vite Chunk Splitting (do not change)
Manual chunks: React, TanStack Query, Radix UI, Framer Motion, Supabase, date-fns, Sentry.
`@imgly/background-removal` excluded from dependency optimization (WASM, loads separately).
