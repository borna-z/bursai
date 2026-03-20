-- Backfill generation-related schema drift for existing live tables.
-- Add only columns that runtime code already uses but are not yet covered by repo migrations.

ALTER TABLE public.outfits
  ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS rating numeric(3,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS saved boolean DEFAULT false;

ALTER TABLE public.wear_logs
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
