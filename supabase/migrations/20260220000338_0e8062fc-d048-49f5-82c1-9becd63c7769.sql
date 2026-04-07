
-- Deny all client INSERT on subscriptions (only stripe webhook via service role)
CREATE POLICY "Deny client insert on subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (false);

-- Deny all client UPDATE on subscriptions
CREATE POLICY "Deny client update on subscriptions"
ON public.subscriptions
FOR UPDATE
USING (false);

-- Deny all client DELETE on subscriptions
CREATE POLICY "Deny client delete on subscriptions"
ON public.subscriptions
FOR DELETE
USING (false);
