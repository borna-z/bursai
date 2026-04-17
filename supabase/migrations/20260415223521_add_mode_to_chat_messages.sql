-- ============================================================
-- Source-control catch-up for chat_messages.mode column added
-- via MCP apply_migration on 2026-04-15 22:35:21 UTC (remote
-- history row 20260415223521). No .sql file was committed at
-- the time; reconstructed idempotently from production schema.
--
-- Enum-style field driving which product surface produced a
-- message ('stylist', 'shopping', etc.). NOT NULL with default
-- 'stylist' so legacy rows are covered on column add.
-- ============================================================

ALTER TABLE IF EXISTS public.chat_messages
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'stylist';
