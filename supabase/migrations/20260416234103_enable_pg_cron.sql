-- ============================================================
-- Enable pg_cron so the render credit ledger's hourly period
-- reset (cron.schedule('reset-render-credit-periods', ...)) in
-- 20260416234201_render_credits_p3_catchup.sql can register.
--
-- Applied via MCP on 2026-04-16 23:41:03 UTC (remote history row
-- 20260416234103). This file is the source-control catch-up.
--
-- Idempotent via IF NOT EXISTS. Safe to re-run in any env.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
