-- Wave 8.5 PR B (P88+P90 prep, integrity migration #4 of 5) — race-free
-- _upsert_garment_pair_memory.
--
-- PR A's helper used SELECT-then-INSERT-or-UPDATE which races under the
-- UNIQUE INDEX shipped in migration #2. Without this rewrite,
-- `ingest_memory_event` would emit 500 errors on every concurrent
-- save/wear flow (N×(N-1)/2 pair upserts per event). The
-- INSERT ... ON CONFLICT path is atomic — Postgres guarantees exactly
-- one winner per (user, pair) tuple. The ON CONFLICT predicate matches
-- the partial UNIQUE INDEX exactly so the planner uses it.

CREATE OR REPLACE FUNCTION public._upsert_garment_pair_memory(
  p_user_id uuid,
  p_a uuid,
  p_b uuid,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_a = p_b THEN
    RETURN;
  END IF;

  INSERT INTO public.garment_pair_memory (
    user_id,
    garment_a_id,
    garment_b_id,
    positive_count,
    negative_count,
    last_positive_at,
    last_negative_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_a,
    p_b,
    CASE WHEN p_delta > 0 THEN 1 ELSE 0 END,
    CASE WHEN p_delta < 0 THEN 1 ELSE 0 END,
    CASE WHEN p_delta > 0 THEN now() ELSE NULL END,
    CASE WHEN p_delta < 0 THEN now() ELSE NULL END,
    now(),
    now()
  )
  ON CONFLICT (user_id, garment_a_id, garment_b_id)
    WHERE garment_a_id IS NOT NULL AND garment_b_id IS NOT NULL
  DO UPDATE SET
    positive_count   = public.garment_pair_memory.positive_count
                     + CASE WHEN p_delta > 0 THEN 1 ELSE 0 END,
    negative_count   = public.garment_pair_memory.negative_count
                     + CASE WHEN p_delta < 0 THEN 1 ELSE 0 END,
    last_positive_at = CASE WHEN p_delta > 0 THEN now() ELSE public.garment_pair_memory.last_positive_at END,
    last_negative_at = CASE WHEN p_delta < 0 THEN now() ELSE public.garment_pair_memory.last_negative_at END,
    updated_at       = now();
END;
$$;
