
-- Step 6: Fix CRITICAL - Sensitive data exposed on public profiles
-- Replace the overly permissive public profiles SELECT policy with one that only exposes safe columns
DROP POLICY IF EXISTS "Anyone can view public profiles by username" ON public.profiles;

-- Create a safe public profile view
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, display_name, avatar_path, username
FROM public.profiles
WHERE username IS NOT NULL;

-- Allow public SELECT on the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Re-add a safe policy for profiles: authenticated users can read their own full profile
-- (existing "Users can read own profile" policy should already handle this)

-- Step 6: Fix CRITICAL - Users can upgrade their own subscription
-- Remove the client-facing UPDATE policy on user_subscriptions
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;

-- Step 8: Create rate limiting table for AI edge functions
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  called_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Service-role only - no client access needed
DROP POLICY IF EXISTS "Service role only" ON public.ai_rate_limits;
CREATE POLICY "Service role only" ON public.ai_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_user_function 
ON public.ai_rate_limits (user_id, function_name, called_at DESC);

-- Auto-cleanup: delete entries older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.ai_rate_limits WHERE called_at < now() - interval '1 hour';
$$;
