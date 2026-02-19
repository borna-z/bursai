
-- 1. Update handle_new_user to set onboarding.completed = false for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, preferences)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    '{"onboarding": {"completed": false}}'::jsonb
  );
  RETURN NEW;
END;
$function$;

-- 2. Mark ALL existing profiles as onboarded so they skip onboarding on next login
UPDATE public.profiles
SET preferences = COALESCE(preferences, '{}'::jsonb) || '{"onboarding": {"completed": true}}'::jsonb
WHERE preferences IS NULL
   OR preferences->'onboarding'->>'completed' IS NULL
   OR preferences->'onboarding'->>'completed' != 'true';
