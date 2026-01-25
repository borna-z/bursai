-- First, delete duplicate wear_logs keeping only the oldest entry
DELETE FROM public.wear_logs a
USING public.wear_logs b
WHERE a.user_id = b.user_id 
  AND a.garment_id = b.garment_id 
  AND a.worn_at = b.worn_at 
  AND a.created_at > b.created_at;

-- Now add unique constraint on wear_logs to prevent future duplicates
ALTER TABLE public.wear_logs 
ADD CONSTRAINT wear_logs_unique_garment_day UNIQUE (user_id, garment_id, worn_at);