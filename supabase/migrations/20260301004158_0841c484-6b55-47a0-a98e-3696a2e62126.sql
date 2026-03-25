
-- Drop all existing RESTRICTIVE policies on calendar_connections
DROP POLICY IF EXISTS "Users can view own connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can insert own connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can update own connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can delete own connections" ON public.calendar_connections;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can view own connections"
ON public.calendar_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections"
ON public.calendar_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
ON public.calendar_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
ON public.calendar_connections FOR DELETE
USING (auth.uid() = user_id);
