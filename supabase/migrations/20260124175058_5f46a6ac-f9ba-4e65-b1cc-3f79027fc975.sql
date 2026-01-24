-- Create subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'premium');

-- Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  garments_count INTEGER NOT NULL DEFAULT 0,
  outfits_used_month INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own subscription"
ON public.user_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
ON public.user_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- Create subscription on user signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan)
  VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Function to update garments_count when garments change
CREATE OR REPLACE FUNCTION public.update_garments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count_val INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_subscriptions
    SET garments_count = garments_count + 1, updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_subscriptions
    SET garments_count = GREATEST(0, garments_count - 1), updated_at = now()
    WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_garment_change
  AFTER INSERT OR DELETE ON public.garments
  FOR EACH ROW EXECUTE FUNCTION public.update_garments_count();

-- Function to increment outfits_used_month when outfit created
CREATE OR REPLACE FUNCTION public.increment_outfits_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET 
    outfits_used_month = CASE 
      WHEN period_start < date_trunc('month', now()) THEN 1
      ELSE outfits_used_month + 1
    END,
    period_start = CASE 
      WHEN period_start < date_trunc('month', now()) THEN date_trunc('month', now())
      ELSE period_start
    END,
    updated_at = now()
  WHERE user_id = NEW.user_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_outfit_created
  AFTER INSERT ON public.outfits
  FOR EACH ROW EXECUTE FUNCTION public.increment_outfits_used();

-- Add trigger for updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();