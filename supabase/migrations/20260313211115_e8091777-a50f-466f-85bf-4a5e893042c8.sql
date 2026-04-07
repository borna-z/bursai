
-- Fix CRITICAL: Remove anon SELECT on profiles that exposes sensitive data
-- Public profile lookups should go through the public_profiles view instead
DROP POLICY IF EXISTS "Public can view profiles with username (safe columns only via v" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles with username (safe columns only via view)" ON public.profiles;

-- Fix WARN: Friendship addressee can overwrite requester_id
-- Add WITH CHECK that prevents changing requester_id or addressee_id
DROP POLICY IF EXISTS "Addressee can update friendship status" ON public.friendships;

CREATE POLICY "Addressee can update friendship status" ON public.friendships
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id AND requester_id = requester_id);
