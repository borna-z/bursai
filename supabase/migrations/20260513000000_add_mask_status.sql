-- Wave R-B — on-device background removal.
--
-- Adds `garments.mask_status` so the render worker can branch the Gemini
-- system prompt: a row with `mask_status = 'masked'` carries a pre-segmented
-- `image_path` (transparent background, on-device cutout) and the prompt
-- skips the "remove background" instruction. Any other value (`'unavailable'`,
-- `'failed'`, NULL) means the raw photo is in `image_path` and the prompt
-- keeps its full background-removal instruction (current behavior).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS for fresh runs, plus a defensive
-- CHECK rebuild for replay safety. No backfill — NULL = "legacy row,
-- pre-feature" and the render worker treats it identically to 'unavailable'
-- (i.e., assume the source image needs full background removal).

ALTER TABLE public.garments
  ADD COLUMN IF NOT EXISTS mask_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'garments_mask_status_check'
      AND conrelid = 'public.garments'::regclass
  ) THEN
    ALTER TABLE public.garments
      ADD CONSTRAINT garments_mask_status_check
      CHECK (mask_status IS NULL OR mask_status IN ('masked','unavailable','failed'));
  END IF;
END $$;
