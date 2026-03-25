-- Add new columns for link import tracking
ALTER TABLE public.garments
ADD COLUMN IF NOT EXISTS source_url text NULL,
ADD COLUMN IF NOT EXISTS imported_via text NULL;

-- Create index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_garments_user_source_url 
ON public.garments (user_id, source_url) 
WHERE source_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.garments.source_url IS 'Original product URL if imported via link';
COMMENT ON COLUMN public.garments.imported_via IS 'Import method: link, photo, etc.';