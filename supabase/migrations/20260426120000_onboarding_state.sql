-- Wave 7 (P42): onboarding state machine on profiles + 2 helper RPCs.
--
-- Context: the existing onboarding gate is a single
--   preferences->'onboarding'->>'completed' boolean
-- flipped client-side. Wave 7 replaces the 4-step shell with a guided 10-step
-- flow whose acceptance criteria (≥20 garments + style DNA + at least one
-- studio render) cannot be reached by a client-only state machine. Plus, the
-- iOS launch (Wave 11) needs onboarding completion to be a server-known fact
-- so we can gate the App Store paid-trial entry against it.
--
-- This migration provisions the schema. Backend rate-limit boost (P43),
-- frontend route gate (P44), and the 7 onboarding screens (P45-P51) consume
-- these columns and RPCs in subsequent PRs.
--
-- Schema additions (all on public.profiles, all idempotent):
--   * onboarding_step text NOT NULL DEFAULT 'not_started'
--       — 10-value state machine pinned by a CHECK constraint.
--   * onboarding_garment_count integer NOT NULL DEFAULT 0
--       — atomic counter incremented during BatchCapture (P47).
--   * onboarding_started_at timestamptz NULL
--       — set on the first non-not_started transition; consumed by the
--         scale-guard 24h boost gate (P43).
--   * onboarding_completed_at timestamptz NULL
--       — set when step transitions to 'completed'.
--
-- Index: a partial index on (onboarding_step) WHERE step != 'completed'
-- — most users will be 'completed' over time so a full index would be a waste.
-- The "still onboarding" set is what queries hit.
--
-- Backfill: existing users with preferences->'onboarding'->>'completed' = true
-- get step='completed' + completed_at copied from updated_at. All others keep
-- the column default ('not_started'); the route gate in P44 then routes them
-- back into the new flow on next access. Backfill is idempotent — second
-- application of this migration touches zero rows.
--
-- RPCs:
--   * advance_onboarding_step(p_user_id, p_to_step) — forward-only state
--     transitions (rejects no-op or backwards moves). Sets started_at on first
--     transition out of 'not_started'. Sets completed_at when stepping to
--     'completed'. Authorized: caller must own the row (auth.uid() match) OR
--     be the service_role.
--   * increment_onboarding_garment_count(p_user_id) — atomic counter
--     increment. Same auth model.
--
-- Both RPCs are SECURITY DEFINER with SET search_path = public — same pattern
-- as grant_trial_gift_atomic and consume_credit_atomic in the baseline.
-- Returning jsonb (not boolean) gives callers a richer error shape without
-- needing to handle plpgsql exceptions on the wire.

BEGIN;

-- ───────────────────────────────────────────────────────────────────
-- 1. Columns
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step text NOT NULL DEFAULT 'not_started';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_garment_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;


-- ───────────────────────────────────────────────────────────────────
-- 2. CHECK constraint pinning the 10 valid step values.
-- ───────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_onboarding_step_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_onboarding_step_check
      CHECK (onboarding_step IN (
        'not_started',
        'language',
        'quiz',
        'photo_tutorial',
        'batch_capture',
        'achievement',
        'studio_selection',
        'coach_tour',
        'reveal',
        'completed'
      ));
  END IF;
END $$;


-- ───────────────────────────────────────────────────────────────────
-- 3. Partial index for the "still onboarding" set.
-- ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_step
  ON public.profiles (onboarding_step)
  WHERE onboarding_step <> 'completed';


-- ───────────────────────────────────────────────────────────────────
-- 4. Backfill existing rows from preferences.onboarding.completed.
--    Idempotent: second run touches zero rows because the WHERE excludes
--    rows already at step='completed'.
--
--    Predicate uses a direct JSONB equality against `'true'::jsonb` instead
--    of `(... ->> 'completed')::boolean`. The text-cast version throws
--    `invalid input syntax for type boolean` on any non-boolean literal at
--    `preferences.onboarding.completed` (untyped JSONB lets a misbehaving
--    client write anything there), which would roll the whole migration
--    back on a single malformed row. JSONB equality returns FALSE for
--    string/number/null values without raising.
-- ───────────────────────────────────────────────────────────────────

UPDATE public.profiles
SET onboarding_step = 'completed',
    onboarding_completed_at = COALESCE(onboarding_completed_at, updated_at, NOW())
WHERE preferences->'onboarding'->'completed' = 'true'::jsonb
  AND onboarding_step <> 'completed';


-- ───────────────────────────────────────────────────────────────────
-- 5. RPC: advance_onboarding_step.
--    Forward-only state machine. Returns jsonb so callers get a structured
--    response without parsing plpgsql exception messages.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.advance_onboarding_step(
  p_user_id uuid,
  p_to_step text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_steps constant text[] := ARRAY[
    'not_started',
    'language',
    'quiz',
    'photo_tutorial',
    'batch_capture',
    'achievement',
    'studio_selection',
    'coach_tour',
    'reveal',
    'completed'
  ];
  v_current text;
  v_current_idx int;
  v_target_idx int;
BEGIN
  -- Authorization: the caller must own the row OR be the service_role.
  -- IS DISTINCT FROM handles NULL safely (auth.uid() is NULL for anon callers).
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'caller does not own this profile'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  v_target_idx := array_position(v_steps, p_to_step);
  IF v_target_idx IS NULL THEN
    RAISE EXCEPTION 'invalid onboarding step: %', p_to_step
      USING ERRCODE = '22023';  -- invalid_parameter_value
  END IF;

  -- FOR UPDATE serializes concurrent transitions on the same profile row.
  -- Without it, two parallel calls (multi-tab, retry storm) can both pass
  -- the read-then-validate forward-only check from the same `v_current`
  -- snapshot, then race the UPDATE — the slower writer overwrites the
  -- faster one with a LOWER target step. With the row lock, the second
  -- call blocks until the first commits, re-reads the now-updated step,
  -- and validates against the post-write state.
  SELECT onboarding_step INTO v_current
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    -- Profile row missing entirely (not the column being NULL — the column
    -- has NOT NULL DEFAULT 'not_started'). Treat as a hard error: the caller
    -- is acting on a non-existent user.
    RAISE EXCEPTION 'profile not found for user %', p_user_id
      USING ERRCODE = 'P0002';  -- no_data_found
  END IF;

  v_current_idx := array_position(v_steps, v_current);

  -- Forward-only: reject no-op and backwards transitions. Returning a
  -- structured response (vs. RAISE) so callers can distinguish "tried to
  -- advance from coach_tour to coach_tour" (idempotent retry, fine) from
  -- "tried to advance from quiz to language" (logic error, surface it).
  IF v_target_idx <= v_current_idx THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', CASE
        WHEN v_target_idx = v_current_idx THEN 'no_op'
        ELSE 'backwards'
      END,
      'current', v_current,
      'target', p_to_step
    );
  END IF;

  UPDATE public.profiles
  SET onboarding_step = p_to_step,
      onboarding_started_at = COALESCE(
        onboarding_started_at,
        CASE WHEN p_to_step <> 'not_started' THEN NOW() ELSE NULL END
      ),
      onboarding_completed_at = CASE
        WHEN p_to_step = 'completed' THEN NOW()
        ELSE onboarding_completed_at
      END,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'from', v_current,
    'to', p_to_step
  );
END;
$$;

ALTER FUNCTION public.advance_onboarding_step(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.advance_onboarding_step(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_onboarding_step(uuid, text)
  TO authenticated, service_role;


-- ───────────────────────────────────────────────────────────────────
-- 6. RPC: increment_onboarding_garment_count.
--    Atomic counter increment. Returns the new count.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_onboarding_garment_count(
  p_user_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'caller does not own this profile'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET onboarding_garment_count = onboarding_garment_count + 1,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING onboarding_garment_count INTO v_new_count;

  IF v_new_count IS NULL THEN
    RAISE EXCEPTION 'profile not found for user %', p_user_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_new_count;
END;
$$;

ALTER FUNCTION public.increment_onboarding_garment_count(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.increment_onboarding_garment_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_onboarding_garment_count(uuid)
  TO authenticated, service_role;


-- ───────────────────────────────────────────────────────────────────
-- 7. Column-level UPDATE revoke — tamper-proof onboarding boost.
--
-- The scale-guard onboarding tier (Wave 7 P43) reads
-- `profiles.onboarding_started_at` + `onboarding_step` to decide whether
-- to grant the 3x rate-limit boost for the first 24h after onboarding
-- starts. Without column-level protection, the existing RLS policy
-- (`Users can manage own profile`) lets an authenticated user UPDATE
-- their own profile row freely — including resetting `started_at` to
-- NOW() repeatedly, holding `onboarding_step != 'completed'`, and
-- thereby keeping the 3x boost indefinitely. That's a self-service
-- quota bypass.
--
-- Fix: revoke UPDATE on these 4 columns from the `authenticated` and
-- `anon` roles. The SECURITY DEFINER RPCs above (`advance_onboarding_step`,
-- `increment_onboarding_garment_count`) run as `postgres` and bypass
-- column-level GRANTs, so the legitimate write path is preserved. The
-- service_role (used by edge functions and admin tooling) also bypasses
-- via its `BYPASSRLS` capability.
--
-- INSERT permission is left intact because the existing client-side
-- profile auto-create in `useProfile.ts` doesn't set these columns —
-- it relies on the NOT NULL DEFAULT — so a column-level INSERT revoke
-- would be unnecessary and risk breaking that flow.
-- ───────────────────────────────────────────────────────────────────

REVOKE UPDATE (
  onboarding_step,
  onboarding_garment_count,
  onboarding_started_at,
  onboarding_completed_at
) ON public.profiles FROM authenticated, anon;


COMMIT;
