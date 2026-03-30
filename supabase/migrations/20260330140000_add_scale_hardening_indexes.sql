-- Scale Hardening Phase 2: Performance indexes for hot query paths
--
-- These indexes cover the most frequent queries from rate limiting,
-- AI response caching, and the job queue worker.

-- =============================================================
-- AI_RATE_LIMITS — queried on every rate-limited request
-- =============================================================
-- Query pattern: WHERE user_id=? AND function_name=? AND called_at >= ?
-- Used by: enforceRateLimit() in _shared/scale-guard.ts
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_user_fn_time
  ON public.ai_rate_limits (user_id, function_name, called_at DESC);

-- =============================================================
-- AI_RESPONSE_CACHE — queried on every cached AI call
-- =============================================================
-- Query pattern: WHERE cache_key=? AND expires_at > now()
-- Used by: callBursAI() cache lookup in _shared/burs-ai.ts
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_key_expires
  ON public.ai_response_cache (cache_key, expires_at);

-- =============================================================
-- GARMENTS — partial index for "available" garments (not in laundry)
-- =============================================================
-- Query pattern: WHERE user_id=? AND in_laundry=false
-- Used by: prefetch_suggestions, suggest_outfit_combinations, burs_style_engine
CREATE INDEX IF NOT EXISTS idx_garments_user_available
  ON public.garments (user_id)
  WHERE in_laundry = false;

-- =============================================================
-- SUBSCRIPTIONS — queried on every rate-limited request (tier lookup)
-- =============================================================
-- Query pattern: WHERE user_id=? (single row lookup)
-- Used by: resolveUserPlan() in _shared/scale-guard.ts
-- Note: user_id is the primary key / unique constraint, so this index
-- is likely implicit. Adding explicitly for clarity.
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id);

-- =============================================================
-- STRIPE_EVENTS — idempotency lookups
-- =============================================================
-- Query pattern: WHERE id=? (unique event check)
-- Note: id is the primary key, so this is covered by PK index.
-- No additional index needed.
