-- Step 18: Garment condition tracking
ALTER TABLE public.garments ADD COLUMN IF NOT EXISTS condition_score numeric(3,1) DEFAULT NULL;
ALTER TABLE public.garments ADD COLUMN IF NOT EXISTS condition_notes text DEFAULT NULL;

-- Step 22: Cost-per-wear tracking
ALTER TABLE public.garments ADD COLUMN IF NOT EXISTS purchase_price numeric(10,2) DEFAULT NULL;
ALTER TABLE public.garments ADD COLUMN IF NOT EXISTS purchase_currency text DEFAULT 'SEK';