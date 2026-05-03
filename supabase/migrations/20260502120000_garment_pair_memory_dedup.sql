-- Wave 8.5 PR B (P88+P90 prep, integrity migration #1 of 4) — dedup
-- garment_pair_memory rows before applying the UNIQUE INDEX in migration #2.
--
-- Why a dedicated migration file: combining this dedup with the CREATE
-- UNIQUE INDEX + CHECK constraints + RPC defs in a single migration
-- triggered SQLSTATE 42601 ("cannot insert multiple commands into a
-- prepared statement") on the supabase CLI's apply path. Splitting into
-- one file per concern sidesteps the issue entirely.
--
-- Survivors keep the highest cumulative positive_count for each
-- (user_id, garment_a_id, garment_b_id) tuple. Counter columns merge:
-- SUM positive/negative across the duplicates so no learning is lost.
-- Timestamps take the LATEST value for both last_positive_at and
-- last_negative_at.

DO $$
BEGIN
  -- Merge counter values into the keeper row per (user, pair).
  WITH ranked AS (
    SELECT id,
           user_id,
           garment_a_id,
           garment_b_id,
           row_number() OVER (
             PARTITION BY user_id, garment_a_id, garment_b_id
             ORDER BY positive_count DESC, created_at ASC
           ) AS rn
    FROM   public.garment_pair_memory
    WHERE  garment_a_id IS NOT NULL AND garment_b_id IS NOT NULL
  ),
  keepers AS (
    SELECT id AS keeper_id, user_id, garment_a_id, garment_b_id
    FROM   ranked WHERE rn = 1
  ),
  merged AS (
    SELECT k.keeper_id,
           SUM(g.positive_count) AS total_positive,
           SUM(g.negative_count) AS total_negative,
           MAX(g.last_positive_at) AS max_pos,
           MAX(g.last_negative_at) AS max_neg
    FROM   keepers k
    JOIN   public.garment_pair_memory g
      ON   g.user_id = k.user_id
       AND g.garment_a_id = k.garment_a_id
       AND g.garment_b_id = k.garment_b_id
    GROUP BY k.keeper_id
  )
  UPDATE public.garment_pair_memory g
  SET    positive_count   = m.total_positive,
         negative_count   = m.total_negative,
         last_positive_at = m.max_pos,
         last_negative_at = m.max_neg,
         updated_at       = now()
  FROM   merged m
  WHERE  g.id = m.keeper_id;

  -- Delete duplicate rows, keeping the row with highest positive_count
  -- (ties broken by oldest created_at).
  DELETE FROM public.garment_pair_memory g
  WHERE  g.garment_a_id IS NOT NULL
    AND  g.garment_b_id IS NOT NULL
    AND  EXISTS (
      SELECT 1 FROM public.garment_pair_memory g2
      WHERE  g2.user_id = g.user_id
        AND  g2.garment_a_id = g.garment_a_id
        AND  g2.garment_b_id = g.garment_b_id
        AND  g2.id <> g.id
        AND  (
          g2.positive_count > g.positive_count
          OR (
            g2.positive_count = g.positive_count
            AND g2.created_at < g.created_at
          )
        )
    );
END
$$;
