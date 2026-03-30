# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the `supabase/functions/` subdirectory of the BURS AI wardrobe app. See the root `CLAUDE.md` for full project context (design system, frontend architecture, known bugs, database schema, component inventory, etc.).

## Hard Rules

- **Deploy command** (exact, always): `npx supabase functions deploy [function-name] --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`
- Never deploy all functions at once — always name the specific function
- Never use `getClaims()` — deprecated, silently fails. Use `getUser()` pattern instead
- TypeScript must pass after every task: `npx tsc --noEmit --skipLibCheck`
- All functions use `verify_jwt = false` — JWT is validated manually in code
- All AI functions must: import and call `enforceRateLimit()` + `checkOverload()` + pass `cacheTtlSeconds`/`cacheNamespace`/`functionName` to `callBursAI()`

## Edge Function Structure

43 functions, each a snake_case directory with a single `index.ts`. All use Deno with ESM URL imports:

```typescript
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

No `deno.json` or import map exists — all imports are explicit URLs or relative paths to `_shared/`. Some older functions (e.g. `stripe_webhook`) import from `std@0.190.0` — both work but prefer `std@0.220.0` for new code.

## Required Patterns

Every AI edge function must follow this skeleton:

### 1. CORS preflight — first thing inside `serve()`:
```typescript
if (req.method === "OPTIONS") {
  return new Response(null, { headers: CORS_HEADERS });
}
```

### 2. Overload check — before any expensive work:
```typescript
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse } from "../_shared/scale-guard.ts";

if (checkOverload("function_name")) {
  return overloadResponse(CORS_HEADERS);
}
```

### 3. Auth — extract token manually, call `getUser()`:
```typescript
const authHeader = req.headers.get("Authorization");
const token = authHeader.replace("Bearer ", "");
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user } } = await supabase.auth.getUser(token);
```

### 4. Rate limiting — after auth, before AI call:
```typescript
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
await enforceRateLimit(serviceClient, user.id, "function_name");
```

### 5. AI call — always with caching params:
```typescript
const { data } = await callBursAI({
  messages: [...],
  complexity: "standard",
  cacheTtlSeconds: 1800,
  cacheNamespace: "my_function_user123",
  functionName: "my_function",
}, serviceClient);  // second arg enables DB caching
```

### 6. Error handling — catch RateLimitError separately:
```typescript
} catch (e) {
  if (e instanceof RateLimitError) {
    return rateLimitResponse(e, CORS_HEADERS);
  }
  return bursAIErrorResponse(e, CORS_HEADERS);
}
```

## Shared Utilities (`_shared/`)

| File | Purpose |
|------|---------|
| `cors.ts` | `CORS_HEADERS` constant — include on every response |
| `burs-ai.ts` | AI abstraction: `callBursAI({ messages, complexity, cacheNamespace, functionName, ... })`. Complexity-based model routing (trivial/standard/complex), Gemini fallback chains, DB response caching via `ai_response_cache` table, token budget auto-set, cost tracking |
| `scale-guard.ts` | Scale infrastructure: subscription-tier rate limiting (free=0.5x, premium=2x), overload detection (per-isolate circuit breaker), job queue primitives (submit/claim/complete/fail), bounded concurrency (`withConcurrencyLimit`), AI cost estimation (`estimateCost`), enhanced telemetry (`logTelemetry`) |
| `burs-voice.ts` | Voice identity fragments (`VOICE_STYLIST_CHAT`, `VOICE_SHOPPING`, etc.) for consistent premium tone in AI prompts |
| `unified_stylist_engine.ts` | Middleware to `burs_style_engine` function. Modes: generate, suggest, swap, refine. Also contains slot normalization logic (`normalizeIds()`) |
| `logger.ts` | Structured JSON logging: `const log = logger("fn_name"); log.info(...); log.error(...); log.exception(...)` |
| `idempotency.ts` | In-memory TTL cache (5min default) for request deduplication |
| `stripe-config.ts` | Environment-based Stripe test/live mode switching |
| `render-eligibility.ts` | Gemini vision gate — determines if garment images need ghost-mannequin rendering |
| `insights-dashboard.ts` | Wardrobe analytics metrics engine (color temperature, wear patterns, etc.) |
| `mannequin-presentation.ts` | Normalizes male/female/mixed mannequin presentation preference for garment renders |
| `garment-image-processing/` | Image processing subsystem: `provider.ts` (PhotoRoom background removal via `PHOTOROOM_API_KEY`), `quality.ts` (eligibility checks by category, binary image format detection), `types.ts` |
| `email-templates/` | React Email templates for Supabase Auth (signup, recovery, magic-link, etc.) using `@react-email/components` |

## AI Calls

Always use `callBursAI()` from `_shared/burs-ai.ts` — never call Gemini directly. Key parameters:

- `complexity`: `"trivial"` (300 tokens, temp 0.1), `"standard"` (600 tokens, temp 0.3), `"complex"` (1200 tokens, temp 0.5)
- `cacheNamespace`: identifies the cache partition — **always set this** (e.g., `"style_engine"`, `"mood_happy_userId"`)
- `cacheTtlSeconds`: how long to cache the response — **always set this** (300-43200 depending on volatility)
- `functionName`: identifies the caller for telemetry — **always set this**
- Pass `supabaseServiceClient` as second arg to enable DB caching: `callBursAI(opts, supabase)`
- Analytics logging is fire-and-forget (never blocks response), includes token counts and estimated cost
- `estimateMaxTokens({ inputItems, outputItems, perItemTokens, baseTokens })` helper for dynamic budgets

The AI backend is Google Gemini via OpenAI-compatible endpoint. Model chain: Gemini 2.5 Flash primary, Flash Lite fallback.

## Rate Limiting

All AI functions enforce per-user rate limits via `enforceRateLimit()` from `scale-guard.ts`.

### Subscription-Tier Multipliers
| Plan | Multiplier | Example: burs_style_engine |
|------|-----------|---------------------------|
| Free | 0.5x | 15/hr, 3/min |
| Premium (active/trialing) | 2.0x | 60/hr, 10/min |

Base limits are defined in `RATE_LIMIT_TIERS` in `scale-guard.ts`. Subscription plan is resolved from the `subscriptions` table and cached per-isolate for 5 minutes.

### Base Rate Limits (per function)
| Function | Per Hour | Per Minute | Category |
|----------|---------|-----------|----------|
| `generate_garment_images` | 20 | 3 | Expensive AI |
| `generate_flatlay` | 15 | 3 | Expensive AI |
| `burs_style_engine` | 30 | 5 | Expensive AI |
| `outfit_photo_feedback` | 20 | 4 | Expensive AI |
| `style_chat` | 60 | 10 | Moderate AI |
| `shopping_chat` | 60 | 10 | Moderate AI |
| `analyze_garment` | 40 | 8 | Moderate AI |
| `visual_search` | 30 | 5 | Moderate AI |
| `mood_outfit` | 30 | 5 | Moderate AI |
| `suggest_outfit_combinations` | 30 | 5 | Moderate AI |
| `suggest_accessories` | 30 | 5 | Moderate AI |
| `clone_outfit_dna` | 20 | 4 | Moderate AI |
| `smart_shopping_list` | 20 | 4 | Moderate AI |
| `travel_capsule` | 15 | 3 | Moderate AI |
| `summarize_day` | 40 | 8 | Light AI |
| `detect_duplicate_garment` | 40 | 8 | Light AI |
| `assess_garment_condition` | 30 | 5 | Light AI |
| `wardrobe_gap_analysis` | 15 | 3 | Light AI |
| `wardrobe_aging` | 15 | 3 | Light AI |
| `style_twin` | 15 | 3 | Light AI |
| `__default` | 60 | 12 | Unlisted |

### Client-Side Protection
`src/lib/edgeFunctionClient.ts` includes:
- Circuit breaker: 5 consecutive failures → 30s cooldown per function
- Exponential backoff with +-25% jitter
- Non-retryable error classification (429, 401, 402, 403, 400)
- `EdgeFunctionRateLimitError` with `retryAfter` property

## Job Queue

PostgreSQL-backed async processing via `job_queue` table:
- **Worker**: `process_job_queue` function (invoke via cron every 1 minute)
- **Job types**: `image_processing`, `garment_enrichment`, `batch_analysis`
- **Concurrency**: 3 parallel jobs, max 10 per invocation
- **Locking**: pessimistic with 5-minute lock window via `locked_until`
- **Retry**: exponential backoff (attempt * 30s), max 3 attempts, then `dead` status
- **Stuck recovery**: every invocation resets jobs with expired locks back to `pending`
- **Cleanup**: 10% probabilistic old job cleanup on each invocation

Submit jobs from any function:
```typescript
import { submitJob } from "../_shared/scale-guard.ts";
const jobId = await submitJob(supabase, {
  jobType: "image_processing",
  payload: { garment_id: "..." },
  userId: user.id,
});
```

## Key Database Tables

| Table | Purpose | Key Indexes |
|-------|---------|------------|
| `garments` | Wardrobe items | (user_id, created_at DESC), (user_id) WHERE in_laundry=false |
| `outfits` | Outfit definitions | (user_id, generated_at DESC), (user_id) WHERE saved=true |
| `subscriptions` | Stripe subscription state (plan: free/premium) | (user_id) |
| `ai_response_cache` | AI response cache with TTL | (cache_key, expires_at) |
| `ai_rate_limits` | Per-user per-function call tracking | (user_id, function_name, called_at DESC) |
| `analytics_events` | Telemetry (fn, model, latency, cost, tokens) | — |
| `job_queue` | Async job processing | (job_type, status, locked_until, priority) WHERE status IN (pending, processing) |
| `stripe_events` | Webhook idempotency (atomic upsert) | PK on id |

## Environment Variables

**Required for all functions**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`

**Stripe functions**: `STRIPE_MODE`, `STRIPE_SECRET_KEY_TEST`/`_LIVE`, `STRIPE_WEBHOOK_SECRET_TEST`/`_LIVE`, `STRIPE_PRICE_ID_*`

**Image processing**: `PHOTOROOM_API_KEY`, `PHOTOROOM_API_BASE_URL`

## Notable Function Details

- `analyze_garment` — supports 13 languages for garment title localization via `TITLE_LANG_MAP`
- `calendar` — includes SSRF protection blocking localhost/private IPs in URL validation
- `stripe_webhook` — inline Stripe mode switching. Atomic upsert idempotency (no race condition). Updates both `subscriptions` and `user_subscriptions` tables
- `process_job_queue` — async worker with stuck job recovery. Handles image_processing (PhotoRoom), garment_enrichment (deep AI analysis), batch_analysis
- `prefetch_suggestions` — batch daily suggestions. Bounded concurrency (3 parallel), 100 user batch, 50s time budget
- `cleanup_ai_cache` — deletes expired entries + never-reused entries older than 24h
- `style_chat` — largest function (~3700 LOC). Interactive streaming stylist chat

## Scale Architecture Summary

```
User Request
    │
    ▼
┌─────────────────────────────────────────┐
│ edgeFunctionClient.ts (client-side)     │
│ Circuit breaker → Backoff+jitter →      │
│ Non-retryable classification            │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Edge Function                           │
│ 1. checkOverload() → 503 if tripped     │
│ 2. getUser() → auth                     │
│ 3. enforceRateLimit() → 429 if exceeded │
│    (resolves subscription tier,         │
│     free=0.5x / premium=2.0x)          │
│ 4. callBursAI() → check cache →        │
│    call Gemini → cache response →       │
│    log telemetry (tokens, cost)         │
└─────────────────────────────────────────┘
```

## Known Bug in This Directory

**AI Stylist Truncation** — `style_chat/index.ts` ~line 1568 hard-caps AI replies at 6 sentences / 900 chars. Should be 9 sentences / 1400 chars, with `...` appended when `finish_reason === "length"`.
