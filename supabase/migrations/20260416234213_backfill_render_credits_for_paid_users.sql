-- Archaeology: file renamed from 20260416120001_backfill_render_credits_for_paid_users.sql
-- in commit 034fa49c (PR #419) to align with remote applied_at timestamp
-- 2026-04-16 23:42:13. Original author content in commit 0e6a3b2f
-- ("Priority 3: Add one-time render-credit backfill for existing paid
-- subscribers", 2026-04-16). Follow-up commit b97b6724 changed the
-- UPDATE to an UPSERT to handle edge-case missing render_credits rows.

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
-- Key namespace: 'backfill_<stripe_subscription_id>' — cannot collide
-- with the Stripe webhook's 'stripe_allowance_<event.id>' keys.
--
-- Handles users whose render_credits row doesn't yet exist (edge case
-- — the main-migration trigger+backfill covers every auth.users row,
-- but this function is robust regardless) via INSERT ... ON CONFLICT
-- DO UPDATE on render_credits.
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
      -- Upsert the credit row so the grant transaction always has a
      -- matching balance change. The main migration's trigger + backfill
      -- creates a render_credits row for every auth.users, so this is
      -- defensive: the INSERT path should almost never fire in practice.
      INSERT INTO render_credits (user_id, monthly_allowance)
      VALUES (r.user_id, 20)
      ON CONFLICT (user_id) DO UPDATE
        SET monthly_allowance = 20,
            updated_at = NOW();

      v_granted := v_granted + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Render-credit backfill: granted=% skipped=% (total active/trialing=%)',
    v_granted, v_skipped, v_granted + v_skipped;
END;
$$;
