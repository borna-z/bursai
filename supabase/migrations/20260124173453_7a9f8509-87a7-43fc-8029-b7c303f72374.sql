-- Add AI analysis caching fields to garments table
ALTER TABLE public.garments 
ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_raw JSONB,
ADD COLUMN IF NOT EXISTS ai_provider TEXT;