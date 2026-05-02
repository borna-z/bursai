-- Wave 8.5 PR B (P90, integrity migration #6 of 7) — destructive Style
-- Memory reset RPC.
--
-- One-transaction delete of feedback_signals + garment_pair_memory +
-- user_style_summaries for the calling user. Preserves wear_logs,
-- garments, outfits, profile, planned_outfits per spec §10.

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
