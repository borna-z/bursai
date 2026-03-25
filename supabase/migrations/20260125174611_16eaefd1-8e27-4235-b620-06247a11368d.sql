-- Drop policy if exists to avoid conflicts
DROP POLICY IF EXISTS "wear_logs_update_own" ON public.wear_logs;

-- Create UPDATE policy allowing users to update only their own rows
CREATE POLICY "wear_logs_update_own"
ON public.wear_logs
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());