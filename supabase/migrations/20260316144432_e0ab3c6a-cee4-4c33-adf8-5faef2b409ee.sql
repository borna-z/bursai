
-- Feedback signals table for implicit learning
CREATE TABLE IF NOT EXISTS public.feedback_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'save', 'ignore', 'wear_confirm', 'swap_choice', 'quick_reaction', 'rating', 'garment_edit'
  outfit_id UUID REFERENCES public.outfits(id) ON DELETE SET NULL,
  garment_id UUID REFERENCES public.garments(id) ON DELETE SET NULL,
  value TEXT, -- e.g. 'loved_it', 'too_warm', swap garment_id, rating value
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying user signals efficiently
CREATE INDEX IF NOT EXISTS idx_feedback_signals_user ON public.feedback_signals(user_id, signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_signals_outfit ON public.feedback_signals(outfit_id) WHERE outfit_id IS NOT NULL;

-- RLS
ALTER TABLE public.feedback_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own signals" ON public.feedback_signals;
CREATE POLICY "Users can insert own signals"
  ON public.feedback_signals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own signals" ON public.feedback_signals;
CREATE POLICY "Users can read own signals"
  ON public.feedback_signals FOR SELECT TO authenticated
  USING (user_id = auth.uid());
