-- Archaeology: file renamed from 20260416233226_reserve_credit_replay_flag.sql
-- in commit 034fa49c (PR #419) to align with remote applied_at timestamp
-- 2026-04-16 23:42:30 (the reapply, after P3 catch-up's CREATE OR REPLACE
-- temporarily overwrote this function back to the `duplicate:true` variant).
-- Original author content in commit 0d53a52d ("Priority 4: Fix codex
-- review — reserve replay flag + restore prior state on unclaim",
-- 2026-04-16). Companion file 20260416233654_reserve_credit_replay_flag.sql
-- records the first (pre-catch-up) apply.

-- ============================================================
-- Priority 4 codex round 1 — reserve_credit_atomic replay flag
--
-- Prior behaviour returned `{ ok: true, duplicate: true, source }` on
-- idempotency-hit and `{ ok: true, source }` on fresh reserves. Both
-- paths set `ok: true`, so callers couldn't distinguish "I just made
-- this reservation" from "you already have this reservation from
-- earlier." render_garment_image treated the replay case as a fresh
-- reserve and re-ran Gemini, wasting quota AND leaving a trailing
-- consume call that could silently fail against an already-terminal
-- job — effectively producing a free render.
--
-- This migration replaces the CREATE OR REPLACE for
-- reserve_credit_atomic, adding `replay: true|false` on the success
-- branch. Fresh reserves return replay=false, idempotency hits return
-- replay=true. All other semantics are identical.
--
-- Security role guard, FOR UPDATE lock, partial unique index, and
-- priority order (trial_gift → monthly → topup) are unchanged.
-- ============================================================

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
  -- Security: only service_role may mutate the credit ledger.
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required for credit ledger mutations';
  END IF;

  -- Idempotency check — return replay: true if the key already exists.
  SELECT id, source INTO v_existing
  FROM render_credit_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'source', v_existing.source,
      'replay', true
    );
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

  RETURN jsonb_build_object(
    'ok', true,
    'source', v_source,
    'replay', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- REVOKE/GRANT are idempotent and already in place from the original migration,
-- but re-applying is safe and makes this migration complete on its own.
REVOKE ALL ON FUNCTION reserve_credit_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_credit_atomic(UUID, UUID, TEXT) TO service_role;
