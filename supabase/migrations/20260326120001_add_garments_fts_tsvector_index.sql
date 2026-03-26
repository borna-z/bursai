-- Add a generated tsvector column for full-text search on garments.
-- Uses the 'simple' dictionary so searches work consistently across languages.
-- The existing .ilike() queries in the app remain as a fallback; a future
-- optimisation can switch the client to use `@@` / `to_tsquery('simple', ...)`.

-- 1. Add the generated tsvector column
ALTER TABLE public.garments
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        coalesce(title, '') || ' ' ||
        coalesce(category, '') || ' ' ||
        coalesce(color_primary, '')
      )
    ) STORED;

-- 2. Create a GIN index on the tsvector column
CREATE INDEX IF NOT EXISTS garments_fts_idx
  ON public.garments
  USING GIN (fts);
