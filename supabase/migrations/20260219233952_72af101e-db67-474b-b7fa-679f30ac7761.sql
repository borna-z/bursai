-- stripe_events: only service role (edge functions) should read/write
CREATE POLICY "Deny all client access to stripe_events"
ON public.stripe_events
FOR ALL
USING (false);

-- checkout_attempts: only service role should manage, users can view own
CREATE POLICY "Users can view own checkout attempts"
ON public.checkout_attempts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkout attempts"
ON public.checkout_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);