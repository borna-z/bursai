

# BURS AI Infrastructure — Further Optimization Opportunities

## Current State (Already Implemented)
- Complexity-based model routing (trivial/standard/complex)
- Two-tier caching (in-memory + DB)
- Prompt compression & compact garment descriptors
- Request deduplication
- Token budgets per complexity level
- Prefetch suggestions cron function

---

## What's Still Missing

### 1. Cache Cleanup & Eviction
**Problem**: The `ai_response_cache` table grows indefinitely. Expired rows are never deleted.
**Fix**: Create a scheduled edge function `cleanup_ai_cache` that runs daily and deletes rows where `expires_at < now()`. Also purge rows with `hit_count = 0` older than 24h (never-reused responses).

### 2. Temperature Control Across Functions
**Problem**: Only 2 of 21 functions set `temperature`. Most functions use the model default (~1.0), which wastes tokens on creative variance when structured output is needed.
**Fix**: Add a `temperature` default per complexity level in `burs-ai.ts`:
- `trivial`: 0.1 (deterministic)
- `standard`: 0.3 (slightly creative)
- `complex`: 0.5 (balanced)

### 3. Structured Output / JSON Mode
**Problem**: Many functions ask the AI to return JSON via prompts like "respond ONLY with valid JSON" — this is fragile and wastes tokens on formatting instructions. Models support native JSON mode.
**Fix**: Add `response_format: { type: "json_object" }` to `extraBody` for functions that need structured JSON output (analyze_garment, mood_outfit, summarize_day, etc.). This guarantees valid JSON and removes the need for verbose formatting instructions in prompts.

### 4. Missing Caching on High-Traffic Functions
**Problem**: Several frequently-called functions have NO caching:
- `analyze_garment` — same image re-analyzed = same result
- `mood_outfit` — same mood + similar wardrobe = cacheable
- `suggest_outfit_combinations` — same wardrobe state = cacheable
- `summarize_day` — same date = cacheable for hours
**Fix**: Add `cacheTtlSeconds` to these functions with appropriate TTLs.

### 5. Parallel DB Queries in More Functions
**Problem**: Functions like `mood_outfit`, `clone_outfit_dna`, `suggest_accessories` fetch data sequentially (garments, then outfits, then profile). 
**Fix**: Use `Promise.all()` for independent DB queries in all functions that fetch multiple tables.

### 6. `analyze_garment` Still Uses Legacy `modelType`
**Problem**: `analyze_garment` uses `modelType: aiModelType` (legacy) instead of the new `complexity` system, and also sets `max_tokens` in `extraBody` AND as a top-level option (double specification).
**Fix**: Migrate to `complexity: "complex"` and clean up the dual max_tokens.

### 7. Streaming Keepalive & Abort Detection
**Problem**: `streamBursAI` returns the raw response but doesn't handle client disconnects or long pauses. If the AI takes 20+ seconds, the connection may timeout silently.
**Fix**: Add a `TransformStream` wrapper in `streamBursAI` that:
- Sends SSE keepalive comments (`: keepalive\n\n`) every 15s
- Detects if the writable side is closed (client disconnect) and aborts the upstream fetch

### 8. Observability & Metrics
**Problem**: No way to know which models are used most, average latency, cache hit rates, or error rates. Debugging production issues requires guessing.
**Fix**: Add a lightweight `ai_usage_log` table (or append to `analytics_events`) that logs: function name, model used, latency_ms, from_cache, token count, status. This is fire-and-forget (no await).

### 9. `wardrobe_aging` and `style_twin` Use Legacy `modelType` + Missing `supabaseServiceClient`
**Problem**: `wardrobe_aging` still passes `modelType: "fast"` alongside the new `complexity` field. `style_twin` doesn't pass a supabase client to `callBursAI`, so its cache only uses Tier 1 (in-memory, 30s) instead of persisting to DB.
**Fix**: Remove legacy `modelType` references and pass supabase service client for DB cache in all functions that use `cacheTtlSeconds`.

### 10. Edge Function Cold Start Optimization
**Problem**: Each function imports from `"https://deno.land/std@0.168.0/http/server.ts"` and `"https://esm.sh/@supabase/supabase-js@2"` — old versions. Deno Deploy caches these but the initial import resolution adds ~200ms.
**Fix**: Pin to latest stable versions and consider using `Deno.serve` directly (available in Deno Deploy) instead of importing `serve` from std.

---

## Implementation Priority

| Priority | Change | Impact | Effort |
|---|---|---|---|
| High | Add temperature defaults per complexity | Cost savings, better structured output | Small |
| High | Add caching to analyze_garment, mood_outfit, summarize_day | Latency reduction for repeat calls | Small |
| High | Fix missing supabase client in cached functions | DB cache actually works | Small |
| Medium | Cache cleanup cron function | Prevents DB bloat | Small |
| Medium | JSON mode for structured output functions | Reliability, fewer retries | Medium |
| Medium | Observability logging | Debugging, cost tracking | Medium |
| Low | Streaming keepalive | Fewer timeout errors | Medium |
| Low | Parallel DB queries in remaining functions | Minor latency gains | Small |
| Low | Migrate remaining legacy modelType usages | Code consistency | Small |

## Files to Change
- `supabase/functions/_shared/burs-ai.ts` — temperature defaults, JSON mode helper, observability logging
- `supabase/functions/analyze_garment/index.ts` — migrate to complexity, add caching
- `supabase/functions/mood_outfit/index.ts` — add caching, parallel queries
- `supabase/functions/summarize_day/index.ts` — add caching
- `supabase/functions/suggest_outfit_combinations/index.ts` — add caching
- `supabase/functions/wardrobe_aging/index.ts` — remove legacy modelType
- `supabase/functions/style_twin/index.ts` — pass supabase client for DB cache
- New: `supabase/functions/cleanup_ai_cache/index.ts` — scheduled cache eviction
- DB migration: `ai_usage_log` table for observability (or reuse `analytics_events`)

