-- Sprint PR 7: request_id propagation
--
-- Add a nullable `request_id uuid` column to render_jobs + feedback_signals
-- so a single user-initiated request can be traced end-to-end through the
-- Supabase Logs query layer alongside the structured `request_id` log key
-- emitted by `_shared/logger.ts`.
--
-- Backfill is intentionally null — historical rows have no upstream request
-- to correlate to. The partial indexes (WHERE request_id IS NOT NULL) keep
-- index size bounded as rows age and pre-trace data sits at null forever.
--
-- Idempotent: `ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` so
-- a re-run on a partially-applied environment is a no-op.

ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS request_id uuid;

ALTER TABLE public.feedback_signals
  ADD COLUMN IF NOT EXISTS request_id uuid;

CREATE INDEX IF NOT EXISTS idx_render_jobs_request_id
  ON public.render_jobs(request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_signals_request_id
  ON public.feedback_signals(request_id)
  WHERE request_id IS NOT NULL;
