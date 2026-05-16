-- Phase 0 — style engine variety
-- Logs every outfit the engine returns to a user, so subsequent generates
-- can penalize garments shown in the most recent N suggestions. Solves the
-- "Generate twice in a row returns the same outfit" complaint without
-- disabling the AI response cache for cost-sensitive distinct (user, occasion)
-- pairs.
--
-- Retention: a follow-up cron is expected to delete rows older than 30 days.
-- That cleanup is intentionally out of scope for this phase.

CREATE TABLE IF NOT EXISTS public.style_engine_suggestion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outfit_hash text NOT NULL,
  occasion text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS style_engine_suggestion_log_user_recent_idx
  ON public.style_engine_suggestion_log (user_id, generated_at DESC);

ALTER TABLE public.style_engine_suggestion_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'style_engine_suggestion_log'
      AND policyname = 'style_engine_suggestion_log_select_own'
  ) THEN
    CREATE POLICY style_engine_suggestion_log_select_own
      ON public.style_engine_suggestion_log
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'style_engine_suggestion_log'
      AND policyname = 'style_engine_suggestion_log_insert_own'
  ) THEN
    CREATE POLICY style_engine_suggestion_log_insert_own
      ON public.style_engine_suggestion_log
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Service role (edge functions) bypasses RLS, so no additional grants needed.
GRANT SELECT, INSERT ON public.style_engine_suggestion_log TO authenticated;
