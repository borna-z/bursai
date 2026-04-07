-- Add last_active_at column to profiles for accurate active-user detection.
-- The prefetch_suggestions edge function uses this to only prefetch for
-- users who have been genuinely active in the last 7 days, rather than
-- relying on updated_at which can change for non-activity reasons.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows from updated_at so current data is reasonable.
UPDATE profiles SET last_active_at = COALESCE(updated_at, created_at, now());

-- Index for the cron query that filters on last_active_at.
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at
  ON profiles (last_active_at DESC);
