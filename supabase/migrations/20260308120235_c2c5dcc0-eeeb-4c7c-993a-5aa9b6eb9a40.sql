CREATE TABLE public.outfit_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id uuid NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  selfie_path text NOT NULL,
  fit_score numeric(3,1),
  color_match_score numeric(3,1),
  overall_score numeric(3,1),
  commentary text,
  ai_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outfit_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback" ON public.outfit_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON public.outfit_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own feedback" ON public.outfit_feedback
  FOR DELETE TO authenticated USING (auth.uid() = user_id);