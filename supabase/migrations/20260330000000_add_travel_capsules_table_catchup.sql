-- ============================================================
-- Catch-up file for previously unmanaged manual apply.
--
-- The `travel_capsules` table exists in production (confirmed via
-- information_schema on 2026-04-17) but no migration row in
-- `supabase_migrations.schema_migrations` records its creation.
-- It was created manually — most likely via Studio UI or an early
-- MCP apply_migration that did not land a .sql file in the repo.
--
-- Over the table's lifetime, follow-up migrations have added columns
-- on top of the original shape (20260414151049_add_travel_capsule_new_fields
-- recorded six additions; many others — trip_type, duration_days, weather_*,
-- capsule_items, outfits, packing_list, packing_tips, total_combinations,
-- reasoning — were applied manually without migration files). This file
-- captures the current production shape exactly so fresh environments
-- provision to parity.
--
-- Idempotent via IF NOT EXISTS on the table, the policy (DO block with
-- pg_policies check), and the index — safe to apply in any environment.
-- On prod this is a no-op that only registers a `schema_migrations` row.
--
-- Content verified against production schema on 2026-04-17:
--   - 21 columns, ordinal order preserved
--   - Policy "users own their capsules" FOR ALL USING (auth.uid() = user_id)
--     WITH CHECK (auth.uid() = user_id)
--   - idx_travel_capsules_user (user_id, created_at DESC)
--
-- Timestamp rationale: 20260330000000 (midnight UTC on 2026-03-30).
-- Originally placed at 20260417100000 (after today's date) but Codex
-- review on PR #419 caught a bootstrap-order bug — the follow-up
-- migration 20260414151049_add_travel_capsule_new_fields.sql uses
-- `ALTER TABLE IF EXISTS` to add columns. If the catch-up ran AFTER
-- that ALTER on a fresh environment, the ALTER would silently no-op
-- against the missing table, then this CREATE TABLE would build
-- travel_capsules without the new columns. Placing this catch-up
-- before any migration that references the table ensures CREATE
-- runs first in timestamp order. The slot 20260330000000 is free
-- on remote (the first 2026-03-30 remote row is 20260330092824), so
-- this file does not collide with any applied migration.
--
-- After PR #419 merges, run
--   `npx supabase db push --linked --yes --include-all`
-- from main to register this migration. The --include-all flag is
-- required specifically for this push because the CLI detects an
-- out-of-order insertion (this file's timestamp 20260330000000 sits
-- before many already-applied remote rows). After this one apply,
-- future P5-P11 migrations use the normal deploy flow without the
-- flag — they'll always carry current-timestamp rows appended to
-- the end of the history.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.travel_capsules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  destination text NOT NULL,
  trip_type text DEFAULT 'mixed',
  duration_days integer NOT NULL,
  weather_min integer,
  weather_max integer,
  occasions text[],
  capsule_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  outfits jsonb NOT NULL DEFAULT '[]'::jsonb,
  packing_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  packing_tips text[],
  total_combinations integer,
  reasoning text,
  created_at timestamptz DEFAULT now(),
  start_date date,
  end_date date,
  luggage_type text DEFAULT 'carry_on_personal',
  companions text DEFAULT 'solo',
  style_preference text DEFAULT 'balanced',
  result jsonb
);

ALTER TABLE public.travel_capsules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'travel_capsules'
      AND policyname = 'users own their capsules'
  ) THEN
    CREATE POLICY "users own their capsules"
      ON public.travel_capsules
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_travel_capsules_user
  ON public.travel_capsules (user_id, created_at DESC);
