-- ============================================================
-- CFO Sprint Patch 1: Core billing tables
-- Tables: billing_accounts, usage_periods, render_boosts, usage_events
-- ============================================================

-- --------------------------------------------------------
-- 1. billing_accounts
--    One row per user. Source of truth for current plan,
--    RevenueCat customer ID, and store metadata.
-- --------------------------------------------------------
CREATE TABLE public.billing_accounts (
    user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    plan          TEXT NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free', 'plus', 'pro')),
    rc_customer_id TEXT,                          -- RevenueCat customer ID
    rc_entitlement TEXT,                          -- active RevenueCat entitlement ID
    store         TEXT CHECK (store IS NULL OR store IN ('app_store', 'play_store', 'stripe', 'promotional')),
    product_id    TEXT,                           -- SKU: burs_plus_monthly, burs_pro_monthly, etc.
    is_sandbox    BOOLEAN NOT NULL DEFAULT FALSE, -- sandbox/test purchases
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing account"
    ON public.billing_accounts FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role handles inserts/updates from webhook

-- Auto-create billing_account on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_billing_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.billing_accounts (user_id, plan)
    VALUES (NEW.id, 'free')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_billing_account
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_billing_account();

-- updated_at trigger
CREATE TRIGGER update_billing_accounts_updated_at
    BEFORE UPDATE ON public.billing_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Index for RevenueCat webhook lookups
CREATE INDEX idx_billing_accounts_rc_customer
    ON public.billing_accounts(rc_customer_id)
    WHERE rc_customer_id IS NOT NULL;


-- --------------------------------------------------------
-- 2. usage_periods
--    One row per billing cycle per user.
--    Holds per-feature usage counters and render balance.
-- --------------------------------------------------------
CREATE TABLE public.usage_periods (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_start  TIMESTAMPTZ NOT NULL,
    period_end    TIMESTAMPTZ NOT NULL,
    plan_snapshot TEXT NOT NULL DEFAULT 'free'
                  CHECK (plan_snapshot IN ('free', 'plus', 'pro')),

    -- Per-feature counters (increment on use)
    style_me_used       INTEGER NOT NULL DEFAULT 0,
    mood_outfit_used    INTEGER NOT NULL DEFAULT 0,
    stylist_replies_used INTEGER NOT NULL DEFAULT 0,
    renders_used        INTEGER NOT NULL DEFAULT 0,

    -- Plan-granted render allowance for this period
    renders_granted     INTEGER NOT NULL DEFAULT 0,

    -- Boost-purchased renders added to this period
    renders_boosted     INTEGER NOT NULL DEFAULT 0,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One active period per user at any time
    CONSTRAINT uq_usage_periods_user_range
        UNIQUE (user_id, period_start)
);

ALTER TABLE public.usage_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage periods"
    ON public.usage_periods FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role handles inserts/updates

CREATE INDEX idx_usage_periods_user_current
    ON public.usage_periods(user_id, period_end DESC);

CREATE TRIGGER update_usage_periods_updated_at
    BEFORE UPDATE ON public.usage_periods
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


-- --------------------------------------------------------
-- 3. render_boosts
--    IAP purchase log. Each row = one boost pack purchase.
--    Links to the usage_period it was applied to.
-- --------------------------------------------------------
CREATE TABLE public.render_boosts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_period_id UUID NOT NULL REFERENCES public.usage_periods(id) ON DELETE CASCADE,
    sku             TEXT NOT NULL CHECK (sku IN ('burs_render_boost_25', 'burs_render_boost_60')),
    renders_added   INTEGER NOT NULL CHECK (renders_added > 0),
    store           TEXT NOT NULL CHECK (store IN ('app_store', 'play_store', 'stripe', 'promotional')),
    store_tx_id     TEXT,            -- store transaction ID for dedup
    is_sandbox      BOOLEAN NOT NULL DEFAULT FALSE,
    purchased_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.render_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own render boosts"
    ON public.render_boosts FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role handles inserts

-- Dedup index on store transaction ID
CREATE UNIQUE INDEX idx_render_boosts_store_tx
    ON public.render_boosts(store_tx_id)
    WHERE store_tx_id IS NOT NULL;

CREATE INDEX idx_render_boosts_user_period
    ON public.render_boosts(user_id, usage_period_id);


-- --------------------------------------------------------
-- 4. usage_events
--    Immutable audit log. One row per usage action.
--    Used for analytics, debugging, and quota verification.
-- --------------------------------------------------------
CREATE TABLE public.usage_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_period_id UUID REFERENCES public.usage_periods(id) ON DELETE SET NULL,
    event_type    TEXT NOT NULL
                  CHECK (event_type IN (
                      'style_me', 'mood_outfit', 'stylist_reply',
                      'render', 'garment_add', 'garment_remove'
                  )),
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage events"
    ON public.usage_events FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage events"
    ON public.usage_events FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Service role also inserts from edge functions

CREATE INDEX idx_usage_events_user_period
    ON public.usage_events(user_id, usage_period_id, event_type);

CREATE INDEX idx_usage_events_created
    ON public.usage_events(created_at DESC);
