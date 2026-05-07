-- Theme 1 (post-launch audit) — atomic JSONB merge RPCs for profile state.
--
-- BACKGROUND
-- ----------
-- Five mobile call sites perform read-modify-write merges against
-- `profiles.preferences` (a free-form JSONB column with sibling keys for
-- onboarding, coach tour, V4 quiz, V3 mirror, shopping list, language, etc.)
-- and one against `profiles.notification_prefs`. The pattern:
--
--     SELECT preferences FROM profiles WHERE id = auth.uid();
--     -- mutate in JS:  next = { ...prev, [key]: value }
--     UPDATE profiles SET preferences = next WHERE id = auth.uid();
--
-- Two writers firing within the round-trip window (e.g. the first-run coach
-- completion firing while V3-compat backfill is mid-merge on first launch)
-- both read the old row, build disjoint patches, and the second write
-- clobbers the first's keys. Symptoms in the wild: users seeing the coach
-- tour re-surface after completing it, V3 mirror disappearing after
-- onboarding finish, must-have shopping list reverting on a refresh.
--
-- SOLUTION
-- --------
-- Two SECURITY-INVOKER functions that take a JSONB patch, take a row-level
-- write lock (`SELECT ... FOR UPDATE`), apply Postgres' right-wins `||`
-- merge, and write the result back atomically inside a single statement.
-- `auth.uid()` is the implicit row key — there is no user_id parameter so
-- it is impossible for a caller to merge another user's row, regardless of
-- RLS posture. RLS on `profiles` (USING (id = auth.uid())) still applies
-- through SECURITY INVOKER and acts as defense-in-depth.
--
-- Patch size is capped at 4 KB to bound the merged blob — a runaway client
-- loop or bug can't inflate the column past a recoverable size.
--
-- Also fixes a pre-existing P0: `20260426120000_onboarding_state.sql`
-- revoked table-level UPDATE on `profiles` from `authenticated` and
-- granted column-level UPDATE on a fixed list of columns. The
-- `notification_prefs` column was added later by
-- `20260507120100_profiles_notification_prefs.sql` without re-granting
-- UPDATE on it, so the M30 settings toggle (`useUpdateNotificationPrefs`)
-- was silently failing with "permission denied" on every save — the
-- optimistic UI flipped, then the round-trip rolled back. This migration
-- closes that gap. Same applies for the new RPC: SECURITY INVOKER means
-- the RPC's UPDATE statement runs with the caller's grants, so without
-- this GRANT both the legacy direct-update path AND the RPC fail.
--
-- Side effect (intentional, called out for reviewers): the RPC also bumps
-- `updated_at = NOW()` on every merge, which the pre-PR client UPDATEs
-- did not do. Any consumer that filters on `profiles.updated_at` (sync
-- jobs, observability dashboards) will see more churn after this lands.
-- This matches the column's documented purpose ("last-write timestamp")
-- and lets us tell apart a never-touched row from one that's actively
-- being merged into.

-- ──────────────────────────────────────────────────────────────────────
-- merge_profile_preferences_jsonb — `profiles.preferences` patch merge
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.merge_profile_preferences_jsonb(
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current jsonb;
  v_merged jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'merge_profile_preferences_jsonb: auth.uid() is null';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'merge_profile_preferences_jsonb: p_patch must be a jsonb object';
  END IF;

  -- 4 KB cap on the patch payload. The merged column can grow larger than
  -- this over time across many merges; the cap is on a single patch only.
  IF octet_length(p_patch::text) > 4096 THEN
    RAISE EXCEPTION 'merge_profile_preferences_jsonb: p_patch exceeds 4096 bytes';
  END IF;

  -- FOR UPDATE serializes concurrent merges on the same row. Two callers
  -- racing each other will produce both writes in order, not lose one.
  SELECT COALESCE(preferences, '{}'::jsonb)
    INTO v_current
    FROM public.profiles
   WHERE id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_profile_preferences_jsonb: profile row missing for %', v_uid;
  END IF;

  -- Defensive: if a malformed historical write left `preferences` as a
  -- non-object jsonb (array, scalar), Postgres' `||` would happily
  -- produce `[{...}]` (array || object → array-with-object-appended)
  -- and silently corrupt the row. Treat any non-object stored value as
  -- empty so the merge always lands on a clean object.
  IF jsonb_typeof(v_current) <> 'object' THEN
    v_current := '{}'::jsonb;
  END IF;

  v_merged := v_current || p_patch;

  UPDATE public.profiles
     SET preferences = v_merged,
         updated_at = NOW()
   WHERE id = v_uid;

  RETURN v_merged;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- merge_notification_prefs_jsonb — `profiles.notification_prefs` patch merge
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.merge_notification_prefs_jsonb(
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current jsonb;
  v_merged jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'merge_notification_prefs_jsonb: auth.uid() is null';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'merge_notification_prefs_jsonb: p_patch must be a jsonb object';
  END IF;

  IF octet_length(p_patch::text) > 1024 THEN
    -- Tighter cap than preferences — notification_prefs has a fixed,
    -- small key set (daily/new_outfit/reminders today, room to grow).
    RAISE EXCEPTION 'merge_notification_prefs_jsonb: p_patch exceeds 1024 bytes';
  END IF;

  SELECT COALESCE(notification_prefs, '{}'::jsonb)
    INTO v_current
    FROM public.profiles
   WHERE id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_notification_prefs_jsonb: profile row missing for %', v_uid;
  END IF;

  -- Defensive: see merge_profile_preferences_jsonb above. Non-object
  -- stored value would corrupt under `||`; coerce to empty object.
  IF jsonb_typeof(v_current) <> 'object' THEN
    v_current := '{}'::jsonb;
  END IF;

  v_merged := v_current || p_patch;

  UPDATE public.profiles
     SET notification_prefs = v_merged,
         updated_at = NOW()
   WHERE id = v_uid;

  RETURN v_merged;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- Grants — authenticated callers only. Anonymous + service_role do not
-- need this surface (service_role can write the column directly; anon
-- has no profile row).
-- ──────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.merge_profile_preferences_jsonb(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_notification_prefs_jsonb(jsonb)  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.merge_profile_preferences_jsonb(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_notification_prefs_jsonb(jsonb)  TO authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- Backfill grant — close the M30 column-grant gap
-- ──────────────────────────────────────────────────────────────────────
-- Column-level UPDATE grant for `notification_prefs`. Without this both
-- the new RPC (SECURITY INVOKER → caller-grants) AND any direct write
-- path fail with "permission denied" because of the table-level UPDATE
-- revocation in `20260426120000_onboarding_state.sql`. See header
-- comment for the full backstory.
GRANT UPDATE (notification_prefs) ON public.profiles TO authenticated;
