
-- Garment pair memory: tracks positive and negative pairing outcomes
CREATE TABLE IF NOT EXISTS public.garment_pair_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  garment_a_id uuid NOT NULL REFERENCES public.garments(id) ON DELETE CASCADE,
  garment_b_id uuid NOT NULL REFERENCES public.garments(id) ON DELETE CASCADE,
  positive_count integer NOT NULL DEFAULT 0,
  negative_count integer NOT NULL DEFAULT 0,
  last_positive_at timestamp with time zone,
  last_negative_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, garment_a_id, garment_b_id)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_pair_memory_user ON public.garment_pair_memory(user_id);

-- RLS
ALTER TABLE public.garment_pair_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pair memory" ON public.garment_pair_memory;
CREATE POLICY "Users can view own pair memory"
  ON public.garment_pair_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pair memory" ON public.garment_pair_memory;
CREATE POLICY "Users can insert own pair memory"
  ON public.garment_pair_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pair memory" ON public.garment_pair_memory;
CREATE POLICY "Users can update own pair memory"
  ON public.garment_pair_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own pair memory" ON public.garment_pair_memory;
CREATE POLICY "Users can delete own pair memory"
  ON public.garment_pair_memory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
