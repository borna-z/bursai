CREATE POLICY "Deny client select on analytics_events"
  ON public.analytics_events
  FOR SELECT
  USING (false);