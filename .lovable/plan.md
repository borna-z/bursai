

# BURS AI Backend — Speed & Cost Optimization Plan

## Current State
- 22+ edge functions all route through `_shared/burs-ai.ts`
- Model fallback chains with retry logic and DB-backed caching (`ai_response_cache` table)
- Style engine (~1900 lines) does heavy local scoring then AI refinement
- Cache uses SHA-256 hashing with TTL-based expiry
- No prompt compression, no parallel AI calls, no tiered model routing based on complexity

## Architecture Upgrades

### 1. Intelligent Model Router (Complexity-Based)
Add a `complexity` option to `BursAIOptions` that auto-selects the cheapest/fastest model that can handle the task:

| Complexity | Model | Use Case |
|---|---|---|
| `trivial` | gemini-2.5-flash-lite | Simple classification, yes/no, short extraction |
| `standard` | gemini-3-flash-preview | Outfit selection, suggestions, chat |
| `complex` | gemini-2.5-pro | Vision analysis, multi-image, deep reasoning |

Replace the current static `modelType` chains with dynamic routing. Each function declares its complexity instead of a model chain.

### 2. Prompt Compression Engine
Add a `compressPrompt()` utility to `_shared/burs-ai.ts` that:
- Strips unnecessary whitespace and formatting from system prompts
- Truncates garment lists to top-N scored candidates (e.g., send top 30 instead of all 200)
- Uses abbreviated garment descriptors (`"id:title:color:mat"` instead of verbose sentences)
- Reduces token count by 40-60%, directly cutting latency and cost

### 3. Parallel Pre-scoring with Deferred AI
In `burs_style_engine`, the local scoring (color harmony, weather, formality, wear rotation — ~1300 lines) already runs without AI. Optimize by:
- Running all 6 DB queries in parallel (already done)
- Pre-filtering garments aggressively before combo building (drop anything scoring below 20th percentile)
- Reducing combo count sent to AI from potentially hundreds to top 5-8
- This means AI only does final selection on a tiny candidate set = faster response

### 4. Two-Tier Cache Strategy
Upgrade from single DB cache to a two-tier system:

**Tier 1: In-memory edge function cache** (per-isolate, ~30s TTL)
- Use a simple `Map<string, {data, expires}>` at module scope
- Catches repeated identical requests within the same isolate lifetime
- Zero latency, no DB round-trip

**Tier 2: DB cache** (existing `ai_response_cache`, extended)
- Add a `hit_count` column to track popular queries
- Add a `compressed` boolean column for storing gzipped responses
- Auto-extend TTL on cache hits (sliding window)
- Add periodic cleanup via a scheduled function

### 5. Speculative Prefetch
Create a new edge function `prefetch_suggestions` that:
- Runs on a cron schedule (daily at 6 AM user-local)
- Pre-generates daily outfit suggestions for active users
- Stores results in cache so the Home page loads instantly
- Uses the cheapest model (`flash-lite`) since it's background work

### 6. Request Deduplication
Add an in-flight request map to `burs-ai.ts`:
- If the same prompt hash is already being processed, await the existing promise instead of making a duplicate AI call
- Prevents the common pattern of users double-tapping "Generate" or React re-renders firing duplicate requests

### 7. Streaming-First for Chat Functions
Already partially done. Ensure `style_chat` and `shopping_chat` always stream and never buffer. Add:
- Server-Sent Events keepalive pings every 15s to prevent timeout
- Early termination detection (if client disconnects, abort the AI call)

### 8. Token Budget System
Add `max_tokens` control per function type:

| Function | Max Tokens | Rationale |
|---|---|---|
| `analyze_garment` | 300 | Structured output, small |
| `burs_style_engine` (generate) | 200 | Just picking an index + short explanation |
| `burs_style_engine` (suggest) | 500 | 2-3 outfits with explanations |
| `style_chat` | 1000 | Conversational |
| `wardrobe_gap_analysis` | 600 | Structured list |

Currently no `max_tokens` is set, meaning models generate until they stop — wasting tokens and time.

## Files to Change

| File | Changes |
|---|---|
| `supabase/functions/_shared/burs-ai.ts` | Add complexity router, prompt compression, in-memory cache tier, request deduplication, token budgets |
| `supabase/functions/burs_style_engine/index.ts` | Reduce combo count sent to AI, use compressed garment descriptors, set `max_tokens` |
| All 22 edge functions | Add `complexity` and `max_tokens` to their `callBursAI` options |
| New: `supabase/functions/prefetch_suggestions/index.ts` | Daily prefetch cron function |
| DB migration | Add `hit_count` and `compressed` columns to `ai_response_cache` |

## Expected Impact
- **Latency**: 40-60% reduction for outfit generation (less tokens in, less tokens out, pre-filtered candidates)
- **Cost**: 50-70% reduction (flash-lite for simple tasks, token budgets, better caching)
- **Reliability**: Fewer timeouts from shorter prompts and proper `max_tokens` limits

