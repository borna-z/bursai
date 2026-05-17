-- Audit issue #6 — missing indexes review (2026-05-17).
--
-- The audit asked for three indexes on hot user-scoped tables. Two already
-- exist on `main`:
--
--   * `garments(user_id)` — covered by 12 existing indexes from the initial
--     schema, including `idx_garments_user_available (user_id) WHERE
--     in_laundry = false` (the soft-availability filter — garments has no
--     `deleted_at` column; in_laundry is its closest semantic).
--
--   * `wear_logs(user_id, worn_at DESC)` — exists as
--     `idx_wear_logs_user_worn`.
--
-- Only `analytics_events(user_id, created_at DESC)` is genuinely missing.
-- `analytics_events` has no `deleted_at` column, so no partial-index
-- predicate is applicable.
--
-- CONCURRENTLY is NOT used here because the Supabase migration runner wraps
-- each file in a transaction (no existing migration in this tree uses
-- CONCURRENTLY). For pre-launch volume the bare `CREATE INDEX` acquires an
-- ACCESS EXCLUSIVE lock for milliseconds — acceptable. If post-launch
-- traffic warrants it, future migrations can split this with `commit;` /
-- `begin;` framing or run the SQL out-of-band.

CREATE INDEX IF NOT EXISTS analytics_events_user_created_idx
  ON public.analytics_events (user_id, created_at DESC);
