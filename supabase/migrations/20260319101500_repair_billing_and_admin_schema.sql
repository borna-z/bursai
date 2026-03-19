-- Minimal production repair for confirmed live schema drift.
-- Aligns production to repo expectations without backfilling stripe_mode values.

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS stripe_mode text;
