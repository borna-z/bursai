-- Add planned_for date and feedback to outfits table
ALTER TABLE public.outfits
ADD COLUMN IF NOT EXISTS planned_for date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS feedback text[] DEFAULT NULL;

-- Create index for efficient querying of planned outfits
CREATE INDEX IF NOT EXISTS idx_outfits_planned_for ON public.outfits(planned_for) WHERE planned_for IS NOT NULL;