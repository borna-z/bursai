-- ============================================================
-- Source-control catch-up for travel_capsules columns added via
-- MCP apply_migration on 2026-04-14 15:10:49 UTC (remote history
-- row 20260414151049). No .sql file was committed at the time;
-- reconstructed idempotently from the current production schema
-- so new environments provision to parity.
--
-- This migration layers on top of the later
-- 20260414180000_add_travel_capsules_table.sql catch-up (which
-- creates the base table if missing) with ADD COLUMN IF NOT EXISTS
-- guards so the order does not matter.
-- ============================================================

ALTER TABLE IF EXISTS public.travel_capsules
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS luggage_type text DEFAULT 'carry_on_personal',
  ADD COLUMN IF NOT EXISTS companions text DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS style_preference text DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS result jsonb;
