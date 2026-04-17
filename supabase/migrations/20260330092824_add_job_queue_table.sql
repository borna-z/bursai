-- Archaeology: file renamed from 20260330120000_add_job_queue_table.sql in
-- commit 034fa49c (PR #419) to align with remote applied_at timestamp
-- 2026-03-30 09:28:24. Original author content in commit cbf0f3ff
-- ("Scale-harden BURS backend for growth toward 2.3M+ users", 2026-03-30).

-- Job queue table for async heavy-work processing
-- Used by scale-guard.ts job queue helpers

CREATE TABLE IF NOT EXISTS public.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  locked_until timestamptz
);

-- RLS: service role only (workers use service key)
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.job_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Users can read their own job status (for polling)
CREATE POLICY "Users can view own jobs" ON public.job_queue
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Indexes for efficient job claiming and status queries
CREATE INDEX IF NOT EXISTS idx_job_queue_claim
  ON public.job_queue (job_type, status, locked_until, priority DESC, created_at ASC)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_job_queue_user_status
  ON public.job_queue (user_id, status, created_at DESC);

-- Auto-cleanup: remove completed/dead jobs older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_old_jobs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.job_queue
  WHERE status IN ('completed', 'dead')
    AND updated_at < now() - interval '7 days';
$$;
