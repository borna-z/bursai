-- Archaeology: file renamed from 20260416120000_render_credits.sql in
-- commit 034fa49c (PR #419) to align with remote applied_at timestamp
-- 2026-04-16 23:42:01 (when applied via MCP after pg_cron enable).
-- Original author content in commit a429cd99 ("Priority 3: Build render
-- credit ledger — tables, atomic RPCs, shared module, Stripe wiring",
-- 2026-04-16). Three follow-up commits (2bf63b1e, f1f7905c, f1b78a9e)
-- refined the migration through codex review rounds 1-3 before merge.

-- ============================================================
-- Priority 3: Render credit ledger
-- Tables, RLS, triggers, and atomic RPC functions for
-- studio-quality render credit management.
-- ============================================================

-- ─── Tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS render_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_allowance INT NOT NULL DEFAULT 0,
  used_this_period INT NOT NULL DEFAULT 0,
  reserved INT NOT NULL DEFAULT 0,
  topup_balance INT NOT NULL DEFAULT 0,
  trial_gift_remaining INT NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS render_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  render_job_id UUID,
  idempotency_key TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reserve', 'consume', 'release', 'grant', 'reset', 'trial_gift')),
  amount INT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('monthly', 'topup', 'trial_gift', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_render_credit_tx_user ON render_credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_credit_tx_job ON render_credit_transactions(render_job_id);

-- Defense-in-depth against minting: at most one terminal transaction
-- (consume or release) per render_job_id. Even if concurrent RPCs slip
-- past the PL/pgSQL row lock for any reason, the second INSERT fails and
-- its transaction rolls back, leaving balances consistent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_render_credit_tx_terminal_unique
  ON render_credit_transactions(render_job_id)
  WHERE kind IN ('consume', 'release') AND render_job_id IS NOT NULL;

-- ─── RLS ───────────────────────────────────────────────────

ALTER TABLE render_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE render_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own credits" ON render_credits;
CREATE POLICY "Users read own credits" ON render_credits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own transactions" ON render_credit_transactions;
CREATE POLICY "Users read own transactions" ON render_credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ─── Auto-init for new users ──────────────────────────────

CREATE OR REPLACE FUNCTION init_render_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO render_credits (user_id, monthly_allowance)
  VALUES (NEW.id, 0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_render_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_render_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION init_render_credits();

-- Backfill existing users
INSERT INTO render_credits (user_id, monthly_allowance)
SELECT id, 0 FROM auth.users
ON CONFLICT DO NOTHING;

-- ─── RPC: Reset period if needed ──────────────────────────
-- Advances the billing period if period_end has passed.
--
-- IMPORTANT: does NOT reset `reserved`, `trial_gift_remaining`, or
-- `topup_balance`. In-flight reservations created before rollover must
-- carry over so their eventual consume/release finds `reserved > 0` and
-- updates the source balance correctly. Resetting `reserved` at rollover
-- causes consume_credit_atomic's `WHERE reserved > 0` to no-op (user
-- gets a free render) and release_credit_atomic to over-refund the
-- trial/topup balance (mints a credit).

CREATE OR REPLACE FUNCTION reset_period_if_needed(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE render_credits
  SET
    used_this_period = 0,
    period_start = NOW(),
    period_end = NOW() + INTERVAL '1 month',
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND period_end < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RPC: Reserve credit (atomic) ─────────────────────────
-- Priority: trial_gift → monthly → topup.
-- Returns JSON: { ok: true, source: '...' } or { ok: false, reason: '...' }
-- Idempotent on idempotency_key — if already exists, returns ok without re-applying.

CREATE OR REPLACE FUNCTION reserve_credit_atomic(
  p_user_id UUID,
  p_job_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_existing RECORD;
  v_credits RECORD;
  v_source TEXT;
  v_updated INT;
BEGIN
  -- Security: only service_role may mutate the credit ledger. Defense-in-depth
  -- with the REVOKE / GRANT EXECUTE statements at the bottom of this migration.
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  -- Idempotency check
  SELECT id, source INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'source', v_existing.source, 'duplicate', true);
  END IF;

  -- Ensure period is current
  PERFORM reset_period_if_needed(p_user_id);

  -- Read current balances
  SELECT * INTO v_credits
  FROM render_credits
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_credit_row');
  END IF;

  -- Priority 1: trial_gift
  IF v_credits.trial_gift_remaining > 0 THEN
    UPDATE render_credits
    SET trial_gift_remaining = trial_gift_remaining - 1,
        reserved = reserved + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND trial_gift_remaining > 0;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      v_source := 'trial_gift';
    END IF;
  END IF;

  -- Priority 2: monthly
  IF v_source IS NULL AND (v_credits.monthly_allowance - v_credits.used_this_period - v_credits.reserved) > 0 THEN
    UPDATE render_credits
    SET reserved = reserved + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND (monthly_allowance - used_this_period - reserved) > 0;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      v_source := 'monthly';
    END IF;
  END IF;

  -- Priority 3: topup
  IF v_source IS NULL AND v_credits.topup_balance > 0 THEN
    UPDATE render_credits
    SET topup_balance = topup_balance - 1,
        reserved = reserved + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND topup_balance > 0;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      v_source := 'topup';
    END IF;
  END IF;

  -- No source could satisfy the reservation
  IF v_source IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient');
  END IF;

  -- Record the transaction
  INSERT INTO render_credit_transactions (user_id, render_job_id, idempotency_key, kind, amount, source)
  VALUES (p_user_id, p_job_id, p_idempotency_key, 'reserve', 1, v_source);

  RETURN jsonb_build_object('ok', true, 'source', v_source);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RPC: Consume credit (atomic) ─────────────────────────
-- Moves reserved → used for monthly/topup. For trial_gift, the
-- trial_gift_remaining was already decremented during reserve.

CREATE OR REPLACE FUNCTION consume_credit_atomic(
  p_user_id UUID,
  p_job_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_existing RECORD;
  v_reserve_tx RECORD;
  v_terminal_tx RECORD;
BEGIN
  -- Security: only service_role may mutate the credit ledger.
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  -- Idempotency check
  SELECT id INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  -- Acquire exclusive row lock on this user's credit row. Serializes concurrent
  -- credit mutations per user so the terminal-check + refund sequence below is
  -- race-free. Held for the duration of this RPC's transaction.
  PERFORM 1 FROM render_credits WHERE user_id = p_user_id FOR UPDATE;

  -- Guard against double-terminal: a reservation can be consumed OR released
  -- exactly once. If a terminal transaction already exists for this job under
  -- a different idempotency key, reject rather than silently no-op (or, for
  -- release, mint credits back to the source balance).
  SELECT id INTO v_terminal_tx
  FROM render_credit_transactions
  WHERE render_job_id = p_job_id
    AND user_id = p_user_id
    AND kind IN ('consume', 'release')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_terminal');
  END IF;

  -- Find the reserve transaction for this job to know the source
  SELECT source INTO v_reserve_tx
  FROM render_credit_transactions
  WHERE render_job_id = p_job_id
    AND kind = 'reserve'
    AND user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_reservation');
  END IF;

  -- Move reserved → used (only increment used_this_period for monthly source —
  -- trial_gift and topup are tracked via their own balance columns)
  IF v_reserve_tx.source = 'monthly' THEN
    UPDATE render_credits
    SET reserved = GREATEST(0, reserved - 1),
        used_this_period = used_this_period + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND reserved > 0;
  ELSE
    UPDATE render_credits
    SET reserved = GREATEST(0, reserved - 1),
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND reserved > 0;
  END IF;

  -- Record the transaction
  INSERT INTO render_credit_transactions (user_id, render_job_id, idempotency_key, kind, amount, source)
  VALUES (p_user_id, p_job_id, p_idempotency_key, 'consume', 1, v_reserve_tx.source);

  RETURN jsonb_build_object('ok', true, 'source', v_reserve_tx.source);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RPC: Release credit (atomic) ─────────────────────────
-- Returns reserved credit back to its source balance.

CREATE OR REPLACE FUNCTION release_credit_atomic(
  p_user_id UUID,
  p_job_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_existing RECORD;
  v_reserve_tx RECORD;
  v_terminal_tx RECORD;
BEGIN
  -- Security: only service_role may mutate the credit ledger.
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  -- Idempotency check
  SELECT id INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  -- Acquire exclusive row lock on this user's credit row. Serializes concurrent
  -- release/consume calls per user so two concurrent releases with different
  -- idempotency keys can't both pass the terminal check and both refund the
  -- source balance (minting credits). Held for the duration of the transaction.
  PERFORM 1 FROM render_credits WHERE user_id = p_user_id FOR UPDATE;

  -- Guard against minting: if a consume or release has already happened for
  -- this job under a different idempotency key, the source balance has either
  -- been debited (consume) or already refunded (prior release). Running the
  -- refund again would increment trial_gift_remaining / topup_balance without
  -- any outstanding reservation — creating credits out of thin air.
  SELECT id INTO v_terminal_tx
  FROM render_credit_transactions
  WHERE render_job_id = p_job_id
    AND user_id = p_user_id
    AND kind IN ('consume', 'release')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_terminal');
  END IF;

  -- Find the reserve transaction for this job
  SELECT source INTO v_reserve_tx
  FROM render_credit_transactions
  WHERE render_job_id = p_job_id
    AND kind = 'reserve'
    AND user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_reservation');
  END IF;

  -- Return credit to the source
  IF v_reserve_tx.source = 'trial_gift' THEN
    UPDATE render_credits
    SET reserved = GREATEST(0, reserved - 1),
        trial_gift_remaining = trial_gift_remaining + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF v_reserve_tx.source = 'topup' THEN
    UPDATE render_credits
    SET reserved = GREATEST(0, reserved - 1),
        topup_balance = topup_balance + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    -- monthly: just decrement reserved (used_this_period wasn't incremented yet)
    UPDATE render_credits
    SET reserved = GREATEST(0, reserved - 1),
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Record the transaction
  INSERT INTO render_credit_transactions (user_id, render_job_id, idempotency_key, kind, amount, source)
  VALUES (p_user_id, p_job_id, p_idempotency_key, 'release', 1, v_reserve_tx.source);

  RETURN jsonb_build_object('ok', true, 'source', v_reserve_tx.source);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RPC: Grant trial gift (atomic, idempotent) ───────────

CREATE OR REPLACE FUNCTION grant_trial_gift_atomic(
  p_user_id UUID,
  p_amount INT,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_existing RECORD;
BEGIN
  -- Security: only service_role may mutate the credit ledger.
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  -- Idempotency check
  SELECT id INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  UPDATE render_credits
  SET trial_gift_remaining = trial_gift_remaining + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO render_credit_transactions (user_id, idempotency_key, kind, amount, source)
  VALUES (p_user_id, p_idempotency_key, 'trial_gift', p_amount, 'trial_gift');

  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RPC: Set monthly allowance (atomic, idempotent) ──────
-- Called by Stripe webhook on subscription create/update/delete.

CREATE OR REPLACE FUNCTION set_monthly_allowance_atomic(
  p_user_id UUID,
  p_allowance INT,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_existing RECORD;
BEGIN
  -- Security: only service_role may mutate the credit ledger.
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  -- Idempotency check
  SELECT id INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  UPDATE render_credits
  SET monthly_allowance = p_allowance,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO render_credit_transactions (user_id, idempotency_key, kind, amount, source)
  VALUES (p_user_id, p_idempotency_key, 'grant', p_allowance, 'admin');

  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Batch period reset (pg_cron target) ──────────────────
-- Hourly cron invokes this to advance any expired periods system-wide,
-- so lazy reset-on-read isn't load-bearing and client-side RLS-protected
-- reads against render_credits stay fresh.

CREATE OR REPLACE FUNCTION reset_expired_periods_batch()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE render_credits
  SET used_this_period = 0,
      period_start = NOW(),
      period_end = NOW() + INTERVAL '1 month',
      updated_at = NOW()
  WHERE period_end < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Schedule hourly period reset ─────────────────────────
-- pg_cron runs as the postgres superuser so privilege checks are bypassed.
SELECT cron.schedule(
  'reset-render-credit-periods',
  '0 * * * *',
  'SELECT reset_expired_periods_batch();'
);

-- ─── Lockdown: revoke public execute, grant only to service_role ─
-- Defense-in-depth with the `auth.role() = service_role` checks inside
-- each mutation function. Without these, any authenticated user could
-- call supabase.rpc('set_monthly_allowance_atomic', ...) from the
-- browser and grant themselves unlimited credits.

REVOKE ALL ON FUNCTION reserve_credit_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION consume_credit_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_credit_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION grant_trial_gift_atomic(UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_monthly_allowance_atomic(UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reset_period_if_needed(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reset_expired_periods_batch() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION reserve_credit_atomic(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION consume_credit_atomic(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION release_credit_atomic(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION grant_trial_gift_atomic(UUID, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION set_monthly_allowance_atomic(UUID, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION reset_period_if_needed(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION reset_expired_periods_batch() TO service_role;
