-- Wave 8.5 PR B (P88+P90 prep) — integrity constraints discovered by pre-implementation audit.
--
-- Audit findings folded in:
--
-- (A) Pre-implementation audit on PR A foundation flagged TWO P1 integrity gaps that PR B's
--     readers (burs_style_engine + style_chat) will rely on:
--
--     1. garment_pair_memory has NO UNIQUE constraint on (user_id, garment_a_id, garment_b_id).
--        Concurrent ingest_memory_event RPC calls — unavoidable with PR B's throughput
--        (each save/wear/swap fires N×(N-1)/2 pair upserts) — can race the SELECT-then-INSERT
--        path in the _upsert_garment_pair_memory helper at PR A migration line 426-431,
--        producing duplicate rows for the same pair. Duplicates corrupt the engine's
--        pair-weight aggregation downstream.
--
--     2. user_style_summaries has no CHECK constraints on `version` or `confidence`.
--        version=0 / confidence=2.5 / confidence=-0.1 silently round-trip through the engine
--        readers and skew scoring math without a deterministic failure mode.
--
-- (B) Pre-implementation audit on burs_style_engine flagged that recordPairOutcome at
--     outfit-scoring.ts:537-591 has the same race profile. PR B will route writes through
--     ingest_memory_event RPC (canonical path); legacy direct writes still happen pre-merge.
--     The UNIQUE constraint is the safety net for both writers.
--
-- These constraints are PURELY ADDITIVE on validated rows. Duplicate-row cleanup happens
-- BEFORE the constraint is applied (the `delete-then-insert` block below preserves the
-- highest-positive-count row per pair, which is the deterministic survivor under PR A's
-- counter-only update semantics). On a healthy user base with low pre-existing duplicate
-- counts (verify pre-deploy via the count query in the deploy section), the cleanup is
-- a no-op or a few-row delete.
--
-- Reset RPC for P90 (atomic Style Memory wipe) lives in this same migration so the wave
-- ships one tracked migration end-to-end. The RPC is SECURITY DEFINER, GRANT'd to
-- service_role only, and re-checks auth.role() before deleting rows — same defense pattern
-- as ingest_memory_event from PR A.

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — garment_pair_memory: dedupe + UNIQUE constraint
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: dedupe pre-existing rows. Survivors keep the highest cumulative
-- positive_count for each (user_id, garment_a_id, garment_b_id) tuple.
-- Counter columns merge: SUM positive/negative across the duplicates so no
-- learning is lost. Timestamps take the LATEST value for both
-- last_positive_at / last_negative_at.

WITH ranked AS (
  SELECT id,
         user_id,
         garment_a_id,
         garment_b_id,
         positive_count,
         negative_count,
         last_positive_at,
         last_negative_at,
         created_at,
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

DELETE FROM public.garment_pair_memory g
WHERE  g.garment_a_id IS NOT NULL
  AND  g.garment_b_id IS NOT NULL
  AND  EXISTS (
    SELECT 1 FROM public.garment_pair_memory g2
    WHERE  g2.user_id = g.user_id
      AND  g2.garment_a_id = g.garment_a_id
      AND  g2.garment_b_id = g.garment_b_id
      AND  (g2.positive_count, g2.created_at) > (g.positive_count, g.created_at)
  );

-- Step 2: enforce uniqueness going forward. Partial index — null garment ids
-- (legacy `garment_id_a` / `garment_id_b` rows from before PR A's column adds)
-- are excluded from the constraint, which is correct: those rows aren't reachable
-- by the new RPC writers anyway.
CREATE UNIQUE INDEX IF NOT EXISTS idx_garment_pair_memory_unique_pair
  ON public.garment_pair_memory (user_id, garment_a_id, garment_b_id)
  WHERE garment_a_id IS NOT NULL AND garment_b_id IS NOT NULL;

COMMENT ON INDEX public.idx_garment_pair_memory_unique_pair IS
  'Wave 8.5 PR B integrity. Required by PR A _upsert_garment_pair_memory race fix and PR B ingest_memory_event RPC. Partial — legacy null-pair rows excluded.';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — user_style_summaries: CHECK constraints on version + confidence
-- ─────────────────────────────────────────────────────────────────────────────

-- Repair any pre-existing rows that violate the about-to-be-added constraints.
-- PR A's deterministic builder always emits version >= 1 and 0 <= confidence <= 1,
-- so this is defensive: covers any manually-written rows from local dev seeds or
-- mistaken admin edits.

UPDATE public.user_style_summaries
SET    version = 1
WHERE  version IS NULL OR version < 1;

UPDATE public.user_style_summaries
SET    confidence = 0
WHERE  confidence IS NULL OR confidence < 0;

UPDATE public.user_style_summaries
SET    confidence = 1
WHERE  confidence > 1;

ALTER TABLE public.user_style_summaries
  DROP CONSTRAINT IF EXISTS user_style_summaries_version_check;
ALTER TABLE public.user_style_summaries
  ADD  CONSTRAINT user_style_summaries_version_check CHECK (version >= 1);

ALTER TABLE public.user_style_summaries
  DROP CONSTRAINT IF EXISTS user_style_summaries_confidence_check;
ALTER TABLE public.user_style_summaries
  ADD  CONSTRAINT user_style_summaries_confidence_check
       CHECK (confidence >= 0 AND confidence <= 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — reset_style_memory_atomic RPC (P90)
-- ─────────────────────────────────────────────────────────────────────────────

-- One-transaction wipe of feedback_signals + garment_pair_memory + user_style_summaries
-- for a single user. Preserves wear_logs, garments, outfits, profile, planned_outfits per
-- spec §10. service_role-only — the reset_style_memory edge function is the only
-- legitimate caller.

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
  -- Cross-user write protection: reject any caller that isn't service_role.
  -- session_user is the connected role (bypasses SECURITY DEFINER); auth.role()
  -- returns the authenticated principal's role.
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

COMMENT ON FUNCTION public.reset_style_memory_atomic(uuid) IS
  'Wave 8.5 P90: atomic Style Memory reset. Deletes feedback_signals + garment_pair_memory + user_style_summaries rows owned by p_user_id in one transaction. Preserves wear_logs, garments, outfits, profile, planned_outfits per spec. Callable only by service_role via the reset_style_memory edge function.';
