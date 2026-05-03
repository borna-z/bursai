-- Wave 8.5 PR B audit Round 7 — fix RPC caller-auth check.
--
-- PR A's migration 120000 used `current_setting('request.jwt.claim.role', true)`
-- to read the JWT role inside the SECURITY DEFINER function. Modern PostgREST
-- (the version Supabase ships) sets `request.jwt.claims` (a single JSONB
-- object) instead of the per-key `request.jwt.claim.<key>` settings, so the
-- old GUC returns NULL on every call. The `session_user` fallback then
-- raised `unauthorized caller (role=authenticator)` because PostgREST
-- always connects as the `authenticator` role and switches with `SET ROLE`
-- — `session_user` stays `authenticator` regardless of which JWT is in play.
--
-- Effect: every direct call to `ingest_memory_event` from a service_role
-- supabase-js client (BOTH `memory_ingest` edge fn AND `style_chat`'s
-- `_shared/style-memory-ingest.ts` helper) returned 42501. The HTTP entry
-- point surfaces this as 500 `rpc_failed`; the chat helper logs + drops
-- the event. So Style Memory ingestion has been silently broken since PR A.
--
-- Surfaced by the new memory-ingest smoke test (Round 6 audit work) which
-- exercised the wire contract for the first time.
--
-- Fix: use `auth.role()` (the canonical Supabase helper that reads the
-- JSONB claims map correctly — same pattern the onboarding migrations
-- 20260426120000 and 20260427120000 use). Keep the `session_user` fallback
-- for direct postgres-role callers (cron, migrations) but make it AND not
-- override the role check.
--
-- Single-statement CREATE OR REPLACE FUNCTION (same shape as 120700/120710).

CREATE OR REPLACE FUNCTION public.ingest_memory_event(
  p_user_id uuid,
  p_event_type text,
  p_outfit_id uuid DEFAULT NULL,
  p_garment_ids uuid[] DEFAULT '{}'::uuid[],
  p_removed_garment_ids uuid[] DEFAULT '{}'::uuid[],
  p_added_garment_ids uuid[] DEFAULT '{}'::uuid[],
  p_rating integer DEFAULT NULL,
  p_feedback_text text DEFAULT NULL,
  p_value text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_source text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_signal_id uuid;
  v_representative_garment_id uuid;
  v_pair_delta integer := 0;
  v_canonical_signals constant text[] := ARRAY[
    'save_outfit',
    'unsave_outfit',
    'rate_outfit',
    'wear_outfit',
    'skip_outfit',
    'reject_outfit',
    'swap_garment',
    'quick_reaction',
    'never_suggest_garment',
    'like_pair',
    'dislike_pair'
  ];
  v_pair_count integer := 0;
  v_garment_ids uuid[];
  v_kept_garment_ids uuid[];
  v_all_garment_ids uuid[];
  v_owned_count integer;
  v_supplied_count integer;
  i integer;
  j integer;
  v_a uuid;
  v_b uuid;
  v_existing_id uuid;
BEGIN
  -- ----- Caller authorization (Round 7 fix) ---------------------------------
  -- Use `auth.role()` which reads `request.jwt.claims` JSONB (modern
  -- PostgREST), not the legacy per-key GUC. Falls back to session_user for
  -- direct postgres callers (migrations, cron — session_user='postgres').
  -- Note: under PostgREST, session_user is ALWAYS 'authenticator' regardless
  -- of JWT — so the fallback only ever matches non-PostgREST callers.
  v_caller_role := auth.role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('service_role', 'authenticated') THEN
    IF session_user NOT IN ('postgres', 'service_role') THEN
      RAISE EXCEPTION 'ingest_memory_event: unauthorized caller (role=%, session=%)',
        COALESCE(v_caller_role, 'NULL'), session_user
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_caller_role = 'authenticated' THEN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
      RAISE EXCEPTION 'ingest_memory_event: cross-user write blocked'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ----- Ownership validation (Round 6 R6-1 + Round 7 SQL fix) -------------
  IF p_outfit_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.outfits
      WHERE id = p_outfit_id AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'ingest_memory_event: outfit_id % not owned by user', p_outfit_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_all_garment_ids := ARRAY(
    SELECT DISTINCT u.id
    FROM unnest(
      COALESCE(p_garment_ids, '{}'::uuid[])
      || COALESCE(p_removed_garment_ids, '{}'::uuid[])
      || COALESCE(p_added_garment_ids, '{}'::uuid[])
    ) AS u(id)
    WHERE u.id IS NOT NULL
  );
  v_supplied_count := COALESCE(array_length(v_all_garment_ids, 1), 0);

  IF v_supplied_count > 0 THEN
    SELECT count(*) INTO v_owned_count
    FROM public.garments
    WHERE user_id = p_user_id
      AND id = ANY(v_all_garment_ids);
    IF v_owned_count <> v_supplied_count THEN
      RAISE EXCEPTION 'ingest_memory_event: % of % garment_ids not owned by user',
        v_supplied_count - v_owned_count, v_supplied_count
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ----- Validate canonical event_type (unchanged from PR A) ---------------
  IF p_event_type IS NULL OR p_event_type = '' THEN
    RAISE EXCEPTION 'ingest_memory_event: event_type is required'
      USING ERRCODE = '22023';
  END IF;
  IF NOT (p_event_type = ANY(v_canonical_signals)) THEN
    RAISE EXCEPTION 'ingest_memory_event: event_type % is not canonical', p_event_type
      USING ERRCODE = '22023';
  END IF;

  -- ----- Pick representative garment_id (unchanged) ------------------------
  IF p_event_type = 'swap_garment' AND array_length(p_added_garment_ids, 1) > 0 THEN
    v_representative_garment_id := p_added_garment_ids[1];
  ELSIF array_length(p_garment_ids, 1) > 0 THEN
    v_representative_garment_id := p_garment_ids[1];
  ELSE
    v_representative_garment_id := NULL;
  END IF;

  -- ----- INSERT feedback_signals (unchanged) -------------------------------
  INSERT INTO public.feedback_signals (
    user_id,
    signal_type,
    outfit_id,
    garment_id,
    value,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    p_event_type,
    p_outfit_id,
    v_representative_garment_id,
    p_value,
    jsonb_strip_nulls(
      jsonb_build_object(
        'garment_ids', CASE WHEN array_length(p_garment_ids, 1) > 0 THEN to_jsonb(p_garment_ids) ELSE NULL END,
        'removed_garment_ids', CASE WHEN array_length(p_removed_garment_ids, 1) > 0 THEN to_jsonb(p_removed_garment_ids) ELSE NULL END,
        'added_garment_ids', CASE WHEN array_length(p_added_garment_ids, 1) > 0 THEN to_jsonb(p_added_garment_ids) ELSE NULL END,
        'rating', p_rating,
        'feedback_text', p_feedback_text,
        'source', p_source
      )
      || COALESCE(p_metadata, '{}'::jsonb)
    ),
    now()
  )
  RETURNING id INTO v_signal_id;

  -- ----- Pair-memory delta (unchanged) ------------------------------------
  IF p_event_type IN ('save_outfit', 'wear_outfit', 'like_pair') THEN
    v_pair_delta := 1;
  ELSIF p_event_type = 'rate_outfit' AND p_rating IS NOT NULL AND p_rating >= 4 THEN
    v_pair_delta := 1;
  ELSIF p_event_type IN ('reject_outfit', 'skip_outfit', 'dislike_pair') THEN
    v_pair_delta := -1;
  ELSIF p_event_type = 'rate_outfit' AND p_rating IS NOT NULL AND p_rating <= 2 THEN
    v_pair_delta := -1;
  END IF;

  IF v_pair_delta <> 0 AND array_length(p_garment_ids, 1) >= 2 THEN
    v_garment_ids := p_garment_ids;
    v_pair_count := array_length(v_garment_ids, 1);
    FOR i IN 1..v_pair_count LOOP
      FOR j IN i+1..v_pair_count LOOP
        IF v_garment_ids[i] < v_garment_ids[j] THEN
          v_a := v_garment_ids[i];
          v_b := v_garment_ids[j];
        ELSE
          v_a := v_garment_ids[j];
          v_b := v_garment_ids[i];
        END IF;
        PERFORM public._upsert_garment_pair_memory(
          p_user_id, v_a, v_b, v_pair_delta
        );
      END LOOP;
    END LOOP;
  END IF;

  IF p_event_type = 'swap_garment'
     AND array_length(p_garment_ids, 1) >= 1
  THEN
    v_kept_garment_ids := ARRAY(
      SELECT g FROM unnest(p_garment_ids) g
      WHERE g <> ALL(COALESCE(p_added_garment_ids, '{}'::uuid[]))
        AND g <> ALL(COALESCE(p_removed_garment_ids, '{}'::uuid[]))
    );

    IF array_length(p_removed_garment_ids, 1) > 0
       AND array_length(v_kept_garment_ids, 1) > 0
    THEN
      FOR i IN 1..array_length(p_removed_garment_ids, 1) LOOP
        FOR j IN 1..array_length(v_kept_garment_ids, 1) LOOP
          IF p_removed_garment_ids[i] < v_kept_garment_ids[j] THEN
            v_a := p_removed_garment_ids[i];
            v_b := v_kept_garment_ids[j];
          ELSE
            v_a := v_kept_garment_ids[j];
            v_b := p_removed_garment_ids[i];
          END IF;
          IF v_a <> v_b THEN
            PERFORM public._upsert_garment_pair_memory(p_user_id, v_a, v_b, -1);
          END IF;
        END LOOP;
      END LOOP;
    END IF;

    IF array_length(p_added_garment_ids, 1) > 0
       AND array_length(v_kept_garment_ids, 1) > 0
    THEN
      FOR i IN 1..array_length(p_added_garment_ids, 1) LOOP
        FOR j IN 1..array_length(v_kept_garment_ids, 1) LOOP
          IF p_added_garment_ids[i] < v_kept_garment_ids[j] THEN
            v_a := p_added_garment_ids[i];
            v_b := v_kept_garment_ids[j];
          ELSE
            v_a := v_kept_garment_ids[j];
            v_b := p_added_garment_ids[i];
          END IF;
          IF v_a <> v_b THEN
            PERFORM public._upsert_garment_pair_memory(p_user_id, v_a, v_b, 1);
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  IF p_event_type = 'quick_reaction'
     AND array_length(p_garment_ids, 1) >= 2
  THEN
    IF p_value IN ('like', 'positive', 'thumbs_up')
       OR (p_metadata->>'value') IN ('like', 'positive', 'thumbs_up') THEN
      v_pair_delta := 1;
    ELSIF p_value IN ('dislike', 'negative', 'thumbs_down')
          OR (p_metadata->>'value') IN ('dislike', 'negative', 'thumbs_down') THEN
      v_pair_delta := -1;
    ELSE
      v_pair_delta := 0;
    END IF;

    IF v_pair_delta <> 0 THEN
      v_garment_ids := p_garment_ids;
      v_pair_count := array_length(v_garment_ids, 1);
      FOR i IN 1..v_pair_count LOOP
        FOR j IN i+1..v_pair_count LOOP
          IF v_garment_ids[i] < v_garment_ids[j] THEN
            v_a := v_garment_ids[i];
            v_b := v_garment_ids[j];
          ELSE
            v_a := v_garment_ids[j];
            v_b := v_garment_ids[i];
          END IF;
          PERFORM public._upsert_garment_pair_memory(p_user_id, v_a, v_b, v_pair_delta);
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  -- ----- Mark style summary as dirty (unchanged) ---------------------------
  INSERT INTO public.user_style_summaries (
    user_id,
    summary_json,
    summary_text,
    confidence,
    version,
    dirty_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    '{}'::jsonb,
    NULL,
    0,
    1,
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    dirty_at = now(),
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'signal_id', v_signal_id,
    'event_type', p_event_type,
    'pair_delta', v_pair_delta
  );
END;
$$;
