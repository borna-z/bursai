-- Prompt 19: Fix analytics_events telemetry pipeline.
-- Every trackEvent call has been silently failing since launch due to schema drift:
--   * event_name was added via dashboard as NOT NULL with no default
--   * RLS policies were replaced with strict owner-only (no permissive NULL path)
--   * user_id had no default and was never set client-side
-- This migration reconciles live state into tracked SQL and unblocks telemetry.

-- 1. Drop the dashboard-added RLS policies that replaced the originals
DROP POLICY IF EXISTS "analytics_events_owner_insert" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_owner_select" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_owner_update" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_owner_delete" ON public.analytics_events;
DROP POLICY IF EXISTS "Deny client select on analytics_events" ON public.analytics_events;

-- 2. Set user_id default to auth.uid() so RLS passes without client changes
ALTER TABLE public.analytics_events
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 3. Drop NOT NULL on event_name so inserts that only set event_type don't fail
ALTER TABLE public.analytics_events
  ALTER COLUMN event_name DROP NOT NULL;

-- 4. Create a BEFORE INSERT trigger that backfills event_name and properties
--    from event_type and metadata when they are not explicitly set.
--    Keeps Admin.tsx aggregates on event_name working.
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

-- 5. Recreate the correct INSERT policy
CREATE POLICY "analytics_events_insert_self"
  ON public.analytics_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Recreate the deny-select policy (clients must not read telemetry)
CREATE POLICY "analytics_events_deny_select"
  ON public.analytics_events
  FOR SELECT
  USING (false);
