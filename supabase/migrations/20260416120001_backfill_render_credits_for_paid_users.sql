-- ============================================================
-- One-time backfill: grant 20 monthly render credits to users
-- who are already on an active/trialing paid subscription.
--
-- Bypasses set_monthly_allowance_atomic() because that RPC's role
-- guard (auth.role() = 'service_role') would reject the migration
-- runner's context (auth.role() is NULL when no JWT is present).
-- The migration runs as the postgres superuser, which has direct
-- write access to render_credits and render_credit_transactions.
--
-- Idempotent via the UNIQUE constraint on render_credit_transactions
-- .idempotency_key — re-running this migration (or an overlapping
-- Stripe webhook) is safe: the INSERT ... ON CONFLICT DO NOTHING
-- skips rows that already have a backfill transaction recorded.
--
-- Without this backfill, every existing paid user sees 0 credits
-- until their next Stripe webhook event (renewal, plan change, etc).
-- ============================================================

DO $$
DECLARE
  r RECORD;
  v_key TEXT;
  v_inserted BOOLEAN;
  v_granted INT := 0;
  v_skipped INT := 0;
BEGIN
  FOR r IN
    SELECT user_id, stripe_subscription_id
    FROM subscriptions
    WHERE plan = 'premium'
      AND status IN ('active', 'trialing')
      AND stripe_subscription_id IS NOT NULL
  LOOP
    v_key := 'backfill_' || r.stripe_subscription_id;

    -- Atomically try to claim this backfill via the transaction log.
    -- Unique constraint on idempotency_key makes the claim race-free.
    INSERT INTO render_credit_transactions (user_id, idempotency_key, kind, amount, source)
    VALUES (r.user_id, v_key, 'grant', 20, 'admin')
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING TRUE INTO v_inserted;

    IF v_inserted IS TRUE THEN
      UPDATE render_credits
      SET monthly_allowance = 20,
          updated_at = NOW()
      WHERE user_id = r.user_id;

      v_granted := v_granted + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Render-credit backfill: granted=% skipped=% (total active/trialing=%)',
    v_granted, v_skipped, v_granted + v_skipped;
END;
$$;
