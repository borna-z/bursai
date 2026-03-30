# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Follow everything here without being asked. These are standing orders, not suggestions.

## Hard Rules — Never Break These

- Never push directly to main — all changes via PR or explicit instruction
- Never touch `src/pages/Insights.tsx` — frozen, do not modify under any circumstances
- Never use localStorage or sessionStorage in artifacts — use React state
- Never use form HTML elements in React — use onClick/onChange handlers
- TypeScript must pass after every task — run `npx tsc --noEmit --skipLibCheck` and fix all errors before finishing
- Edge function deploy command (exact, always):
  ```
  npx supabase functions deploy [function-name] --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
  ```
- Never deploy all functions at once — always name the specific function
- Never use `getClaims()` in edge functions — deprecated, broken. Use `getUser()` pattern instead
- All AI edge functions must use `enforceRateLimit()` + `checkOverload()` + pass `cacheTtlSeconds`/`cacheNamespace`/`functionName` to `callBursAI()`

## Project Identity

| Field | Value |
|-------|-------|
| App | BURS — AI-powered wardrobe management and personal stylist |
| Founder | Solo, non-technical background, AI-assisted development throughout |
| Repo | borna-z/bursai on GitHub |
| Distribution | React/Vite web app on Vercel, wrapped for iOS/Android via Median.co |
| Backend | Supabase (PostgreSQL + 43 edge functions) |
| AI | Gemini API via OpenAI-compatible endpoint (chosen over Claude API for cost — 3-6x cheaper). Model chain: Gemini 2.5 Flash primary, Flash Lite fallback |
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
npm test               # Vitest + jsdom (512 tests, 91 files)
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

### Surface Classes (use these, don't invent new ones)
`.surface-hero` `.surface-secondary` `.surface-inset` `.surface-interactive` `.surface-editorial` `.surface-utility` `.topbar-frost` `.app-dock` `.eyebrow-chip` `.label-editorial`

### Design Principles
- Light mode: flat surfaces, minimal shadows, editorial feel — Scandinavian magazine aesthetic
- Dark mode: rich, warm charcoal — not cold/blue
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
- 43 functions, snake_case dirs, each with `index.ts` (Deno runtime, ESM URL imports)
- Shared utilities in `_shared/`: see `supabase/functions/CLAUDE.md` for full reference
- **AI engine** (`_shared/burs-ai.ts`): complexity-based model routing, Gemini fallback chains, DB response caching, per-user rate limiting, token/cost tracking
- **Scale guard** (`_shared/scale-guard.ts`): subscription-tier-aware rate limiting (free=0.5x, premium=2x), overload detection, job queue primitives, bounded concurrency, AI cost estimation, enhanced telemetry
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

## All 43 Edge Functions

| Function | Purpose | Rate Limited | Overload Guard | AI Cached |
|----------|---------|:---:|:---:|:---:|
| `analyze_garment` | AI image analysis to extract garment metadata (13 languages) | Y | - | - |
| `assess_garment_condition` | Evaluate garment wear/condition from photos | Y | Y | Y |
| `burs_style_engine` | Unified outfit generation engine (generate/suggest/swap/refine) | Y | - | Y |
| `calendar` | ICS and Google calendar sync with SSRF protection | - | - | - |
| `cleanup_ai_cache` | Delete expired/unused cache entries (cron) | - | - | N/A |
| `clone_outfit_dna` | Clone outfit style DNA for similar looks | - | - | Y |
| `create_checkout_session` | Create Stripe checkout for subscription | - | - | N/A |
| `create_portal_session` | Create Stripe billing portal session | - | - | N/A |
| `daily_reminders` | Send daily outfit reminder push notifications (cron) | - | - | N/A |
| `delete_user_account` | Delete user account and all associated data | - | - | N/A |
| `detect_duplicate_garment` | Find duplicate garments via attribute + AI visual comparison | Y | Y | Y |
| `generate_flatlay` | Generate flat lay arrangement images | Y | Y | - |
| `generate_garment_images` | Generate product photos for garments | Y | Y | - |
| `generate_outfit` | Outfit generation via unified engine | - | - | - |
| `get_vapid_public_key` | Return VAPID key for push notifications | - | - | N/A |
| `google_calendar_auth` | Google OAuth flow for calendar integration | - | - | N/A |
| `import_garments_from_links` | Import garments from URLs with metadata extraction | - | - | N/A |
| `insights_dashboard` | Build wardrobe analytics (color temp, wear patterns) | - | - | N/A |
| `mood_outfit` | Generate outfits based on mood input | Y | Y | Y |
| `outfit_photo_feedback` | Analyze outfit selfies with styling feedback | Y | Y | - |
| `prefetch_suggestions` | Batch prefetch daily suggestions (cron, 3 parallel, 50s budget) | - | - | Y |
| `process_garment_image` | Validate and process garment image quality | - | - | N/A |
| `process_job_queue` | Async job worker: image_processing, garment_enrichment, batch_analysis. Stuck job recovery. | - | - | N/A |
| `render_garment_image` | Render garment with background removal (PhotoRoom) | - | - | N/A |
| `restore_subscription` | Restore cancelled Stripe subscription | - | - | N/A |
| `seed_wardrobe` | Seed user wardrobe with starter garments | - | - | - |
| `send_push_notification` | Send push notifications | - | - | N/A |
| `shopping_chat` | Streaming shopping recommendation chat | Y | Y | - |
| `smart_shopping_list` | Generate prioritized shopping list from wardrobe gaps | - | - | Y |
| `stripe_webhook` | Handle Stripe events (checkout, subscription updates, payment failures). Atomic upsert idempotency. | - | - | N/A |
| `style_chat` | Interactive AI stylist chat (~3700 LOC) | Y | Y | - |
| `style_twin` | Find users with similar style profiles | - | - | Y |
| `suggest_accessories` | Suggest accessories to complete outfits | Y | Y | Y |
| `suggest_outfit_combinations` | Suggest outfit combos from wardrobe | Y | Y | Y |
| `summarize_day` | Summarize day events + outfit recommendations | Y | Y | Y |
| `travel_capsule` | Plan capsule wardrobe for trips | Y | Y | Y |
| `visual_search` | Search wardrobe by image similarity | Y | Y | Y |
| `wardrobe_aging` | Analyze wear patterns and garment aging | - | - | Y |
| `wardrobe_gap_analysis` | Identify missing items to complete wardrobe | - | - | Y |

**Rate limit tiers** are defined in `_shared/scale-guard.ts`. Base limits scale by subscription: free users get 0.5x, premium users get 2.0x. Example: `burs_style_engine` base is 30/hr → free=15/hr, premium=60/hr.

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
| `src/pages/OutfitDetail.tsx` | ~833 | |
| `src/pages/OutfitGenerate.tsx` | ~846 | |

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

**Audit score**: 91/100 (upgraded from 78). Target: 95+

### What Was Fixed (do not redo)
- Accent color: indigo to warm gold throughout index.css
- Auth screen: full editorial redesign
- Loading screen: cinematic Playfair Display entrance
- Home header: Playfair italic greeting, date as eyebrow
- Garment cards: edge-to-edge image, colour swatch dots, no pill clutter
- Empty states: concentric ring motif, editorial variant
- Style quiz: 10 questions down to 6 core questions
- overscroll-behavior: none on main scroll container
- Body background: cool blue gradient removed
- Scale hardening phase 1: rate limiting on 15 functions, circuit breaker, retry backoff, job queue, AI cost telemetry, overload detection
- Scale hardening phase 2: subscription-tier rate limits, caching gaps filled, N+1 fixes, performance indexes, stripe webhook idempotency, stuck job recovery

### What Still Needs Doing
- Keyboard accessibility on SwipeableGarmentCard (swipe has no keyboard alternative)
- Virtual scrolling on GarmentGrid (no react-window, renders entire list at 100+ items)
- AI stylist truncation — `style_chat/index.ts` ~line 1572 hard-caps at 6 sentences/900 chars (should be 9/1400)
- Milestone celebrations — first outfit, 10 garments, first wear (hook + overlay component)
- Reduced motion guards on AnimatedPage and BursLoadingScreen (missing useReducedMotion)
- Contrast ratios — CardEyebrow text-foreground/35 fails WCAG AA on cream background

## Known Bugs (confirmed, fix when touching related code)

**Bug 1: AI Stylist Truncation**
- File: `supabase/functions/style_chat/index.ts` ~line 1568
- Issue: Hard sentence cap cuts AI reply mid-thought at 6 sentences or 900 chars
- Fix: Raise to 9 sentences / 1400 chars. Append `...` when `finish_reason === "length"`

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
