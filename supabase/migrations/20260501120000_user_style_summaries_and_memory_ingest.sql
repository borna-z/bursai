-- Wave 8.5 PR A — Backend foundation
-- ============================================================================
-- Combines two functional units:
--   P84: `user_style_summaries` table — single persistent style summary per user.
--   P85: `ingest_memory_event` Postgres RPC — atomic triple-write
--        (feedback_signals + garment_pair_memory + summary dirty-mark) called
--        by the `memory_ingest` edge function. Triple-write atomicity is the
--        Wave 8.5 D3 architectural decision.
--
-- Idempotency is enforced at the edge-function layer (request_idempotency
-- table from P12), not inside the RPC. The RPC is purely transactional.
--
-- Pair-memory writes preserve the existing recordPairOutcome convention:
--   - lexicographic sort: garment_a_id < garment_b_id always
--   - SELECT-then-UPDATE-or-INSERT (no UNIQUE constraint in this PR; same
--     race profile as the legacy code path the RPC supersedes)
--
-- Style-summary refresh strategy: this RPC only marks the summary dirty
-- (sets `updated_at = now()` on the row's `dirty_at` field) when memory
-- changes. The deterministic builder (P87) is invoked from the edge function
-- AFTER the RPC succeeds (fire-and-forget) AND from engine reads on cache
-- miss. This is the D5 lazy-materialization pattern.

-- ----------------------------------------------------------------------------
-- 1. user_style_summaries table (P84)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_style_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_text text,
  confidence numeric NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  dirty_at timestamptz, -- NULL = clean (recently rebuilt); non-NULL = dirty since this timestamp
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One summary per user (unique constraint serves as the lookup index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_style_summaries_user_id
  ON public.user_style_summaries (user_id);

-- Find rows that need rebuild (engine reads use this to decide cache miss).
CREATE INDEX IF NOT EXISTS idx_user_style_summaries_dirty_at
  ON public.user_style_summaries (dirty_at)
  WHERE dirty_at IS NOT NULL;

-- Find recently-updated summaries (admin dashboards, observability).
CREATE INDEX IF NOT EXISTS idx_user_style_summaries_updated_at
  ON public.user_style_summaries (updated_at);

ALTER TABLE public.user_style_summaries ENABLE ROW LEVEL SECURITY;

-- Users can read their own summary (for client-side display in P90 export).
DROP POLICY IF EXISTS "users_select_own_style_summary" ON public.user_style_summaries;
CREATE POLICY "users_select_own_style_summary"
  ON public.user_style_summaries FOR SELECT
  USING (user_id = auth.uid());

-- Service role bypasses RLS via BYPASSRLS, but we add an explicit ALL policy
-- for clarity in the policy listing.
DROP POLICY IF EXISTS "service_role_all_style_summary" ON public.user_style_summaries;
CREATE POLICY "service_role_all_style_summary"
  ON public.user_style_summaries FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Standard BURS GRANT pattern (see initial_schema.sql lines 2466-2468 for the
-- canonical example on garment_pair_memory).
GRANT SELECT ON TABLE public.user_style_summaries TO authenticated;
GRANT ALL ON TABLE public.user_style_summaries TO service_role;

-- ----------------------------------------------------------------------------
-- 2. ingest_memory_event RPC (P85)
-- ----------------------------------------------------------------------------
--
-- Atomic triple-write called by the memory_ingest edge function after auth +
-- normalization. The edge function passes the canonical event_type (one of
-- 11 names from CanonicalStyleMemorySignal) and structured event payload.
--
-- Pair-memory weight rules per Wave 8.5 D3:
--   POSITIVE on every (i,j) pair in p_garment_ids:
--     - save_outfit
--     - wear_outfit
--     - rate_outfit when p_rating >= 4
--     - like_pair (typically called with exactly 2 garment_ids)
--   NEGATIVE on every (i,j) pair in p_garment_ids:
--     - reject_outfit (outfit-level — penalty on combination, not on individual garments)
--     - skip_outfit
--     - rate_outfit when p_rating <= 2
--     - dislike_pair
--     - never_suggest_garment (single garment — no pair, just feedback signal)
--   SWAP semantics (swap_garment):
--     - p_removed_garment_ids paired with surviving (kept) garments → NEGATIVE
--     - p_added_garment_ids paired with surviving (kept) garments → POSITIVE
--   QUICK REACTION (quick_reaction):
--     - delegated to caller via p_context (caller specifies positive/negative)
--   No-op for memory weight purposes:
--     - unsave_outfit (cancels a previous save_outfit; we don't reverse the
--       earlier positive — too noisy. Just record the signal for analytics.)
--
-- All operations run in a single transaction (function-implicit). If any
-- statement raises, the entire ingest is rolled back.

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
  v_pair_delta integer := 0; -- +1 positive, -1 negative, 0 no-op
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
  i integer;
  j integer;
  v_a uuid;
  v_b uuid;
  v_existing_id uuid;
BEGIN
  -- ----- Caller authorization -----------------------------------------------
  -- This RPC is SECURITY DEFINER. The edge function gates on JWT first, but
  -- we re-check inside the RPC so direct callers (eg, internal cron) also
  -- pass through the same gate. Two paths:
  --   1. service_role bypasses RLS and is trusted to pass the verified user_id.
  --   2. authenticated callers must match auth.uid() to p_user_id.
  v_caller_role := current_setting('request.jwt.claim.role', true);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('service_role', 'authenticated') THEN
    -- Attempt session_user-level fallback (server-side direct calls).
    -- Inside a SECURITY DEFINER function `current_user` always resolves to
    -- the function owner (postgres) regardless of who invoked us, so it
    -- can NEVER fail this check and the gate would let any caller with a
    -- missing/invalid JWT role claim through. `session_user` is the
    -- original invoker identity (anon / authenticated / service_role / ...)
    -- and is the correct fallback signal here.
    IF session_user NOT IN ('postgres', 'service_role') THEN
      RAISE EXCEPTION 'ingest_memory_event: unauthorized caller (role=%)', session_user
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_caller_role = 'authenticated' THEN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
      RAISE EXCEPTION 'ingest_memory_event: cross-user write blocked'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ----- Validate canonical event_type --------------------------------------
  IF p_event_type IS NULL OR p_event_type = '' THEN
    RAISE EXCEPTION 'ingest_memory_event: event_type is required'
      USING ERRCODE = '22023';
  END IF;
  IF NOT (p_event_type = ANY(v_canonical_signals)) THEN
    RAISE EXCEPTION 'ingest_memory_event: event_type % is not canonical', p_event_type
      USING ERRCODE = '22023';
  END IF;

  -- ----- Pick representative garment_id for feedback_signals.garment_id -----
  -- The feedback_signals table has scalar garment_id (singular). For multi-
  -- garment events (swap_garment, like_pair, dislike_pair, save_outfit, etc.)
  -- we store the first garment id as the "representative" and put the full
  -- array(s) in metadata. never_suggest_garment uses the first id as the
  -- target. unsave_outfit and skip_outfit may have empty garment_ids if only
  -- outfit_id is provided.
  IF p_event_type = 'swap_garment' AND array_length(p_added_garment_ids, 1) > 0 THEN
    v_representative_garment_id := p_added_garment_ids[1];
  ELSIF array_length(p_garment_ids, 1) > 0 THEN
    v_representative_garment_id := p_garment_ids[1];
  ELSE
    v_representative_garment_id := NULL;
  END IF;

  -- ----- INSERT feedback_signals --------------------------------------------
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
    -- Compose final metadata: auto-injected arrays + source as DEFAULTS,
    -- caller-provided keys override on collision. PostgreSQL's `||` is
    -- right-wins on duplicates, so auto-injected fields go on the LEFT
    -- and caller metadata goes on the RIGHT. `jsonb_strip_nulls` then
    -- trims any null values (e.g., when no removed_garment_ids were
    -- supplied) without affecting non-null caller keys.
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

  -- ----- Determine pair-memory delta ----------------------------------------
  IF p_event_type IN ('save_outfit', 'wear_outfit', 'like_pair') THEN
    v_pair_delta := 1;
  ELSIF p_event_type = 'rate_outfit' AND p_rating IS NOT NULL AND p_rating >= 4 THEN
    v_pair_delta := 1;
  ELSIF p_event_type IN ('reject_outfit', 'skip_outfit', 'dislike_pair') THEN
    v_pair_delta := -1;
  ELSIF p_event_type = 'rate_outfit' AND p_rating IS NOT NULL AND p_rating <= 2 THEN
    v_pair_delta := -1;
  -- never_suggest_garment, unsave_outfit, quick_reaction, swap_garment: handled below or no-op
  END IF;

  -- ----- UPSERT pair memory for save/wear/like_pair/reject/skip/dislike/rate
  IF v_pair_delta <> 0 AND array_length(p_garment_ids, 1) >= 2 THEN
    v_garment_ids := p_garment_ids;
    v_pair_count := array_length(v_garment_ids, 1);
    -- Iterate all (i, j) pairs (1-indexed in PL/pgSQL arrays).
    FOR i IN 1..v_pair_count LOOP
      FOR j IN i+1..v_pair_count LOOP
        -- Lex-sort the pair so a < b (matches recordPairOutcome convention).
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

  -- ----- SWAP semantics: removed × kept → negative; added × kept → positive
  IF p_event_type = 'swap_garment'
     AND array_length(p_garment_ids, 1) >= 1
  THEN
    -- "Kept" garments = p_garment_ids minus the removed ids minus the added.
    -- (The current canonical p_garment_ids is the FULL post-swap outfit, so
    --  kept = p_garment_ids minus added. We want kept paired with removed.)
    v_kept_garment_ids := ARRAY(
      SELECT g FROM unnest(p_garment_ids) g
      WHERE g <> ALL(COALESCE(p_added_garment_ids, '{}'::uuid[]))
        AND g <> ALL(COALESCE(p_removed_garment_ids, '{}'::uuid[]))
    );

    -- Negative weight for (removed × kept).
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

    -- Positive weight for (added × kept).
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

  -- ----- QUICK REACTION: derive direction from p_value or p_metadata --------
  -- Direction lives in p_value ('like' | 'dislike') OR p_metadata.value.
  -- When unambiguous AND >= 2 garment_ids provided, treat as paired weight.
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

  -- ----- Mark style summary as dirty ----------------------------------------
  -- D5 lazy materialization: edge fn (post-RPC) OR engine reads on cache miss
  -- trigger the actual rebuild via the TS deterministic builder (P87). We
  -- only mark the row dirty here so the rebuild path knows when to fire.
  --
  -- UPSERT pattern: insert a placeholder row if absent (so engine reads have
  -- a row to inspect for dirty_at), bump dirty_at + updated_at if present.
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

  -- ----- Return result ------------------------------------------------------
  RETURN jsonb_build_object(
    'ok', true,
    'signal_id', v_signal_id,
    'event_type', p_event_type,
    'pair_delta', v_pair_delta
  );
END;
$$;

-- ----- Helper: SELECT-then-UPDATE-or-INSERT for one pair --------------------
-- Mirrors recordPairOutcome at supabase/functions/_shared/outfit-scoring.ts:537-592.
-- Same race profile (small window between SELECT and INSERT/UPDATE if two
-- isolates ingest the same pair simultaneously). Acceptable for the BURS
-- usage pattern (memory writes are infrequent per-user; cross-user collisions
-- can't happen because user_id is part of the implicit dedup key).

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
DECLARE
  v_existing_id uuid;
BEGIN
  IF p_a = p_b THEN
    -- Refuse self-pair — shouldn't happen but defensive.
    RETURN;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.garment_pair_memory
  WHERE user_id = p_user_id
    AND garment_a_id = p_a
    AND garment_b_id = p_b
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    IF p_delta > 0 THEN
      UPDATE public.garment_pair_memory
      SET positive_count = positive_count + 1,
          last_positive_at = now(),
          updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      UPDATE public.garment_pair_memory
      SET negative_count = negative_count + 1,
          last_negative_at = now(),
          updated_at = now()
      WHERE id = v_existing_id;
    END IF;
  ELSE
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
    );
  END IF;
END;
$$;

-- ----- GRANTs --------------------------------------------------------------
-- Only service_role can call ingest_memory_event directly. The edge function
-- runs as service_role; authenticated clients reach the RPC only via the
-- edge function (which gates on JWT first, then forwards verified user_id).
REVOKE ALL ON FUNCTION public.ingest_memory_event(
  uuid, text, uuid, uuid[], uuid[], uuid[], integer, text, text, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_memory_event(
  uuid, text, uuid, uuid[], uuid[], uuid[], integer, text, text, jsonb, text
) TO service_role;

REVOKE ALL ON FUNCTION public._upsert_garment_pair_memory(uuid, uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._upsert_garment_pair_memory(uuid, uuid, uuid, integer)
  TO service_role;

-- ----- Documentation comment ------------------------------------------------
COMMENT ON TABLE public.user_style_summaries IS
  'Wave 8.5 P84. One persistent style summary per user. Refreshed by the deterministic builder (P87) on memory_ingest events (debounced) and on engine read cache miss (D5 lazy materialization).';

COMMENT ON COLUMN public.user_style_summaries.dirty_at IS
  'NULL = clean (recently rebuilt). Non-NULL = dirty since this timestamp; engine reads should rebuild via the P87 deterministic builder on next access.';

COMMENT ON FUNCTION public.ingest_memory_event(
  uuid, text, uuid, uuid[], uuid[], uuid[], integer, text, text, jsonb, text
) IS
  'Wave 8.5 P85. Atomic triple-write entry point for the Style Memory Bridge: writes feedback_signals + updates garment_pair_memory + marks user_style_summaries dirty. SECURITY DEFINER; only service_role can EXECUTE. Authenticated callers must reach via the memory_ingest edge function which gates on JWT first.';
