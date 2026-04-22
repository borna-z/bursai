# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the `supabase/functions/` subdirectory of the BURS AI wardrobe app. See the root `CLAUDE.md` for full project context (design system, frontend architecture, known bugs, database schema, component inventory, etc.).

## Hard Rules

- **Deploy command** (exact, always): `npx supabase functions deploy [function-name] --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`
- Never deploy all functions at once — always name the specific function
- Never use `getClaims()` — deprecated, silently fails. Use `getUser()` pattern instead
- TypeScript must pass after every task: `npx tsc --noEmit --skipLibCheck`
- All functions use `verify_jwt = false` — JWT is validated manually in code
- All AI functions must: import and call `enforceRateLimit()` + `checkOverload()` + pass `functionName` to `callBursAI()`. Caching params (`cacheTtlSeconds`/`cacheNamespace`) required for cacheable functions but not for image generation or streaming functions

## Edge Function Structure

39 functions, each a snake_case directory with a single `index.ts`. All use Deno with ESM URL imports:

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
| `burs-ai.ts` | AI abstraction: `callBursAI()`, `streamBursAI()` (streaming with keepalive pings), `bursAIErrorResponse()` (standard error formatter), `estimateMaxTokens()` (dynamic token budgets), `compressPrompt()` (text normalization), `compactGarment()` (garment→string, full UUID after P23), `isEnrichmentReady()` / `isEnrichmentFailed()` (predicates — accept BOTH `'complete'` and `'completed'` spellings), `filterEnrichedGarments()` (drops rows not ready), `waitForEnrichment()` (polls `garments.enrichment_status` until terminal or timeout; phantom IDs bucketed as failed), `checkRateLimit()`. Complexity-based model routing, Gemini fallback chains, DB response caching, token budget auto-set, cost tracking |
| `scale-guard.ts` | Scale infrastructure: `enforceRateLimit()`, `rateLimitResponse()`, `checkOverload()`, `recordError()` (circuit breaker tracking), `overloadResponse()`, `estimateCost()`, `logTelemetry()`, job queue primitives (`submitJob`/`claimJob`/`completeJob`/`failJob`/`getJobStatus`), `withConcurrencyLimit()` |
| `burs-voice.ts` | Voice identity fragments (`VOICE_STYLIST_CHAT`, `VOICE_SHOPPING`, etc.) for consistent premium tone in AI prompts |
| `unified_stylist_engine.ts` | Middleware to `burs_style_engine` function. Modes: generate, suggest, swap, refine. Also contains slot normalization logic (`normalizeIds()`) |
| `logger.ts` | Structured JSON logging: `const log = logger("fn_name"); log.info(...); log.error(...); log.exception(...)` |
| `idempotency.ts` | DB-backed request deduplication via `public.request_idempotency` table (P12). Atomic claim using UPSERT+ignoreDuplicates (same pattern as stripe_events). 60s claim TTL, 5min completed-result TTL. Both helpers take `supabaseAdmin` as 2nd arg. Consumers: `create_checkout_session`, `delete_user_account`. |
| `stripe-config.ts` | Environment-based Stripe test/live mode switching |
| `render-eligibility.ts` | Gemini vision gate — determines if garment images need ghost-mannequin rendering |
| `insights-dashboard.ts` | Wardrobe analytics metrics engine (color temperature, wear patterns, etc.) |
| `mannequin-presentation.ts` | Normalizes male/female/mixed mannequin presentation preference for garment renders |
| `outfit-scoring.ts` | Extracted from burs_style_engine (Session A): all scoring functions — color harmony, material compat, weather, formality, rotation, feedback, pair memory, style alignment, intent, comfort, body, social, uniform, `scoreGarment` |
| `outfit-combination.ts` | Extracted from burs_style_engine (Session A): combo building — family signatures, `buildCombos`, `buildFallbackCombos`, `scoreCombo`, `qualityGate`, confidence, wardrobe gaps, limitation notes |
| `outfit-rules.ts` | Canonical slot mapping, layering rules, outfit validation (331 lines). Used by outfit-validation.ts, complete-outfit-ids.ts, style-chat-normalizer.ts |
| `outfit-validation.ts` | Outfit validation logic with slot inference. Imports from outfit-rules.ts |
| `complete-outfit-ids.ts` | Outfit ID completion/resolution logic |
| `style-chat-normalizer.ts` | Normalizes style_chat AI output into structured outfit format. Used by style_chat |
| `garment-image-processing/` | Image processing subsystem: `provider.ts` (PhotoRoom background removal via `PHOTOROOM_API_KEY`), `quality.ts` (eligibility checks by category, binary image format detection), `types.ts` |
| `email-templates/` | React Email templates for Supabase Auth (signup, recovery, magic-link, etc.) using `@react-email/components` |

## AI Calls

Always use `callBursAI()` from `_shared/burs-ai.ts` — never call Gemini directly. Key parameters:

- `complexity`: `"trivial"` (300 tokens, temp 0.1), `"standard"` (600 tokens, temp 0.3), `"complex"` (1200 tokens, temp 0.5)
- `cacheNamespace`: identifies the cache partition (e.g., `"style_engine"`, `"mood_happy_userId"`) — set for cacheable functions
- `cacheTtlSeconds`: how long to cache the response (300-43200 depending on volatility) — set for cacheable functions
- `functionName`: identifies the caller for telemetry — **always set this**
- `modelType`: override for special cases (e.g., `"image-gen"` for image generation functions) — use instead of `complexity` when needed
- Pass `supabaseServiceClient` as second arg to enable DB caching: `callBursAI(opts, supabase)`
- For streaming: use `streamBursAI()` which wraps `callBursAI` with keepalive pings
- Analytics logging is fire-and-forget (never blocks response), includes token counts and estimated cost
- `estimateMaxTokens({ inputItems, outputItems, perItemTokens, baseTokens })` helper for dynamic budgets

The AI backend is Google Gemini via OpenAI-compatible endpoint. Model routing by complexity:
- **trivial/standard**: Gemini 2.5 Flash Lite primary → Flash fallback (cheaper model first)
- **complex**: Gemini 2.5 Flash primary → Flash Lite fallback (stronger model first)

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
- `style_chat` — largest function (~2300 LOC, rebuilt from main + CONVERSATIONAL mode). Supports 4 modes: OUTFIT_GENERATION, FOLLOW_UP, KNOWLEDGE, CONVERSATIONAL. CONVERSATIONAL detects greetings/short replies and fashion knowledge questions — uses trivial complexity (180 max_tokens), skips outfit card generation. Shared modules: style-chat-normalizer.ts, complete-outfit-ids.ts, outfit-validation.ts, outfit-rules.ts
- `burs_style_engine` — split in Session A from 5,067→~1,553 lines. Scoring and combination logic extracted to `_shared/outfit-scoring.ts` and `_shared/outfit-combination.ts`

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

**AI Stylist Truncation** — `style_chat/index.ts` has two-stage truncation: (1) ~line 1587: if `finish_reason === "length"`, cleans up partial sentence by finding last punctuation mark past 60% of text; (2) ~line 1619: non-outfit replies over 1400 chars are capped at 9 sentences, with ` …` appended if token-truncated. Previously was 6 sentences / 900 chars — already fixed but verify the limits are adequate for production responses.
