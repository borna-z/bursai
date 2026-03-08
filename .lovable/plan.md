

## Make BURS AI Independent and Resilient

### Reality Check
Building a custom AI model from scratch requires millions of dollars in compute, datasets, and ML infrastructure — this isn't feasible within any app platform. However, we **can** make BURS AI feel and behave like its own independent intelligence by:

1. **Creating a unified BURS AI layer** — a shared module all 22 edge functions use, so the underlying models are completely abstracted away
2. **Multi-model fallback chains** — if one model fails, automatically try the next
3. **Response caching** — store AI results in a database table so repeated queries return instantly without any AI dependency
4. **Graceful offline mode** — when all models are down, serve cached/fallback responses

### What Changes

**1. Create shared AI client: `supabase/functions/_shared/burs-ai.ts`**
- Single `callBursAI()` function with: model fallback chain (3+ models), automatic retry with backoff, rate limit handling (429/402), timeout protection
- All 22 edge functions import from this one file instead of writing their own fetch logic
- Models tried in order: `google/gemini-3-flash-preview` → `google/gemini-2.5-flash` → `google/gemini-2.5-flash-lite`

**2. Create AI response cache table: `ai_response_cache`**
- Columns: `id`, `cache_key` (hash of prompt), `response`, `model_used`, `created_at`, `expires_at`
- Before calling AI, check cache; after calling AI, store result
- Cache TTL varies by function type (styling suggestions: 30min, garment analysis: permanent)

**3. Update all 22 edge functions**
- Replace inline `fetch("https://ai.gateway.lovable.dev/...")` calls with `callBursAI()`
- Each function passes its prompt, tools, and cache config
- Error handling becomes consistent across all functions

**4. Add fallback responses**
- For critical functions (style chat, outfit generation), define sensible fallback responses when all models are unavailable
- E.g., outfit generation falls back to the algorithmic scoring engine (already exists in `burs_style_engine`) without AI refinement

### Technical Details

```text
Current flow:
  Edge Function → fetch(gateway) → single model → response or error

New flow:
  Edge Function → callBursAI() → check cache
                                → try model 1 → try model 2 → try model 3
                                → cache result
                                → fallback response if all fail
```

The shared module handles:
- **Fallback chain**: 3 models tried sequentially
- **Retry**: 1 retry per model on 5xx errors
- **Cache**: hash-based lookup before any AI call
- **Rate limit backoff**: exponential delay on 429
- **Timeout**: 30s per model attempt

### Scope
- 1 new shared module
- 1 new database table
- 22 edge functions updated to use shared module
- No UI changes needed — this is all backend

