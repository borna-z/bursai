-- Post-launch Theme 2 — schema hardening sweep
--
-- Five tightening fixes. All idempotent (DROP POLICY IF EXISTS / CREATE
-- INDEX IF NOT EXISTS / DO blocks) so the migration is safe to replay
-- against a partially-applied environment. No column drops, no data loss.
--
--   1. outfit_items     — replace single FOR ALL policy with explicit per-action
--                          policies; INSERT/UPDATE WITH CHECK now also verifies
--                          the caller owns the referenced garment_id (was only
--                          checking parent outfit_id ownership, which lets a
--                          user attach another user's garment_id to their own
--                          outfit row).
--   2. wear_logs        — UNIQUE INDEX on (user_id, garment_id, worn_at) so
--                          that a retried "Wear today" mutation re-sending the
--                          same payload (same nowIso) is dedup'd at the DB
--                          layer instead of relying solely on the in-flight
--                          Set in mobile/src/hooks/useOutfits.ts.
--   3. outfit_feedback  — UNIQUE INDEX on (user_id, outfit_id) so the SELECT-
--                          newest / UPDATE-newest / DELETE-siblings workaround
--                          in mobile/src/hooks/useOutfits.ts can converge to
--                          a real PostgREST upsert. Existing duplicates are
--                          collapsed first (keep newest by created_at).
--   4. increment_wear_count(uuid)
--                       — atomic UPDATE-with-RETURNING RPC so per-garment
--                          wear bumps stop being read-modify-write. Caller
--                          ownership is enforced by `WHERE user_id = auth.uid()`
--                          inside the function body (SECURITY INVOKER also
--                          honors RLS as defense-in-depth).
--   5. push_subscriptions
--                       — replace single FOR ALL policy with explicit per-
--                          action policies that all carry an explicit
--                          WITH CHECK (auth.uid() = user_id). Functionally
--                          equivalent to the prior policy under PG's "WITH
--                          CHECK defaults to USING" rule, but survives a
--                          future agent adding a separate FOR INSERT policy
--                          without WITH CHECK and silently widening the gate.

BEGIN;

-- ============================================================
-- 1. outfit_items — per-action RLS with garment ownership check
-- ============================================================

DROP POLICY IF EXISTS "Users can manage own outfit items" ON public.outfit_items;
DROP POLICY IF EXISTS "outfit_items_select_own" ON public.outfit_items;
DROP POLICY IF EXISTS "outfit_items_insert_own" ON public.outfit_items;
DROP POLICY IF EXISTS "outfit_items_update_own" ON public.outfit_items;
DROP POLICY IF EXISTS "outfit_items_delete_own" ON public.outfit_items;

CREATE POLICY "outfit_items_select_own" ON public.outfit_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.outfits o
      WHERE o.id = outfit_items.outfit_id
        AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "outfit_items_insert_own" ON public.outfit_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outfits o
      WHERE o.id = outfit_items.outfit_id
        AND o.user_id = auth.uid()
    )
    AND (
      garment_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.garments g
        WHERE g.id = outfit_items.garment_id
          AND g.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "outfit_items_update_own" ON public.outfit_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.outfits o
      WHERE o.id = outfit_items.outfit_id
        AND o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outfits o
      WHERE o.id = outfit_items.outfit_id
        AND o.user_id = auth.uid()
    )
    AND (
      garment_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.garments g
        WHERE g.id = outfit_items.garment_id
          AND g.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "outfit_items_delete_own" ON public.outfit_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.outfits o
      WHERE o.id = outfit_items.outfit_id
        AND o.user_id = auth.uid()
    )
  );

-- ============================================================
-- 2. wear_logs — retry-safe UNIQUE INDEX
-- ============================================================
--
-- Mobile inserts (useOutfits.ts) batch all garments for a single "Wear
-- today" tap with one shared `nowIso`. A network retry of that mutation
-- re-sends the same `worn_at` value; without this UNIQUE we'd get
-- duplicate rows and a doubled wear_count downstream.
--
-- garment_id is nullable (fallback path inserts a single null-garment
-- log); for that path the in-flight Set in useMarkOutfitWorn handles
-- same-call dedup. NULLs are treated as distinct (default), so two
-- separate fallback-path mutations CAN double-insert a null-garment
-- row — that's a pre-existing client-side concern and out of scope.

CREATE UNIQUE INDEX IF NOT EXISTS wear_logs_user_garment_worn_at_uidx
  ON public.wear_logs (user_id, garment_id, worn_at);

-- ============================================================
-- 3. outfit_feedback — UNIQUE on (user_id, outfit_id)
-- ============================================================
--
-- Collapse pre-existing duplicates first: keep the row with the most
-- recent created_at; tie-break on id so the cleanup is deterministic.
-- Mobile's useOutfits.ts already does the same (SELECT newest, DELETE
-- siblings) at runtime, so historical drift may have left rows that
-- need this one-shot pass before the index can be created.

DELETE FROM public.outfit_feedback a
  USING public.outfit_feedback b
  WHERE a.user_id = b.user_id
    AND a.outfit_id = b.outfit_id
    AND a.outfit_id IS NOT NULL
    AND (
      COALESCE(a.created_at, 'epoch'::timestamptz)
        < COALESCE(b.created_at, 'epoch'::timestamptz)
      OR (
        COALESCE(a.created_at, 'epoch'::timestamptz)
          = COALESCE(b.created_at, 'epoch'::timestamptz)
        AND a.id < b.id
      )
    );

-- Use a UNIQUE INDEX (not ALTER TABLE ... ADD CONSTRAINT) for true
-- IF NOT EXISTS idempotency. PostgREST's onConflict can target a
-- UNIQUE INDEX by column list just like a constraint.
CREATE UNIQUE INDEX IF NOT EXISTS outfit_feedback_user_outfit_uidx
  ON public.outfit_feedback (user_id, outfit_id);

-- ============================================================
-- 4. increment_wear_count(uuid) — atomic per-garment wear bump
-- ============================================================
--
-- Replaces the read-modify-write pattern in mobile/src/hooks/useGarments.ts
-- (useMarkWorn). A concurrent same-garment wear under the prior pattern
-- would lose an increment; the single UPDATE here is atomic.
--
-- SECURITY INVOKER + the explicit `WHERE user_id = auth.uid()` give
-- belt-and-braces ownership enforcement: RLS on `garments` already
-- filters by user_id, so a caller targeting another user's row has the
-- UPDATE return zero rows even without the explicit user_id predicate;
-- keeping the predicate makes the intent unambiguous and survives any
-- future RLS edit that loosens the row-scope.

CREATE OR REPLACE FUNCTION public.increment_wear_count(p_garment_id uuid)
  RETURNS TABLE (id uuid, wear_count integer, last_worn_at timestamptz)
  LANGUAGE sql
  SECURITY INVOKER
  SET search_path = public, pg_temp
  AS $$
    UPDATE public.garments
       SET wear_count = COALESCE(wear_count, 0) + 1,
           last_worn_at = now()
     WHERE id = p_garment_id
       AND user_id = auth.uid()
     RETURNING id, wear_count, last_worn_at;
  $$;

GRANT EXECUTE ON FUNCTION public.increment_wear_count(uuid) TO authenticated;

-- ============================================================
-- 5. push_subscriptions — explicit WITH CHECK on every action
-- ============================================================

DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
