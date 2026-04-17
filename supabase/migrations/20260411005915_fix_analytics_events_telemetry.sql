-- Archaeology: file renamed from 20260411120000_fix_analytics_events_telemetry.sql
-- in commit 034fa49c (PR #419) to align with remote applied_at timestamp
-- 2026-04-11 00:59:15. Original author content in commit 27394b6e
-- ("Prompt 19: fix analytics_events schema drift — trigger backfill,
-- user_id default, RLS reconcile", 2026-04-11).

-- Prompt 19: Fix analytics_events telemetry pipeline.
-- Safe for both production (where event_name/properties exist via dashboard drift)
-- and clean environments (where only the baseline schema exists).

-- 1. Drop the dashboard-added RLS policies that replaced the originals
DROP POLICY IF EXISTS "analytics_events_owner_insert" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_owner_select" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_owner_update" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_owner_delete" ON public.analytics_events;
DROP POLICY IF EXISTS "Deny client select on analytics_events" ON public.analytics_events;

-- 2. Set user_id default to auth.uid() so RLS passes without client changes
ALTER TABLE public.analytics_events
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 3. Add event_name if it doesn't exist (dashboard added it in prod; clean envs don't have it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analytics_events' AND column_name = 'event_name'
  ) THEN
    ALTER TABLE public.analytics_events ADD COLUMN event_name text;
  ELSE
    ALTER TABLE public.analytics_events ALTER COLUMN event_name DROP NOT NULL;
  END IF;
END $$;

-- 4. Add properties if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analytics_events' AND column_name = 'properties'
  ) THEN
    ALTER TABLE public.analytics_events ADD COLUMN properties jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 5. Create a BEFORE INSERT trigger that backfills event_name and properties
--    from event_type and metadata when they are not explicitly set
CREATE OR REPLACE FUNCTION public.analytics_events_backfill()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_name IS NULL THEN
    NEW.event_name := NEW.event_type;
  END IF;
  IF NEW.properties IS NULL THEN
    NEW.properties := COALESCE(NEW.metadata, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS analytics_events_backfill_trigger ON public.analytics_events;
CREATE TRIGGER analytics_events_backfill_trigger
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW EXECUTE FUNCTION public.analytics_events_backfill();

-- 6. Recreate INSERT policies — authenticated users insert their own rows,
--    anonymous users (share pages) insert rows with user_id IS NULL.
DROP POLICY IF EXISTS "analytics_events_insert_anon" ON public.analytics_events;

-- 6a. Authenticated users can insert their own events
CREATE POLICY "analytics_events_insert_self"
  ON public.analytics_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6b. Anonymous users can insert events where user_id is NULL
CREATE POLICY "analytics_events_insert_anon"
  ON public.analytics_events
  FOR INSERT
  WITH CHECK (user_id IS NULL);

-- 7. Recreate the deny-select policy
CREATE POLICY "analytics_events_deny_select"
  ON public.analytics_events
  FOR SELECT
  USING (false);
