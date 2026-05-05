-- Wave 8.5 PR B (P88+P90 prep, integrity migration #3 of 4) — CHECK
-- constraints on user_style_summaries. Defends against builder bugs
-- emitting out-of-range version / confidence values.

-- Repair any pre-existing rows that violate the about-to-be-added
-- constraints. PR A's deterministic builder always emits version >= 1
-- and 0 <= confidence <= 1, so this is defensive: covers manually-written
-- rows from local dev seeds or admin edits.

UPDATE public.user_style_summaries
SET    version = 1
WHERE  version IS NULL OR version < 1;

UPDATE public.user_style_summaries
SET    confidence = 0
WHERE  confidence IS NULL OR confidence < 0;

UPDATE public.user_style_summaries
SET    confidence = 1
WHERE  confidence > 1;

ALTER TABLE public.user_style_summaries
  DROP CONSTRAINT IF EXISTS user_style_summaries_version_check;

ALTER TABLE public.user_style_summaries
  ADD  CONSTRAINT user_style_summaries_version_check CHECK (version >= 1);

ALTER TABLE public.user_style_summaries
  DROP CONSTRAINT IF EXISTS user_style_summaries_confidence_check;

ALTER TABLE public.user_style_summaries
  ADD  CONSTRAINT user_style_summaries_confidence_check
       CHECK (confidence >= 0 AND confidence <= 1);
