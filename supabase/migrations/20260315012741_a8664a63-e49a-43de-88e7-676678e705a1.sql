
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
  id,
  display_name,
  avatar_path,
  username
FROM public.profiles
WHERE username IS NOT NULL;
