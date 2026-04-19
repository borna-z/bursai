-- Create subscriptions table for Stripe integration
CREATE TABLE IF NOT EXISTS public.subscriptions (
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
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
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

-- Create trigger to update updated_at. Wrapped because
-- public.update_updated_at_column() was never created in the public schema on
-- prod (lives in storage schema only), so this trigger silently failed to
-- create on prod and doesn't exist there today. Skipping here keeps local
-- schema matching prod.
DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
  CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN undefined_function THEN NULL;
END $$;