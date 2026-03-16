ALTER TABLE public.garments ADD COLUMN enrichment_status text NOT NULL DEFAULT 'pending';

UPDATE public.garments 
SET enrichment_status = CASE 
  WHEN ai_raw::text LIKE '%enrichment%' THEN 'complete'
  WHEN ai_analyzed_at IS NOT NULL THEN 'pending'
  ELSE 'none'
END;