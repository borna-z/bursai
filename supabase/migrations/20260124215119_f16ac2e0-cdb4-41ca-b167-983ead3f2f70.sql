-- Ensure RLS is enabled on wear_logs
ALTER TABLE public.wear_logs ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists to avoid conflicts
DROP POLICY IF EXISTS "wear_logs_delete_own" ON public.wear_logs;

-- Create DELETE policy allowing users to delete only their own rows
DROP POLICY IF EXISTS "wear_logs_delete_own" ON public.wear_logs;
CREATE POLICY "wear_logs_delete_own"
ON public.wear_logs
FOR DELETE
TO authenticated
USING (user_id = auth.uid());