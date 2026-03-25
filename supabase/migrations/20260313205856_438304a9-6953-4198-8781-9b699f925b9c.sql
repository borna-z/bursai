
-- Fix security definer view - make it SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT id, display_name, avatar_path, username
FROM public.profiles
WHERE username IS NOT NULL;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- We still need anon/public to be able to read public profiles, so add back a restricted policy
CREATE POLICY "Public can view profiles with username (safe columns only via view)" ON public.profiles
  FOR SELECT
  TO anon
  USING (username IS NOT NULL);
