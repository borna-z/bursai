CLAUDE.md — BURS AI Wardrobe App
This file is read by Claude Code at the start of every session.
Follow everything here without being asked. These are standing orders, not suggestions.

Hard Rules — Never Break These

Never push directly to main — all changes via PR or explicit instruction
Never touch src/pages/Insights.tsx — frozen, do not modify under any circumstances
Never use localStorage or sessionStorage in artifacts — use React state
Never use form HTML elements in React — use onClick/onChange handlers
TypeScript must pass after every task — run npx tsc --noEmit --skipLibCheck and fix all errors before finishing
Edge function deploy command (exact, always):

  npx supabase functions deploy [function-name] --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt

Never deploy all functions at once — always name the specific function
Never use getClaims() in edge functions — deprecated, broken. Use getUser() pattern instead


Project Identity
App: BURS — AI-powered wardrobe management and personal stylist
Founder: Solo, non-technical background, AI-assisted development throughout
Repo: borna-z/bursai on GitHub
Distribution: React/Vite web app → Vercel → Median.co wraps for iOS/Android App Store
Backend: Supabase (PostgreSQL + 43 edge functions)
AI: Gemini API (chosen over Claude API for cost — 3–6× cheaper)
Target market: Sweden first, then Nordics/UK/Netherlands, US year two
Pricing: $7.99/month, $69.99/year

Build & Dev Commands
bashnpm run dev          # local dev server on port 8080
npm run build        # production build (Vite)
npm run build:dev    # development build
npm run lint         # ESLint (ignores supabase/**)
npm run typecheck    # tsc --noEmit
npm test             # Vitest + jsdom
npm run test:watch   # watch mode
npx vitest run src/path/to/File.test.tsx  # single test file
npm run test:coverage  # 30% line threshold

Design System — Source of Truth
Brand Palette
Editorial Cream (background):  hsl(34 32% 95%)   → #F5F0E8
Deep Charcoal (foreground):    hsl(24 13% 10%)   → #1C1917
Warm Gold (accent):            hsl(37 47% 46%)   → #B07D3A  ← CORRECT accent
Card surface:                  hsl(30 32% 98%)   → near-white warm
Border:                        hsl(31 29% 84%)
The accent is warm gold — NOT indigo. If you see --accent: 229 anywhere, that's wrong. Fix it to 37 47% 46%.
Typography

Display/emotional headlines: font-['Playfair_Display'] italic — Playfair Display italic
Body/UI copy: font-['DM_Sans'] — DM Sans
Never use: Inter, Roboto, Arial, Space Grotesk as primary fonts (legacy, replaced)
CSS comment in index.css says "Inter + Sora" — that comment is stale/wrong, the actual fonts are Playfair Display + DM Sans

Surface Classes (use these, don't invent new ones)
.surface-hero          — primary hero cards
.surface-secondary     — supporting cards
.surface-inset         — search bars, inputs
.surface-interactive   — buttons, action cards
.surface-editorial     — editorial-weight cards
.surface-utility       — utility surfaces
.topbar-frost          — sticky page headers (defined in index.css)
.app-dock              — bottom navigation container
.eyebrow-chip          — small uppercase label chips
.label-editorial       — section overlines
Design Principles

Light mode: flat surfaces, minimal shadows, editorial feel — like a Scandinavian magazine
Dark mode: rich, warm charcoal — not cold/blue
Radius: --radius: 1.125rem — rounded but not bubbly
Motion: Framer Motion throughout. Use EASE_CURVE from src/lib/motion.ts for all custom transitions
Micro-interactions: hapticLight() on every tap (src/lib/haptics.ts)


Architecture
Stack: React 18 + TypeScript 5.8 + Vite, Supabase, TanStack React Query v5, Radix UI + shadcn/ui + Tailwind CSS, Framer Motion
Path alias: @/ → src/
Data Flow

5 contexts: AuthContext, ThemeContext (5 accent colors via CSS vars), LanguageContext (14 locales, RTL for ar/fa), LocationContext, SeedContext
React Query: offline-first, staleTime 2min, gcTime 30min, retry 1, no refetch on window focus
Pages: lazy-loaded via React Router v6 in AnimatedRoutes.tsx, wrapped in ProtectedRoute
Error handling: ErrorBoundary + Sentry (20% trace sample rate, VITE_SENTRY_DSN)

Supabase

Client singleton: src/integrations/supabase/client.ts
Types: src/integrations/supabase/types.ts — use Tables<'table_name'>, TablesInsert<>, TablesUpdate<>
Edge invocation: src/lib/edgeFunctionClient.ts — invokeEdgeFunction<T>(name, opts) with 25s timeout + exponential backoff + client-side circuit breaker (5 failures → 30s cooldown)
Garment images: private garments bucket scoped to <user-id>/*

Edge Functions (supabase/functions/)

43 functions, snake_case dirs, each with index.ts
Shared utilities in _shared/: CORS, AI engine, voice, logging, idempotency, Stripe config, image processing, email, scale-guard
AI engine (_shared/burs-ai.ts): complexity-based model routing, Gemini fallback chains, DB response caching, per-user rate limiting, token/cost tracking
Scale guard (_shared/scale-guard.ts): subscription-tier-aware rate limiting (free=0.5x, premium=2x), overload detection, job queue primitives, bounded concurrency, AI cost estimation, enhanced telemetry
All functions: verify_jwt = false in config.toml, validate JWT manually with getUser() (NOT getClaims())
All AI functions must: import and call enforceRateLimit() + checkOverload() + pass cacheTtlSeconds/cacheNamespace to callBursAI()
Job queue: process_job_queue function processes async jobs (image_processing, garment_enrichment, batch_analysis) with stuck job recovery

i18n

14 locales lazy-loaded from src/i18n/locales/
t(key) from LanguageContext, dot-notation keys
Missing keys humanized as fallback
Persist to localStorage (burs-locale) + profile


Key Component Inventory
God Components (large, handle carefully)
src/pages/AddGarment.tsx        — 960 lines, split in progress
src/pages/Wardrobe.tsx          — 905 lines, split in progress  
src/pages/OutfitDetail.tsx      — 833 lines
src/pages/OutfitGenerate.tsx    — 846 lines
When editing these: surgical changes only. Do not refactor structure unless explicitly asked.
Critical UI Components
src/components/wardrobe/GarmentCardSystem.tsx     — garment card layouts (grid + list)
src/components/ui/card-language.tsx               — CardEyebrow, CardPill, CardMetaRail, ColorSwatch
src/components/layout/BottomNav.tsx               — main nav with spring animation active pill
src/components/layout/AppLayout.tsx               — root layout, safe areas, overscroll-none
src/components/layout/BursLoadingScreen.tsx       — app launch screen
src/components/layout/EmptyState.tsx              — empty state with concentric ring motif
src/pages/Auth.tsx                                — editorial private-atelier auth screen
Hook Patterns

useGarmentCount(), useFlatGarments(), useGarments() — wardrobe data
useProfile() — user profile
useOutfits() — all outfits
usePlannedOutfitsForDate(dateStr) — planned outfits for a day
useStyleDNA() — style DNA analysis
useFirstRunCoach() — coach mark system
useWardrobeUnlocks() / useUnlockCelebration() — feature unlock system
useWeather({ city }) — weather data
hapticLight() — always call this on interactive taps


Current Code Quality State
Audit score: 91/100 (upgraded from 78 in last design sprint)
Target: 95+
What Was Fixed (do not redo)

Accent color: indigo → warm gold throughout index.css ✅
Auth screen: full editorial redesign ✅
Loading screen: cinematic Playfair Display entrance ✅
Home header: Playfair italic greeting, date as eyebrow ✅
Garment cards: edge-to-edge image, colour swatch dots, no pill clutter ✅
Empty states: concentric ring motif, editorial variant ✅
Style quiz: 10 questions → 6 core questions ✅
overscroll-behavior: none on main scroll container ✅
Body background: cool blue gradient removed ✅

What Still Needs Doing

Keyboard accessibility on SwipeableGarmentCard (swipe has no keyboard alternative)
Virtual scrolling on GarmentGrid — no react-window, renders entire list at 100+ items
AI stylist truncation — style_chat/index.ts line ~1572 hard-caps at 6 sentences/900 chars
Milestone celebrations — first outfit, 10 garments, first wear (hook + overlay component)
Reduced motion guards on AnimatedPage and BursLoadingScreen (missing useReducedMotion)
Contrast ratios — CardEyebrow text-foreground/35 fails WCAG AA on cream background


Known Bugs (confirmed, fix when touching related code)
Bug 1: AI Stylist Truncation
File: supabase/functions/style_chat/index.ts ~line 1568
Issue: Hard sentence cap — cuts AI reply mid-thought at 6 sentences or 900 chars
Fix: Raise to 9 sentences / 1400 chars. Append … when finish_reason === "length"
Bug 2: Outfit Without Shoes — Dead End (partially fixed)
File: src/pages/OutfitGenerate.tsx
Issue: When AI generates outfit without shoes, empty slot showed passive text "Add shoes to complete"
Status: Placeholder now navigates to wardrobe?category=shoes. Warning banner shows when outfit incomplete. ✅ Mostly fixed.
Bug 3: Auth JWT Pattern (edge functions)
Issue: Some edge functions still use deprecated getClaims() — silently fails
Fix: Replace with const { data: { user } } = await supabase.auth.getUser(token)

Infrastructure Facts

SMTP: Resend (migrated from IONOS — do not use IONOS SMTP config)
Payments: StoreKit for iOS in-app purchases (Stripe CANNOT be used for digital goods on iOS — App Store rejection risk). Stripe for web checkout (webhook idempotency via atomic upsert on stripe_events)
Deployment: Vercel (frontend) + Supabase (backend)
DNS: burs.me via IONOS → Vercel nameservers
Camera: Median.co native camera bridge (useMedianCamera hook) — do not use browser fetch(dataUrl) pattern
Subscriptions: Binary free/premium model. subscriptions table is source of truth (plan, status). Rate limits scale by tier automatically.
Job queue: job_queue table with pessimistic locking. Worker: process_job_queue (cron every 1 min). Stuck jobs auto-recovered on each invocation.


Testing Conventions

Tests co-located in __tests__/ subdirectories
Test setup: src/test/setup.ts (localStorage/sessionStorage mocked)
30% line coverage threshold — do not drop below this
When adding a new hook: add a __tests__/useMyHook.test.tsx alongside it


Subagent Instructions
When given a multi-task prompt, spawn subagents in parallel using this pattern:
Task 1 [Agent A]: [specific files] → [specific outcome]
Task 2 [Agent B]: [specific files] → [specific outcome]
...
After all agents: run npx tsc --noEmit --skipLibCheck → must return 0 errors
Deploy only changed edge functions (never deploy all)
Prefer parallelism. Seqential only when Task B depends on Task A's output.

Environment Variables
Frontend (required):

VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY

Frontend (optional):

VITE_SENTRY_DSN

Edge functions:

GEMINI_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
Stripe keys, VAPID keys, Google OAuth keys as needed


Vite Chunk Splitting (do not change)
Manual chunks: React, TanStack Query, Radix UI, Framer Motion, Supabase, date-fns, Sentry
@imgly/background-removal excluded from dependency optimization (WASM, loads separately)