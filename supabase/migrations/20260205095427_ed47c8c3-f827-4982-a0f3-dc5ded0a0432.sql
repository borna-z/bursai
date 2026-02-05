-- Marketing leads table for email capture
CREATE TABLE public.marketing_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT DEFAULT 'website',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on email
CREATE UNIQUE INDEX idx_marketing_leads_email ON public.marketing_leads(email);

-- Marketing events table for analytics
CREATE TABLE public.marketing_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  path TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  utm_medium TEXT,
  device_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for analytics queries
CREATE INDEX idx_marketing_events_name ON public.marketing_events(event_name);
CREATE INDEX idx_marketing_events_created ON public.marketing_events(created_at);

-- Enable RLS
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts for leads (with email validation in app)
CREATE POLICY "Anyone can submit leads"
ON public.marketing_leads
FOR INSERT
WITH CHECK (true);

-- Allow anonymous inserts for events
CREATE POLICY "Anyone can track events"
ON public.marketing_events
FOR INSERT
WITH CHECK (true);

-- Admins can view leads
CREATE POLICY "Admins can view leads"
ON public.marketing_leads
FOR SELECT
USING (is_admin(auth.uid()));

-- Admins can view events
CREATE POLICY "Admins can view events"
ON public.marketing_events
FOR SELECT
USING (is_admin(auth.uid()));