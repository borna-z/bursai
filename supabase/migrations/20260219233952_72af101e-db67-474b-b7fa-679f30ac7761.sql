-- stripe_events: only service role (edge functions) should read/write
DROP POLICY IF EXISTS "Deny all client access to stripe_events" ON public.stripe_events;
CREATE POLICY "Deny all client access to stripe_events"
ON public.stripe_events
FOR ALL
USING (false);

-- checkout_attempts: only service role should manage, users can view own
DROP POLICY IF EXISTS "Users can view own checkout attempts" ON public.checkout_attempts;
CREATE POLICY "Users can view own checkout attempts"
ON public.checkout_attempts
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own checkout attempts" ON public.checkout_attempts;
CREATE POLICY "Users can insert own checkout attempts"
ON public.checkout_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);