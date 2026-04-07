-- Add stripe_mode to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS stripe_mode text DEFAULT 'test';

-- Create stripe_events table for webhook logging and idempotency
CREATE TABLE IF NOT EXISTS public.stripe_events (
    id text PRIMARY KEY,
    event_type text NOT NULL,
    created_at timestamptz DEFAULT now(),
    processed_at timestamptz DEFAULT now(),
    processed_ok boolean DEFAULT true,
    error text,
    stripe_mode text DEFAULT 'test'
);

-- Enable RLS on stripe_events (only service role can access)
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Create checkout_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.checkout_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_checkout_attempts_user_time 
ON public.checkout_attempts(user_id, created_at DESC);

-- Create analytics_events table for growth tracking
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own events
CREATE POLICY "Users can insert own analytics events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Anyone can insert anonymous events (for share page)
CREATE POLICY "Anyone can insert anonymous events"
ON public.analytics_events
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time 
ON public.analytics_events(event_type, created_at DESC);