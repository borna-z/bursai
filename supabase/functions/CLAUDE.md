# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the `supabase/functions/` subdirectory of the BURS AI wardrobe app. See the root `CLAUDE.md` for full project context (design system, frontend architecture, known bugs, etc.).

## Hard Rules

- **Deploy command** (exact, always): `npx supabase functions deploy [function-name] --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`
- Never deploy all functions at once — always name the specific function
- Never use `getClaims()` — deprecated, silently fails. Use `getUser()` pattern instead
- TypeScript must pass after every task: `npx tsc --noEmit --skipLibCheck`
- All functions use `verify_jwt = false` — JWT is validated manually in code

## Edge Function Structure

38 functions, each a snake_case directory with a single `index.ts`. All use Deno with ESM URL imports:

```typescript
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

No `deno.json` or import map exists — all imports are explicit URLs or relative paths to `_shared/`. Some older functions (e.g. `stripe_webhook`) use `Deno.serve()` directly or import from `std@0.190.0` — both work but prefer `std@0.220.0` for new code.

## Required Patterns

Every edge function must follow this skeleton:

**CORS preflight** — first thing inside `serve()`:
```typescript
if (req.method === "OPTIONS") {
  return new Response(null, { headers: CORS_HEADERS });
}
```

**Auth** — extract token manually, call `getUser()`:
```typescript
const authHeader = req.headers.get("Authorization");
const token = authHeader.replace("Bearer ", "");
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user } } = await supabase.auth.getUser(token);
```

**Error handling** — try/catch wrapping the entire handler, return JSON with `CORS_HEADERS` on every response.

## Shared Utilities (`_shared/`)

| File | Purpose |
|------|---------|
| `cors.ts` | `CORS_HEADERS` constant — include on every response |
| `burs-ai.ts` | AI abstraction: `callBursAI({ messages, complexity, cacheNamespace, functionName, ... })`. Complexity-based model routing (trivial/standard/complex), Gemini fallback chains, DB response caching via `ai_response_cache` table, token budget auto-set |
| `burs-voice.ts` | Voice identity fragments (`VOICE_STYLIST_CHAT`, `VOICE_SHOPPING`, etc.) for consistent premium tone in AI prompts |
| `unified_stylist_engine.ts` | Middleware to `burs_style_engine` function. Modes: generate, suggest, swap, refine. Also contains slot normalization logic (`normalizeIds()`) |
| `logger.ts` | Structured JSON logging |
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
- `cacheNamespace`: function name for cache partitioning
- `cacheTtlSeconds`: how long to cache the response
- Analytics logging is fire-and-forget (never blocks response)

The AI backend is Google Gemini via OpenAI-compatible endpoint. Model chain: Gemini 2.5 Flash primary, Flash Lite fallback.

## Key Database Tables

- `garments` — wardrobe items
- `outfits` — outfit definitions
- `wear_logs` — outfit wear history
- `profiles` — user profiles (includes `stripe_customer_id`, subscription info)
- `subscriptions` — subscription status
- `ai_response_cache` — AI response cache (cache_key, response, model_used, expires_at, hit_count)
- `analytics_events` — observability (event_type, metadata with fn, model, latency_ms, cached, status)
- `stripe_events` — webhook event log for idempotency

## Environment Variables

Required for all functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`

Stripe functions additionally need: `STRIPE_MODE`, `STRIPE_SECRET_KEY_TEST`/`_LIVE`, `STRIPE_WEBHOOK_SECRET_TEST`/`_LIVE`, `STRIPE_PRICE_ID_*`

Image processing functions need: `PHOTOROOM_API_KEY`, `PHOTOROOM_API_BASE_URL`

## Notable Function Details

- `analyze_garment` — supports 13 languages for garment title localization via `TITLE_LANG_MAP`
- `calendar` — includes SSRF protection blocking localhost/private IPs in URL validation
- `stripe_webhook` — has inline Stripe mode switching (duplicates `stripe-config.ts` logic)

## Known Bug in This Directory

**AI Stylist Truncation** — `style_chat/index.ts` ~line 1568 hard-caps AI replies at 6 sentences / 900 chars. Should be 9 sentences / 1400 chars, with `...` appended when `finish_reason === "length"`.
