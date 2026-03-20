ALTER TABLE public.garments
  ADD COLUMN IF NOT EXISTS original_image_path text,
  ADD COLUMN IF NOT EXISTS processed_image_path text,
  ADD COLUMN IF NOT EXISTS image_processing_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS image_processing_provider text,
  ADD COLUMN IF NOT EXISTS image_processing_version text,
  ADD COLUMN IF NOT EXISTS image_processing_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS image_processing_error text,
  ADD COLUMN IF NOT EXISTS image_processed_at timestamptz;

UPDATE public.garments
SET
  original_image_path = COALESCE(original_image_path, image_path),
  image_processing_status = COALESCE(image_processing_status, 'pending')
WHERE original_image_path IS NULL
   OR image_processing_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'garments_image_processing_status_check'
  ) THEN
    ALTER TABLE public.garments
      ADD CONSTRAINT garments_image_processing_status_check
      CHECK (image_processing_status IN ('pending', 'processing', 'ready', 'failed'));
  END IF;
END $$;
