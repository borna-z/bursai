-- Add occasion column to wear_logs for tracking what occasion each wear was for
ALTER TABLE public.wear_logs
ADD COLUMN IF NOT EXISTS occasion text;