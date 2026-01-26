-- Create subscriptions table for Stripe integration
CREATE TABLE public.subscriptions (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id text,
    stripe_subscription_id text,
    status text,
    price_id text,
    current_period_end timestamptz,
    plan text DEFAULT 'free',
    updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
CREATE POLICY "Users can view own subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only service role can insert/update (webhook)
-- Note: No INSERT/UPDATE policies for authenticated users - webhook uses service role

-- Add stripe_customer_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Create trigger to update updated_at
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();