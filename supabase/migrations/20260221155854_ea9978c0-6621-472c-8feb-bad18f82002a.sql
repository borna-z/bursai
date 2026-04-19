-- Explicitly deny client-side INSERT on user_subscriptions
-- Subscriptions are created exclusively via SECURITY DEFINER trigger on user signup
DROP POLICY IF EXISTS "Deny client insert on user_subscriptions" ON public.user_subscriptions;
CREATE POLICY "Deny client insert on user_subscriptions"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (false);