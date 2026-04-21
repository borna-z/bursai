-- Migration: ai_response_cache user_id column + FK cascade for GDPR delete
--
-- Context: Launch Plan P13+P14 / Wave 2-C bundle. The Findings Log row
-- from 2026-04-21 on P8 flagged this: `cache_key` on `ai_response_cache`
-- is a SHA-256 hash (see `createBursAICacheKey` in
-- `supabase/functions/_shared/burs-ai.ts:229-236`), so a `.like("cache_key",
-- "%<uuid>%")` filter in `delete_user_account` matches zero rows. That made
-- GDPR right-to-erasure on this table impossible without a schema change.
--
-- Fix: add a nullable `user_id` column with an FK to `auth.users(id)` and
-- `ON DELETE CASCADE`. When `delete_user_account` calls
-- `auth.admin.deleteUser(userId)` at the end of its cascade, Postgres
-- automatically deletes every cache row owned by that user. No app-code
-- retrofit of `delete_user_account` needed — the cascade happens at the DB
-- level at the last step of the existing flow.
--
-- Why nullable: existing rows (pre-migration) have no user_id and we can't
-- reliably backfill them (the cache_key is a hash, which is the whole
-- reason we're doing this). They keep `user_id = NULL` and decay via their
-- existing 30-min–12-h TTLs. Post-migration, `storeCache` in burs-ai.ts
-- populates user_id on every new row from the `userId` option that
-- consumers now pass through. Within ~12 hours of deploy, all cache rows
-- will be cascade-eligible.
--
-- For anonymous / system cache entries (cron jobs, batch analyses without
-- a specific user context), user_id stays NULL — those rows just decay via
-- TTL, same as today.
--
-- Index: lookup by user_id is not on the hot path of cache reads (those go
-- through `cache_key` which already has a unique index via the PK). The
-- index matters only for the FK-cascade delete (which Postgres uses the
-- index to make efficient). Without the index, a cascade delete on a user
-- with many cache rows would sequential-scan the whole table.
--
-- Idempotent via `IF NOT EXISTS` guards so re-apply against an already-
-- patched schema is a no-op.

ALTER TABLE public.ai_response_cache
  ADD COLUMN IF NOT EXISTS user_id UUID
    REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ai_response_cache_user_id_idx
  ON public.ai_response_cache (user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.ai_response_cache.user_id IS
  'Owner of the cached response. NULL for system/cron cache entries and '
  'for pre-migration rows (which decay via TTL). Populated by storeCache '
  'in supabase/functions/_shared/burs-ai.ts from the userId option passed '
  'to callBursAI. FK cascade on delete ensures auth.users row removal '
  'automatically cleans this user''s cache entries — this is the whole '
  'reason the column was added (see P8 Findings Log, 2026-04-21).';
