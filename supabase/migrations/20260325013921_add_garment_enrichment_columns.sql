-- Add indexed enrichment columns to garments table
ALTER TABLE public.garments
  ADD COLUMN IF NOT EXISTS silhouette TEXT,
  ADD COLUMN IF NOT EXISTS visual_weight SMALLINT,
  ADD COLUMN IF NOT EXISTS texture_intensity SMALLINT,
  ADD COLUMN IF NOT EXISTS style_archetype TEXT,
  ADD COLUMN IF NOT EXISTS occasion_tags TEXT[],
  ADD COLUMN IF NOT EXISTS versatility_score SMALLINT;

-- Backfill from existing ai_raw JSONB data
UPDATE public.garments
SET
  silhouette = NULLIF(TRIM(ai_raw->'enrichment'->>'silhouette'), ''),
  visual_weight = CASE
    WHEN (ai_raw->'enrichment'->>'visual_weight') ~ '^\d+(\.\d+)?$'
    THEN LEAST(10, GREATEST(1, ROUND((ai_raw->'enrichment'->>'visual_weight')::numeric)::smallint))
    ELSE NULL
  END,
  texture_intensity = CASE
    WHEN (ai_raw->'enrichment'->>'texture_intensity') ~ '^\d+(\.\d+)?$'
    THEN LEAST(10, GREATEST(1, ROUND((ai_raw->'enrichment'->>'texture_intensity')::numeric)::smallint))
    ELSE NULL
  END,
  style_archetype = NULLIF(TRIM(ai_raw->'enrichment'->>'style_archetype'), ''),
  occasion_tags = CASE
    WHEN jsonb_typeof(ai_raw->'enrichment'->'occasion_tags') = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(ai_raw->'enrichment'->'occasion_tags'))
    ELSE NULL
  END,
  versatility_score = CASE
    WHEN (ai_raw->'enrichment'->>'versatility_score') ~ '^\d+(\.\d+)?$'
    THEN LEAST(10, GREATEST(1, ROUND((ai_raw->'enrichment'->>'versatility_score')::numeric)::smallint))
    ELSE NULL
  END
WHERE ai_raw IS NOT NULL;

-- Indexes for most-queried enrichment columns
CREATE INDEX IF NOT EXISTS garments_style_archetype_idx ON public.garments(style_archetype) WHERE style_archetype IS NOT NULL;
CREATE INDEX IF NOT EXISTS garments_occasion_tags_idx ON public.garments USING GIN(occasion_tags) WHERE occasion_tags IS NOT NULL;
CREATE INDEX IF NOT EXISTS garments_visual_weight_idx ON public.garments(visual_weight) WHERE visual_weight IS NOT NULL;
