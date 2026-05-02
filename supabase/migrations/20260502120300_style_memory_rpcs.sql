-- Wave 8.5 PR B (P88+P90 prep, integrity migration #4 of 4) — RPCs.
--
-- Two functions land here:
--
-- 1. `_upsert_garment_pair_memory` (REPLACE) — race-free version.
--    PR A's helper used SELECT-then-INSERT-or-UPDATE which races under
--    the UNIQUE INDEX shipped in migration #2. Without this rewrite,
--    `ingest_memory_event` would emit 500 errors on every concurrent
--    save/wear flow (N×(N-1)/2 pair upserts per event). The
--    INSERT ... ON CONFLICT path is atomic — Postgres guarantees exactly
--    one winner per (user, pair) tuple. The ON CONFLICT predicate
--    matches the partial UNIQUE INDEX exactly so the planner uses it.
--
-- 2. `reset_style_memory_atomic` (NEW) — destructive Style Memory wipe.
--    One-transaction delete of feedback_signals + garment_pair_memory +
--    user_style_summaries for the calling user. Preserves wear_logs,
--    garments, outfits, profile, planned_outfits per spec §10.

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

REVOKE ALL ON FUNCTION public._upsert_garment_pair_memory(uuid, uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._upsert_garment_pair_memory(uuid, uuid, uuid, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.reset_style_memory_atomic(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signals_deleted integer;
  v_pairs_deleted integer;
  v_summaries_deleted integer;
BEGIN
  IF (auth.role() IS NULL OR auth.role() <> 'service_role')
     AND session_user <> 'postgres'
     AND session_user <> 'service_role' THEN
    RAISE EXCEPTION 'reset_style_memory_atomic: service_role required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'reset_style_memory_atomic: p_user_id required';
  END IF;

  DELETE FROM public.feedback_signals WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_signals_deleted = ROW_COUNT;

  DELETE FROM public.garment_pair_memory WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_pairs_deleted = ROW_COUNT;

  DELETE FROM public.user_style_summaries WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_summaries_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'feedback_signals_deleted', v_signals_deleted,
    'garment_pair_memory_deleted', v_pairs_deleted,
    'user_style_summaries_deleted', v_summaries_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_style_memory_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_style_memory_atomic(uuid) TO service_role;
