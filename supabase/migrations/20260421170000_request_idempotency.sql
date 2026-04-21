-- Migration: request_idempotency — DB-backed request dedup store for Edge Functions
--
-- Context: Launch Plan P12 / Wave 2-B. `_shared/idempotency.ts` previously
-- kept an in-memory `Map` scoped to the Deno isolate. Edge Functions are
-- stateless; cold starts blow away the cache, and concurrent requests that
-- land on different warm isolates both see no entry, both execute side
-- effects, and both try to store results. Idempotency guarantee: broken.
--
-- Replacement: a tiny Postgres table keyed by the caller's
-- `x-idempotency-key` header. The edge function performs an atomic
-- INSERT-or-skip (ON CONFLICT DO NOTHING, same pattern as `stripe_events`)
-- to claim the key, and only the winning isolate proceeds with the real
-- work. Duplicates read back the stored response row.
--
-- Table shape:
--   * key         TEXT PRIMARY KEY — the client-supplied idempotency key.
--                 Stored as-is; no hashing (the key itself is already the
--                 client's opaque identifier, e.g. a UUID from the mobile
--                 SDK). TEXT not UUID so clients aren't forced into a
--                 specific shape.
--   * body        TEXT NOT NULL — the stored response body. Empty string for
--                 "pending" claims (status = 0); overwritten with the real
--                 body when `storeIdempotencyResult` completes.
--   * status      INT NOT NULL — HTTP status of the stored response. 0 means
--                 "pending claim, no response yet"; 200-5xx once stored.
--                 The edge function uses this to tell a still-executing
--                 duplicate (return 409 Retry-After) from a completed one
--                 (return the cached Response).
--   * headers     JSONB NOT NULL DEFAULT '{}'::jsonb — response headers as
--                 a flat key/value object. Reconstructed via
--                 `new Headers(object)` on read.
--   * expires_at  TIMESTAMPTZ NOT NULL — TTL boundary. Pending claims use a
--                 short TTL (60s, see CLAIM_TTL_MS in _shared/idempotency.ts)
--                 so a crashed isolate doesn't block retries for too long;
--                 completed responses get the full 5min TTL. Indexed because
--                 the hourly cleanup cron scans by this.
--   * created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() — operational only.
--
-- RLS: service role only. Edge functions that use this table all create a
-- service-role client. RLS is enabled with NO policies so `anon` and
-- `authenticated` clients cannot touch it directly. Service role bypasses
-- RLS by design.
--
-- Cleanup: pg_cron job `request_idempotency_cleanup` runs hourly, deleting
-- expired rows. pg_cron is already enabled by the initial schema migration.
-- The cleanup body only DELETEs from public.request_idempotency — no secrets
-- needed, no HTTP POST, no vault lookup.
--
-- Idempotent: `IF NOT EXISTS` guards on the DDL + DO block for the cron
-- unschedule so re-applying this migration (accidentally or via
-- `db push --include-all`) is a no-op.

CREATE TABLE IF NOT EXISTS public.request_idempotency (
  key        TEXT PRIMARY KEY,
  body       TEXT NOT NULL,
  status     INT NOT NULL,
  headers    JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS request_idempotency_expires_at_idx
  ON public.request_idempotency (expires_at);

ALTER TABLE public.request_idempotency ENABLE ROW LEVEL SECURITY;

-- No policies: only the service role (which bypasses RLS) touches this table.

-- Hourly cleanup of expired rows.
-- Idempotent: unschedule first so re-apply against a DB that already has
-- the job doesn't raise "job already exists".
DO $$
BEGIN
  PERFORM cron.unschedule('request_idempotency_cleanup');
EXCEPTION WHEN OTHERS THEN
  -- Job did not exist — fine.
  NULL;
END $$;

SELECT cron.schedule(
  'request_idempotency_cleanup',
  '0 * * * *',
  $cron$DELETE FROM public.request_idempotency WHERE expires_at < NOW()$cron$
);
